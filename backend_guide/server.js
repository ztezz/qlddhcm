
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)) });
import dbConfig from './db_config.js';

// Import New Routers
import proxyRouter from './routes_proxy.js';
import spatialRouter, { syncRegisteredSpatialTables } from './routes_spatial.js';
import authRouter from './routes_auth.js';
import userRouter from './routes_users.js';
import configRouter from './routes_config.js';
import mapAdminRouter from './routes_map_admin.js';
import statsRouter from './routes_stats.js';
import messageRouter from './routes_messages.js';
import notificationRouter from './routes_notifications.js';
import conversionRouter from './routes_conversion.js';
import parcelHistoryRouter from './routes_parcel_history.js';
import aiRouter from './routes_ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = process.env.UPLOAD_DIR || (process.platform !== 'win32' && fs.existsSync('/data') ? '/data/uploads' : path.join(__dirname, 'uploads'));
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const { Pool } = pg;
const connectionErrorCodes = new Set([
    '57P01', // admin_shutdown
    '57P02', // crash_shutdown
    '57P03', // cannot_connect_now
    '08000', // connection_exception
    '08003', // connection_does_not_exist
    '08006', // connection_failure
    '53300', // too_many_connections
]);
const connectionErrorMessages = [
    'connection terminated',
    'connection timeout',
    'timeout exceeded when trying to connect',
    'connection ended unexpectedly',
    'terminating connection',
    'server closed the connection',
    'client has encountered a connection error',
    'read econnreset',
    'write econnreset',
    'econnrefused',
    'etimedout',
    'socket hang up',
];

const isConnectionError = (error) => {
    const code = String(error?.code || '').toUpperCase();
    const message = String(error?.message || '').toLowerCase();
    return connectionErrorCodes.has(code) || connectionErrorMessages.some((text) => message.includes(text));
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pool = new Pool({
    ...dbConfig,
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
    maxLifetimeSeconds: Number(process.env.PG_MAX_LIFETIME_SECONDS || 300),
    keepAlive: true,
    keepAliveInitialDelayMillis: Number(process.env.PG_KEEPALIVE_INITIAL_DELAY_MS || 10000),
});

pool.on('error', (error) => {
    console.warn('[DB Pool] Idle client error, client will be replaced:', error.message);
});

const originalPoolQuery = pool.query.bind(pool);
pool.query = async (...args) => {
    try {
        return await originalPoolQuery(...args);
    } catch (error) {
        if (!isConnectionError(error)) throw error;
        console.warn('[DB Pool] Query failed due to connection loss, retrying once:', error.message);
        await delay(300);
        return originalPoolQuery(...args);
    }
};

const originalPoolConnect = pool.connect.bind(pool);
pool.connect = (...args) => {
    if (typeof args[0] === 'function') {
        return originalPoolConnect(...args);
    }

    return connectWithRetry();
};

const connectWithRetry = async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        let client;
        try {
            client = await originalPoolConnect();
        } catch (error) {
            if (!isConnectionError(error) || attempt === 1) throw error;
            console.warn('[DB Pool] Connect failed, retrying:', error.message);
            await delay(300);
            continue;
        }

        try {
            await client.query('SELECT 1');
            return client;
        } catch (error) {
            client.release(true);
            if (!isConnectionError(error) || attempt === 1) throw error;
            console.warn('[DB Pool] Dropped stale client, reconnecting:', error.message);
            await delay(300);
        }
    }
};
const port = process.env.PORT || (process.env.SPACE_ID ? 7860 : 3004);

// Khởi tạo Express App
const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-name', 'x-branch-id', 'x-user-role'] }));
app.use(express.json({ limit: '50mb' }));
app.enable('trust proxy');

app.use('/uploads', express.static(uploadDir, {
    setHeaders: (res) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
}));

const logSystemAction = async (req, action, details, overrideUser = null) => {
    try {
        const userId = overrideUser ? overrideUser.id : (req.headers['x-user-id'] || 'system');
        const userName = overrideUser ? overrideUser.name : (decodeURIComponent(req.headers['x-user-name'] || 'System'));
        await pool.query(`INSERT INTO system_logs (user_id, user_name, action, details) VALUES ($1, $2, $3, $4)`, [userId, userName, action, details]);
    } catch (e) { console.error("Log error:", e.message); }
};

