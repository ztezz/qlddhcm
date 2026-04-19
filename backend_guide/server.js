
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
import spatialRouter from './routes_spatial.js';
import authRouter from './routes_auth.js';
import userRouter from './routes_users.js';
import configRouter from './routes_config.js';
import mapAdminRouter from './routes_map_admin.js';
import statsRouter from './routes_stats.js';
import messageRouter from './routes_messages.js';
import notificationRouter from './routes_notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const { Pool } = pg;
const pool = new Pool({ ...dbConfig, connectionTimeoutMillis: 10000 });
const port = 3004;

// Khởi tạo Express App
const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-name', 'x-branch-id'] }));
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
    try {
        await pool.query('SELECT 1');
        
        await pool.query(`ALTER TABLE wms_layers ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'WMS'`);
        await pool.query(`ALTER TABLE wms_layers ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'STANDARD'`);
        await pool.query(`ALTER TABLE wms_layers ADD COLUMN IF NOT EXISTS map_scope TEXT DEFAULT 'MAIN'`);
        await pool.query(`ALTER TABLE wms_layers ADD COLUMN IF NOT EXISTS opacity NUMERIC DEFAULT 1`);
        await pool.query(`ALTER TABLE wms_layers ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`);
        await pool.query(`ALTER TABLE wms_layers ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE basemaps ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE basemaps ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                role TEXT PRIMARY KEY,
                permissions TEXT[] DEFAULT ARRAY[]::TEXT[]
            )
        `);

        // Đảm bảo bảng tin nhắn có cột is_deleted và deleted_at
        await pool.query(`
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
        `);
        await pool.query(`ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`);
        await pool.query(`ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL`);

        console.log("🚀 Database Schema Verified & Initialized");
        
        cleanupOldTrash();
        setInterval(cleanupOldTrash, 86400000);

    } catch (e) { 
        console.error("❌ Init DB Critical Error:", e.message); 
    }
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
app.use('/api/proxy', proxyRouter);

app.get('/health', (req, res) => res.json({ status: 'OK', db: 'Connected' }));

const server = app.listen(port, '0.0.0.0', () => { 
    console.log(`✅ GeoMaster Enterprise API is alive on port ${port}`); 
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} already in use.`);
        process.exit(1);
    }
});
