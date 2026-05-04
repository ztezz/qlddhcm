import express from 'express';

// NOTE: Run this migration if the column does not exist yet:
// ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
// ALTER TABLE users ADD COLUMN IF NOT EXISTS last_notification_read_at TIMESTAMPTZ;

export default function(pool) {
    const router = express.Router();

    const getUserRoleAndLastRead = async (userId) => {
        const userRes = await pool.query(
            `SELECT role, last_notification_read_at FROM users WHERE id = $1`,
            [userId]
        );

        if (userRes.rows.length === 0) {
            const err = new Error('User not found');
            err.statusCode = 404;
            throw err;
        }

        return {
            role: userRes.rows[0].role,
            lastReadAt: userRes.rows[0].last_notification_read_at
        };
    };

    // Get notifications by role and active/expiry constraints.
    router.get('/', async (req, res) => {
        const userId = req.headers['x-user-id'];
        try {
            const { role } = await getUserRoleAndLastRead(userId);
            const result = await pool.query(
                `SELECT n.*, u.name as sender_name
                 FROM system_notifications n
                 LEFT JOIN users u ON n.sender_id = u.id
                 WHERE n.is_active = true
                 AND (n.target_role = 'ALL' OR n.target_role = $1)
                 AND (n.expires_at IS NULL OR n.expires_at > NOW())
                 ORDER BY n.created_at DESC LIMIT 50`,
                [role]
            );
            res.json(result.rows);
        } catch (e) {
            res.status(e.statusCode || 500).json({ error: e.message });
        }
    });

    // Get unread notification count for current user.
    router.get('/unread/count', async (req, res) => {
        const userId = req.headers['x-user-id'];
        try {
            const { role, lastReadAt } = await getUserRoleAndLastRead(userId);
            const result = await pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM system_notifications n
                 WHERE n.is_active = true
                 AND (n.target_role = 'ALL' OR n.target_role = $1)
                 AND (n.expires_at IS NULL OR n.expires_at > NOW())
                 AND ($2::timestamptz IS NULL OR n.created_at > $2::timestamptz)`,
                [role, lastReadAt]
            );
            res.json({ count: result.rows[0]?.count || 0 });
        } catch (e) {
            res.status(e.statusCode || 500).json({ error: e.message });
        }
    });

    // Mark all currently visible notifications as read for current user.
    router.put('/read-all', async (req, res) => {
        const userId = req.headers['x-user-id'];
        try {
            const result = await pool.query(
                `UPDATE users
                 SET last_notification_read_at = NOW()
                 WHERE id = $1
                 RETURNING last_notification_read_at`,
                [userId]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({
                status: 'ok',
                last_read_at: result.rows[0].last_notification_read_at
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Admin: get all notifications.
    router.get('/admin', async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT n.*, u.name as sender_name
                 FROM system_notifications n
                 LEFT JOIN users u ON n.sender_id = u.id
                 ORDER BY n.created_at DESC`
            );
            res.json(result.rows);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Create notification.
    router.post('/', async (req, res) => {
        const userId = req.headers['x-user-id'];
        const { title, content, type, targetRole, expiresAt } = req.body;
        try {
            const result = await pool.query(
                `INSERT INTO system_notifications (title, content, type, target_role, sender_id, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [title, content, type || 'INFO', targetRole || 'ALL', userId, expiresAt || null]
            );
            res.json(result.rows[0]);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Update notification.
    router.put('/:id', async (req, res) => {
        const { id } = req.params;
        const { title, content, type, targetRole, expiresAt } = req.body;
        try {
            const result = await pool.query(
                `UPDATE system_notifications
                 SET title = $1, content = $2, type = $3, target_role = $4, expires_at = $5
                 WHERE id = $6 RETURNING *`,
                [title, content, type, targetRole, expiresAt || null, parseInt(id)]
            );
            if (result.rowCount === 0) return res.status(404).json({ error: 'Khong tim thay thong bao.' });
            res.json(result.rows[0]);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Delete notification.
    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const result = await pool.query(`DELETE FROM system_notifications WHERE id = $1`, [parseInt(id)]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Khong tim thay thong bao de xoa.' });
            }
            res.json({ status: 'ok' });
        } catch (e) {
            console.error('Delete notification error:', e.message);
            res.status(500).json({ error: 'Loi co so du lieu khi xoa thong bao.' });
        }
    });

    return router;
}
