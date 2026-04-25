import express from 'express';

const MANAGE_ROLES = ['ADMIN', 'EDITOR'];
const BLOG_SELECT_FIELDS = `
    id,
    title,
    summary,
    content_html,
    cover_image,
    tags,
    author_id,
    author_name,
    publish_at,
    created_at,
    updated_at
`;

const sanitizeHtml = (value) => {
    if (!value) return '';
    return String(value)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .trim();
};

const normalizeTags = (value) => {
    if (Array.isArray(value)) {
        return value
            .map((tag) => String(tag || '').trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 20);
    }
    return [];
};

const canManagePosts = (roleHeader) => MANAGE_ROLES.includes(String(roleHeader || '').toUpperCase());

const normalizePublishAt = (value) => {
    if (value === undefined || value === null || value === '') {
        return new Date();
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
};

export default function(pool) {
    const router = express.Router();

    router.get('/blog-posts', async (req, res) => {
        const canManage = canManagePosts(req.headers['x-user-role']);
        try {
            const result = await pool.query(`
                SELECT ${BLOG_SELECT_FIELDS}
                FROM blog_posts
                WHERE is_deleted = false
                  AND ($1::boolean = true OR publish_at <= NOW())
                ORDER BY publish_at DESC, updated_at DESC
            `, [canManage]);
            res.json(result.rows);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/blog-posts/:id', async (req, res) => {
        const { id } = req.params;
        const canManage = canManagePosts(req.headers['x-user-role']);
        try {
            const result = await pool.query(`
                SELECT ${BLOG_SELECT_FIELDS}
                FROM blog_posts
                WHERE id = $1
                  AND is_deleted = false
                  AND ($2::boolean = true OR publish_at <= NOW())
                LIMIT 1
            `, [id, canManage]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
            res.json(result.rows[0]);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/blog-posts', async (req, res) => {
        const userId = req.headers['x-user-id'];
        const userName = decodeURIComponent(req.headers['x-user-name'] || 'Tac gia GIS');
        const userRole = String(req.headers['x-user-role'] || '').toUpperCase();
        if (!userId) return res.status(401).json({ error: 'Vui long dang nhap.' });
        if (!['ADMIN', 'EDITOR'].includes(userRole)) return res.status(403).json({ error: 'Ban khong co quyen viet bai.' });

        const title = String(req.body?.title || '').trim();
        const summary = String(req.body?.summary || '').trim();
        const contentHtml = sanitizeHtml(req.body?.content_html || req.body?.contentHtml || '');
        const coverImage = String(req.body?.cover_image || req.body?.coverImage || '').trim();
        const tags = normalizeTags(req.body?.tags);
        const publishAt = normalizePublishAt(req.body?.publish_at || req.body?.publishAt);

        if (!title || !summary || !contentHtml) {
            return res.status(400).json({ error: 'Tieu de, tom tat va noi dung la bat buoc.' });
        }
        if (!publishAt) {
            return res.status(400).json({ error: 'Thoi gian dang bai khong hop le.' });
        }

        try {
            const result = await pool.query(`
                INSERT INTO blog_posts (title, summary, content_html, cover_image, tags, author_id, author_name, publish_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING ${BLOG_SELECT_FIELDS}
            `, [title, summary, contentHtml, coverImage, tags, String(userId), userName, publishAt]);
            res.json(result.rows[0]);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.put('/blog-posts/:id', async (req, res) => {
        const userId = req.headers['x-user-id'];
        const userRole = String(req.headers['x-user-role'] || '').toUpperCase();
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: 'Vui long dang nhap.' });
        if (!['ADMIN', 'EDITOR'].includes(userRole)) return res.status(403).json({ error: 'Ban khong co quyen sua bai.' });

        const title = String(req.body?.title || '').trim();
        const summary = String(req.body?.summary || '').trim();
        const contentHtml = sanitizeHtml(req.body?.content_html || req.body?.contentHtml || '');
        const coverImage = String(req.body?.cover_image || req.body?.coverImage || '').trim();
        const tags = normalizeTags(req.body?.tags);
        const publishAt = normalizePublishAt(req.body?.publish_at || req.body?.publishAt);

        if (!title || !summary || !contentHtml) {
            return res.status(400).json({ error: 'Tieu de, tom tat va noi dung la bat buoc.' });
        }
        if (!publishAt) {
            return res.status(400).json({ error: 'Thoi gian dang bai khong hop le.' });
        }

        try {
            const check = await pool.query(`SELECT author_id FROM blog_posts WHERE id = $1 AND is_deleted = false`, [id]);
            if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });

            const canEdit = userRole === 'ADMIN' || String(check.rows[0].author_id) === String(userId);
            if (!canEdit) return res.status(403).json({ error: 'Ban chi duoc sua bai viet cua minh.' });

            const result = await pool.query(`
                UPDATE blog_posts
                SET title = $1, summary = $2, content_html = $3, cover_image = $4, tags = $5, publish_at = $6, updated_at = NOW()
                WHERE id = $7
                RETURNING ${BLOG_SELECT_FIELDS}
            `, [title, summary, contentHtml, coverImage, tags, publishAt, id]);
            res.json(result.rows[0]);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/blog-posts/:id', async (req, res) => {
        const userId = req.headers['x-user-id'];
        const userRole = String(req.headers['x-user-role'] || '').toUpperCase();
        const { id } = req.params;
        if (!userId) return res.status(401).json({ error: 'Vui long dang nhap.' });
        if (!['ADMIN', 'EDITOR'].includes(userRole)) return res.status(403).json({ error: 'Ban khong co quyen xoa bai.' });

        try {
            const check = await pool.query(`SELECT author_id FROM blog_posts WHERE id = $1 AND is_deleted = false`, [id]);
            if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });

            const canDelete = userRole === 'ADMIN' || String(check.rows[0].author_id) === String(userId);
            if (!canDelete) return res.status(403).json({ error: 'Ban chi duoc xoa bai viet cua minh.' });

            await pool.query(`UPDATE blog_posts SET is_deleted = true, updated_at = NOW() WHERE id = $1`, [id]);
            res.json({ status: 'ok' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
