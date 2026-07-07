import express from 'express';
import { authenticateToken } from './middleware_auth.js';

const pickChangedFields = (before = {}, after = {}) => {
    const skip = new Set(['geometry', 'created_at', 'updated_at']);
    const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]))
        .filter(k => !skip.has(k));
    return keys
        .map(key => ({ key, before: before?.[key] ?? null, after: after?.[key] ?? null }))
        .filter(item => JSON.stringify(item.before) !== JSON.stringify(item.after));
};

const getAreaValue = (snap = {}) => {
    const v = snap?.dientich ?? snap?.dien_tich ?? snap?.area ?? snap?.shape_area;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const fallbackAnalysis = ({ action, before, after }) => {
    const changed = pickChangedFields(before, after);
    const beforeArea = getAreaValue(before);
    const afterArea = getAreaValue(after);
    const lines = [];

    lines.push(`## Tóm tắt biến động`);
    if (action === 'CREATE') lines.push(`- Thửa đất được tạo mới trong hệ thống.`);
    else if (action === 'DELETE') lines.push(`- Thửa đất đã bị xóa khỏi bảng dữ liệu.`);
    else lines.push(`- Thửa đất được cập nhật thông tin/hình học.`);

    if (beforeArea !== null || afterArea !== null) {
        const delta = beforeArea !== null && afterArea !== null ? afterArea - beforeArea : null;
        lines.push(`- Diện tích trước: ${beforeArea ?? 'không có'} m²; sau: ${afterArea ?? 'không có'} m²${delta !== null ? `; chênh lệch: ${delta.toFixed(2)} m²` : ''}.`);
        if (delta !== null && beforeArea && Math.abs(delta / beforeArea) > 0.2) {
            lines.push(`- Cảnh báo: diện tích thay đổi trên 20%, nên kiểm tra lại ranh giới và nguồn dữ liệu.`);
        }
    }

    if (changed.length > 0) {
        lines.push(`\n## Trường thay đổi`);
        changed.slice(0, 20).forEach(c => lines.push(`- ${c.key}: "${c.before ?? ''}" → "${c.after ?? ''}"`));
    } else {
        lines.push(`\n## Trường thay đổi`);
        lines.push(`- Không phát hiện thay đổi thuộc tính rõ ràng; có thể biến động chủ yếu nằm ở hình học.`);
    }

    lines.push(`\n## Gợi ý kiểm tra`);
    lines.push(`- Kiểm tra overlay hình học trước/sau để xác định cạnh hoặc vùng thay đổi.`);
    lines.push(`- Đối chiếu số tờ/số thửa, loại đất và diện tích pháp lý với hồ sơ nguồn.`);
    lines.push(`- Nếu biến động do phục hồi lịch sử, cần kiểm tra quyền và lý do phục hồi.`);

    return lines.join('\n');
};

const fallbackTopologyBatchAnalysis = ({ features = [], topologyFindings = [] }) => {
    const lines = ['## Kết quả AI kiểm tra dữ liệu/topology hàng loạt'];
    const warnings = [];
    const keyMap = new Map();

    features.forEach((f, idx) => {
        const label = `#${idx + 1} thửa ${f.sothua || '?'} / tờ ${f.sodoto || '?'}`;
        if (!f.sodoto || !f.sothua) warnings.push(`${label}: thiếu số tờ hoặc số thửa.`);
        const key = `${f.sodoto || ''}::${f.sothua || ''}`;
        if (f.sodoto && f.sothua) {
            if (keyMap.has(key)) warnings.push(`${label}: trùng số tờ/số thửa với ${keyMap.get(key)}.`);
            else keyMap.set(key, label);
        }
        const area = Number(f.area || f.dientich || 0);
        if (!Number.isFinite(area) || area <= 0) warnings.push(`${label}: diện tích không hợp lệ.`);
        else if (area < 5) warnings.push(`${label}: diện tích rất nhỏ (${area.toFixed(2)} m²), cần kiểm tra.`);
        else if (area > 100000) warnings.push(`${label}: diện tích rất lớn (${area.toFixed(2)} m²), cần kiểm tra hệ tọa độ hoặc hình học.`);
        if (!f.geometryType) warnings.push(`${label}: thiếu geometry.`);
        if (f.vertexCount && f.vertexCount < 4) warnings.push(`${label}: polygon có quá ít đỉnh.`);
        if (!f.loaidat) warnings.push(`${label}: thiếu loại đất/ký hiệu mục đích sử dụng.`);
    });

    lines.push(`- Tổng số thửa kiểm tra: ${features.length}`);
    lines.push(`- Số cảnh báo dữ liệu phát hiện: ${warnings.length}`);
    lines.push(`- Số phát hiện topology/hình học: ${topologyFindings.length}`);
    if (warnings.length > 0) {
        lines.push('\n## Cảnh báo');
        warnings.slice(0, 50).forEach(w => lines.push(`- ${w}`));
    } else {
        lines.push('\nKhông phát hiện lỗi dữ liệu rõ ràng theo các quy tắc kiểm tra cơ bản.');
    }
    if (topologyFindings.length > 0) {
        lines.push('\n## Lỗi topology / hình học');
        topologyFindings.slice(0, 50).forEach(f => lines.push(`- [${f.severity || 'info'}] ${f.message || `${f.type}: ${f.label || ''}`}`));
    }
    lines.push('\n## Gợi ý tiếp theo');
    lines.push('- Chạy kiểm tra chồng lấn ranh giới trong Editor để phát hiện overlap hình học.');
    lines.push('- Kiểm tra các thửa thiếu số tờ/số thửa hoặc thiếu loại đất trước khi lưu vào CSDL.');
    lines.push('- Với thửa diện tích bất thường, kiểm tra lại hệ tọa độ và nguồn import.');
    return lines.join('\n');
};

const getSettingsMap = async (pool) => {
    const res = await pool.query(`SELECT key, value FROM system_settings WHERE key LIKE 'ocr_%' OR key LIKE 'ai_%'`);
    return Object.fromEntries(res.rows.map(r => [r.key, r.value]));
};

const callGemini = async ({ apiKey, model, prompt }) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-flash-latest'}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json?.error?.message || `Gemini HTTP ${response.status}`);
    return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
};

