/**
 * routes_parcel_history.js
 * Quản lý lịch sử biến động thửa đất.
 *
 * Endpoints:
 *   GET    /api/parcel-history/:table/:gid          – lịch sử của một thửa
 *   GET    /api/parcel-history/:table               – lịch sử toàn bảng (admin)
 *   POST   /api/parcel-history/:table/:gid/restore  – phục hồi về snapshot
 *   DELETE /api/parcel-history/:table/:gid/clear    – xóa lịch sử của một thửa (admin)
 */

import express from 'express';
import { authenticateToken } from './middleware_auth.js';

const TABLE_NAME_REGEX = /^[a-z0-9_]+$/;

export default function parcelHistoryRouter(pool, logSystemAction) {
    const router = express.Router();

    // ─── Tự động tạo bảng parcel_history nếu chưa tồn tại (Promise cache) ────
    let _tablePromise = null;
    const ensureTable = () => {
        if (_tablePromise) return _tablePromise;
        _tablePromise = (async () => {
            // Đảm bảo function trigger tồn tại trước khi CREATE TABLE
            // (event trigger trong DB tự gắn trigger này vào mọi bảng mới)
            await pool.query(`
                CREATE OR REPLACE FUNCTION cap_nhat_madinhdanh_phuc_hop()
                RETURNS TRIGGER LANGUAGE plpgsql AS $$
                DECLARE
                    has_madinhdanh BOOLEAN;
                    has_geometry   BOOLEAN;
                BEGIN
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = TG_TABLE_NAME AND column_name = 'madinhdanh'
                    ) INTO has_madinhdanh;
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = TG_TABLE_NAME AND column_name = 'geometry'
                    ) INTO has_geometry;
                    IF has_madinhdanh AND has_geometry AND NEW.geometry IS NOT NULL THEN
                        NEW.madinhdanh := ST_GeoHash(ST_Transform(ST_Centroid(NEW.geometry), 4326), 12);
                    END IF;
                    RETURN NEW;
                END;
                $$
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS parcel_history (
                    id              SERIAL PRIMARY KEY,
                    table_name      TEXT NOT NULL,
                    parcel_gid      INTEGER NOT NULL,
                    action          TEXT NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE')),
                    snapshot        JSONB,
                    changed_by_id   TEXT,
                    changed_by_name TEXT,
                    changed_at      TIMESTAMPTZ DEFAULT NOW(),
                    note            TEXT
                )
            `);
            await pool.query(`CREATE INDEX IF NOT EXISTS parcel_history_table_gid_idx  ON parcel_history (table_name, parcel_gid)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS parcel_history_changed_at_idx ON parcel_history (changed_at DESC)`);
        })().catch(e => {
            _tablePromise = null; // reset để lần sau thử lại
            throw e;
        });
        return _tablePromise;
    };

    // Kích hoạt tạo bảng ngay khi router mount — không block
    ensureTable().catch(e => console.error('[parcel_history] ensureTable error:', e.message));

    // ─── helper: validate table in registry ──────────────────────────────────
    const resolveSafeTableName = async (rawName) => {
        const table = (rawName || '').toLowerCase().trim();
        if (!TABLE_NAME_REGEX.test(table)) throw new Error('Tên bảng không hợp lệ.');
        const check = await pool.query(
            `SELECT table_name FROM spatial_tables_registry WHERE table_name = $1 LIMIT 1`, [table]
        );
        if (check.rowCount === 0) throw new Error(`Bảng ${table} chưa được đăng ký.`);
        return table;
    };

    // ─── helper: lấy snapshot hiện tại của một thửa ──────────────────────────
    const getCurrentSnapshot = async (table, gid) => {
        const colRes = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]
        );
        const cols = colRes.rows.map(r => r.column_name);
        const geomCol = cols.includes('geometry') ? `, ST_AsGeoJSON(geometry)::json AS geometry_geojson` : '';
        const nonGeomCols = cols
            .filter(c => c !== 'geometry')
            .map(c => `"${c}"`)
            .join(', ');

        const q = `SELECT ${nonGeomCols}${geomCol} FROM "${table}" WHERE gid = $1 LIMIT 1`;
        const result = await pool.query(q, [gid]);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        // Gộp geometry_geojson vào snapshot
        if (row.geometry_geojson !== undefined) {
            row.geometry = row.geometry_geojson;
            delete row.geometry_geojson;
        }
        return row;
    };

    // ─── helper: ghi một bản ghi lịch sử ────────────────────────────────────
    const writeHistory = async (pool, tableName, parcelGid, action, snapshot, req, note = null) => {
        const userId = req.headers['x-user-id'] || req.user?.id || 'system';
        const userName = decodeURIComponent(req.headers['x-user-name'] || req.user?.name || 'System');
        await pool.query(
            `INSERT INTO parcel_history (table_name, parcel_gid, action, snapshot, changed_by_id, changed_by_name, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [tableName, parcelGid, action, JSON.stringify(snapshot), userId, userName, note]
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/parcel-history/:table/:gid
    // Lấy toàn bộ lịch sử biến động của một thửa đất
    // ─────────────────────────────────────────────────────────────────────────
    router.get('/:table/:gid', authenticateToken, async (req, res) => {
        try {
            await ensureTable();
            const table = await resolveSafeTableName(req.params.table);
            const gid = parseInt(req.params.gid, 10);
            if (!Number.isFinite(gid)) return res.status(400).json({ error: 'gid không hợp lệ.' });

            const page  = Math.max(1, parseInt(req.query.page  || '1', 10));
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
            const offset = (page - 1) * limit;

            const [rows, countRes] = await Promise.all([
                pool.query(
                    `SELECT id, action, snapshot, changed_by_id, changed_by_name, changed_at, note
                     FROM parcel_history
                     WHERE table_name = $1 AND parcel_gid = $2
                     ORDER BY changed_at DESC
                     LIMIT $3 OFFSET $4`,
                    [table, gid, limit, offset]
                ),
                pool.query(
                    `SELECT COUNT(*) FROM parcel_history WHERE table_name = $1 AND parcel_gid = $2`,
                    [table, gid]
                )
            ]);

            const total = parseInt(countRes.rows[0].count, 10);
            res.json({
                data: rows.rows,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/parcel-history/:table
    // Lấy lịch sử toàn bảng (dành cho admin / báo cáo)
    // ─────────────────────────────────────────────────────────────────────────
    router.get('/:table', authenticateToken, async (req, res) => {
        try {
            await ensureTable();
            const table = await resolveSafeTableName(req.params.table);
            const page   = Math.max(1, parseInt(req.query.page   || '1',  10));
            const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
            const offset = (page - 1) * limit;
            const action = req.query.action || null; // 'CREATE'|'UPDATE'|'DELETE'
            const user   = req.query.user   || null; // filter by changed_by_name ILIKE

            const conditions = ['table_name = $1'];
            const params = [table];
            let idx = 2;

            if (action) {
                conditions.push(`action = $${idx++}`);
                params.push(action.toUpperCase());
            }
            if (user) {
                conditions.push(`changed_by_name ILIKE $${idx++}`);
                params.push(`%${user}%`);
            }

            const where = `WHERE ${conditions.join(' AND ')}`;

            const [rows, countRes] = await Promise.all([
                pool.query(
                    `SELECT id, parcel_gid, action, changed_by_id, changed_by_name, changed_at, note,
                            snapshot->>'sodoto' AS sodoto, snapshot->>'sothua' AS sothua
                     FROM parcel_history ${where}
                     ORDER BY changed_at DESC
                     LIMIT $${idx} OFFSET $${idx + 1}`,
                    [...params, limit, offset]
                ),
                pool.query(
                    `SELECT COUNT(*) FROM parcel_history ${where}`, params
                )
            ]);

            const total = parseInt(countRes.rows[0].count, 10);
            res.json({
                data: rows.rows,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/parcel-history/:table/:gid/restore
    // Phục hồi thửa đất về trạng thái của một bản ghi lịch sử
    // Body: { history_id: number }
    // ─────────────────────────────────────────────────────────────────────────
    router.post('/:table/:gid/restore', authenticateToken, async (req, res) => {
        const { history_id } = req.body;
        if (!history_id) return res.status(400).json({ error: 'Thiếu history_id.' });

        try {
            await ensureTable();
            const table = await resolveSafeTableName(req.params.table);
            const gid   = parseInt(req.params.gid, 10);
            if (!Number.isFinite(gid)) return res.status(400).json({ error: 'gid không hợp lệ.' });

            // Lấy snapshot cần phục hồi
            const histRes = await pool.query(
                `SELECT * FROM parcel_history WHERE id = $1 AND table_name = $2 AND parcel_gid = $3 LIMIT 1`,
                [history_id, table, gid]
            );
            if (histRes.rows.length === 0) {
                return res.status(404).json({ error: 'Không tìm thấy bản ghi lịch sử.' });
            }

            const histRow  = histRes.rows[0];
            const snapshot = histRow.snapshot;

            if (!snapshot) {
                return res.status(400).json({ error: 'Bản ghi lịch sử không có dữ liệu snapshot để phục hồi.' });
            }

            // Lấy danh sách cột thực tế của bảng
            const colRes = await pool.query(
                `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]
            );
            const tableCols = new Set(colRes.rows.map(r => r.column_name));

            // Lấy SRID
            const sridRes = await pool.query(
                `SELECT srid FROM geometry_columns WHERE f_table_name = $1 AND f_geometry_column = 'geometry' LIMIT 1`,
                [table]
            );
            const targetSrid = sridRes.rows[0]?.srid || 4326;

            // Ghi snapshot hiện tại trước khi ghi đè (để có thể undo lần này nữa)
            const currentSnap = await getCurrentSnapshot(table, gid);

            // Build UPDATE từ snapshot
            const updates = [];
            const params  = [];
            let idx = 1;

            const SCALAR_FIELDS = ['madinhdanh','sodoto','sothua','tenchu','diachi','kyhieumucd','loaidat','dientich','image_url'];
            for (const field of SCALAR_FIELDS) {
                if (tableCols.has(field) && snapshot[field] !== undefined) {
                    updates.push(`"${field}" = $${idx++}`);
                    params.push(snapshot[field]);
                }
            }

            // geometry từ snapshot
            if (tableCols.has('geometry') && snapshot.geometry) {
                updates.push(`geometry = ST_Multi(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($${idx++}), 4326), ${targetSrid}))`);
                params.push(JSON.stringify(snapshot.geometry));
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'Snapshot không có trường nào hợp lệ để phục hồi.' });
            }

            params.push(gid);
            await pool.query(
                `UPDATE "${table}" SET ${updates.join(', ')} WHERE gid = $${idx}`,
                params
            );

            // Ghi lịch sử cho thao tác restore này
            await writeHistory(pool, table, gid, 'UPDATE', currentSnap, req,
                `Phục hồi về lịch sử #${history_id} (${histRow.action} lúc ${new Date(histRow.changed_at).toLocaleString('vi-VN')})`
            );

            await logSystemAction(req, 'PARCEL_RESTORE',
                `Phục hồi thửa gid=${gid} trong bảng ${table} về lịch sử #${history_id}`
            );

            // Trả về snapshot vừa khôi phục để frontend cập nhật bản đồ
            res.json({ status: 'ok', snapshot });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/parcel-history/:table/:gid/clear
    // Xóa toàn bộ lịch sử của một thửa (chỉ ADMIN)
    // ─────────────────────────────────────────────────────────────────────────
    router.delete('/:table/:gid/clear', authenticateToken, async (req, res) => {
        const role = (req.headers['x-user-role'] || '').toUpperCase();
        if (role !== 'ADMIN') return res.status(403).json({ error: 'Chỉ quản trị viên mới có thể xóa lịch sử.' });

        try {
            await ensureTable();
            const table = await resolveSafeTableName(req.params.table);
            const gid   = parseInt(req.params.gid, 10);
            if (!Number.isFinite(gid)) return res.status(400).json({ error: 'gid không hợp lệ.' });

            const result = await pool.query(
                `DELETE FROM parcel_history WHERE table_name = $1 AND parcel_gid = $2`, [table, gid]
            );
            await logSystemAction(req, 'PARCEL_HISTORY_CLEAR',
                `Xóa ${result.rowCount} bản ghi lịch sử của gid=${gid} trong bảng ${table}`
            );
            res.json({ status: 'ok', deleted: result.rowCount });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Export helper để routes_spatial.js dùng
    router.writeHistory = writeHistory;
    router.getCurrentSnapshot = getCurrentSnapshot;

    return router;
}

// Export helper độc lập để routes_spatial import
export { };
