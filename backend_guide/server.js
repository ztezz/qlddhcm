
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
import blogRouter from './routes_blog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const { Pool } = pg;
const pool = new Pool({ ...dbConfig, connectionTimeoutMillis: 10000 });
const port = 3004;

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
    try {
        await pool.query('SELECT 1');

        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT`);
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (LOWER(username)) WHERE username IS NOT NULL`);

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

        await pool.query(`
            CREATE TABLE IF NOT EXISTS blog_posts (
                id BIGSERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                summary TEXT NOT NULL,
                content_html TEXT NOT NULL,
                cover_image TEXT DEFAULT '',
                tags TEXT[] DEFAULT ARRAY[]::TEXT[],
                author_id TEXT NOT NULL,
                author_name TEXT NOT NULL,
                publish_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_deleted BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS publish_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await pool.query(`UPDATE blog_posts SET publish_at = COALESCE(publish_at, created_at, NOW()) WHERE publish_at IS NULL`);

        await pool.query(`
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
        `);

        await pool.query(`
            INSERT INTO menu_items (id, label, icon, roles, order_index, is_active, type, url)
            VALUES ('blog-gis', 'Blog GIS', 'BookOpen', ARRAY['GUEST','VIEWER','EDITOR','ADMIN']::TEXT[], 9, true, 'INTERNAL', '/bloggis')
            ON CONFLICT (id) DO UPDATE
            SET label = EXCLUDED.label,
                icon = EXCLUDED.icon,
                url = EXCLUDED.url,
                type = EXCLUDED.type,
                is_active = true
        `);

        const blogCountResult = await pool.query(`SELECT COUNT(*)::int AS total FROM blog_posts WHERE is_deleted = false`);
        if ((blogCountResult.rows?.[0]?.total || 0) === 0) {
            await pool.query(`
                INSERT INTO blog_posts (title, summary, content_html, cover_image, tags, author_id, author_name)
                VALUES
                (
                    'Tổng quan WebGIS trong quản lý đất đai hiện đại',
                    'Bài viết giới thiệu cách WebGIS giúp chuẩn hóa dữ liệu, tăng tốc truy vấn và phối hợp liên phòng ban.',
                    '<p>WebGIS không chỉ là bản đồ trực tuyến, mà còn là <strong>hệ điều hành dữ liệu không gian</strong> cho cơ quan quản lý đất đai.</p><p>Khi triển khai đúng kiến trúc, WebGIS giúp:</p><ul><li>Chuẩn hóa lớp dữ liệu nền giữa các bộ phận</li><li>Truy vấn thửa đất và lịch sử biến động nhanh hơn</li><li>Rút ngắn thời gian lập hồ sơ nghiệp vụ</li></ul><p>Đây là bước quan trọng để tiến tới quản trị đất đai theo hướng dữ liệu số nhất quán.</p>',
                    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80',
                    ARRAY['webgis', 'quan-ly-dat-dai', 'chuyen-doi-so'],
                    'system',
                    'Hệ thống GIS'
                ),
                (
                    '5 nguyên tắc xây dựng dữ liệu không gian sạch cho dự án GIS',
                    'Tập trung vào quy tắc đặt mã, chuẩn thuộc tính và kiểm tra chất lượng trước khi xuất bản lớp dữ liệu.',
                    '<p>Muốn bản đồ vận hành ổn định, dữ liệu đầu vào phải sạch và đồng nhất.</p><p>Năm nguyên tắc cốt lõi:</p><ol><li>Đặt mã định danh thống nhất cho từng đối tượng</li><li>Quy ước tên trường theo chuẩn chung</li><li>Kiểm tra topology định kỳ</li><li>Quản lý phiên bản cập nhật rõ ràng</li><li>Thiết lập quy trình nghiệm thu trước khi publish</li></ol><p>Thực hiện đủ năm bước này sẽ giảm đáng kể lỗi hiển thị và sai lệch báo cáo.</p>',
                    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80',
                    ARRAY['du-lieu-khong-gian', 'data-quality', 'gis-ops'],
                    'system',
                    'Hệ thống GIS'
                )
            `);
        }

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
app.use('/api', blogRouter(pool));
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