const callNineRouter = async ({ apiKey, model, endpoint, prompt }) => {
    let url = endpoint || 'https://thzi-chinraoto.hf.space/v1';
    if (!url.endsWith('/chat/completions')) url += url.endsWith('/') ? 'chat/completions' : '/chat/completions';
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: model || '9router/google/gemini-1.5-flash',
            messages: [{ role: 'user', content: prompt }],
            stream: false
        })
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`9router HTTP ${response.status}: ${text.slice(0, 200)}`);
    const json = JSON.parse(text);
    return json?.choices?.[0]?.message?.content?.trim() || '';
};

const fallbackChat = (message = '', context = {}) => {
    const text = String(message || '').toLowerCase();
    const lines = [];
    lines.push('Tôi là Axis, trợ lý AI của hệ thống WebGIS quản lý đất đai.');

    if (text.includes('lịch sử') || text.includes('biến động')) {
        lines.push('Bạn có thể vào Editor hoặc Quản trị → Lịch sử biến động để xem trước/sau, overlay hình thửa và phục hồi biến động.');
    } else if (text.includes('thửa') || text.includes('số tờ') || text.includes('số thửa')) {
        lines.push('Bạn có thể dùng chức năng Tra cứu thửa đất theo số tờ/số thửa, hoặc dùng bản đồ để chọn thửa rồi xem thuộc tính.');
    } else if (text.includes('giá đất')) {
        lines.push('Bạn có thể vào mục Bảng giá đất để tra cứu theo phường/xã, tuyến đường và đoạn đường.');
    } else if (text.includes('editor') || text.includes('vẽ') || text.includes('chỉnh sửa')) {
        lines.push('Trong Editor, bạn có thể vẽ mới, chỉnh sửa đỉnh, tách/gộp thửa, import/export DXF/GeoJSON/SHP và lưu vào PostGIS.');
    } else {
        lines.push('Bạn có thể hỏi tôi về tra cứu thửa đất, chỉnh sửa bản đồ, lịch sử biến động, báo cáo, giá đất hoặc hướng dẫn sử dụng hệ thống.');
    }

    if (context?.page) lines.push(`\nNgữ cảnh hiện tại: ${context.page}.`);
    lines.push('\nGợi ý: hãy hỏi cụ thể hơn, ví dụ “Cách xem lịch sử biến động của thửa đang chọn?” hoặc “Làm sao xuất báo cáo biến động tháng này?”.');
    return lines.join('\n');
};

