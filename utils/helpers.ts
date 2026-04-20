
/**
 * Loại bỏ dấu tiếng Việt để phục vụ tìm kiếm không dấu
 */
export const removeAccents = (str: string): string => {
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd').replace(/Đ/g, 'D')
              .toLowerCase();
};

/**
 * Định dạng tiền tệ VNĐ
 * @param val Giá trị số
 * @param isVnd Nếu true, nhân với 1000 (do dữ liệu gốc lưu đơn vị nghìn đồng)
 */
export const formatCurrency = (val: number, isVnd = false): string => {
    const finalVal = isVnd ? val * 1000 : val;
    return new Intl.NumberFormat('vi-VN').format(finalVal) + (isVnd ? " VNĐ/m²" : "");
};

const getParcelFormatValue = (source: any, keys: string[]): string => {
    for (const key of keys) {
        const value = source?.[key] ?? source?.properties?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }
    return '';
};

const normalizeTableLabel = (value: string): string => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const withoutSchema = raw.includes('.') ? raw.split('.').pop() || raw : raw;
    return withoutSchema.replace(/[_-]+/g, ' ').trim();
};

export const formatParcelIdentifier = (source: any, template?: string): string => {
    const soTo = getParcelFormatValue(source, ['so_to', 'sodoto', 'shbando', 'to', 'map_sheet']);
    const soThua = getParcelFormatValue(source, ['so_thua', 'sothua', 'shthua', 'thua', 'parcel_no']);
    const gid = getParcelFormatValue(source, ['gid', 'id']);
    const owner = getParcelFormatValue(source, ['ownerName', 'tenchu', 'owner']);
    const landType = getParcelFormatValue(source, ['landType', 'loaidat', 'land_type']);
    const wardName = getParcelFormatValue(source, ['display_name', 'tableDisplayName'])
        || normalizeTableLabel(getParcelFormatValue(source, ['tableName', 'table_name']))
        || getParcelFormatValue(source, ['phuongxa', 'phuong_xa', 'ward', 'ward_name', 'xa', 'ten_xa']);
    const format = String(template || '{so_to}/{so_thua}').trim() || '{so_to}/{so_thua}';

    const mapped = format.replace(/\{(so_to|so_thua|gid|owner|land_type|loai_dat|phuong_xa|phuongxa|ward|ten_bang|table_name)\}/gi, (_, token: string) => {
        const normalized = token.toLowerCase();
        if (normalized === 'so_to') return soTo;
        if (normalized === 'so_thua') return soThua;
        if (normalized === 'gid') return gid;
        if (normalized === 'owner') return owner;
        if (normalized === 'land_type' || normalized === 'loai_dat') return landType;
        if (normalized === 'phuong_xa' || normalized === 'phuongxa' || normalized === 'ward' || normalized === 'ten_bang' || normalized === 'table_name') return wardName;
        return '';
    });

    const cleaned = mapped
        .replace(/\s{2,}/g, ' ')
        .replace(/[\-_/,:\s]{2,}/g, (match) => match.charAt(0))
        .replace(/^[\-_/,:\s]+|[\-_/,:\s]+$/g, '')
        .trim();

    return cleaned || [soTo, soThua].filter(Boolean).join('/') || gid || 'Chưa có mã';
};

export const toSafeFilename = (value: string, fallback = 'parcel'): string => {
    const normalized = removeAccents(value || fallback)
        .replace(/[^a-z0-9]+/gi, '_')
        .replace(/^_+|_+$/g, '');
    return normalized || fallback;
};
