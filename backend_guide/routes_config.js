
import express from 'express';
import nodemailer from 'nodemailer';
import { authenticateToken, requireAdmin } from './middleware_auth.js';

export default function(pool, logSystemAction) {
    const router = express.Router();

    const parseWardLabel = (rawWard = '', rawTinhCu = '') => {
        const wardText = String(rawWard || '').trim();
        const tinhCuText = String(rawTinhCu || '').trim();
        if (!wardText) {
            return { phuongxa: '', tinhcu: tinhCuText };
        }

        const match = wardText.match(/^(.*)\s+\((.*)\)$/);
        if (!match) {
            return { phuongxa: wardText, tinhcu: tinhCuText };
        }

        return {
            phuongxa: match[1].trim(),
            tinhcu: tinhCuText || match[2].trim()
        };
    };

    const getEffectiveMailSettings = async (overrides = {}) => {
        const res = await pool.query(`
            SELECT key, value FROM system_settings
            WHERE key IN ('mail_host', 'mail_port', 'mail_user', 'mail_pass', 'mail_from_name', 'mail_from_email', 'system_name')
        `);

        const dbSettings = {};
        res.rows.forEach(r => dbSettings[r.key] = r.value);

        const merged = {
            mail_host: dbSettings.mail_host || process.env.MAIL_HOST || '',
            mail_port: dbSettings.mail_port || process.env.MAIL_PORT || '587',
            mail_user: dbSettings.mail_user || process.env.MAIL_USER || '',
            mail_pass: dbSettings.mail_pass || process.env.MAIL_PASS || '',
            mail_from_name: dbSettings.mail_from_name || process.env.MAIL_FROM_NAME || 'GeoMaster System',
            mail_from_email: dbSettings.mail_from_email || process.env.MAIL_FROM_EMAIL || dbSettings.mail_user || process.env.MAIL_USER || '',
            system_name: dbSettings.system_name || 'GeoMaster',
            ...overrides
        };

        return merged;
    };

    // --- BRANCHES ---
    router.get('/branches', async (req, res) => {
        try { res.json((await pool.query(`SELECT * FROM branches ORDER BY name`)).rows); } catch (e) { res.status(500).json({ error: e.message }); }
    });
    router.post('/branches', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const id = 'br-' + Date.now();
            await pool.query(`INSERT INTO branches (id, code, name, address) VALUES ($1, $2, $3, $4)`, [id, req.body.code, req.body.name, req.body.address]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
    router.put('/branches/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            await pool.query(`UPDATE branches SET code=$1, name=$2, address=$3 WHERE id=$4`, [req.body.code, req.body.name, req.body.address, req.params.id]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
    router.delete('/branches/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            await pool.query(`DELETE FROM branches WHERE id=$1`, [req.params.id]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- LAND PRICES ---
    router.get('/land-prices', async (req, res) => {
        try { res.json((await pool.query(`SELECT land_type as "landType", base_price as "basePrice", description FROM land_prices`)).rows); } catch (e) { res.status(500).json({ error: e.message }); }
    });
    router.post('/land-prices', authenticateToken, async (req, res) => {
        try { await pool.query(`INSERT INTO land_prices VALUES ($1, $2, $3)`, [req.body.landType, req.body.basePrice, req.body.description]); res.json({status:'ok'}); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });
    router.put('/land-prices/:id', authenticateToken, async (req, res) => {
        try { await pool.query(`UPDATE land_prices SET base_price=$1, description=$2 WHERE land_type=$3`, [req.body.basePrice, req.body.description, req.params.id]); res.json({status:'ok'}); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });
    router.delete('/land-prices/:id', authenticateToken, async (req, res) => {
        try { await pool.query(`DELETE FROM land_prices WHERE land_type=$1`, [req.params.id]); res.json({status:'ok'}); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- TRA CỨU BẢNG GIÁ ĐẤT 2026 ---
    // Lấy danh sách Phường/Xã nối kèm Tỉnh Cũ để phân biệt
    router.get('/land-prices-2026/wards', async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT DISTINCT 
                phuongxa || ' (' || COALESCE(tinhcu, 'N/A') || ')' as label 
                FROM bang_gia_dat_2026 
                WHERE phuongxa IS NOT NULL AND phuongxa != '' 
                ORDER BY label ASC
            `);
            res.json(result.rows.map(r => r.label));
        } catch (e) { 
            if (e.code === '42P01') return res.json([]);
            res.status(500).json({ error: e.message }); 
        }
    });


    // API goi y tong hop (duong, doan) theo phuong/xa + tinh cu.
    router.get('/land-prices-2026/suggestions', async (req, res) => {
        const { phuongxa, tinhcu } = parseWardLabel(req.query.phuongxa, req.query.tinhcu);

        try {
            const filters = [];
            const params = [];
            let idx = 1;

            if (phuongxa) {
                filters.push(`phuongxa = $${idx++}`);
                params.push(phuongxa);
            }
            if (tinhcu) {
                filters.push(`tinhcu = $${idx++}`);
                params.push(tinhcu);
            }

            const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : 'WHERE 1=1';

            const streets = await pool.query(`SELECT DISTINCT tenduong FROM bang_gia_dat_2026 ${whereClause} AND tenduong IS NOT NULL ORDER BY tenduong ASC`, params);
            const fromPoints = await pool.query(`SELECT DISTINCT tu FROM bang_gia_dat_2026 ${whereClause} AND tu IS NOT NULL ORDER BY tu ASC`, params);
            const toPoints = await pool.query(`SELECT DISTINCT den FROM bang_gia_dat_2026 ${whereClause} AND den IS NOT NULL ORDER BY den ASC`, params);

            res.json({
                streets: streets.rows.map(r => r.tenduong),
                fromPoints: fromPoints.rows.map(r => r.tu),
                toPoints: toPoints.rows.map(r => r.den)
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });


    // Tim kiem gia dat mo rong
    router.get('/land-prices-2026/search', async (req, res) => {
        const { phuongxa, tinhcu } = parseWardLabel(req.query.phuongxa, req.query.tinhcu);
        const { tenduong, tu, den } = req.query;
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));

        try {
            let query = `SELECT * FROM bang_gia_dat_2026 WHERE 1=1`;
            const params = [];
            let idx = 1;

            if (phuongxa) {
                query += ` AND phuongxa = $${idx++}`;
                params.push(phuongxa);
            }
            if (tinhcu) {
                query += ` AND tinhcu = $${idx++}`;
                params.push(tinhcu);
            }
            if (tenduong) {
                query += ` AND tenduong ILIKE $${idx++}`;
                params.push(`%${tenduong}%`);
            }
            if (tu) {
                query += ` AND tu ILIKE $${idx++}`;
                params.push(`%${tu}%`);
            }
            if (den) {
                query += ` AND den ILIKE $${idx++}`;
                params.push(`%${den}%`);
            }

            query += ` ORDER BY tinhcu ASC, phuongxa ASC, tenduong ASC, tu ASC LIMIT $${idx}`;
            params.push(limit);

            const result = await pool.query(query, params);
            res.set('X-Search-Limit', String(limit));
            res.json(result.rows);
        } catch (e) {
            if (e.code === '42P01') return res.status(404).json({ error: "Bang gia dat 2026 chua duoc khoi tao." });
            res.status(500).json({ error: e.message });
        }
    });
    // Admin APIs for Land Price 2026
    router.post('/land-prices-2026', authenticateToken, async (req, res) => {
        const { phuongxa, tenduong, tinhcu, tu, den, dato, dattmdv, datsxkdpnn, nam_ap_dung, nguon_du_lieu, ghi_chu } = req.body;
        try {
            await pool.query(`
                INSERT INTO bang_gia_dat_2026 
                (phuongxa, tenduong, tinhcu, tu, den, dato, dattmdv, datsxkdpnn, nam_ap_dung, nguon_du_lieu, ghi_chu)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [phuongxa, tenduong, tinhcu, tu, den, dato, dattmdv, datsxkdpnn, nam_ap_dung, nguon_du_lieu, ghi_chu]);
            res.json({ status: 'ok' });
        } catch(e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/land-prices-2026/:id', authenticateToken, async (req, res) => {
        const { id } = req.params;
        const { phuongxa, tenduong, tinhcu, tu, den, dato, dattmdv, datsxkdpnn, nam_ap_dung, nguon_du_lieu, ghi_chu } = req.body;
        try {
            await pool.query(`
                UPDATE bang_gia_dat_2026 
                SET phuongxa=$1, tenduong=$2, tinhcu=$3, tu=$4, den=$5, dato=$6, dattmdv=$7, datsxkdpnn=$8, nam_ap_dung=$9, nguon_du_lieu=$10, ghi_chu=$11
                WHERE id=$12
            `, [phuongxa, tenduong, tinhcu, tu, den, dato, dattmdv, datsxkdpnn, nam_ap_dung, nguon_du_lieu, ghi_chu, id]);
            res.json({ status: 'ok' });
        } catch(e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/land-prices-2026/:id', authenticateToken, async (req, res) => {
        try {
            await pool.query(`DELETE FROM bang_gia_dat_2026 WHERE id=$1`, [req.params.id]);
            res.json({ status: 'ok' });
        } catch(e) { res.status(500).json({ error: e.message }); }
    });

    // --- MENU ITEMS ---
    router.get('/menu-items', async (req, res) => {
        try { res.json((await pool.query(`SELECT * FROM menu_items ORDER BY order_index ASC`)).rows); } catch (e) { res.status(500).json({ error: e.message }); }
    });
    
    router.post('/menu-items', authenticateToken, requireAdmin, async (req, res) => {
        try {
            await pool.query(`INSERT INTO menu_items (id, label, icon, roles, order_index, is_active, type, url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [req.body.id, req.body.label, req.body.icon, req.body.roles, req.body.order_index, req.body.is_active, req.body.type, req.body.url]);
            await logSystemAction(req, 'ADD_MENU', `Thêm mục menu: ${req.body.label}`);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/menu-items/reorder', authenticateToken, requireAdmin, async (req, res) => {
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const item of items) {
                await client.query(`UPDATE menu_items SET order_index = $1 WHERE id = $2`, [item.order_index, item.id]);
            }
            await client.query('COMMIT');
            await logSystemAction(req, 'REORDER_MENU', `Cập nhật thứ tự ${items.length} mục menu`);
            res.json({ status: 'ok' });
        } catch (e) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: e.message });
        } finally {
            client.release();
        }
    });

    router.put('/menu-items/:id', authenticateToken, requireAdmin, async (req, res) => {
        const { id } = req.params;
        const { label, icon, roles, order_index, is_active, type, url } = req.body;
        try {
            await pool.query(`UPDATE menu_items SET label=$1, icon=$2, roles=$3, order_index=$4, is_active=$5, type=$6, url=$7 WHERE id=$8`, [label, icon, roles, order_index, is_active, type, url, id]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/menu-items/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            await pool.query(`DELETE FROM menu_items WHERE id = $1`, [req.params.id]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- SYSTEM SETTINGS ---
    router.get('/settings', async (req, res) => {
        try { res.json((await pool.query(`SELECT * FROM system_settings`)).rows); } catch (e) { res.status(500).json({ error: e.message }); }
    });
    router.post('/settings', authenticateToken, async (req, res) => {
        try {
            for(const s of req.body.settings) {
                await pool.query(`INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [s.key, s.value]);
            }
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- TEST SMTP MAIL ---
    router.post('/settings/test-mail', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const body = req.body || {};
            const smtp = body.smtp || {};
            const settings = await getEffectiveMailSettings(smtp);

            if (!settings.mail_host || !settings.mail_user || !settings.mail_pass) {
                return res.status(400).json({ error: 'Thiếu cấu hình SMTP: host/user/pass.' });
            }

            const to = (body.to || settings.mail_user || '').trim();
            if (!to) return res.status(400).json({ error: 'Thiếu email nhận thử.' });

            const transporter = nodemailer.createTransport({
                host: settings.mail_host,
                port: parseInt(settings.mail_port) || 587,
                secure: parseInt(settings.mail_port) === 465,
                auth: {
                    user: settings.mail_user,
                    pass: settings.mail_pass
                }
            });

            await transporter.verify();

            const now = new Date().toLocaleString('vi-VN');
            const fromEmail = settings.mail_from_email || settings.mail_user;
            const from = `"${settings.mail_from_name || settings.system_name || 'GeoMaster System'}" <${fromEmail}>`;
            await transporter.sendMail({
                from,
                to,
                subject: `[${settings.system_name || 'GeoMaster'}] Test SMTP thành công`,
                text: `Đây là email test SMTP từ hệ thống ${settings.system_name || 'GeoMaster'} vào lúc ${now}.\nHost: ${settings.mail_host}\nPort: ${settings.mail_port}`,
                html: `<div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6"><h3>Test SMTP thành công</h3><p>Hệ thống <strong>${settings.system_name || 'GeoMaster'}</strong> đã gửi email test thành công vào lúc <strong>${now}</strong>.</p><p><strong>Host:</strong> ${settings.mail_host}<br/><strong>Port:</strong> ${settings.mail_port}</p></div>`
            });

            await logSystemAction(req, 'TEST_SMTP_MAIL', `Gửi mail test tới ${to} (${settings.mail_host}:${settings.mail_port})`);
            res.json({ status: 'ok', message: `Đã gửi email test tới ${to}.` });
        } catch (e) {
            res.status(500).json({ error: `Test SMTP thất bại: ${e.message}` });
        }
    });

    return router;
}