const TABLE_NAME_REGEX = /^[a-z0-9_]+$/;
const PARCEL_COL_CANDIDATES = {
    sodoto: ['sodoto', 'so_to', 'shbando', 'sh_ban_do', 'tobando', 'to_ban_do'],
    sothua: ['sothua', 'so_thua', 'shthua', 'sh_thua', 'thua_dat'],
    tenchu: ['tenchu', 'ten_chu', 'chu', 'chu_su_dung', 'chusudung', 'chu_so_huu', 'chusohuu', 'owner', 'owner_name'],
    loaidat: ['loaidat', 'loai_dat', 'kyhieumucd', 'ky_hieu_muc_dich'],
    dientich: ['dientich', 'dien_tich', 'area', 'shape_area'],
    madinhdanh: ['madinhdanh', 'ma_dinh_danh', 'parcel_code']
};

const normalizeSearchText = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const cleanOwnerName = (value = '') => String(value || '')
    .replace(/^(?:là|la|tên|ten|chủ|chu|chủ\s*sở\s*hữu|chu\s*so\s*huu|chủ\s*sử\s*dụng|chu\s*su\s*dung)\s+/i, '')
    .replace(/\s+(?:ở|tai|tại|thuộc|thuoc|trong|của|cua)(?:\s|$).*$/i, '')
    .replace(/[,.]+$/g, '')
    .trim();