// Hàm dọn dẹp thư rác quá 30 ngày
const cleanupOldTrash = async () => {
    try {
        const result = await pool.query(`
            DELETE FROM internal_messages 
            WHERE is_deleted = true 
            AND deleted_at < NOW() - INTERVAL '30 days'
        `);
        if (result.rowCount > 0) {
            console.log(`[Auto Cleanup] Đã xóa vĩnh viễn ${result.rowCount} thư rác cũ hơn 30 ngày.`);
        }
    } catch (e) {
        console.error("[Auto Cleanup Error]", e.message);
    }
};

const initDB = async () => {
    // Helper: chạy từng migration riêng, lỗi chỉ log — không dừng toàn bộ
    const run = async (label, fn) => {
        try {
            await fn();
        } catch (e) {
            console.warn(`[initDB] Bỏ qua bước "${label}": ${e.message}`);
        }
    };

    try {
        await pool.query('SELECT 1');
    } catch (e) {
        console.error('❌ Init DB Critical Error: Không kết nối được DB:', e.message);
        return;
    }

    // Tạo lại function cap_nhat_madinhdanh_phuc_hop trước tiên
    // Event trigger trong DB tự động gắn trigger này vào mọi CREATE TABLE mới.
    // Nếu function bị mất, mọi CREATE TABLE sẽ thất bại.
    await run('create function cap_nhat_madinhdanh_phuc_hop', () => pool.query(`
        CREATE OR REPLACE FUNCTION cap_nhat_madinhdanh_phuc_hop()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        DECLARE
            has_madinhdanh BOOLEAN;
            has_geometry   BOOLEAN;
        BEGIN
            -- Kiểm tra bảng có cột madinhdanh và geometry không
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = TG_TABLE_NAME AND column_name = 'madinhdanh'
            ) INTO has_madinhdanh;

            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = TG_TABLE_NAME AND column_name = 'geometry'
            ) INTO has_geometry;

            -- Không đọc NEW.geometry nếu bảng không có cột geometry.
            -- Nếu đọc trực tiếp trên bảng như parcel_history sẽ lỗi: record "new" has no field "geometry".
            IF NOT has_madinhdanh OR NOT has_geometry THEN
                RETURN NEW;
            END IF;

            IF NEW.geometry IS NOT NULL THEN
                NEW.madinhdanh := ST_GeoHash(ST_Transform(ST_Centroid(NEW.geometry), 4326), 12);
            END IF;

            RETURN NEW;
        END;
        $$
    `));

    await run('users: add username', () => pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT`));
    await run('users: add last_notification_read_at', () => pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_notification_read_at TIMESTAMPTZ`));
    await run('users: unique index username', () => pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (LOWER(username)) WHERE username IS NOT NULL`));

    await run('wms_layers: add type', () => pool.query(`ALTER TABLE wms_layers ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'WMS'`));
    await run('wms_layers: add category', () => pool.query(`ALTER TABLE wms_layers ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'STANDARD'`));
    await run('wms_layers: add map_scope', () => pool.query(`ALTER TABLE wms_layers ADD COLUMN IF NOT EXISTS map_scope TEXT DEFAULT 'MAIN'`));
    await run('wms_layers: add opacity', () => pool.query(`ALTER TABLE wms_layers ADD COLUMN IF NOT EXISTS opacity NUMERIC DEFAULT 1`));
    await run('wms_layers: add description', () => pool.query(`ALTER TABLE wms_layers ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`));
    await run('wms_layers: add sort_order', () => pool.query(`ALTER TABLE wms_layers ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`));
    await run('basemaps: add sort_order', () => pool.query(`ALTER TABLE basemaps ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`));
    await run('basemaps: add description', () => pool.query(`ALTER TABLE basemaps ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`));

    await run('create role_permissions', () => pool.query(`
        CREATE TABLE IF NOT EXISTS role_permissions (
            role TEXT PRIMARY KEY,
            permissions TEXT[] DEFAULT ARRAY[]::TEXT[]
        )
    `));

    await run('create internal_messages', () => pool.query(`
        CREATE TABLE IF NOT EXISTS internal_messages (
            id SERIAL PRIMARY KEY,
            sender_id TEXT REFERENCES users(id) ON DELETE CASCADE,
            receiver_id TEXT REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP DEFAULT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `));
    await run('internal_messages: add is_deleted', () => pool.query(`ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`));
    await run('internal_messages: add deleted_at', () => pool.query(`ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL`));

    await run('create menu_items', () => pool.query(`
        CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            icon TEXT NOT NULL,
            roles TEXT[] DEFAULT ARRAY['GUEST','VIEWER','EDITOR','ADMIN']::TEXT[],
            order_index INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            type TEXT DEFAULT 'INTERNAL',
            url TEXT DEFAULT ''
        )
    `));

    // Bảng lịch sử biến động thửa đất
    await run('create parcel_history', () => pool.query(`
        CREATE TABLE IF NOT EXISTS parcel_history (
            id              SERIAL PRIMARY KEY,
            table_name      TEXT NOT NULL,
            parcel_gid      INTEGER NOT NULL,
            action          TEXT NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE')),
            snapshot        JSONB,
            snapshot_before JSONB,
            snapshot_after  JSONB,
            changed_by_id   TEXT,
            changed_by_name TEXT,
            changed_at      TIMESTAMPTZ DEFAULT NOW(),
            note            TEXT
        )
    `));
    await run('parcel_history: add snapshot_before', () => pool.query(`ALTER TABLE parcel_history ADD COLUMN IF NOT EXISTS snapshot_before JSONB`));
    await run('parcel_history: add snapshot_after', () => pool.query(`ALTER TABLE parcel_history ADD COLUMN IF NOT EXISTS snapshot_after JSONB`));
    await run('parcel_history: index table_gid', () => pool.query(`CREATE INDEX IF NOT EXISTS parcel_history_table_gid_idx  ON parcel_history (table_name, parcel_gid)`));
    await run('parcel_history: index changed_at', () => pool.query(`CREATE INDEX IF NOT EXISTS parcel_history_changed_at_idx ON parcel_history (changed_at DESC)`));
    await run('parcel_history: remove geohash triggers', async () => {
        await pool.query(`DROP TRIGGER IF EXISTS trg_cap_nhat_madinhdanh_insert_parcel_history ON parcel_history`);
        await pool.query(`DROP TRIGGER IF EXISTS trg_cap_nhat_madinhdanh_update_parcel_history ON parcel_history`);
    });

    console.log('🚀 Database Schema Verified & Initialized');

    try {
        const syncSummary = await syncRegisteredSpatialTables(pool);
        if (syncSummary.total > 0) {
            console.log(`[Startup Sync] Đã đồng bộ ${syncSummary.synced.length}/${syncSummary.total} bảng đã đăng ký.`);
        }
        if (syncSummary.failed.length > 0) {
            console.warn('[Startup Sync] Một số bảng đồng bộ thất bại:', syncSummary.failed);
        }
    } catch (syncError) {
        console.error('[Startup Sync] Lỗi đồng bộ bảng đã đăng ký:', syncError.message);
    }

    cleanupOldTrash();
    setInterval(cleanupOldTrash, 86400000);
};
initDB();

// Truyền pool và logger vào routes, không truyền transporter nữa
app.use('/api/auth', authRouter(pool, logSystemAction));
app.use('/api/users', userRouter(pool, logSystemAction));
app.use('/api/stats', statsRouter(pool));
app.use('/api/messages', messageRouter(pool));
app.use('/api/notifications', notificationRouter(pool));
app.use('/api', configRouter(pool, logSystemAction)); 
app.use('/api', mapAdminRouter(pool, logSystemAction, dbConfig));
app.use('/api', spatialRouter(pool, logSystemAction));
app.use('/api', conversionRouter(pool, logSystemAction));
app.use('/api/parcel-history', parcelHistoryRouter(pool, logSystemAction));
app.use('/api/ai', aiRouter(pool, logSystemAction));
app.use('/api/proxy', proxyRouter);

app.get('/', (req, res) => {
    res.json({
        message: "Hệ thống GeoMaster Enterprise API đang hoạt động bình thường.",
        status: "OK",
        version: "1.0.0",
        timestamp: new Date().toISOString()
    });
});

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'OK', db: 'Connected' });
    } catch (error) {
        res.status(503).json({ status: 'ERROR', db: 'Disconnected', message: error.message });
    }
});

const server = app.listen(port, '0.0.0.0', () => { 
    console.log(`✅ GeoMaster Enterprise API is alive on port ${port}`); 
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} already in use.`);
        process.exit(1);
    }
});
