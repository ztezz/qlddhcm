
import express from 'express';
import os from 'os';
import { authenticateToken } from './middleware_auth.js';

export default function(pool, logSystemAction, dbConfig) {
    const router = express.Router();
    const VALID_ROLES = new Set(['ADMIN', 'EDITOR', 'VIEWER']);

    const normalizePermissions = (value) => {
        if (Array.isArray(value)) {
            return Array.from(new Set(value.map(v => String(v).trim()).filter(Boolean)));
        }
        if (typeof value === 'string') {
            const raw = value.trim();
            if (!raw) return [];
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return Array.from(new Set(parsed.map(v => String(v).trim()).filter(Boolean)));
                }
            } catch (_) {}
            return Array.from(new Set(raw.split(',').map(v => v.trim()).filter(Boolean)));
        }
        return [];
    };

    // --- WMS LAYERS ---
    router.get('/wms-layers', async (req, res) => {
        try { 
            const result = await pool.query(`SELECT id, name, url, layers, visible, opacity, type, category, map_scope as "mapScope", description, sort_order as "sortOrder" FROM wms_layers ORDER BY sort_order ASC, name ASC`);
            res.json(result.rows); 
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/wms-layers', authenticateToken, async (req, res) => {
        const { name, url, layers, visible, opacity, type, category, mapScope, description, sortOrder } = req.body;
        try {
            const id = 'ly-' + Date.now();
            await pool.query(
                `INSERT INTO wms_layers (id, name, url, layers, visible, opacity, type, category, map_scope, description, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [id, name, url, layers, visible, parseFloat(opacity) || 1, type || 'WMS', category || 'STANDARD', mapScope || 'MAIN', description || '', Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0]
            );
            await logSystemAction(req, 'ADD_LAYER', `Thêm lớp bản đồ: ${name}`);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/wms-layers/:id', authenticateToken, async (req, res) => {
        const { id } = req.params;
        const { name, url, layers, visible, opacity, type, category, mapScope, description, sortOrder } = req.body;
        try {
            await pool.query(
                `UPDATE wms_layers SET name=$1, url=$2, layers=$3, visible=$4, opacity=$5, type=$6, category=$7, map_scope=$8, description=$9, sort_order=$10 WHERE id=$11`,
                [name, url, layers, visible, parseFloat(opacity) || 1, type, category, mapScope || 'MAIN', description || '', Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0, id]
            );
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/wms-layers/reorder', authenticateToken, async (req, res) => {
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        if (items.length === 0) return res.status(400).json({ error: 'Danh sách sắp xếp không hợp lệ.' });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const item of items) {
                if (!item?.id) continue;
                const order = Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0;
                await client.query(`UPDATE wms_layers SET sort_order=$1 WHERE id=$2`, [order, item.id]);
            }
            await client.query('COMMIT');
            await logSystemAction(req, 'REORDER_LAYER', `Cập nhật thứ tự ${items.length} lớp bản đồ`);
            res.json({ status: 'ok' });
        } catch (e) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: e.message });
        } finally {
            client.release();
        }
    });

    router.delete('/wms-layers/:id', authenticateToken, async (req, res) => {
        try {
            await pool.query(`DELETE FROM wms_layers WHERE id = $1`, [req.params.id]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- BASEMAPS ---
    router.get('/basemaps', async (req, res) => {
        try { res.json((await pool.query(`SELECT id, name, url, type, is_default as "isDefault", visible, use_proxy as "useProxy", sort_order as "sortOrder", description FROM basemaps ORDER BY sort_order ASC, name ASC`)).rows); } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/basemaps', authenticateToken, async (req, res) => {
        const { name, url, type, isDefault, visible, useProxy, sortOrder, description } = req.body;
        try {
            const id = 'bm-' + Date.now();
            if (isDefault) await pool.query(`UPDATE basemaps SET is_default = false`);
            await pool.query(
                `INSERT INTO basemaps (id, name, url, type, is_default, visible, use_proxy, sort_order, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, 
                [id, name, url, type, isDefault, visible, useProxy || false, Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0, description || '']
            );
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/basemaps/:id', authenticateToken, async (req, res) => {
        const { id } = req.params;
        const { name, url, type, isDefault, visible, useProxy, sortOrder, description } = req.body;
        try {
            if (isDefault) await pool.query(`UPDATE basemaps SET is_default = false`);
            await pool.query(
                `UPDATE basemaps SET name=$1, url=$2, type=$3, is_default=$4, visible=$5, use_proxy=$6, sort_order=$7, description=$8 WHERE id=$9`, 
                [name, url, type, isDefault, visible, useProxy || false, Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0, description || '', id]
            );
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/basemaps/reorder', authenticateToken, async (req, res) => {
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        if (items.length === 0) return res.status(400).json({ error: 'Danh sách sắp xếp không hợp lệ.' });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const item of items) {
                if (!item?.id) continue;
                const order = Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0;
                await client.query(`UPDATE basemaps SET sort_order=$1 WHERE id=$2`, [order, item.id]);
            }
            await client.query('COMMIT');
            await logSystemAction(req, 'REORDER_BASEMAP', `Cập nhật thứ tự ${items.length} bản đồ nền`);
            res.json({ status: 'ok' });
        } catch (e) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: e.message });
        } finally {
            client.release();
        }
    });

    router.delete('/basemaps/:id', authenticateToken, async (req, res) => {
        try {
            await pool.query(`DELETE FROM basemaps WHERE id = $1`, [req.params.id]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- ROLE PERMISSIONS ---
    router.get('/role-permissions', authenticateToken, async (req, res) => {
        try {
            const result = await pool.query(`SELECT role, permissions FROM role_permissions`);
            const rows = result.rows.map(row => ({
                role: String(row.role || '').toUpperCase(),
                permissions: normalizePermissions(row.permissions)
            })).filter(row => VALID_ROLES.has(row.role));
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
    router.post('/role-permissions', authenticateToken, async (req, res) => {
        const role = String(req.body?.role || '').toUpperCase();
        const permissions = normalizePermissions(req.body?.permissions);

        if (!VALID_ROLES.has(role)) {
            return res.status(400).json({ error: 'Vai trò không hợp lệ.' });
        }

        try {
            const colResult = await pool.query(
                `SELECT data_type, udt_name FROM information_schema.columns WHERE table_name = 'role_permissions' AND column_name = 'permissions' LIMIT 1`
            );
            const columnInfo = colResult.rows[0];
            if (!columnInfo) {
                return res.status(500).json({ error: 'Không tìm thấy cột permissions trong bảng role_permissions.' });
            }

            await pool.query(`DELETE FROM role_permissions WHERE role = $1`, [role]);

            if (columnInfo.data_type === 'ARRAY' || columnInfo.udt_name === '_text') {
                await pool.query(
                    `INSERT INTO role_permissions (role, permissions) VALUES ($1, $2::text[])`,
                    [role, permissions]
                );
            } else if (columnInfo.data_type === 'jsonb') {
                await pool.query(
                    `INSERT INTO role_permissions (role, permissions) VALUES ($1, $2::jsonb)`,
                    [role, JSON.stringify(permissions)]
                );
            } else if (columnInfo.data_type === 'json') {
                await pool.query(
                    `INSERT INTO role_permissions (role, permissions) VALUES ($1, $2::json)`,
                    [role, JSON.stringify(permissions)]
                );
            } else {
                await pool.query(
                    `INSERT INTO role_permissions (role, permissions) VALUES ($1, $2)`,
                    [role, JSON.stringify(permissions)]
                );
            }

            await logSystemAction(req, 'UPDATE_ROLE_PERMISSIONS', `Cập nhật phân quyền cho vai trò: ${role}`);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- SYSTEM LOGS ---
    router.get('/logs/stats', authenticateToken, async (req, res) => {
        try {
            const [todayResult, actionResult, userResult] = await Promise.all([
                pool.query(`SELECT COUNT(*) as total FROM system_logs WHERE timestamp::date = CURRENT_DATE`),
                pool.query(`SELECT action, COUNT(*) as count FROM system_logs GROUP BY action ORDER BY count DESC LIMIT 10`),
                pool.query(`SELECT COUNT(DISTINCT user_name) as total FROM system_logs WHERE timestamp > NOW() - INTERVAL '7 days'`)
            ]);
            res.json({
                today: parseInt(todayResult.rows[0].total),
                actionStats: actionResult.rows.map(r => ({ action: r.action, count: parseInt(r.count) })),
                uniqueUsersWeek: parseInt(userResult.rows[0].total)
            });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.get('/logs', authenticateToken, async (req, res) => {
        try {
            const { page = 1, limit = 50, action, search, from, to } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);
            const conditions = [];
            const params = [];
            let idx = 1;
            if (action) { conditions.push(`action = $${idx++}`); params.push(action); }
            if (search) {
                conditions.push(`(user_name ILIKE $${idx} OR details ILIKE $${idx + 1})`);
                params.push(`%${search}%`, `%${search}%`); idx += 2;
            }
            if (from) { conditions.push(`timestamp >= $${idx++}`); params.push(new Date(from).toISOString()); }
            if (to) { conditions.push(`timestamp <= $${idx++}`); params.push(new Date(to + 'T23:59:59').toISOString()); }
            const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            const [countResult, dataResult] = await Promise.all([
                pool.query(`SELECT COUNT(*) as total FROM system_logs ${where}`, params),
                pool.query(`SELECT id, user_id as "userId", user_name as "userName", action, details, timestamp FROM system_logs ${where} ORDER BY timestamp DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, parseInt(limit), offset])
            ]);
            const total = parseInt(countResult.rows[0].total);
            res.json({ data: dataResult.rows, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- DB STATUS & SERVER INFO ---
    router.get('/db-check', authenticateToken, async (req, res) => {
        try { await pool.query('SELECT 1'); res.json({ status: 'connected', dbName: dbConfig.database, host: dbConfig.host }); } catch (e) { res.json({ status: 'error', message: e.message }); }
    });
    
    router.get('/server-info', authenticateToken, (req, res) => {
        res.json({ 
            osType: os.type(), 
            uptime: os.uptime(), 
            freeMem: os.freemem(), 
            totalMem: os.totalmem(),
            cpuModel: os.cpus()[0].model,
            cpuUsage: Math.random() * 30 // Demo, thực tế cần module phức tạp hơn để tính % CPU
        });
    });

    // --- BACKUP V2 ---
    router.get('/backup/tables', authenticateToken, async (req, res) => {
        try {
            const systemTables = ['users', 'branches', 'system_settings', 'land_prices', 'menu_items', 'wms_layers', 'basemaps', 'role_permissions', 'system_notifications', 'spatial_tables_registry'];
            const registryRes = await pool.query(`SELECT table_name FROM spatial_tables_registry`);
            const spatialTables = registryRes.rows.map(r => r.table_name);
            res.json({ system: systemTables, spatial: spatialTables });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/backup/create', authenticateToken, async (req, res) => {
        const { tables } = req.body;
        if (!tables || !Array.isArray(tables) || tables.length === 0) return res.status(400).json({ error: "Vui lòng chọn ít nhất một bảng để sao lưu." });
        try {
            let sqlDump = `-- GeoMaster WebGIS SQL Dump\n-- Date: ${new Date().toISOString()}\n\n`;
            for (const table of tables) {
                const colRes = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [table]);
                if (colRes.rows.length === 0) continue;
                const columns = colRes.rows.map(r => r.column_name);
                const dataQuery = `SELECT ${colRes.rows.map(r => r.data_type === 'USER-DEFINED' ? `ST_AsEWKT("${r.column_name}") as "${r.column_name}"` : `"${r.column_name}"`).join(', ')} FROM "${table}"`;
                const dataRes = await pool.query(dataQuery);
                sqlDump += `-- Data for: ${table}\nDELETE FROM "${table}";\n`;
                for (const row of dataRes.rows) {
                    const values = columns.map(col => {
                        const val = row[col];
                        if (val === null) return 'NULL';
                        if (typeof val === 'string') return val.startsWith('SRID=') ? `ST_GeomFromEWKT('${val.replace(/'/g, "''")}')` : `'${val.replace(/'/g, "''")}'`;
                        return (val instanceof Date) ? `'${val.toISOString()}'` : val;
                    });
                    sqlDump += `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
                }
                sqlDump += `\n`;
            }
            res.setHeader('Content-disposition', `attachment; filename=backup_${Date.now()}.sql`);
            res.setHeader('Content-type', 'text/plain');
            res.send(sqlDump);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}