const extractParcelIntent = (message = '') => {
    const raw = String(message || '');
    const text = raw.toLowerCase();
    const soTo =
        raw.match(/(?:số\s*)?tờ\s*(?:bản\s*đồ)?\s*(?:số\s*)?[:#-]?\s*([\w.-]+)/i)?.[1] ||
        raw.match(/to\s*(?:ban\s*do)?\s*(?:so\s*)?[:#-]?\s*([\w.-]+)/i)?.[1] || '';
    const soThua =
        raw.match(/(?:số\s*)?thửa\s*(?:số\s*)?[:#-]?\s*([\w.-]+)/i)?.[1] ||
        raw.match(/thua\s*(?:so\s*)?[:#-]?\s*([\w.-]+)/i)?.[1] || '';
    const owner = cleanOwnerName(
        raw.match(/(?:tên\s*chủ|ten\s*chu|chủ\s*sở\s*hữu|chu\s*so\s*huu|chủ\s*sử\s*dụng|chu\s*su\s*dung|chủ|chu)\s+([^,;\n]+?)(?=\s+(?:ở|tai|tại|thuộc|thuoc|tờ|to|số\s*tờ|so\s*to|thửa|thua)(?:\s|$)|$)/i)?.[1] || ''
    );
    const madinhdanh = (
        raw.match(/(?:mã\s*định\s*danh|ma\s*dinh\s*danh|mã\s*thửa|ma\s*thua|parcel\s*(?:code|id))\s*[:#-]?\s*([a-z0-9_.-]+)/i)?.[1] || ''
    ).replace(/[,.]$/, '');
    return {
        soTo: soTo.replace(/[,.]$/, ''),
        soThua: soThua.replace(/[,.]$/, ''),
        owner,
        madinhdanh,
        wantsHistory: /lịch\s*sử|biến\s*động|thay\s*đổi|phục\s*hồi/i.test(text),
        wantsParcel: /thửa|thua|số\s*tờ|tờ\s*bản\s*đồ|số\s*thửa|tên\s*chủ|ten\s*chu|chủ\s*sở\s*hữu|chủ\s*sử\s*dụng|mã\s*định\s*danh|ma\s*dinh\s*danh|mã\s*thửa|ma\s*thua|parcel\s*(?:code|id)/i.test(text)
    };
};

const getRegisteredTables = async (pool) => {
    const r = await pool.query(`SELECT table_name, display_name FROM spatial_tables_registry ORDER BY display_name NULLS LAST, table_name`);
    return r.rows.filter(row => TABLE_NAME_REGEX.test(row.table_name));
};

const resolveColumns = async (pool, table) => {
    const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]);
    const lowerMap = Object.fromEntries(r.rows.map(row => [String(row.column_name).toLowerCase(), row.column_name]));
    const find = (key) => PARCEL_COL_CANDIDATES[key].find(c => lowerMap[c]) ? lowerMap[PARCEL_COL_CANDIDATES[key].find(c => lowerMap[c])] : null;
    return {
        gid: lowerMap.gid || lowerMap.id || null,
        geometry: lowerMap.geometry || null,
        sodoto: find('sodoto'),
        sothua: find('sothua'),
        tenchu: find('tenchu'),
        loaidat: find('loaidat'),
        dientich: find('dientich'),
        madinhdanh: find('madinhdanh')
    };
};

const searchParcelsBySheetParcel = async (pool, { soTo, soThua, owner, madinhdanh }) => {
    if (!soTo && !soThua && !owner && !madinhdanh) return [];
    const tables = await getRegisteredTables(pool);
    const results = [];
    const normalizedOwner = normalizeSearchText(owner);
    for (const tableInfo of tables) {
        if (results.length >= 10) break;
        const table = tableInfo.table_name;
        const cols = await resolveColumns(pool, table);
        if (!cols.gid || (!cols.sodoto && soTo) || (!cols.sothua && soThua) || (!cols.tenchu && owner) || (!cols.madinhdanh && madinhdanh)) continue;

        const where = [];
        const params = [];
        let idx = 1;
        if (soTo && cols.sodoto) {
            where.push(`"${cols.sodoto}"::text ILIKE $${idx++}`);
            params.push(soTo);
        }
        if (soThua && cols.sothua) {
            where.push(`"${cols.sothua}"::text ILIKE $${idx++}`);
            params.push(soThua);
        }
        if (owner && cols.tenchu) {
            where.push(`(
                "${cols.tenchu}"::text ILIKE $${idx}
                OR regexp_replace(replace(lower("${cols.tenchu}"::text), 'đ', 'd'), '[^a-z0-9]+', ' ', 'g') LIKE $${idx + 1}
            )`);
            params.push(`%${owner}%`, `%${normalizedOwner}%`);
            idx += 2;
        }
        if (madinhdanh && cols.madinhdanh) {
            where.push(`"${cols.madinhdanh}"::text ILIKE $${idx++}`);
            params.push(madinhdanh);
        }
        if (where.length === 0) continue;

        const selectParts = [
            `"${cols.gid}" AS gid`,
            cols.sodoto ? `"${cols.sodoto}" AS sodoto` : `NULL AS sodoto`,
            cols.sothua ? `"${cols.sothua}" AS sothua` : `NULL AS sothua`,
            cols.tenchu ? `"${cols.tenchu}" AS tenchu` : `NULL AS tenchu`,
            cols.loaidat ? `"${cols.loaidat}" AS loaidat` : `NULL AS loaidat`,
            cols.dientich ? `"${cols.dientich}" AS dientich` : `NULL AS dientich`,
            cols.madinhdanh ? `"${cols.madinhdanh}" AS madinhdanh` : `NULL AS madinhdanh`,
            cols.geometry ? `CASE WHEN "${cols.geometry}" IS NOT NULL THEN ST_AsGeoJSON(ST_Transform("${cols.geometry}", 4326))::json ELSE NULL END AS geometry` : `NULL AS geometry`
        ];

        try {
            const q = `SELECT ${selectParts.join(', ')} FROM "${table}" WHERE ${where.join(' AND ')} LIMIT 5`;
            const r = await pool.query(q, params);
            r.rows.forEach(row => results.push({ ...row, table_name: table, display_name: tableInfo.display_name || table }));
        } catch (_) {}
    }
    return results;
};

const getRecentHistoryForParcel = async (pool, table, gid) => {
    try {
        const r = await pool.query(
            `SELECT id, action, changed_by_name, changed_at, note,
                    COALESCE(snapshot_after->>'dientich', snapshot_before->>'dientich', snapshot->>'dientich') AS dientich
             FROM parcel_history
             WHERE table_name = $1 AND parcel_gid = $2
             ORDER BY changed_at DESC
             LIMIT 5`,
            [table, gid]
        );
        return r.rows;
    } catch {
        return [];
    }
};

const buildDataLookupFallback = ({ intent, parcels, histories }) => {
    if (!intent.wantsParcel || (!intent.soTo && !intent.soThua && !intent.owner && !intent.madinhdanh)) return null;
    if (parcels.length === 0) {
        return `Không tìm thấy thửa phù hợp${intent.madinhdanh ? ` với mã định danh "${intent.madinhdanh}"` : ''}${intent.owner ? ` với tên chủ "${intent.owner}"` : ''}${intent.soTo ? `, số tờ "${intent.soTo}"` : ''}${intent.soThua ? `, số thửa "${intent.soThua}"` : ''} trong các bảng dữ liệu đã đăng ký.`;
    }
    const lines = [`Tìm thấy ${parcels.length} thửa phù hợp:`];
    parcels.slice(0, 5).forEach((p, i) => {
        lines.push(`${i + 1}. Bảng ${p.display_name} (${p.table_name}), GID ${p.gid}: chủ ${p.tenchu || 'chưa rõ'}, thửa ${p.sothua || '?'} / tờ ${p.sodoto || '?'}, loại đất ${p.loaidat || 'chưa rõ'}, diện tích ${p.dientich || 'chưa rõ'} m².`);
        const h = histories?.[`${p.table_name}:${p.gid}`] || [];
        if (intent.wantsHistory) {
            if (h.length === 0) lines.push(`   - Chưa có lịch sử biến động gần đây.`);
            else h.forEach(item => lines.push(`   - ${item.action} lúc ${new Date(item.changed_at).toLocaleString('vi-VN')} bởi ${item.changed_by_name || 'không rõ'}${item.note ? ` (${item.note})` : ''}`));
        }
    });
    return lines.join('\n');
};

const normalizeLandPriceText = (s = '') => String(s)
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const cleanPlaceName = (value = '') => String(value)
    .replace(/\(.*/g, '')
    .replace(/\(.+?\)/g, '')
    .replace(/\b(bến cát|ben cat|bình dương|binh duong|tp\.?hcm|hồ chí minh|ho chi minh)\b/ig, '')
    .replace(/[,.]+$/g, '')
    .trim();

const extractLandPriceIntent = (message = '', context = {}) => {
    const raw = String(message || '');
    const lower = raw.toLowerCase();
    const page = String(context?.page || '').toLowerCase();
    const hasPriceWords = /giá\s*đất|bảng\s*giá|gia\s*dat|bang\s*gia/.test(lower);
    const hasStreetWords = /đường|duong|tuyến|tuyen|đh|dh|đt|dt|ql|quốc\s*lộ|quoc\s*lo/.test(lower);
    const hasPlaceWords = /phường|phuong|xã|xa|thị trấn|thi tran/.test(lower);
    const wantsLandPrice = hasPriceWords || page.includes('land-price') || page.includes('giadata') || (hasPlaceWords && /xem|tra|tìm|thông tin|thong tin/.test(lower)) || (hasStreetWords && /ở|tai|tại|khu vực|khu vuc/.test(lower));
    if (!wantsLandPrice) return { wantsLandPrice: false, street: '', ward: '', tinhcu: '' };

    let street = raw.match(/(?:đường|duong|tuyến|tuyen)\s+([^,;\n]+?)(?=\s+(?:ở|tai|tại|phường|phuong|xã|xa|thị trấn|thi tran)\b|$)/i)?.[1]?.trim() || '';
    if (!street) {
        street = raw.match(/\b(?:đh|dh|đt|dt|ql|quốc\s*lộ|quoc\s*lo)[\s.\-]*\d+[\w.\-]*/i)?.[0]?.trim() || '';
    }
    const wardRaw = raw.match(/(?:phường|phuong|xã|xa|thị trấn|thi tran)\s+([^,;\n]+)/i)?.[1]?.trim()
        || raw.match(/(?:ở|tai|tại|khu vực|khu vuc)\s+([^,;\n]+)/i)?.[1]?.trim()
        || '';
    const paren = raw.match(/\(([^)]+)\)/)?.[1] || '';
    const parenParts = paren.split(',').map(s => s.trim()).filter(Boolean);
    const tinhcu = parenParts.length > 0 ? parenParts[parenParts.length - 1] : (lower.includes('bình dương') || lower.includes('binh duong') ? 'Bình Dương' : '');
    let ward = cleanPlaceName(wardRaw);
    if (!ward && paren) {
        ward = cleanPlaceName(raw.split('(')[0]
            .replace(/giá\s*đất|bảng\s*giá|gia\s*dat|bang\s*gia|xem|tra|tìm|thông\s*tin|thong\s*tin/ig, '')
            .trim());
    }
    return { wantsLandPrice, street, ward, tinhcu };
};

const searchLandPrices = async (pool, intent) => {
    if (!intent?.wantsLandPrice) return [];
    const filters = [];
    const params = [];
    let idx = 1;

    if (intent.street) {
        const normalized = `%${normalizeLandPriceText(intent.street)}%`;
        const digits = String(intent.street).replace(/\D/g, '');
        filters.push(`(
            tenduong ILIKE $${idx}
            OR regexp_replace(replace(lower(tenduong), 'đ', 'd'), '[^a-z0-9]+', '', 'g') LIKE $${idx + 1}
            ${digits ? `OR regexp_replace(tenduong, '\\D', '', 'g') LIKE $${idx + 2}` : ''}
        )`);
        params.push(`%${intent.street}%`, normalized);
        if (digits) params.push(`%${digits}%`);
        idx += digits ? 3 : 2;
    }
    if (intent.ward) {
        filters.push(`phuongxa ILIKE $${idx++}`);
        params.push(`%${intent.ward}%`);
    }
    if (intent.tinhcu) {
        filters.push(`tinhcu ILIKE $${idx++}`);
        params.push(`%${intent.tinhcu}%`);
    }
    if (filters.length === 0) return [];

    const where = `WHERE ${filters.join(' AND ')}`;
    try {
        const r = await pool.query(`
            SELECT id, phuongxa, tinhcu, tenduong, tu, den, dato, dattmdv, datsxkdpnn, nam_ap_dung, nguon_du_lieu, ghi_chu
            FROM bang_gia_dat_2026
            ${where}
            ORDER BY tinhcu ASC, phuongxa ASC, tenduong ASC, tu ASC
            LIMIT 20
        `, params);
        return r.rows;
    } catch (e) {
        if (e.code === '42P01') return [];
        throw e;
    }
};

const buildLandPriceFallback = ({ intent, results }) => {
    if (!intent?.wantsLandPrice) return null;
    if (!results || results.length === 0) {
        return `Axis chưa tìm thấy dòng giá đất phù hợp${intent.street ? ` cho "${intent.street}"` : ''}${intent.ward ? ` tại ${intent.ward}` : ''}${intent.tinhcu ? ` (${intent.tinhcu})` : ''}. Bạn có thể thử viết tên đường đầy đủ hơn hoặc kiểm tra lại tên phường/xã.`;
    }
    const lines = [`Axis tìm thấy ${results.length} dòng giá đất phù hợp${intent.street ? ` cho "${intent.street}"` : ''}${intent.ward ? ` tại ${intent.ward}` : ''}${intent.tinhcu ? ` (${intent.tinhcu})` : ''}:`];
    results.slice(0, 8).forEach((r, i) => {
        lines.push(`${i + 1}. ${r.tenduong} — ${r.phuongxa}${r.tinhcu ? ` (${r.tinhcu})` : ''}, đoạn ${r.tu || '?'} → ${r.den || '?'}`);
        lines.push(`   - Đất ở: ${(Number(r.dato || 0) * 1000).toLocaleString('vi-VN')} đ/m²; TM-DV: ${(Number(r.dattmdv || 0) * 1000).toLocaleString('vi-VN')} đ/m²; SX-KD PNN: ${(Number(r.datsxkdpnn || 0) * 1000).toLocaleString('vi-VN')} đ/m².`);
    });
    return lines.join('\n');
};

export default function aiRouter(pool, logSystemAction) {
    const router = express.Router();

    router.post('/analyze-parcel-history', authenticateToken, async (req, res) => {
        try {
            const { action, before, after, context } = req.body || {};
            const settings = await getSettingsMap(pool).catch(() => ({}));
            const changed = pickChangedFields(before, after);
            const fallback = fallbackAnalysis({ action, before, after });

            const prompt = `Bạn là trợ lý AI nghiệp vụ đất đai. Hãy phân tích biến động thửa đất bằng tiếng Việt, ngắn gọn nhưng chuyên nghiệp.\n\nYêu cầu trả lời theo Markdown với các mục:\n1. Tóm tắt biến động\n2. Thay đổi thuộc tính quan trọng\n3. Nhận xét về diện tích/hình học nếu có\n4. Cảnh báo rủi ro\n5. Gợi ý kiểm tra tiếp theo\n\nContext: ${JSON.stringify(context || {})}\nAction: ${action}\nChanged fields: ${JSON.stringify(changed)}\nBefore: ${JSON.stringify(before || {})}\nAfter: ${JSON.stringify(after || {})}`;

            let analysis = '';
            let provider = 'fallback';
            try {
                if (settings.ocr_use_9router === 'true' && settings.ocr_9router_key) {
                    analysis = await callNineRouter({
                        apiKey: settings.ocr_9router_key,
                        model: settings.ocr_9router_model,
                        endpoint: settings.ocr_9router_endpoint,
                        prompt
                    });
                    provider = '9router';
                } else if (settings.ocr_use_gemini === 'true' && settings.ocr_gemini_key) {
                    analysis = await callGemini({
                        apiKey: settings.ocr_gemini_key,
                        model: settings.ocr_gemini_model,
                        prompt
                    });
                    provider = 'gemini';
                }
            } catch (aiError) {
                analysis = `${fallback}\n\n> Ghi chú: AI cloud lỗi (${aiError.message}), hệ thống đã dùng phân tích nội bộ.`;
                provider = 'fallback';
            }

            if (!analysis) analysis = fallback;
            await logSystemAction?.(req, 'AI_ANALYZE_PARCEL_HISTORY', `Phân tích biến động thửa đất bằng ${provider}`);
            res.json({ status: 'ok', provider, analysis, changedFields: changed });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/chat', authenticateToken, async (req, res) => {
        try {
            const { message, history = [], context = {} } = req.body || {};
            if (!message || !String(message).trim()) {
                return res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
            }

            const settings = await getSettingsMap(pool).catch(() => ({}));
            const intent = extractParcelIntent(message);
            const landPriceIntent = extractLandPriceIntent(message, context);
            const parcels = intent.wantsParcel ? await searchParcelsBySheetParcel(pool, intent).catch(() => []) : [];
            const landPrices = landPriceIntent.wantsLandPrice ? await searchLandPrices(pool, landPriceIntent).catch(() => []) : [];
            const histories = {};
            if (intent.wantsHistory && parcels.length > 0) {
                for (const p of parcels.slice(0, 5)) {
                    histories[`${p.table_name}:${p.gid}`] = await getRecentHistoryForParcel(pool, p.table_name, p.gid);
                }
            }
            const dataLookupFallback = buildDataLookupFallback({ intent, parcels, histories });
            const landPriceFallback = buildLandPriceFallback({ intent: landPriceIntent, results: landPrices });
            const systemPrompt = `Bạn tên là Axis, trợ lý AI tiếng Việt cho hệ thống WebGIS quản lý đất đai QLDDHCM.\n\nPhong cách giao tiếp:\n- Xưng là Axis khi cần, nói tự nhiên, chuyên nghiệp, thân thiện.\n- Trả lời ngắn gọn, rõ ràng, đúng nghiệp vụ đất đai/bản đồ.\n- Không nhắc lộ chi tiết context nội bộ trừ khi người dùng hỏi trực tiếp.\n\nNhiệm vụ:\n- Hướng dẫn người dùng thao tác trong hệ thống: bản đồ, editor, quản trị, lịch sử biến động, bảng giá đất, import/export.\n- Nếu người dùng hỏi dữ liệu cụ thể nhưng chưa có dữ liệu trong context, hãy nói cần dùng chức năng tra cứu/lọc hoặc chọn thửa trên bản đồ.\n- Khi trả lời về bảng giá đất, KHÔNG gợi ý click tuyến đường trên bản đồ. Hãy gợi ý bấm nút xem chi tiết giá đất hoặc mở trang tra cứu giá đất.\n- Không bịa số liệu pháp lý.\n\nContext nội bộ: ${JSON.stringify(context || {})}\n\nLịch sử chat gần đây: ${JSON.stringify((history || []).slice(-8))}\n\nCâu hỏi người dùng: ${message}`;
            const enrichedPrompt = `${systemPrompt}\n\nDữ liệu tra cứu thật từ CSDL (nếu có):\n${JSON.stringify({ intent, parcels: parcels.slice(0, 5), histories, landPriceIntent, landPrices }, null, 2)}\n\nNếu có dữ liệu tra cứu thật, hãy ưu tiên trả lời dựa trên dữ liệu này.`;

            let reply = '';
            let provider = 'fallback';
            try {
                if (settings.ocr_use_9router === 'true' && settings.ocr_9router_key) {
                    reply = await callNineRouter({
                        apiKey: settings.ocr_9router_key,
                        model: settings.ocr_9router_model,
                        endpoint: settings.ocr_9router_endpoint,
                        prompt: enrichedPrompt
                    });
                    provider = '9router';
                } else if (settings.ocr_use_gemini === 'true' && settings.ocr_gemini_key) {
                    reply = await callGemini({
                        apiKey: settings.ocr_gemini_key,
                        model: settings.ocr_gemini_model,
                        prompt: enrichedPrompt
                    });
                    provider = 'gemini';
                }
            } catch (aiError) {
                reply = `${landPriceFallback || dataLookupFallback || fallbackChat(message, context)}\n\n> Ghi chú: AI cloud lỗi (${aiError.message}), hệ thống đã dùng trả lời nội bộ.`;
                provider = 'fallback';
            }

            if (!reply) reply = landPriceFallback || dataLookupFallback || fallbackChat(message, context);
            await logSystemAction?.(req, 'AI_CHAT', `Người dùng hỏi AI (${provider}): ${String(message).slice(0, 120)}`);
            res.json({
                status: 'ok',
                provider,
                reply,
                parcels: parcels.slice(0, 5).map(p => ({
                    gid: p.gid,
                    table_name: p.table_name,
                    display_name: p.display_name,
                    sodoto: p.sodoto,
                    sothua: p.sothua,
                    tenchu: p.tenchu,
                    loaidat: p.loaidat,
                    dientich: p.dientich,
                    madinhdanh: p.madinhdanh,
                    geometry: p.geometry
                })),
                landPrices: landPrices.slice(0, 10)
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/analyze-topology-batch', authenticateToken, async (req, res) => {
        try {
            const { features = [], context = {} } = req.body || {};
            if (!Array.isArray(features) || features.length === 0) {
                return res.status(400).json({ error: 'Không có danh sách thửa để kiểm tra.' });
            }
            const limitedFeatures = features.slice(0, 200);
            const topologyFindings = Array.isArray(context?.topologyFindings) ? context.topologyFindings.slice(0, 200) : [];
            const settings = await getSettingsMap(pool).catch(() => ({}));
            const fallback = fallbackTopologyBatchAnalysis({ features: limitedFeatures, topologyFindings });
            const prompt = `Bạn tên là Axis, trợ lý AI kiểm tra dữ liệu đất đai/topology. Hãy phân tích danh sách thửa dưới đây bằng tiếng Việt.\n\nYêu cầu:\n- Tóm tắt số lượng thửa và chất lượng dữ liệu.\n- Phát hiện lỗi thuộc tính: thiếu số tờ/số thửa, thiếu loại đất, diện tích bất thường, trùng định danh.\n- Phân tích findings hình học thật: overlap, self-intersection, geometry không hợp lệ, kiểm tra giao cắt lỗi.\n- Không bịa lỗi không có dữ liệu chứng minh.\n- Trả lời Markdown ngắn gọn, có mục Cảnh báo và Gợi ý xử lý.\n\nContext: ${JSON.stringify(context)}\nTopology findings: ${JSON.stringify(topologyFindings)}\nFeatures: ${JSON.stringify(limitedFeatures)}`;

            let analysis = '';
            let provider = 'fallback';
            try {
                if (settings.ocr_use_9router === 'true' && settings.ocr_9router_key) {
                    analysis = await callNineRouter({
                        apiKey: settings.ocr_9router_key,
                        model: settings.ocr_9router_model,
                        endpoint: settings.ocr_9router_endpoint,
                        prompt
                    });
                    provider = '9router';
                } else if (settings.ocr_use_gemini === 'true' && settings.ocr_gemini_key) {
                    analysis = await callGemini({
                        apiKey: settings.ocr_gemini_key,
                        model: settings.ocr_gemini_model,
                        prompt
                    });
                    provider = 'gemini';
                }
            } catch (aiError) {
                analysis = `${fallback}\n\n> Ghi chú: AI cloud lỗi (${aiError.message}), hệ thống đã dùng kiểm tra nội bộ.`;
                provider = 'fallback';
            }
            if (!analysis) analysis = fallback;
            await logSystemAction?.(req, 'AI_ANALYZE_TOPOLOGY_BATCH', `AI kiểm tra ${limitedFeatures.length} thửa bằng ${provider}`);
            res.json({ status: 'ok', provider, analysis });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
