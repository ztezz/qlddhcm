
import express from 'express';
import multer from 'multer';
import shp from 'shpjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from './middleware_auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đảm bảo thư mục uploads tồn tại
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

// Bộ nhớ đệm cho cấu trúc bảng và SRID (Schema Cache)
const SCHEMA_CACHE = new Map();

export default function(pool, logSystemAction) {
    const router = express.Router();
    const TABLE_NAME_REGEX = /^[a-z0-9_]+$/;
    const ADMIN_NAME_COLUMN_CANDIDATES = ['ten_tinh', 'ten_tinh_tp', 'ten_dvhc', 'ten_don_vi', 'ten', 'name', 'province'];
    const ACCENTED_CHARS = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
    const UNACCENTED_CHARS = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';

    const resolveSafeTableName = async (rawTableName) => {
        const table = (rawTableName || '').toLowerCase().trim();
        if (!TABLE_NAME_REGEX.test(table)) {
            throw new Error('Tên bảng không hợp lệ.');
        }

        const check = await pool.query(
            `SELECT table_name FROM spatial_tables_registry WHERE table_name = $1 LIMIT 1`,
            [table]
        );
        if (check.rowCount === 0) {
            throw new Error(`Bảng ${table} chưa được đăng ký trong registry.`);
        }

        return table;
    };

    const generateRandomParcelCode = () => {
        let result = '';
        for (let i = 0; i < 12; i += 1) {
            result += Math.floor(Math.random() * 10).toString();
        }
        return result;
    };

    const generateUniqueParcelCode = async (db, tableName, codeColumn) => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
            const candidate = generateRandomParcelCode();
            const exists = await db.query(
                `SELECT 1 FROM "${tableName}" WHERE "${codeColumn}" = $1 LIMIT 1`,
                [candidate]
            );
            if (exists.rowCount === 0) {
                return candidate;
            }
        }
        throw new Error('Không thể tạo mã định danh thửa đất duy nhất.');
    };

    const COLUMN_VARIANTS = {
        madinhdanh: ['madinhdanh', 'ma_dinh_danh', 'ma_thua', 'parcel_code', 'parcel_id', 'land_id', 'identifier'],
        sodoto: ['shbando', 'sh_ban_do', 'tobando', 'to_ban_do', 'map_sheet', 'shmap', 'sodoto', 'so_to'],
        sothua: ['shthua', 'sh_thua', 'thua_dat', 'parcel_no', 'shparcel', 'so_thu_tu_thua', 'sothua', 'so_thua'],
        loaidat: ['kyhieumucd', 'ky_hieu_muc_dich', 'mucdich', 'mdsd', 'kh_mucdich', 'purpose', 'loaidat', 'loai_dat'],
        tenchu: ['tenchu', 'ten_chu', 'chu_so_huu', 'ten_chu_sd', 'owner', 'owner_name', 'chusudung'],
        diachi: ['diachi', 'dia_chi', 'vitri', 'vi_tri', 'address', 'location', 'khu_vuc'],
        dientich: ['dientich', 'dien_tich', 'dt_phaply', 'area', 'shape_area', 'st_area'],
        image_url: ['image_url', 'imageurl', 'hinh_anh', 'hinhanh', 'photo', 'picture']
    };

    /**
     * Hàm tìm tên cột và SRID hiện tại của bảng
     */
    const resolveTableColumns = async (tableName) => {
        if (SCHEMA_CACHE.has(tableName)) {
            return SCHEMA_CACHE.get(tableName);
        }

        try {
            // Lấy danh sách cột
            const res = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [tableName]);
            
            // Lấy SRID hiện tại của cột geometry
            const sridRes = await pool.query(`
                SELECT srid FROM geometry_columns 
                WHERE f_table_name = $1 AND f_geometry_column = 'geometry'
                LIMIT 1
            `, [tableName]);

            const currentSrid = sridRes.rows[0]?.srid || 4326;
            
            const dbColsMap = {};
            res.rows.forEach(r => {
                dbColsMap[r.column_name.toLowerCase()] = r.column_name;
            });
            
            const mapping = { _srid: currentSrid };
            for (const [standardKey, candidates] of Object.entries(COLUMN_VARIANTS)) {
                let foundCol = null;
                for (const candidate of candidates) {
                    if (dbColsMap[candidate]) {
                        foundCol = dbColsMap[candidate];
                        break;
                    }
                }
                mapping[standardKey] = foundCol;
            }
            
            SCHEMA_CACHE.set(tableName, mapping);
            return mapping;
        } catch (e) {
            console.error(`Error resolving columns for ${tableName}:`, e);
            return { madinhdanh: null, sodoto: null, sothua: null, loaidat: null, tenchu: null, diachi: null, dientich: null, image_url: null, _srid: 4326 };
        }
    };

    const syncTableSchema = async (tableName) => {
        try {
            SCHEMA_CACHE.delete(tableName);
            const currentMap = await resolveTableColumns(tableName);
            const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [tableName]);
            if (res.rows.length === 0) return; // Bảng không tồn tại vật lý

            const existingCols = res.rows.map(r => r.column_name.toLowerCase());

            // Chuẩn hóa bảng cũ: nếu chỉ có loaidat thì tạo kyhieumucd và sao chép dữ liệu sang.
            if (!existingCols.includes('kyhieumucd') && existingCols.includes('loaidat')) {
                await pool.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "kyhieumucd" TEXT`);
                await pool.query(`
                    UPDATE "${tableName}"
                    SET "kyhieumucd" = COALESCE(NULLIF("kyhieumucd"::text, ''), "loaidat"::text)
                    WHERE "loaidat" IS NOT NULL
                `);
                existingCols.push('kyhieumucd');
            }

            // 1. Kiểm tra thiếu cột thuộc tính
            const missingCols = [];
            if (currentMap.madinhdanh && !existingCols.includes(currentMap.madinhdanh.toLowerCase())) missingCols.push({ name: currentMap.madinhdanh, type: 'TEXT' });
            if (currentMap.sodoto && !existingCols.includes(currentMap.sodoto.toLowerCase())) missingCols.push({ name: currentMap.sodoto, type: 'TEXT' });
            if (currentMap.sothua && !existingCols.includes(currentMap.sothua.toLowerCase())) missingCols.push({ name: currentMap.sothua, type: 'TEXT' });
            if (currentMap.loaidat && !existingCols.includes(currentMap.loaidat.toLowerCase())) missingCols.push({ name: currentMap.loaidat, type: 'TEXT' });
            if (currentMap.dientich && !existingCols.includes(currentMap.dientich.toLowerCase())) missingCols.push({ name: currentMap.dientich, type: 'NUMERIC' });
            if (currentMap.image_url && !existingCols.includes(currentMap.image_url.toLowerCase())) missingCols.push({ name: currentMap.image_url, type: 'TEXT' });

            // Nếu các cột chuẩn hoàn toàn không có trong mapping (null), ta có thể ép thêm các cột mặc định nếu muốn
            if (!currentMap.madinhdanh && !existingCols.includes('madinhdanh')) missingCols.push({ name: 'madinhdanh', type: 'TEXT' });
            if (!currentMap.sodoto && !existingCols.includes('sodoto')) missingCols.push({ name: 'sodoto', type: 'TEXT' });
            if (!currentMap.sothua && !existingCols.includes('sothua')) missingCols.push({ name: 'sothua', type: 'TEXT' });
            if (!currentMap.loaidat && !existingCols.includes('kyhieumucd') && !existingCols.includes('loaidat')) missingCols.push({ name: 'kyhieumucd', type: 'TEXT' });
            if (!currentMap.tenchu && !existingCols.includes('tenchu')) missingCols.push({ name: 'tenchu', type: 'TEXT' });
            if (!currentMap.diachi && !existingCols.includes('diachi')) missingCols.push({ name: 'diachi', type: 'TEXT' });
            if (!currentMap.dientich && !existingCols.includes('dientich')) missingCols.push({ name: 'dientich', type: 'NUMERIC' });
            if (!currentMap.image_url && !existingCols.includes('image_url')) missingCols.push({ name: 'image_url', type: 'TEXT' });

            if (missingCols.length > 0) {
                for (const col of missingCols) {
                    await pool.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`);
                }
            }

            const refreshedCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [tableName]);
            const refreshedColSet = new Set(refreshedCols.rows.map(r => r.column_name.toLowerCase()));
            const parcelCodeColumn = currentMap.madinhdanh || (refreshedColSet.has('madinhdanh') ? 'madinhdanh' : null);
            if (parcelCodeColumn) {
                const missingCodeRows = await pool.query(`SELECT gid FROM "${tableName}" WHERE "${parcelCodeColumn}" IS NULL OR BTRIM("${parcelCodeColumn}") = ''`);
                for (const row of missingCodeRows.rows) {
                    const parcelCode = await generateUniqueParcelCode(pool, tableName, parcelCodeColumn);
                    await pool.query(`UPDATE "${tableName}" SET "${parcelCodeColumn}" = $1 WHERE gid = $2`, [parcelCode, row.gid]);
                }
                await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${tableName}_${parcelCodeColumn}_uniq" ON "${tableName}" ("${parcelCodeColumn}")`);
            }

            // 2. Tự động sửa SRID 4326 -> 9210 nếu cần
            if (currentMap._srid !== 9210) {
                try {
                    await pool.query(`
                        ALTER TABLE "${tableName}" 
                        ALTER COLUMN geometry TYPE geometry(Geometry, 9210) 
                        USING ST_SetSRID(geometry, 9210)
                    `);
                    console.log(`[Migrate] Forced SRID 9210 for table: ${tableName}`);
                } catch (err) {
                    console.warn(`[Migrate Skip] Could not force SRID 9210 for ${tableName}`);
                }
            }

            await pool.query(`CREATE INDEX IF NOT EXISTS "${tableName}_geom_idx" ON "${tableName}" USING GIST (geometry)`);
            SCHEMA_CACHE.delete(tableName); 
        } catch (e) {
            console.error(`[Schema Sync] Error syncing table ${tableName}:`, e.message);
        }
    };

    const resolveNameColumn = async (tableName) => {
        const res = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
            [tableName]
        );
        const dbCols = new Set(res.rows.map((r) => String(r.column_name || '').toLowerCase()));
        for (const candidate of ADMIN_NAME_COLUMN_CANDIDATES) {
            if (dbCols.has(candidate)) return candidate;
        }
        return null;
    };

    const getTableColumns = async (tableName) => {
        const res = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
            [tableName]
        );
        return new Set(res.rows.map((r) => String(r.column_name || '').toLowerCase()));
    };

    router.get('/spatial-tables', async (req, res) => {
        try {
            const result = await pool.query(`SELECT * FROM spatial_tables_registry ORDER BY created_at DESC`);
            res.json(result.rows);
        } catch (e) {
            // Backward compatibility: some deployments may not have created_at yet.
            if (e?.code === '42703') {
                try {
                    const fallback = await pool.query(`
                        SELECT *, NOW() AS created_at
                        FROM spatial_tables_registry
                        ORDER BY table_name ASC
                    `);
                    return res.json(fallback.rows);
                } catch (fallbackError) {
                    return res.status(500).json({ error: fallbackError.message });
                }
            }
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/spatial-tables/sync/:table', authenticateToken, async (req, res) => {
        const { table } = req.params;
        try {
            await syncTableSchema(table);
            await logSystemAction(req, 'SYNC_TABLE', `Đồng bộ cấu trúc bảng: ${table}`);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/spatial-tables', authenticateToken, async (req, res) => {
        const { tableName, displayName, description } = req.body;
        const safeName = tableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        try {
            await pool.query('BEGIN');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS "${safeName}" (
                    gid SERIAL PRIMARY KEY,
                    madinhdanh TEXT UNIQUE,
                    sodoto TEXT, sothua TEXT, tenchu TEXT, diachi TEXT, kyhieumucd TEXT, dientich NUMERIC,
                    image_url TEXT,
                    geometry GEOMETRY(Geometry, 9210),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await pool.query(`CREATE INDEX IF NOT EXISTS "${safeName}_geom_idx" ON "${safeName}" USING GIST (geometry)`);
            await pool.query(`
                INSERT INTO spatial_tables_registry (table_name, display_name, description) VALUES ($1, $2, $3)
                ON CONFLICT (table_name) DO UPDATE SET display_name = EXCLUDED.display_name
            `, [safeName, displayName, description]);
            
            await syncTableSchema(safeName);
            await pool.query('COMMIT');
            res.json({ status: 'ok', tableName: safeName });
        } catch (e) { await pool.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
    });

    router.post('/spatial-tables/import-geojson-parcels', authenticateToken, upload.single('file'), async (req, res) => {
        const file = req.file;
        const rawTableName = String(req.body?.tableName || '').trim();
        const displayName = String(req.body?.displayName || '').trim();
        const description = String(req.body?.description || '').trim();
        const mappingRaw = String(req.body?.mapping || '{}').trim();
        const sourceSridRaw = parseInt(String(req.body?.sourceSrid || '4326'), 10);
        const sourceSrid = Number.isFinite(sourceSridRaw) ? sourceSridRaw : 4326;

        if (!file) return res.status(400).json({ error: 'Vui lòng chọn file GeoJSON để nhập.' });
        if (!rawTableName) return res.status(400).json({ error: 'Vui lòng nhập tên bảng mới.' });
        if (!displayName) return res.status(400).json({ error: 'Vui lòng nhập tên hiển thị cho bảng.' });

        const safeName = rawTableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (!TABLE_NAME_REGEX.test(safeName)) {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'Tên bảng không hợp lệ, chỉ cho phép chữ thường, số và dấu gạch dưới.' });
        }

        let mapping = {};
        const client = await pool.connect();
        let txStarted = false;
        try {
            mapping = JSON.parse(mappingRaw);
        } catch {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            client.release();
            return res.status(400).json({ error: 'Cấu hình ánh xạ cột (mapping) không hợp lệ.' });
        }

        const requiredMapping = ['sodoto', 'sothua'];
        for (const key of requiredMapping) {
            const value = String(mapping?.[key] || '').trim();
            if (!value) {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                client.release();
                return res.status(400).json({ error: `Thiếu ánh xạ bắt buộc cho trường ${key}.` });
            }
        }

        try {
            const existedInRegistry = await client.query(`SELECT 1 FROM spatial_tables_registry WHERE table_name = $1 LIMIT 1`, [safeName]);
            if (existedInRegistry.rowCount > 0) {
                return res.status(400).json({ error: `Bảng ${safeName} đã tồn tại trong registry.` });
            }

            const existedPhysical = await client.query(`SELECT to_regclass($1) as exists`, [safeName]);
            if (existedPhysical.rows?.[0]?.exists) {
                return res.status(400).json({ error: `Bảng ${safeName} đã tồn tại trong database.` });
            }

            const raw = fs.readFileSync(file.path, 'utf8');
            const parsed = JSON.parse(raw);
            let features = [];

            if (parsed?.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
                features = parsed.features;
            } else if (parsed?.type === 'Feature') {
                features = [parsed];
            } else if (Array.isArray(parsed)) {
                features = parsed.filter((item) => item?.type === 'Feature');
            }

            if (!Array.isArray(features) || features.length === 0) {
                return res.status(400).json({ error: 'Không tìm thấy feature hợp lệ trong file GeoJSON.' });
            }

            await client.query('BEGIN');
            await client.query("SET LOCAL statement_timeout = 0");
            txStarted = true;

            await client.query(`
                CREATE TABLE IF NOT EXISTS "${safeName}" (
                    gid SERIAL PRIMARY KEY,
                    madinhdanh TEXT UNIQUE,
                    sodoto TEXT,
                    sothua TEXT,
                    tenchu TEXT,
                    diachi TEXT,
                    kyhieumucd TEXT,
                    dientich NUMERIC,
                    image_url TEXT,
                    geometry GEOMETRY(Geometry, ${sourceSrid}),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query(`CREATE INDEX IF NOT EXISTS "${safeName}_geom_idx" ON "${safeName}" USING GIST (geometry)`);
            await client.query(`
                INSERT INTO spatial_tables_registry (table_name, display_name, description)
                VALUES ($1, $2, $3)
                ON CONFLICT (table_name) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description
            `, [safeName, displayName, description]);

            const resolveValue = (props, key) => {
                const sourceKey = String(
                    mapping?.[key]
                    || (key === 'kyhieumucd' ? mapping?.loaidat : '')
                    || ''
                ).trim();
                if (!sourceKey) return null;
                if (props[sourceKey] !== undefined && props[sourceKey] !== null) return props[sourceKey];
                const foundKey = Object.keys(props).find((k) => String(k).toLowerCase() === sourceKey.toLowerCase());
                return foundKey ? props[foundKey] : null;
            };

            const parseGeometryValue = (value) => {
                if (!value) return null;
                if (typeof value === 'object' && value.type && value.coordinates) {
                    return value;
                }
                if (typeof value === 'string') {
                    try {
                        const parsedValue = JSON.parse(value);
                        if (parsedValue && parsedValue.type && parsedValue.coordinates) {
                            return parsedValue;
                        }
                    } catch (_) {
                        return null;
                    }
                }
                return null;
            };

            const resolveGeometry = (feature, props) => {
                const sourceKey = String(mapping?.geom || '').trim();
                if (!sourceKey || sourceKey === '__feature_geometry__' || sourceKey.toLowerCase() === 'geometry') {
                    return feature?.geometry || null;
                }
                const rawGeom = resolveValue(props, 'geom');
                return parseGeometryValue(rawGeom);
            };

            let inserted = 0;
            let totalValidFeatures = 0;
            const rowsToInsert = [];
            for (const feature of features) {
                const props = feature.properties || {};
                const sodoto = resolveValue(props, 'sodoto');
                const sothua = resolveValue(props, 'sothua');
                const geometry = resolveGeometry(feature, props);

                if (!geometry || !['Polygon', 'MultiPolygon'].includes(String(geometry.type || ''))) {
                    continue;
                }

                totalValidFeatures += 1;

                if (sodoto === null || sothua === null || String(sodoto).trim() === '' || String(sothua).trim() === '') {
                    continue;
                }

                const tenchu = resolveValue(props, 'tenchu');
                const diachi = resolveValue(props, 'diachi');
                const kyhieumucd = resolveValue(props, 'kyhieumucd');
                const dientichRaw = resolveValue(props, 'dientich');
                const dientich = (dientichRaw === null || dientichRaw === undefined || String(dientichRaw).trim() === '')
                    ? null
                    : Number(String(dientichRaw).replace(',', '.'));

                const parcelCode = await generateUniqueParcelCode(client, safeName, 'madinhdanh');
                rowsToInsert.push([
                    parcelCode,
                    String(sodoto),
                    String(sothua),
                    tenchu !== null && tenchu !== undefined ? String(tenchu) : null,
                    diachi !== null && diachi !== undefined ? String(diachi) : null,
                    kyhieumucd !== null && kyhieumucd !== undefined ? String(kyhieumucd) : null,
                    Number.isFinite(dientich) ? dientich : null,
                    JSON.stringify(geometry)
                ]);
            }

            if (totalValidFeatures === 0) {
                throw new Error('Không tìm thấy geometry Polygon/MultiPolygon hợp lệ theo ánh xạ geom.');
            }

            const batchSize = 200;
            for (let i = 0; i < rowsToInsert.length; i += batchSize) {
                const batch = rowsToInsert.slice(i, i + batchSize);
                const params = [];
                let idx = 1;

                const valuesSql = batch.map((row) => {
                    const placeholders = [
                        `$${idx++}`,
                        `$${idx++}`,
                        `$${idx++}`,
                        `$${idx++}`,
                        `$${idx++}`,
                        `$${idx++}`,
                        `$${idx++}`
                    ];
                    const geomPlaceholder = `$${idx++}`;
                    params.push(...row);
                    return `(${placeholders.join(', ')}, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${geomPlaceholder}), ${sourceSrid})))`;
                }).join(', ');

                await client.query(
                    `INSERT INTO "${safeName}" (madinhdanh, sodoto, sothua, tenchu, diachi, kyhieumucd, dientich, geometry) VALUES ${valuesSql}`,
                    params
                );
                inserted += batch.length;
            }

            await client.query('COMMIT');
            txStarted = false;
            SCHEMA_CACHE.delete(safeName);
            await logSystemAction(req, 'IMPORT_GEOJSON_PARCELS', `Import GeoJSON vào bảng mới ${safeName} (${inserted} bản ghi)`);

            res.json({
                status: 'ok',
                tableName: safeName,
                inserted,
                totalFeatures: totalValidFeatures
            });
        } catch (e) {
            if (txStarted) {
                await client.query('ROLLBACK');
            }
            res.status(500).json({ error: e.message });
        } finally {
            client.release();
            if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
    });

    router.post('/spatial-tables/link', authenticateToken, async (req, res) => {
        const { tableName, displayName, description } = req.body;
        try {
            const check = await pool.query(`SELECT to_regclass($1) as exists`, [tableName]);
            if (!check.rows[0].exists) throw new Error(`Bảng ${tableName} không tồn tại vật lý trong Database.`);
            await pool.query(`
                INSERT INTO spatial_tables_registry (table_name, display_name, description) VALUES ($1, $2, $3)
                ON CONFLICT (table_name) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description
            `, [tableName, displayName, description]);
            
            await syncTableSchema(tableName);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/spatial-tables/rename', authenticateToken, async (req, res) => {
        const { oldName, newName, displayName, description, renamePhysical } = req.body;
        try {
            await pool.query('BEGIN');
            
            // Nếu người dùng yêu cầu đổi tên vật lý VÀ tên có thay đổi
            if (renamePhysical && oldName !== newName) {
                const check = await pool.query(`SELECT to_regclass($1) as exists`, [oldName]);
                if (check.rows[0].exists) {
                    await pool.query(`ALTER TABLE "${oldName}" RENAME TO "${newName}"`);
                }
            }

            // Luôn cập nhật Registry
            await pool.query(`
                UPDATE spatial_tables_registry 
                SET table_name = $1, display_name = $2, description = $3 
                WHERE table_name = $4
            `, [newName, displayName, description, oldName]);
            
            await pool.query('COMMIT');
            SCHEMA_CACHE.delete(oldName);
            SCHEMA_CACHE.delete(newName);
            res.json({ status: 'ok' });
        } catch (e) {
            await pool.query('ROLLBACK');
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/spatial-tables/unlink', authenticateToken, async (req, res) => {
        const { tableName } = req.body;
        try {
            await pool.query(`DELETE FROM spatial_tables_registry WHERE table_name = $1`, [tableName]);
            SCHEMA_CACHE.delete(tableName);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Public endpoint for fast administrative name suggestions.
    router.get('/admin-search/:table/suggest', async (req, res) => {
        try {
            const q = String(req.query.q || '').trim();
            const limit = Math.min(Math.max(parseInt(String(req.query.limit || '8'), 10) || 8, 1), 20);
            if (!q) return res.json([]);

            let table;
            try {
                table = await resolveSafeTableName(req.params.table);
            } catch (_) {
                return res.json([]);
            }
            const nameCol = await resolveNameColumn(table);
            if (!nameCol) return res.json([]);

            const query = `
                SELECT DISTINCT "${nameCol}"::text as name
                FROM "${table}"
                WHERE "${nameCol}" IS NOT NULL
                  AND "${nameCol}"::text ILIKE $1
                ORDER BY "${nameCol}"::text ASC
                LIMIT $2
            `;
            const result = await pool.query(query, [`%${q}%`, limit]);
            res.json(result.rows.map((r) => ({ name: r.name }))); 
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Public endpoint for fast administrative lookup and highlight geometry.
    router.get('/admin-search/:table', async (req, res) => {
        try {
            const q = String(req.query.q || '').trim();
            const limit = Math.min(Math.max(parseInt(String(req.query.limit || '5'), 10) || 5, 1), 50);
            if (!q) return res.json([]);

            let table;
            try {
                table = await resolveSafeTableName(req.params.table);
            } catch (_) {
                return res.json([]);
            }
            const nameCol = await resolveNameColumn(table);
            if (!nameCol) return res.json([]);

            const existingCols = await getTableColumns(table);
            if (!existingCols.has('geometry')) return res.json([]);

            const optionalCols = ['ma_tinh', 'ten_tinh', 'sap_nhap', 'quy_mo', 'tru_so', 'loai', 'cap', 'dtich_km2', 'dan_so', 'matdo_km2', 'name', 'ten', 'province'];
            const selectedOptional = optionalCols.filter((c) => existingCols.has(c));
            const optionalSelect = selectedOptional.map((c) => `"${c}"::text as "${c}"`).join(', ');
            const optionalSql = optionalSelect ? `, ${optionalSelect}` : '';

            const query = `
                SELECT
                    gid,
                    "${nameCol}"::text as display_name,
                    ST_AsGeoJSON(
                        CASE 
                            WHEN ST_SRID(geometry) = 0 THEN ST_SetSRID(geometry, 4326)
                            WHEN ST_SRID(geometry) = 4326 THEN geometry
                            ELSE ST_Transform(geometry, 4326)
                        END
                    ) as geometry
                    ${optionalSql}
                FROM "${table}"
                WHERE "${nameCol}" IS NOT NULL
                  AND "${nameCol}"::text ILIKE $1
                ORDER BY "${nameCol}"::text ASC
                LIMIT $2
            `;
            const result = await pool.query(query, [`%${q}%`, limit]);
            const data = result.rows.map((row) => ({
                gid: row.gid,
                name: row.display_name,
                properties: selectedOptional.reduce((acc, key) => {
                    if (row[key] !== undefined && row[key] !== null) acc[key] = row[key];
                    return acc;
                }, {}),
                geometry: row.geometry ? JSON.parse(row.geometry) : null
            }));
            res.json(data);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Public endpoint: fetch one administrative feature by gid for click-highlight fallback.
    router.get('/admin-search/:table/by-gid/:gid', async (req, res) => {
        try {
            const gid = parseInt(String(req.params.gid || '0'), 10);
            if (!Number.isFinite(gid) || gid <= 0) return res.json(null);

            let table;
            try {
                table = await resolveSafeTableName(req.params.table);
            } catch (_) {
                return res.json(null);
            }

            const existingCols = await getTableColumns(table);
            if (!existingCols.has('geometry')) return res.json(null);

            const nameCol = await resolveNameColumn(table);
            const optionalCols = ['ma_tinh', 'ten_tinh', 'sap_nhap', 'quy_mo', 'tru_so', 'loai', 'cap', 'dtich_km2', 'dan_so', 'matdo_km2', 'name', 'ten', 'province'];
            const selectedOptional = optionalCols.filter((c) => existingCols.has(c));
            const optionalSelect = selectedOptional.map((c) => `"${c}"::text as "${c}"`).join(', ');
            const optionalSql = optionalSelect ? `, ${optionalSelect}` : '';
            const nameSelect = nameCol ? `, "${nameCol}"::text as display_name` : '';

            const query = `
                SELECT
                    gid
                    ${nameSelect}
                    ${optionalSql},
                    ST_AsGeoJSON(
                        CASE 
                            WHEN ST_SRID(geometry) = 0 THEN ST_SetSRID(geometry, 4326)
                            WHEN ST_SRID(geometry) = 4326 THEN geometry
                            ELSE ST_Transform(geometry, 4326)
                        END
                    ) as geometry
                FROM "${table}"
                WHERE gid = $1
                LIMIT 1
            `;
            const result = await pool.query(query, [gid]);
            if (result.rowCount === 0) return res.json(null);

            const row = result.rows[0];
            const properties = selectedOptional.reduce((acc, key) => {
                if (row[key] !== undefined && row[key] !== null) acc[key] = row[key];
                return acc;
            }, {});
            if (row.display_name) properties.ten_tinh = properties.ten_tinh || row.display_name;

            res.json({
                gid: row.gid,
                name: row.display_name || '',
                properties,
                geometry: row.geometry ? JSON.parse(row.geometry) : null
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Public read endpoint used by MapPage search panel.
    router.get('/data/:table', async (req, res) => {
        const { madinhdanh, sodoto, sothua, tenchu, diachi } = req.query;
        try {
            const table = await resolveSafeTableName(req.params.table);
            const cols = await resolveTableColumns(table);
            const page = Math.max(parseInt(req.query.page || '1', 10), 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit || '100', 10), 1), 500);
            const offset = (page - 1) * limit;
            
            const selectFields = ['gid'];
            const params = [];
            let idx = 1;

            const addSelectField = (key) => {
                if (cols[key]) {
                    selectFields.push(`"${cols[key]}" as ${key}`);
                }
            };

            addSelectField('madinhdanh');
            addSelectField('sodoto');
            addSelectField('sothua');
            addSelectField('tenchu');
            addSelectField('diachi');
            addSelectField('loaidat');
            addSelectField('dientich');
            addSelectField('image_url');
            
            selectFields.push('ST_AsGeoJSON(geometry) as geometry');

            const whereClauses = ['1=1'];

            if (madinhdanh && cols.madinhdanh) { whereClauses.push(`"${cols.madinhdanh}"::text = $${idx++}`); params.push(madinhdanh); }
            if (sodoto && cols.sodoto) { whereClauses.push(`"${cols.sodoto}"::text = $${idx++}`); params.push(sodoto); }
            if (sothua && cols.sothua) { whereClauses.push(`"${cols.sothua}"::text = $${idx++}`); params.push(sothua); }
            if (tenchu && cols.tenchu) {
                whereClauses.push(`translate(lower(COALESCE("${cols.tenchu}"::text, '')), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}') LIKE '%' || translate(lower($${idx++}), '${ACCENTED_CHARS}', '${UNACCENTED_CHARS}') || '%'`);
                params.push(String(tenchu).trim());
            }
            if (diachi && cols.diachi) { whereClauses.push(`"${cols.diachi}" ILIKE $${idx++}`); params.push(`%${diachi}%`); }

            const whereSql = whereClauses.join(' AND ');
            const countQuery = `SELECT COUNT(*)::int AS total FROM "${table}" WHERE ${whereSql}`;
            const countResult = await pool.query(countQuery, params);
            const total = countResult.rows[0]?.total || 0;

            const dataQuery = `SELECT ${selectFields.join(', ')} FROM "${table}" WHERE ${whereSql} ORDER BY gid DESC LIMIT $${idx++} OFFSET $${idx++}`;
            const dataParams = [...params, limit, offset];

            const result = await pool.query(dataQuery, dataParams);
            const data = result.rows.map(row => ({
                ...row,
                geometry: row.geometry ? JSON.parse(row.geometry) : null
            }));

            res.json({
                data,
                total,
                page,
                limit,
                pages: Math.max(Math.ceil(total / limit), 1)
            });
        } catch (e) {
            SCHEMA_CACHE.delete((req.params.table || '').toLowerCase());
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/data/:table', authenticateToken, async (req, res) => {
        const data = req.body;
        try {
            const table = await resolveSafeTableName(req.params.table);
            const cols = await resolveTableColumns(table);
            const targetSrid = cols._srid || 4326;
            const parcelCode = cols.madinhdanh ? await generateUniqueParcelCode(pool, table, cols.madinhdanh) : null;

            const fields = [];
            const placeholders = [];
            const params = [];
            let idx = 1;

            const addField = (key, value) => {
                if (cols[key]) {
                    fields.push(`"${cols[key]}"`);
                    placeholders.push(`$${idx}`);
                    params.push(value);
                    idx++;
                }
            };

            addField('madinhdanh', parcelCode);
            addField('sodoto', data.sodoto);
            addField('sothua', data.sothua);
            addField('tenchu', data.tenchu);
            addField('diachi', data.diachi);
            addField('loaidat', data.loaidat);
            addField('dientich', data.dientich);
            addField('image_url', data.image_url);

            if (data.geometry) {
                fields.push('geometry');
                placeholders.push(`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($${idx}), ${targetSrid}))`);
                params.push(JSON.stringify(data.geometry));
                idx++;
            }

            if (fields.length === 0) return res.status(400).json({ error: "Không có dữ liệu hợp lệ để chèn." });

            const query = `INSERT INTO "${table}" (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING gid, ${cols.madinhdanh ? `"${cols.madinhdanh}" as madinhdanh` : `NULL as madinhdanh`}`;
            const result = await pool.query(query, params);
            res.json({ status: 'ok', gid: result.rows[0].gid, madinhdanh: result.rows[0].madinhdanh });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/data/:table/bulk', authenticateToken, async (req, res) => {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Dữ liệu không hợp lệ." });
        try {
            const table = await resolveSafeTableName(req.params.table);
            const cols = await resolveTableColumns(table);
            const targetSrid = cols._srid || 4326;
            await pool.query('BEGIN');
            for (const item of items) {
                const parcelCode = cols.madinhdanh ? await generateUniqueParcelCode(pool, table, cols.madinhdanh) : null;
                const fields = [];
                const placeholders = [];
                const params = [];
                let idx = 1;

                const addField = (key, value) => {
                    if (cols[key]) {
                        fields.push(`"${cols[key]}"`);
                        placeholders.push(`$${idx}`);
                        params.push(value);
                        idx++;
                    }
                };

            addField('madinhdanh', item.madinhdanh || parcelCode);
                addField('sodoto', item.sodoto);
                addField('sothua', item.sothua);
                addField('tenchu', item.tenchu);
                addField('diachi', item.diachi);
                addField('loaidat', item.loaidat);
                addField('dientich', item.dientich);
                addField('image_url', item.image_url);

                if (item.geometry) {
                    fields.push('geometry');
                    placeholders.push(`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($${idx}), ${targetSrid}))`);
                    params.push(JSON.stringify(item.geometry));
                    idx++;
                }

                if (fields.length > 0) {
                    const query = `INSERT INTO "${table}" (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
                    await pool.query(query, params);
                }
            }
            await pool.query('COMMIT');
            await logSystemAction(req, 'BULK_IMPORT', `Nạp hàng loạt ${items.length} thửa đất vào bảng ${table}`);
            res.json({ status: 'ok', count: items.length });
        } catch (e) { await pool.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
    });

    router.put('/data/:table/:gid', authenticateToken, async (req, res) => {
        const { gid } = req.params;
        const data = req.body;
        try {
            const table = await resolveSafeTableName(req.params.table);
            const cols = await resolveTableColumns(table);
            const targetSrid = cols._srid || 4326;

            const updates = [];
            const params = [];
            let idx = 1;

            const addField = (key, value) => {
                if (cols[key]) {
                    updates.push(`"${cols[key]}"=$${idx}`);
                    params.push(value);
                    idx++;
                }
            };

            addField('madinhdanh', data.madinhdanh);
            addField('sodoto', data.sodoto);
            addField('sothua', data.sothua);
            addField('tenchu', data.tenchu);
            addField('diachi', data.diachi);
            addField('loaidat', data.loaidat);
            addField('dientich', data.dientich);
            addField('image_url', data.image_url);

            if (data.geometry) {
                updates.push(`geometry=ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($${idx}), ${targetSrid}))`);
                params.push(JSON.stringify(data.geometry));
                idx++;
            }

            if (updates.length === 0) return res.status(400).json({ error: "Không có dữ liệu hợp lệ để cập nhật." });

            const query = `UPDATE "${table}" SET ${updates.join(', ')} WHERE gid=$${idx}`;
            params.push(gid);
            await pool.query(query, params);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/data/:table/upload', authenticateToken, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'imageFile', maxCount: 1 }]), async (req, res) => {
        let table = '';
        const files = req.files;
        const file = files?.file?.[0];
        const imageFile = files?.imageFile?.[0];
        
        console.log(`[Upload] Files received: ${Object.keys(files || {}).length}`);
        if (file) console.log(`[Upload] Main file: ${file.originalname} (${file.size} bytes)`);
        if (imageFile) console.log(`[Upload] Image file: ${imageFile.originalname} (${imageFile.size} bytes)`);

        let data = req.body; 
        
        // Nếu có imageFile, lưu đường dẫn và xóa file tạm
        if (imageFile) {
            const ext = path.extname(imageFile.originalname);
            const newFileName = `parcel_${Date.now()}${ext}`;
            const targetPath = path.join(uploadDir, newFileName);
            console.log(`[Upload] Moving image file to: ${targetPath}`);
            try {
                fs.renameSync(imageFile.path, targetPath);
            } catch (err) {
                console.warn(`[Upload] renameSync failed, trying copy + unlink: ${err.message}`);
                // Nếu renameSync lỗi (ví dụ khác filesystem), dùng copy + unlink
                fs.copyFileSync(imageFile.path, targetPath);
                fs.unlinkSync(imageFile.path);
            }
            data.image_url = `/uploads/${newFileName}`;
        }

        try {
            table = await resolveSafeTableName(req.params.table);
            console.log(`[Upload] Starting upload for table: ${table}`);
            const cols = await resolveTableColumns(table);
            console.log(`[Upload] Table columns resolved:`, cols);
            const targetSrid = cols._srid || 4326;
            const parcelCode = !data.gid && cols.madinhdanh ? await generateUniqueParcelCode(pool, table, cols.madinhdanh) : null;

            let geometry = null;
            if (file) {
                const buffer = fs.readFileSync(file.path);
                console.log(`[Upload] Reading file buffer, size: ${buffer.length}`);
                let geojson;
                if (file.originalname.endsWith('.zip')) {
                    console.log(`[Upload] Parsing SHP ZIP...`);
                    geojson = await shp(buffer);
                } else {
                    console.log(`[Upload] Parsing JSON...`);
                    geojson = JSON.parse(buffer.toString());
                }
                console.log(`[Upload] GeoJSON parsed successfully`);

                if (Array.isArray(geojson)) geometry = geojson[0]?.features[0]?.geometry;
                else if (geojson.type === 'FeatureCollection') geometry = geojson.features[0]?.geometry;
                else if (geojson.type === 'Feature') geometry = geojson.geometry;
                else geometry = geojson;

                fs.unlinkSync(file.path);
            }

            const fields = [];
            const placeholders = [];
            const params = [];
            let idx = 1;

            const addField = (key, value) => {
                if (cols[key]) {
                    fields.push(`"${cols[key]}"`);
                    placeholders.push(`$${idx}`);
                    params.push(value);
                    idx++;
                }
            };

            addField('madinhdanh', data.madinhdanh || parcelCode);
            addField('sodoto', data.sodoto);
            addField('sothua', data.sothua);
            addField('tenchu', data.tenchu);
            addField('diachi', data.diachi);
            addField('loaidat', data.loaidat);
            addField('dientich', data.dientich);
            addField('image_url', data.image_url);

            if (geometry) {
                fields.push('geometry');
                placeholders.push(`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($${idx}), ${targetSrid}))`);
                params.push(JSON.stringify(geometry));
                idx++;
            }

            if (data.gid) {
                const updates = fields.map((f, i) => `${f}=${placeholders[i]}`).join(', ');
                const query = `UPDATE "${table}" SET ${updates} WHERE gid=$${idx}`;
                params.push(data.gid);
                await pool.query(query, params);
            } else {
                if (fields.length === 0) return res.status(400).json({ error: "Không có dữ liệu hợp lệ để chèn." });
                const query = `INSERT INTO "${table}" (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
                await pool.query(query, params);
            }
            res.json({ status: 'ok', image_url: data.image_url });
        } catch (e) {
            if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
            if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
            res.status(500).json({ error: e.message });
        }
    });

    // Public read endpoint for layer extent/zoom actions.
    router.get('/data/:table/extent', async (req, res) => {
        try {
            const table = await resolveSafeTableName(req.params.table);
            const result = await pool.query(`SELECT ST_XMin(ext) as xmin, ST_YMin(ext) as ymin, ST_XMax(ext) as xmax, ST_YMax(ext) as ymax FROM (SELECT ST_Extent(geometry) as ext FROM "${table}") as t`);
            res.json(result.rows[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/data/:table/:gid', authenticateToken, async (req, res) => {
        const { gid } = req.params;
        try {
            const table = await resolveSafeTableName(req.params.table);
            await pool.query(`DELETE FROM "${table}" WHERE gid=$1`, [gid]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}
