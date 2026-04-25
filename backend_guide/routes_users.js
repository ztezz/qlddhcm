
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thư mục upload tuyệt đối trên VPS
const uploadPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

// Cấu hình lưu trữ Avatar
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const userId = req.params.id || 'unknown';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `avatar-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

export default function(pool, logSystemAction) {
    const router = express.Router();

    // --- LẤY DANH SÁCH USER ---
    router.get('/', async (req, res) => { 
        try {
            const r = await pool.query(`SELECT id, email, username, name, role, branch_id as "branchId", is_verified, can_chat, avatar FROM users ORDER BY name ASC`); 
            res.json(r.rows); 
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- LẤY CHI TIẾT USER (DÙNG ĐỂ ĐỒNG BỘ) ---
    router.get('/:id', async (req, res) => {
        try {
            const r = await pool.query(`SELECT id, email, username, name, role, branch_id as "branchId", is_verified, can_chat, avatar FROM users WHERE id = $1`, [req.params.id]);
            if (r.rows.length === 0) return res.status(404).json({ error: "User not found" });
            // Quan trọng: Gửi header chống cache cho API profile
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private'); 
            res.json(r.rows[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- TẠO USER MỚI (ADMIN) ---
    router.post('/', async (req, res) => {
        const { name, email, username, password, role, branchId, is_verified, can_chat } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'Thiếu name, email hoặc password.' });
        try {
            if (username) {
                const dupCheck = await pool.query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, [username]);
                if (dupCheck.rows.length > 0) return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại.' });
            }
            const emailCheck = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
            if (emailCheck.rows.length > 0) return res.status(400).json({ error: 'Email đã tồn tại.' });
            const id = 'u-' + Date.now();
            const r = await pool.query(
                `INSERT INTO users (id, email, username, password_hash, name, role, branch_id, is_verified, can_chat)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING id, email, username, name, role, branch_id as "branchId", is_verified, can_chat, avatar`,
                [id, email, username || null, password, name, role || 'VIEWER', branchId || null, is_verified ?? true, can_chat ?? true]
            );
            await logSystemAction(req, 'CREATE_USER', `Admin tạo tài khoản mới: ${email}`);
            res.status(201).json(r.rows[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- CẬP NHẬT HỒ SƠ & AVATAR (XÓA FILE CŨ ĐỂ TIẾT KIỆM) ---
    router.put('/:id/profile', upload.single('avatar'), async (req, res) => {
        const { id } = req.params;
        const { name, username } = req.body;
        try {
            // 1. Tìm đường dẫn file cũ trong DB
            const userRes = await pool.query(`SELECT avatar FROM users WHERE id = $1`, [id]);
            const oldAvatarUrl = userRes.rows[0]?.avatar;

            let avatarUrl = null;
            const avatarFile = req.file;
            if (avatarFile) {
                avatarUrl = `/uploads/${avatarFile.filename}`;

                // 2. Nếu có ảnh cũ, tiến hành xóa file vật lý trên ổ đĩa VPS
                if (oldAvatarUrl && oldAvatarUrl.startsWith('/uploads/')) {
                    const fileName = path.basename(oldAvatarUrl);
                    const oldFilePath = path.join(uploadPath, fileName);
                    
                    if (fs.existsSync(oldFilePath)) {
                        try {
                            fs.unlinkSync(oldFilePath);
                            console.log(`[VPS] Deleted old avatar file: ${oldFilePath}`);
                        } catch (err) {
                            console.error(`[VPS Error] Could not unlink file: ${err.message}`);
                        }
                    }
                }
            }

            // 3. Cập nhật DB
            let query = `UPDATE users SET name = $1`;
            const params = [name];
            if (username !== undefined) {
                params.push(username || null);
                query += `, username = $${params.length}`;
            }
            if (avatarUrl) {
                params.push(avatarUrl);
                query += `, avatar = $${params.length}`;
            }
            params.push(id);
            query += ` WHERE id = $${params.length}`;
            
            const result = await pool.query(query + ` RETURNING id, name, username, avatar, email, role, branch_id as "branchId", can_chat`, params);
            await logSystemAction(req, 'UPDATE_PROFILE', `User ${id} cập nhật hồ sơ`);
            res.json(result.rows[0]);
        } catch (e) { 
            // Cleanup: Nếu có file mới vừa upload mà DB lỗi, xóa file đó đi
            const avatarFile = req.file;
            if (avatarFile && fs.existsSync(avatarFile.path)) {
                try {
                    fs.unlinkSync(avatarFile.path);
                } catch (err) {}
            }
            res.status(500).json({ error: e.message }); 
        }
    });

    // --- ĐỔI MẬT KHẨU ---
    router.put('/:id/change-password', async (req, res) => {
        const { oldPassword, newPassword } = req.body;
        try {
            const check = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.params.id]);
            if (check.rows[0].password_hash !== oldPassword) return res.status(400).json({ error: "Mật khẩu cũ không đúng" });
            await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newPassword, req.params.id]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- RESET PASSWORD (ADMIN) ---
    router.put('/:id/reset-password', async (req, res) => {
        const { password } = req.body;
        try {
            await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [password, req.params.id]);
            await logSystemAction(req, 'RESET_PASSWORD', `Admin đặt lại mật khẩu cho user ${req.params.id}`);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- HẠN CHẾ CHAT ---
    router.put('/:id/chat-restriction', async (req, res) => {
        const { canChat } = req.body;
        try {
            await pool.query(`UPDATE users SET can_chat = $1 WHERE id = $2`, [canChat, req.params.id]);
            await logSystemAction(req, 'TOGGLE_CHAT', `Thay đổi quyền chat của user ${req.params.id} thành ${canChat}`);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- CẬP NHẬT THÔNG TIN ADMIN (ROLE, BRANCH, IS_VERIFIED, NAME, EMAIL, USERNAME) ---
    router.put('/:id', async (req, res) => {
        const { id } = req.params;
        const { name, email, username, role, branchId, is_verified, can_chat } = req.body;
        try {
            if (username != null) {
                const dupCheck = await pool.query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2`, [username, id]);
                if (dupCheck.rows.length > 0) return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại.' });
            }
            const r = await pool.query(
                `UPDATE users SET
                    name        = COALESCE($1, name),
                    email       = COALESCE($2, email),
                    username    = CASE WHEN $3::text IS DISTINCT FROM '__SKIP__' THEN $3 ELSE username END,
                    role        = COALESCE($4, role),
                    branch_id   = COALESCE($5, branch_id),
                    is_verified = COALESCE($6, is_verified),
                    can_chat    = COALESCE($7, can_chat)
                 WHERE id = $8
                 RETURNING id, email, username, name, role, branch_id as "branchId", is_verified, can_chat, avatar`,
                [name ?? null, email ?? null, username !== undefined ? (username || null) : '__SKIP__',
                 role ?? null, branchId ?? null, is_verified ?? null, can_chat ?? null, id]
            );
            if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
            await logSystemAction(req, 'UPDATE_USER', `Admin cập nhật thông tin user ${id}`);
            res.json(r.rows[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- XÓA NGƯỜI DÙNG ---
    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        try {
            // Trước khi xóa user, có thể cần xử lý xóa file avatar vật lý để sạch server
            const userRes = await pool.query(`SELECT avatar FROM users WHERE id = $1`, [id]);
            const avatarUrl = userRes.rows[0]?.avatar;

            if (avatarUrl && avatarUrl.startsWith('/uploads/')) {
                const oldFilePath = path.join(uploadPath, path.basename(avatarUrl));
                if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
            }

            await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
            await logSystemAction(req, 'DELETE_USER', `Xóa người dùng ID: ${id}`);
            res.json({ status: 'ok' });
        } catch (e) { 
            res.status(500).json({ error: "Không thể xóa người dùng. Có thể do ràng buộc dữ liệu nhật ký hoặc các bảng liên quan khác." }); 
        }
    });

    return router;
}
