
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { adminService, hasAnyPermission } from '../../services/mockBackend';
import { SystemSetting } from '../../types';
import { Settings, Save, DatabaseBackup, Download, RefreshCw, AlertTriangle, Image as ImageIcon, Trash2, Map as MapIcon, CheckCircle2, X, Info, Table, CheckSquare, Square, Check, Globe, Mail, Activity, Cpu, HardDrive, Clock, FileText, Eye, EyeOff, Upload, History, Wifi, WifiOff, Zap } from 'lucide-react';
import { PDF_TEMPLATE_PRESETS, getPdfTemplatePreset } from '../../utils/pdfTemplatePresets';
import { formatParcelIdentifier as formatParcelValue } from '../../utils/helpers';

const SETTING_METADATA: Record<string, { label: string; description: string; type: 'text' | 'number' | 'boolean' | 'image' }> = {
    'system_name': { label: 'Tên hệ thống', description: 'Tên hiển thị chính trên website và tiêu đề trình duyệt', type: 'text' },
    'site_logo': { label: 'Logo Website', description: 'Logo hiển thị trên Sidebar (Ảnh nền trong suốt)', type: 'image' },
    'site_favicon': { label: 'Favicon', description: 'Biểu tượng nhỏ trên tab trình duyệt', type: 'image' },
    'maintenance_mode': { label: 'Chế độ bảo trì', description: 'Chỉ cho phép Admin truy cập hệ thống', type: 'boolean' },
    'allow_registration': { label: 'Cho phép đăng ký', description: 'Bật/Tắt nút đăng ký tài khoản mới ở trang login', type: 'boolean' },
    'seo_title': { label: 'Tiêu đề SEO (Suffix)', description: 'Phần mở rộng tiêu đề trang (VD: Tra cứu quy hoạch 2026)', type: 'text' },
    'seo_description': { label: 'Mô tả Meta SEO', description: 'Mô tả ngắn gọn để Google tìm kiếm và hiển thị', type: 'text' },
    'seo_keywords': { label: 'Từ khóa SEO', description: 'Các từ khóa cách nhau bởi dấu phẩy', type: 'text' },
    'seo_og_image': { label: 'Ảnh chia sẻ MXH', description: 'Ảnh hiển thị khi gửi link qua Zalo, Facebook', type: 'image' },
    'mail_provider': { label: 'Nhà cung cấp Mail', description: 'Chọn nhanh loại máy chủ SMTP như Gmail, Outlook, Brevo hoặc cấu hình thủ công', type: 'text' },
    'mail_host': { label: 'SMTP Host', description: 'Địa chỉ máy chủ SMTP, có thể tự điền theo nhà cung cấp đã chọn', type: 'text' },
    'mail_port': { label: 'SMTP Port', description: 'Cổng gửi thư (Brevo: 587, SSL thường dùng: 465)', type: 'number' },
    'mail_user': { label: 'Tài khoản Email', description: 'Email dùng để gửi thư hệ thống', type: 'text' },
    'mail_pass': { label: 'Mật khẩu ứng dụng', description: 'Mật khẩu ứng dụng (App Password) của Gmail/Outlook', type: 'text' },
    'mail_from_email': { label: 'Email người gửi (From)', description: 'Email hiển thị ở địa chỉ người gửi (VD: hotro@qlddhcm.io.vn)', type: 'text' },
    'mail_from_name': { label: 'Tên người gửi', description: 'Tên hiển thị khi khách nhận được email', type: 'text' },
    'footer_text': { label: 'Thông tin chân trang', description: 'Thông tin bản quyền và liên hệ cuối trang', type: 'text' },
    'map_center_lat': { label: 'Vĩ độ trung tâm (Lat)', description: 'Vĩ độ mặc định khi tải bản đồ', type: 'number' },
    'map_center_lng': { label: 'Kinh độ trung tâm (Lng)', description: 'Kinh độ mặc định khi tải bản đồ', type: 'number' },
    'default_zoom': { label: 'Mức Zoom mặc định', description: 'Mức zoom khi mới mở bản đồ (VD: 12)', type: 'number' },
    'map_max_zoom': { label: 'Mức Zoom tối đa', description: 'Mức zoom lớn nhất cho phép', type: 'number' },
    'map_min_zoom': { label: 'Mức Zoom tối thiểu', description: 'Mức zoom nhỏ nhất cho phép', type: 'number' },
    'thematic_map_center_lat': { label: 'HC - Vĩ độ trung tâm (Lat)', description: 'Vĩ độ mặc định cho trang Đơn vị hành chính', type: 'number' },
    'thematic_map_center_lng': { label: 'HC - Kinh độ trung tâm (Lng)', description: 'Kinh độ mặc định cho trang Đơn vị hành chính', type: 'number' },
    'thematic_default_zoom': { label: 'HC - Zoom mặc định', description: 'Mức zoom mặc định cho trang Đơn vị hành chính', type: 'number' },
    'thematic_map_max_zoom': { label: 'HC - Zoom tối đa', description: 'Mức zoom tối đa cho trang Đơn vị hành chính', type: 'number' },
    'thematic_map_min_zoom': { label: 'HC - Zoom tối thiểu', description: 'Mức zoom tối thiểu cho trang Đơn vị hành chính', type: 'number' },
    'thematic_default_basemap_id': { label: 'HC - Bản đồ nền mặc định', description: 'ID bản đồ nền mặc định cho trang Đơn vị hành chính', type: 'text' },
    'parcel_identifier_format': { label: 'Cấu trúc mã định danh thửa đất', description: 'Mẫu hiển thị mã thửa. Hỗ trợ các biến {ma_dinh_danh}, {so_to}, {so_thua}, {gid}, {owner}, {land_type}, {phuong_xa}. Mặc định ưu tiên mã định danh ngẫu nhiên 12 số. Ví dụ: {ma_dinh_danh}', type: 'text' },
    'pdf_template_preset': { label: 'Mẫu PDF mặc định', description: 'Mẫu do quản trị hệ thống chọn và áp dụng cho toàn bộ người dùng', type: 'text' },
    'pdf_header_1': { label: 'Dòng tiêu đề 1', description: 'Ví dụ: CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', type: 'text' },
    'pdf_header_2': { label: 'Dòng tiêu đề 2', description: 'Ví dụ: Độc lập - Tự do - Hạnh phúc', type: 'text' },
    'pdf_title': { label: 'Tiêu đề biểu mẫu PDF', description: 'Tên lớn của biểu mẫu khi xuất thửa đất', type: 'text' },
    'pdf_location_text': { label: 'Địa danh ký', description: 'Ví dụ: TP. Hồ Chí Minh', type: 'text' },
    'pdf_signer_title': { label: 'Chức danh người ký', description: 'Ví dụ: Người trích lục', type: 'text' },
    'pdf_signer_name': { label: 'Tên người ký', description: 'Tên hiển thị ở phần cuối PDF', type: 'text' },
    'pdf_signature_style': { label: 'Mẫu chữ ký', description: 'Chọn kiểu hiển thị khối chữ ký trên PDF', type: 'text' },
    'pdf_signature_width': { label: 'Chiều rộng chữ ký', description: 'Chiều rộng ảnh chữ ký trong PDF, đơn vị pixel, ví dụ 160', type: 'number' },
    'pdf_signature_height': { label: 'Chiều cao chữ ký', description: 'Chiều cao ảnh chữ ký trong PDF, đơn vị pixel, ví dụ 62', type: 'number' },
    'pdf_signature_image': { label: 'Ảnh chữ ký', description: 'Tải lên ảnh chữ ký PNG nền trong suốt để chèn vào PDF', type: 'image' },
    'pdf_show_signature_image': { label: 'Hiển thị ảnh chữ ký', description: 'Bật hoặc tắt ảnh chữ ký trên biểu mẫu', type: 'boolean' },
    'pdf_stamp_image': { label: 'Ảnh mộc / con dấu', description: 'Tải lên ảnh mộc đỏ hoặc dấu xác nhận để đóng trên PDF', type: 'image' },
    'pdf_show_stamp': { label: 'Hiển thị mộc / con dấu', description: 'Bật hoặc tắt phần mộc đỏ trên biểu mẫu', type: 'boolean' },
    'pdf_note_text': { label: 'Ghi chú PDF', description: 'Ghi chú hoặc thông tin bổ sung hiển thị trong mẫu PDF', type: 'text' },
    'pdf_footer_text': { label: 'Chân trang PDF', description: 'Dòng chữ in dưới cùng trang PDF', type: 'text' },
    'pdf_show_qr': { label: 'Hiển thị mã QR', description: 'Bật hoặc tắt khối mã QR xác thực trên biểu mẫu', type: 'boolean' },
    'pdf_show_signer': { label: 'Hiển thị khối chữ ký', description: 'Bật hoặc tắt phần ngày ký và người ký', type: 'boolean' }
};

// ─── Tab → keys mapping ──────────────────────────────────────────────────────
const TAB_KEYS: Record<string, string[]> = {
    GENERAL: ['system_name', 'site_logo', 'site_favicon', 'maintenance_mode', 'allow_registration', 'footer_text'],
    MAP:     ['map_center_lat', 'map_center_lng', 'default_zoom', 'map_max_zoom', 'map_min_zoom', 'thematic_map_center_lat', 'thematic_map_center_lng', 'thematic_default_zoom', 'thematic_map_max_zoom', 'thematic_map_min_zoom', 'thematic_default_basemap_id', 'parcel_identifier_format'],
    SEO:     ['seo_title', 'seo_description', 'seo_keywords', 'seo_og_image'],
    MAIL:    ['mail_provider', 'mail_host', 'mail_port', 'mail_user', 'mail_pass', 'mail_from_email', 'mail_from_name'],
};

const SETTINGS_GROUPS = [
    {
        title: 'Cấu hình hệ thống',
        items: [
            { key: 'GENERAL', label: 'Web & bảo mật', Icon: Settings, style: 'text-blue-400 border-blue-500/40 bg-blue-950/20', desc: 'Tên hệ thống, logo, quyền truy cập và chân trang.' },
            { key: 'MAP', label: 'Bản đồ & nền', Icon: MapIcon, style: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/20', desc: 'Tâm bản đồ, zoom và nền mặc định cho từng trang.' }
        ]
    },
    {
        title: 'Truyền thông',
        items: [
            { key: 'SEO', label: 'SEO & chia sẻ', Icon: Globe, style: 'text-indigo-400 border-indigo-500/40 bg-indigo-950/20', desc: 'Google, mạng xã hội và ảnh chia sẻ.' },
            { key: 'MAIL', label: 'Mail Server', Icon: Mail, style: 'text-rose-400 border-rose-500/40 bg-rose-950/20', desc: 'SMTP, email gửi đi và kiểm tra OTP.' }
        ]
    },
    {
        title: 'Vận hành dữ liệu',
        items: [
            { key: 'STATUS', label: 'Máy chủ', Icon: Activity, style: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20', desc: 'Tài nguyên máy chủ và trạng thái kết nối.' },
            { key: 'BACKUP', label: 'Sao lưu SQL', Icon: DatabaseBackup, style: 'text-green-400 border-green-500/40 bg-green-950/20', desc: 'Xuất và khôi phục dữ liệu hệ thống.' }
        ]
    }
] as const;

const TAB_TITLES: Record<string, { title: string; description: string }> = {
    GENERAL: { title: 'Thiết lập hệ thống chung', description: 'Các cấu hình nền tảng của website và quyền truy cập.' },
    MAP: { title: 'Thiết lập bản đồ', description: 'Nhóm cấu hình điều hướng, tâm bản đồ và nền mặc định.' },
    SEO: { title: 'Thiết lập SEO', description: 'Quản lý cách website hiển thị trên Google và mạng xã hội.' },
    MAIL: { title: 'Thiết lập Mail Server', description: 'Cấu hình SMTP và thử gửi email trực tiếp.' },
    STATUS: { title: 'Trạng thái hệ thống', description: 'Theo dõi máy chủ và kiểm tra kết nối dịch vụ.' },
    BACKUP: { title: 'Sao lưu và khôi phục', description: 'Xuất hoặc phục hồi dữ liệu từ tệp SQL.' }
};

const MAIL_PROVIDER_PRESETS = {
    CUSTOM: { label: 'Tùy chỉnh thủ công', host: '', port: '', note: 'Tự nhập host và port theo nhà cung cấp riêng của bạn.' },
    GMAIL: { label: 'Gmail', host: 'smtp.gmail.com', port: '587', note: 'Khuyên dùng App Password của Google thay cho mật khẩu đăng nhập thường.' },
    OUTLOOK: { label: 'Outlook / Hotmail', host: 'smtp.office365.com', port: '587', note: 'Dùng cho Outlook.com, Hotmail hoặc Microsoft 365.' },
    YAHOO: { label: 'Yahoo Mail', host: 'smtp.mail.yahoo.com', port: '587', note: 'Cần tạo App Password trong tài khoản Yahoo.' },
    ZOHO: { label: 'Zoho Mail', host: 'smtp.zoho.com', port: '587', note: 'Phù hợp khi dùng tên miền email doanh nghiệp qua Zoho.' },
    BREVO: { label: 'Brevo', host: 'smtp-relay.brevo.com', port: '587', note: 'Khuyên dùng cho hệ thống gửi OTP và email giao dịch.' },
    SENDGRID: { label: 'SendGrid', host: 'smtp.sendgrid.net', port: '587', note: 'Sử dụng API Key hoặc SMTP credentials từ SendGrid.' },
    MAILGUN: { label: 'Mailgun', host: 'smtp.mailgun.org', port: '587', note: 'Cần cấu hình domain và SMTP credentials của Mailgun.' }
} as const;

// ─── Inline validation ────────────────────────────────────────────────────────
const validate = (key: string, value: string): string => {
    if (!value) return '';
    if ((key === 'mail_user' || key === 'mail_from_email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email không hợp lệ';
    if (key === 'mail_port') { const n = parseInt(value); if (isNaN(n) || n < 1 || n > 65535) return 'Port phải từ 1 → 65535'; }
    if (key === 'map_center_lat' || key === 'thematic_map_center_lat') { const n = parseFloat(value); if (isNaN(n) || n < -90 || n > 90) return 'Vĩ độ phải từ -90 → 90'; }
    if (key === 'map_center_lng' || key === 'thematic_map_center_lng') { const n = parseFloat(value); if (isNaN(n) || n < -180 || n > 180) return 'Kinh độ phải từ -180 → 180'; }
    if (['default_zoom', 'map_max_zoom', 'map_min_zoom', 'thematic_default_zoom', 'thematic_map_max_zoom', 'thematic_map_min_zoom'].includes(key)) { const n = parseInt(value); if (isNaN(n) || n < 0 || n > 22) return 'Zoom phải từ 0 → 22'; }
    return '';
};

const BACKUP_HISTORY_KEY = 'geo_backup_history';
type BackupScope = 'ALL' | 'SYSTEM' | 'SPATIAL' | 'CUSTOM';
type BackupFormat = 'FULL' | 'DATA_ONLY' | 'SCHEMA_ONLY';
type BackupRecord = { date: string; tables: number; filename: string; format?: BackupFormat; scope?: BackupScope };

interface SystemSettingsManagerProps {
    permissions?: string[];
}

const SystemSettingsManager: React.FC<SystemSettingsManagerProps> = ({ permissions = [] }) => {
    const [settings, setSettings] = useState<SystemSetting[]>([]);
    const [savedSettings, setSavedSettings] = useState<SystemSetting[]>([]); // pristine copy from server
    const [subTab, setSubTab] = useState<'GENERAL' | 'MAP' | 'SEO' | 'MAIL' | 'STATUS' | 'BACKUP'>('GENERAL');
    const [loading, setLoading] = useState(false);
    const [serverInfo, setServerInfo] = useState<any>(null);
    const [basemapOptions, setBasemapOptions] = useState<Array<{ id: string; name: string }>>([]);

    // Validation
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Password visibility
    const [showPassword, setShowPassword] = useState(false);

    // DB connection test
    const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
    const [dbTestMsg, setDbTestMsg] = useState('');

    // SMTP test
    const [mailTestTo, setMailTestTo] = useState('');
    const [mailTestStatus, setMailTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
    const [mailTestMsg, setMailTestMsg] = useState('');

    // Backup
    const [backupTables, setBackupTables] = useState<{system: string[], spatial: string[]}>({ system: [], spatial: [] });
    const [selectedTables, setSelectedTables] = useState<string[]>([]);
    const [backupScope, setBackupScope] = useState<BackupScope>('ALL');
    const [backupFormat, setBackupFormat] = useState<BackupFormat>('FULL');
    const [backupHistory, setBackupHistory] = useState<BackupRecord[]>([]);
    const [restoreFile, setRestoreFile] = useState<File | null>(null);
    const [restoring, setRestoring] = useState(false);
    const restoreInputRef = useRef<HTMLInputElement>(null);

    // Dialog
    const [dialog, setDialog] = useState<{ isOpen: boolean; type: 'alert' | 'success' | 'error'; title: string; message: string }>({
        isOpen: false, type: 'alert', title: '', message: ''
    });
    const showDialog = (type: any, title: string, message: string) => setDialog({ isOpen: true, type, title, message });

    const canSaveSettings = hasAnyPermission(permissions, ['SAVE_SYSTEM_SETTINGS', 'MANAGE_SYSTEM']);
    const canTestServices = hasAnyPermission(permissions, ['TEST_MAIL_SERVER', 'MANAGE_SYSTEM']);
    const canCreateBackup = hasAnyPermission(permissions, ['MANAGE_BACKUP', 'MANAGE_SYSTEM']);
    const canRestoreBackup = hasAnyPermission(permissions, ['RESTORE_BACKUP', 'MANAGE_SYSTEM']);

    // ── Dirty tracking ────────────────────────────────────────────────────────
    const isDirtyKey = useCallback((key: string) => {
        const cur = settings.find(s => s.key === key)?.value ?? '';
        const orig = savedSettings.find(s => s.key === key)?.value ?? '';
        return cur !== orig;
    }, [settings, savedSettings]);

    const dirtyTabs = Object.entries(TAB_KEYS)
        .filter(([, keys]) => keys.some(k => isDirtyKey(k)))
        .map(([tab]) => tab);
    const hasAnyDirty = dirtyTabs.includes(subTab);

    useEffect(() => {
        loadData();
        const stored = localStorage.getItem(BACKUP_HISTORY_KEY);
        if (stored) { try { setBackupHistory(JSON.parse(stored)); } catch {} }
    }, []);

    // Effect for Server Status Polling
    useEffect(() => {
        let timer: any;
        if (subTab === 'STATUS') {
            const fetchInfo = async () => {
                try {
                    const info = await adminService.getServerInfo();
                    setServerInfo(info);
                } catch (e) {}
            };
            fetchInfo();
            timer = setInterval(fetchInfo, 10000); // Refresh mỗi 10s
        }
        return () => clearInterval(timer);
    }, [subTab]);

    useEffect(() => {
        if (subTab === 'BACKUP') {
            loadBackupTables();
        }
    }, [subTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [data, basemaps] = await Promise.all([
                adminService.getSettings(),
                adminService.getBasemaps().catch(() => [])
            ]);
            setSettings(data);
            setSavedSettings(data.map(s => ({ ...s }))); // pristine copy
            setBasemapOptions((Array.isArray(basemaps) ? basemaps : []).map((b: any) => ({ id: b.id, name: b.name || b.id })));
            if (!mailTestTo) {
                const mailUser = data.find(s => s.key === 'mail_user')?.value || '';
                setMailTestTo(mailUser);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleTestMail = async () => {
        if (!canTestServices) {
            showDialog('error', 'Không đủ quyền', 'Bạn không có quyền kiểm tra máy chủ mail.');
            return;
        }
        setMailTestStatus('testing');
        setMailTestMsg('Đang kiểm tra SMTP và gửi email test...');
        try {
            const smtp = {
                mail_host: settings.find(s => s.key === 'mail_host')?.value || '',
                mail_port: settings.find(s => s.key === 'mail_port')?.value || '',
                mail_user: settings.find(s => s.key === 'mail_user')?.value || '',
                mail_pass: settings.find(s => s.key === 'mail_pass')?.value || '',
                mail_from_email: settings.find(s => s.key === 'mail_from_email')?.value || '',
                mail_from_name: settings.find(s => s.key === 'mail_from_name')?.value || '',
                system_name: settings.find(s => s.key === 'system_name')?.value || 'GeoMaster'
            };
            const result = await adminService.testMail({ to: mailTestTo, smtp });
            setMailTestStatus('ok');
            setMailTestMsg(result?.message || 'Đã gửi email test thành công.');
        } catch (e: any) {
            setMailTestStatus('error');
            setMailTestMsg(e.message || 'Test SMTP thất bại.');
        }
    };

    const resolveTablesByScope = useCallback((scope: BackupScope, tablesSource = backupTables) => {
        if (scope === 'SYSTEM') return [...tablesSource.system];
        if (scope === 'SPATIAL') return [...tablesSource.spatial];
        return [...tablesSource.system, ...tablesSource.spatial];
    }, [backupTables]);

    const applyBackupScope = useCallback((scope: BackupScope, tablesSource = backupTables) => {
        setBackupScope(scope);
        if (scope === 'CUSTOM') return;
        setSelectedTables(resolveTablesByScope(scope, tablesSource));
    }, [backupTables, resolveTablesByScope]);

    const loadBackupTables = async () => {
        setLoading(true);
        try {
            const tables = await adminService.getBackupTables();
            setBackupTables(tables);
            setBackupScope('ALL');
            setSelectedTables(resolveTablesByScope('ALL', tables));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleTableSelection = (tableName: string) => {
        setBackupScope('CUSTOM');
        setSelectedTables(prev => 
            prev.includes(tableName) 
            ? prev.filter(t => t !== tableName) 
            : [...prev, tableName]
        );
    };

    const handleSelectAll = (selectAll: boolean) => {
        if (selectAll) {
            setBackupScope('ALL');
            setSelectedTables(resolveTablesByScope('ALL'));
        } else {
            setBackupScope('CUSTOM');
            setSelectedTables([]);
        }
    };

    const updateSettingValue = (key: string, value: string) => {
        const err = validate(key, value);
        setValidationErrors(prev => ({ ...prev, [key]: err }));

        setSettings(prev => {
            let next = prev.some(s => s.key === key)
                ? prev.map(s => s.key === key ? { ...s, value } : s)
                : [...prev, { key, value, type: SETTING_METADATA[key]?.type || 'text' } as SystemSetting];

            if (key === 'pdf_template_preset') {
                const preset = getPdfTemplatePreset(value);
                Object.entries(preset.settings).forEach(([presetKey, presetValue]) => {
                    if (next.some(s => s.key === presetKey)) {
                        next = next.map(s => s.key === presetKey ? { ...s, value: presetValue } : s);
                    } else {
                        next.push({ key: presetKey, value: presetValue, type: SETTING_METADATA[presetKey]?.type || 'text' } as SystemSetting);
                    }
                });
            }

            if (key === 'mail_provider') {
                const providerKey = String(value || 'CUSTOM').toUpperCase() as keyof typeof MAIL_PROVIDER_PRESETS;
                const provider = MAIL_PROVIDER_PRESETS[providerKey] || MAIL_PROVIDER_PRESETS.CUSTOM;
                if (provider.host || provider.port) {
                    ([['mail_host', provider.host], ['mail_port', provider.port]] as const).forEach(([presetKey, presetValue]) => {
                        if (next.some(s => s.key === presetKey)) {
                            next = next.map(s => s.key === presetKey ? { ...s, value: presetValue } : s);
                        } else {
                            next.push({ key: presetKey, value: presetValue, type: SETTING_METADATA[presetKey]?.type || 'text' } as SystemSetting);
                        }
                    });
                }
            }

            return next;
        });
    };

    const handleSave = async () => {
        if (!canSaveSettings) {
            showDialog('error', 'Không đủ quyền', 'Bạn không có quyền lưu thay đổi cấu hình hệ thống.');
            return;
        }
        // Block save if any validation errors exist
        const hasErrors = Object.values(validationErrors).some(e => !!e);
        if (hasErrors) { showDialog('error', 'Lỗi xác thực', 'Vui lòng sửa các trường bị lỗi trước khi lưu.'); return; }
        setLoading(true);
        try {
            await adminService.saveSettings(settings);
            setSavedSettings(settings.map(s => ({ ...s })));

            const settingsMap = settings.reduce((acc, item) => {
                acc[item.key] = item.value;
                return acc;
            }, {} as Record<string, string>);

            window.dispatchEvent(new CustomEvent('system-settings-updated', { detail: settingsMap }));
            showDialog('success', 'Đã lưu', 'Hệ thống đã ghi nhận các thay đổi cấu hình mới.');
        } catch (e: any) {
            showDialog('error', 'Lỗi lưu trữ', e.message);
        } finally { setLoading(false); }
    };

    const handleStartBackup = async () => {
        if (!canCreateBackup) {
            showDialog('error', 'Không đủ quyền', 'Bạn không có quyền tạo bản sao lưu SQL.');
            return;
        }
        const tablesToExport = backupScope === 'CUSTOM' ? selectedTables : resolveTablesByScope(backupScope);
        if (tablesToExport.length === 0) {
            showDialog('error', 'Lỗi', 'Vui lòng chọn ít nhất một bảng để sao lưu.');
            return;
        }
        setLoading(true);
        try {
            const result = await adminService.createBackup({ tables: tablesToExport, format: backupFormat, scope: backupScope });
            const filename = result?.fileName || `backup_${backupScope.toLowerCase()}_${backupFormat.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.sql`;
            const record: BackupRecord = {
                date: new Date().toLocaleString('vi-VN'),
                tables: tablesToExport.length,
                filename,
                format: backupFormat,
                scope: backupScope
            };
            const newHistory = [record, ...backupHistory].slice(0, 10);
            setBackupHistory(newHistory);
            localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(newHistory));
            const warningText = result?.skippedCount > 0 ? ` Tuy có ${result.skippedCount} bảng được bỏ qua do lỗi cấu trúc.` : '';
            showDialog('success', 'Thành công', `File sao lưu SQL đã được tạo và đang tải xuống.${warningText}`);
        } catch (e: any) {
            showDialog('error', 'Lỗi Backup', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        if (!canRestoreBackup) {
            showDialog('error', 'Không đủ quyền', 'Bạn không có quyền khôi phục dữ liệu từ file SQL.');
            return;
        }
        if (!restoreFile) return;
        if (!window.confirm(`Xác nhận khôi phục từ "${restoreFile.name}"? Thao tác này sẽ ghi đè dữ liệu hiện tại.`)) return;
        setRestoring(true);
        try {
            await adminService.restoreDatabase(restoreFile);
            showDialog('success', 'Khôi phục thành công', 'Cơ sở dữ liệu đã được khôi phục từ file SQL.');
            setRestoreFile(null);
        } catch (e: any) {
            showDialog('error', 'Lỗi khôi phục', e.message);
        } finally { setRestoring(false); }
    };

    const handleDbTest = async () => {
        if (!canTestServices) {
            showDialog('error', 'Không đủ quyền', 'Bạn không có quyền kiểm tra kết nối hệ thống.');
            return;
        }
        setDbTestStatus('testing');
        try {
            const result = await adminService.checkDbConnection();
            if (result.status === 'connected') {
                setDbTestStatus('ok');
                setDbTestMsg(`Kết nối tới "${result.dbName}" trên ${result.host} thành công.`);
            } else {
                setDbTestStatus('error');
                setDbTestMsg(result.message || 'Kết nối thất bại');
            }
        } catch (e: any) {
            setDbTestStatus('error');
            setDbTestMsg(e.message);
        }
        setTimeout(() => setDbTestStatus('idle'), 5000);
    };

    const handleFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            showDialog('error', 'File quá lớn', "Vui lòng chọn ảnh dưới 2MB.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            updateSettingValue(key, base64);
        };
        reader.readAsDataURL(file);
    };

    const renderSettingInput = (key: string) => {
        const booleanDefaultValue = ['pdf_show_qr', 'pdf_show_signer', 'pdf_show_signature_image', 'pdf_show_stamp'].includes(key) ? 'true' : '';
        const setting = settings.find(s => s.key === key) || { key, value: SETTING_METADATA[key]?.type === 'boolean' ? booleanDefaultValue : '', type: SETTING_METADATA[key]?.type || 'text' };
        const metadata = SETTING_METADATA[key];
        const dirty = isDirtyKey(key);
        const error = validationErrors[key];

        if (metadata?.type === 'image') {
            const isFavicon = key === 'site_favicon';
            return (
                <div className="space-y-3">
                    {setting.value && (
                        <div className={`relative ${isFavicon ? 'w-16 h-16' : 'w-32 h-32'} bg-gray-900 rounded border ${dirty ? 'border-yellow-500/60' : 'border-gray-700'} overflow-hidden group`}>
                            <img src={setting.value} alt={key} className="w-full h-full object-contain p-1" />
                            <button onClick={() => updateSettingValue(key, '')} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="text-red-400" size={isFavicon ? 14 : 20} />
                            </button>
                        </div>
                    )}
                    <label className={`flex items-center gap-2 px-4 py-2 rounded cursor-pointer w-fit text-sm transition-colors border ${dirty ? 'bg-yellow-900/20 border-yellow-600/50 hover:bg-yellow-900/30' : 'bg-gray-700 hover:bg-gray-600 border-gray-600'}`}>
                        <ImageIcon size={16} />
                        <span>{setting.value ? 'Thay đổi' : 'Tải lên'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleFileChange(key, e)} />
                    </label>
                    {dirty && <span className="text-[10px] text-yellow-500">● Chưa lưu</span>}
                </div>
            );
        }

        if (metadata?.type === 'boolean') {
            const isTrue = setting.value === 'true';
            return (
                <div className="flex items-center gap-3">
                    <button onClick={() => updateSettingValue(key, isTrue ? 'false' : 'true')}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isTrue ? 'bg-blue-600' : 'bg-gray-700'} ${dirty ? 'ring-2 ring-yellow-500/50' : ''}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isTrue ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-sm font-bold uppercase tracking-widest ${isTrue ? 'text-blue-400' : 'text-gray-400'}`}>{isTrue ? 'ĐANG BẬT' : 'ĐANG TẮT'}</span>
                    {dirty && <span className="text-[10px] text-yellow-500">● Chưa lưu</span>}
                </div>
            );
        }

        if (key === 'thematic_default_basemap_id') {
            return (
                <div className="space-y-1">
                    <select
                        className={`w-full bg-gray-900 border rounded p-2.5 text-white outline-none font-medium transition-colors ${dirty ? 'border-yellow-500/60 focus:border-yellow-400' : 'border-gray-600 focus:border-blue-500'}`}
                        value={setting.value || ''}
                        onChange={e => updateSettingValue(key, e.target.value)}
                    >
                        <option value="">-- Theo mặc định hệ thống --</option>
                        {basemapOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.name} ({opt.id})</option>
                        ))}
                    </select>
                    {dirty && <p className="text-[10px] text-yellow-500">● Chưa lưu</p>}
                </div>
            );
        }

        if (key === 'pdf_template_preset') {
            return (
                <div className="space-y-2">
                    <select
                        className={`w-full bg-gray-900 border rounded p-2.5 text-white outline-none font-medium transition-colors ${dirty ? 'border-yellow-500/60 focus:border-yellow-400' : 'border-gray-600 focus:border-blue-500'}`}
                        value={setting.value || 'DEFAULT'}
                        onChange={e => updateSettingValue(key, e.target.value)}
                    >
                        {Object.entries(PDF_TEMPLATE_PRESETS).map(([presetKey, preset]) => (
                            <option key={presetKey} value={presetKey}>{preset.label}</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-gray-500">Quản trị hệ thống chọn mẫu tại đây, toàn bộ người dùng sẽ dùng chung khi xuất PDF.</p>
                    {dirty && <p className="text-[10px] text-yellow-500">● Chưa lưu</p>}
                </div>
            );
        }

        if (key === 'pdf_signature_style') {
            return (
                <div className="space-y-2">
                    <select
                        className={`w-full bg-gray-900 border rounded p-2.5 text-white outline-none font-medium transition-colors ${dirty ? 'border-yellow-500/60 focus:border-yellow-400' : 'border-gray-600 focus:border-blue-500'}`}
                        value={setting.value || 'HANDWRITTEN'}
                        onChange={e => updateSettingValue(key, e.target.value)}
                    >
                        <option value="HANDWRITTEN">Ký tay mềm</option>
                        <option value="FORMAL">Ký hành chính trang trọng</option>
                        <option value="DIGITAL">Ký số màu xanh</option>
                    </select>
                    <p className="text-[10px] text-gray-500">Có thể kết hợp cùng ảnh chữ ký và ảnh mộc để tạo mẫu trình bày hoàn chỉnh.</p>
                    {dirty && <p className="text-[10px] text-yellow-500">● Chưa lưu</p>}
                </div>
            );
        }

        if (key === 'parcel_identifier_format') {
            const previewValue = formatParcelValue({
                so_to: '12',
                so_thua: '345',
                gid: '6789',
                owner: 'NGUYỄN VĂN A',
                land_type: 'ODT',
                table_name: 'phuong_an_khanh'
            }, setting.value || '{so_to}/{so_thua}');

            return (
                <div className="space-y-2">
                    <input
                        className={`w-full bg-gray-900 border rounded p-2.5 text-white outline-none font-medium transition-colors ${dirty ? 'border-yellow-500/60 focus:border-yellow-400' : 'border-gray-600 focus:border-blue-500'}`}
                        value={setting.value || ''}
                        type="text"
                        placeholder="Ví dụ: T{so_to}-TH{so_thua}"
                        onChange={e => updateSettingValue(key, e.target.value)}
                    />
                    <p className="text-[10px] text-gray-500">Biến hỗ trợ: {'{so_to}'}, {'{so_thua}'}, {'{gid}'}, {'{owner}'}, {'{land_type}'}, {'{phuong_xa}'} hoặc {'{ten_bang}'}</p>
                    <div className="rounded-lg border border-cyan-800/40 bg-cyan-950/10 p-3 text-[11px]">
                        <div className="text-cyan-400 font-black uppercase tracking-wider mb-1">Xem trước</div>
                        <div className="text-white font-mono">{previewValue}</div>
                    </div>
                    {dirty && <p className="text-[10px] text-yellow-500">● Chưa lưu</p>}
                </div>
            );
        }

        if (key === 'mail_provider') {
            const providerKey = String(setting.value || 'CUSTOM').toUpperCase() as keyof typeof MAIL_PROVIDER_PRESETS;
            const provider = MAIL_PROVIDER_PRESETS[providerKey] || MAIL_PROVIDER_PRESETS.CUSTOM;
            return (
                <div className="space-y-2">
                    <select
                        className={`w-full bg-gray-900 border rounded p-2.5 text-white outline-none font-medium transition-colors ${dirty ? 'border-yellow-500/60 focus:border-yellow-400' : 'border-gray-600 focus:border-blue-500'}`}
                        value={setting.value || 'CUSTOM'}
                        onChange={e => updateSettingValue(key, e.target.value)}
                    >
                        {Object.entries(MAIL_PROVIDER_PRESETS).map(([providerValue, providerMeta]) => (
                            <option key={providerValue} value={providerValue}>{providerMeta.label}</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-rose-300">{provider.note}</p>
                    {dirty && <p className="text-[10px] text-yellow-500">● Chưa lưu</p>}
                </div>
            );
        }

        // Password field with toggle
        if (key === 'mail_pass') {
            return (
                <div className="space-y-1">
                    <div className="relative">
                        <input
                            className={`w-full bg-gray-900 border rounded p-2.5 pr-10 text-white outline-none font-medium transition-colors
                                ${error ? 'border-red-500 focus:border-red-400' : dirty ? 'border-yellow-500/60 focus:border-yellow-400' : 'border-gray-600 focus:border-blue-500'}`}
                            value={setting.value || ''}
                            type={showPassword ? 'text' : 'password'}
                            onChange={e => updateSettingValue(key, e.target.value)}
                        />
                        <button type="button" onClick={() => setShowPassword(v => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    {error && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertTriangle size={10} /> {error}</p>}
                    {dirty && !error && <p className="text-[10px] text-yellow-500">● Chưa lưu</p>}
                </div>
            );
        }

        return (
            <div className="space-y-1">
                <input
                    className={`w-full bg-gray-900 border rounded p-2.5 text-white outline-none font-medium transition-colors
                        ${error ? 'border-red-500 focus:border-red-400' : dirty ? 'border-yellow-500/60 focus:border-yellow-400' : 'border-gray-600 focus:border-blue-500'}`}
                    value={setting.value || ''}
                    type={metadata?.type === 'number' ? 'number' : 'text'}
                    step={metadata?.type === 'number' ? 'any' : undefined}
                    onChange={e => updateSettingValue(key, e.target.value)}
                />
                {error && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertTriangle size={10} /> {error}</p>}
                {dirty && !error && <p className="text-[10px] text-yellow-500">● Chưa lưu</p>}
            </div>
        );
    };

    const formatUptime = (seconds: number) => {
        const d = Math.floor(seconds / (3600*24));
        const h = Math.floor(seconds % (3600*24) / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        return `${d} ngày, ${h} giờ, ${m} phút`;
    };

    const usedMemGb = serverInfo ? ((serverInfo.totalMem - serverInfo.freeMem) / 1024 / 1024 / 1024).toFixed(1) : '0';
    const totalMemGb = serverInfo ? (serverInfo.totalMem / 1024 / 1024 / 1024).toFixed(1) : '0';
    const memPercent = serverInfo ? Math.round(((serverInfo.totalMem - serverInfo.freeMem) / serverInfo.totalMem) * 100) : 0;

    const seoTitle = settings.find(s => s.key === 'seo_title')?.value || '';
    const seoDesc = settings.find(s => s.key === 'seo_description')?.value || '';
    const seoOgImage = settings.find(s => s.key === 'seo_og_image')?.value || '';
    const sysName = settings.find(s => s.key === 'system_name')?.value || 'GeoMaster';
    const siteUrl = window.location.origin;

    const isAllSelected = selectedTables.length === (backupTables.system.length + backupTables.spatial.length);

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 text-white relative">
            <div className="space-y-4">
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white">Thiết lập hệ thống</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Đã nhóm lại theo danh mục để dễ quản trị và bảo trì</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {SETTINGS_GROUPS.map((group) => (
                        <div key={group.title} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 space-y-3">
                            <div className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-500">{group.title}</div>
                            <div className="space-y-2">
                                {group.items.map(({ key, label, Icon, style, desc }) => {
                                    const isActive = subTab === key;
                                    const hasDirty = dirtyTabs.includes(key);
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setSubTab(key as any)}
                                            className={`w-full text-left rounded-xl border p-3 transition-all ${isActive ? style : 'border-gray-800 bg-gray-950/70 text-gray-300 hover:border-gray-700 hover:bg-gray-900'}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wide">
                                                    <Icon size={15} />
                                                    <span>{label}</span>
                                                </div>
                                                {hasDirty && <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0 mt-1" title="Có thay đổi chưa lưu" />}
                                            </div>
                                            <div className={`mt-2 text-[11px] ${isActive ? 'text-white/80' : 'text-gray-500'}`}>{desc}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-gray-800 rounded-xl md:rounded-lg p-4 md:p-6 border border-gray-700 shadow-xl min-h-[300px] md:min-h-[450px]">
                <div className="mb-6 pb-4 border-b border-gray-700/60">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">{TAB_TITLES[subTab]?.title || 'Thiết lập'}</h3>
                    <p className="text-xs text-gray-500 mt-1">{TAB_TITLES[subTab]?.description || ''}</p>
                </div>
                {subTab === 'GENERAL' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {['system_name', 'site_logo', 'site_favicon', 'maintenance_mode', 'allow_registration', 'footer_text'].map(key => (
                            <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-700/50 pb-6 last:border-0 last:pb-0">
                                <div className="col-span-1">
                                    <label className="text-sm font-bold text-gray-200 block mb-1">{SETTING_METADATA[key]?.label || key}</label>
                                    <span className="text-xs text-gray-500 italic">{SETTING_METADATA[key]?.description}</span>
                                </div>
                                <div className="col-span-2">{renderSettingInput(key)}</div>
                            </div>
                        ))}
                    </div>
                )}

                {subTab === 'MAP' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="text-[11px] font-black uppercase tracking-wider text-cyan-400">Cấu hình bản đồ chung</div>
                        {['map_center_lat', 'map_center_lng', 'default_zoom', 'map_max_zoom', 'map_min_zoom'].map(key => (
                            <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-700/50 pb-6 last:border-0 last:pb-0">
                                <div className="col-span-1">
                                    <label className="text-sm font-bold text-gray-200 block mb-1">{SETTING_METADATA[key]?.label || key}</label>
                                    <span className="text-[10px] text-gray-500 font-mono italic">{SETTING_METADATA[key]?.description}</span>
                                </div>
                                <div className="col-span-2">{renderSettingInput(key)}</div>
                            </div>
                        ))}

                        <div className="text-[11px] font-black uppercase tracking-wider text-indigo-400 pt-2">Trang Đơn vị hành chính</div>
                        {['thematic_map_center_lat', 'thematic_map_center_lng', 'thematic_default_zoom', 'thematic_map_max_zoom', 'thematic_map_min_zoom', 'thematic_default_basemap_id', 'parcel_identifier_format'].map(key => (
                            <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-700/50 pb-6 last:border-0 last:pb-0">
                                <div className="col-span-1">
                                    <label className="text-sm font-bold text-gray-200 block mb-1">{SETTING_METADATA[key]?.label || key}</label>
                                    <span className="text-[10px] text-gray-500 font-mono italic">{SETTING_METADATA[key]?.description}</span>
                                </div>
                                <div className="col-span-2">{renderSettingInput(key)}</div>
                            </div>
                        ))}
                    </div>
                )}

                {subTab === 'STATUS' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {!serverInfo ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-4">
                                <RefreshCw className="animate-spin" size={40} />
                                <p className="text-xs font-bold uppercase tracking-widest">Đang kết nối máy chủ API...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* System resources */}
                                <div className="bg-gray-950/40 p-5 rounded-xl border border-gray-700 space-y-5">
                                    <div className="flex items-center gap-3 text-emerald-400">
                                        <Cpu size={20}/> <h4 className="font-black uppercase tracking-tight text-sm">Tài nguyên Hệ thống</h4>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs"><span className="text-gray-500">Hệ điều hành</span><span className="text-white font-mono">{serverInfo.osType}</span></div>
                                        {serverInfo.cpuModel && <div className="flex justify-between text-xs"><span className="text-gray-500">CPU</span><span className="text-white font-mono truncate max-w-[200px]">{serverInfo.cpuModel}</span></div>}
                                    </div>
                                    {/* RAM bar */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-gray-400 flex items-center gap-1"><HardDrive size={11}/> RAM sử dụng</span>
                                            <span className="font-mono">
                                                <span className={memPercent > 80 ? 'text-red-400' : 'text-emerald-400'}>{usedMemGb} GB</span>
                                                <span className="text-gray-600"> / {totalMemGb} GB</span>
                                                <span className={`ml-1.5 text-[10px] font-bold ${memPercent > 80 ? 'text-red-400' : 'text-gray-500'}`}>({memPercent}%)</span>
                                            </span>
                                        </div>
                                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${memPercent > 80 ? 'bg-red-500' : memPercent > 60 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${memPercent}%` }} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <Clock size={12}/> Uptime: <span className="text-white font-mono">{formatUptime(serverInfo.uptime)}</span>
                                    </div>
                                </div>

                                {/* Database */}
                                <div className="bg-gray-950/40 p-5 rounded-xl border border-gray-700 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 text-blue-400">
                                            <HardDrive size={20}/> <h4 className="font-black uppercase tracking-tight text-sm">Cơ sở dữ liệu</h4>
                                        </div>
                                        <button onClick={handleDbTest} disabled={dbTestStatus === 'testing' || !canTestServices}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded bg-blue-800/40 border border-blue-700/50 text-blue-300 hover:bg-blue-700/50 transition-colors disabled:opacity-50">
                                            {dbTestStatus === 'testing' ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
                                            Test kết nối
                                        </button>
                                    </div>

                                    {/* DB test result */}
                                    {dbTestStatus !== 'idle' && (
                                        <div className={`flex items-start gap-2 p-3 rounded-lg text-xs border
                                            ${dbTestStatus === 'testing' ? 'bg-blue-900/20 border-blue-800 text-blue-300'
                                            : dbTestStatus === 'ok' ? 'bg-emerald-900/20 border-emerald-800 text-emerald-300'
                                            : 'bg-red-900/20 border-red-800 text-red-300'}`}>
                                            {dbTestStatus === 'testing' && <RefreshCw size={13} className="animate-spin shrink-0 mt-0.5" />}
                                            {dbTestStatus === 'ok' && <Wifi size={13} className="shrink-0 mt-0.5" />}
                                            {dbTestStatus === 'error' && <WifiOff size={13} className="shrink-0 mt-0.5" />}
                                            <span>{dbTestStatus === 'testing' ? 'Đang kiểm tra...' : dbTestMsg}</span>
                                        </div>
                                    )}

                                    <div className="p-3 bg-emerald-900/10 border border-emerald-800/30 rounded-lg flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Trạng thái</p>
                                            <p className="text-sm font-bold text-emerald-400">Đã kết nối (PostgreSQL)</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="p-3 bg-gray-900 rounded-lg border border-gray-800">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Dung lượng DB</p>
                                            <p className="text-xs font-mono text-white">~240 MB</p>
                                        </div>
                                        <div className="p-3 bg-gray-900 rounded-lg border border-gray-800">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Phiên bản API</p>
                                            <p className="text-xs font-mono text-white">v2.5.0-PRO</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {subTab === 'SEO' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="p-4 bg-indigo-900/10 border border-indigo-800/30 rounded flex gap-3 items-center">
                            <Globe className="text-indigo-400 shrink-0" size={20}/>
                            <p className="text-xs text-indigo-300">Cấu hình cách Google và mạng xã hội hiển thị thông tin trang web của bạn.</p>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Input fields */}
                            <div className="space-y-5">
                                {['seo_title', 'seo_description', 'seo_keywords', 'seo_og_image'].map(key => (
                                    <div key={key} className="space-y-1">
                                        <label className="text-sm font-bold text-gray-200 block">{SETTING_METADATA[key]?.label || key}</label>
                                        <span className="text-xs text-gray-500 italic block mb-2">{SETTING_METADATA[key]?.description}</span>
                                        {renderSettingInput(key)}
                                    </div>
                                ))}
                            </div>
                            {/* Live preview */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2"><Eye size={12}/> Xem trước Live</h4>
                                {/* Google preview */}
                                <div>
                                    <p className="text-[10px] text-gray-600 mb-2 uppercase tracking-wider">Kết quả trên Google</p>
                                    <div className="bg-white rounded-lg p-4 max-w-lg shadow">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center text-white text-[9px] font-black">G</div>
                                            <div>
                                                <div className="text-[11px] text-gray-800 font-medium leading-tight">{sysName}</div>
                                                <div className="text-[10px] text-gray-500">{siteUrl.replace('https://', '')}</div>
                                            </div>
                                        </div>
                                        <div className="text-blue-700 text-sm font-medium leading-snug mb-0.5">
                                            {seoTitle ? `${seoTitle} – ${sysName}` : sysName}
                                        </div>
                                        <div className="text-[11px] text-gray-600 leading-relaxed line-clamp-2">
                                            {seoDesc || 'Mô tả SEO sẽ hiển thị tại đây. Hãy điền mô tả ngắn gọn khoảng 150–160 ký tự.'}
                                        </div>
                                    </div>
                                </div>
                                {/* OG/Social preview */}
                                <div>
                                    <p className="text-[10px] text-gray-600 mb-2 uppercase tracking-wider">Chia sẻ mạng xã hội (Zalo, Facebook...)</p>
                                    <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 max-w-sm">
                                        {seoOgImage
                                            ? <img src={seoOgImage} alt="OG" className="w-full h-36 object-cover" />
                                            : <div className="w-full h-36 bg-gray-800 flex flex-col items-center justify-center text-gray-600 gap-2"><ImageIcon size={28}/><span className="text-xs">Chưa có ảnh chia sẻ</span></div>
                                        }
                                        <div className="p-3">
                                            <div className="text-[10px] text-gray-500 uppercase">{siteUrl.replace('https://', '')}</div>
                                            <div className="text-sm font-bold text-white mt-0.5 leading-snug">{seoTitle || sysName}</div>
                                            <div className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{seoDesc || 'Mô tả sẽ hiển thị tại đây...'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {subTab === 'MAIL' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="p-4 bg-rose-900/10 border border-rose-800/30 rounded flex gap-3 items-center mb-4">
                            <Mail className="text-rose-400" size={24}/>
                            <p className="text-xs text-rose-300 italic">Chọn nhanh nhà cung cấp như Gmail, Outlook, Yahoo, Zoho, Brevo, SendGrid hoặc Mailgun. Hệ thống sẽ tự điền host và port phổ biến.</p>
                        </div>
                        <div className="p-4 bg-gray-900/60 border border-gray-700 rounded-lg space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                <div className="md:col-span-2 space-y-1">
                                    <label className="text-sm font-bold text-gray-200 block">Email nhận thử</label>
                                    <input
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white outline-none focus:border-rose-500"
                                        value={mailTestTo}
                                        onChange={e => setMailTestTo(e.target.value)}
                                        placeholder="vd: admin@company.com"
                                        type="email"
                                    />
                                </div>
                                <button
                                    onClick={handleTestMail}
                                    disabled={mailTestStatus === 'testing' || !mailTestTo || !canTestServices}
                                    className="h-[42px] px-4 rounded bg-rose-700 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold text-white transition-colors flex items-center justify-center gap-2"
                                >
                                    {mailTestStatus === 'testing' ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                                    Test gửi thư
                                </button>
                            </div>
                            {mailTestStatus !== 'idle' && (
                                <div className={`text-xs px-3 py-2 rounded border ${
                                    mailTestStatus === 'ok' ? 'bg-emerald-900/20 border-emerald-700 text-emerald-300' :
                                    mailTestStatus === 'error' ? 'bg-red-900/20 border-red-700 text-red-300' :
                                    'bg-blue-900/20 border-blue-700 text-blue-300'
                                }`}>
                                    {mailTestMsg}
                                </div>
                            )}
                            <p className="text-[11px] text-gray-500">Nút này dùng ngay giá trị SMTP hiện tại trên form (kể cả chưa bấm Lưu).</p>
                        </div>
                        {['mail_provider', 'mail_host', 'mail_port', 'mail_user', 'mail_pass', 'mail_from_email', 'mail_from_name'].map(key => (
                            <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-700/50 pb-6 last:border-0 last:pb-0">
                                <div className="col-span-1">
                                    <label className="text-sm font-bold text-gray-200 block mb-1">{SETTING_METADATA[key]?.label || key}</label>
                                    <span className="text-xs text-gray-500 italic">{SETTING_METADATA[key]?.description}</span>
                                </div>
                                <div className="col-span-2">{renderSettingInput(key)}</div>
                            </div>
                        ))}
                    </div>
                )}

                {subTab === 'BACKUP' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Backup section */}
                        <div className="bg-gray-950/40 rounded-2xl border border-gray-700 p-6 space-y-6">
                            <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                                <div className="flex items-center gap-3">
                                    <DatabaseBackup className="text-green-500" size={24} />
                                    <div>
                                        <h4 className="font-bold text-lg uppercase tracking-tight">Xuất SQL</h4>
                                        <p className="text-xs text-gray-500">Có thể xuất toàn bộ bảng hoặc từng nhóm bảng trong một file SQL</p>
                                    </div>
                                </div>
                                <button onClick={() => handleSelectAll(!isAllSelected)} className="text-xs font-black uppercase text-blue-400 hover:text-blue-300 flex items-center gap-2">
                                    {isAllSelected ? <CheckSquare size={16}/> : <Square size={16}/>}
                                    {isAllSelected ? "Bỏ chọn" : "Chọn tất cả"}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4 space-y-3">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Phạm vi xuất</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'ALL', label: 'Toàn bộ CSDL' },
                                            { key: 'SYSTEM', label: 'Chỉ bảng hệ thống' },
                                            { key: 'SPATIAL', label: 'Chỉ bảng bản đồ' },
                                            { key: 'CUSTOM', label: 'Tùy chọn thủ công' }
                                        ].map((option) => (
                                            <button
                                                key={option.key}
                                                onClick={() => applyBackupScope(option.key as BackupScope)}
                                                className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase transition-all ${backupScope === option.key ? 'border-cyan-500 bg-cyan-600/20 text-cyan-300' : 'border-gray-700 bg-gray-950 text-gray-400 hover:text-white hover:border-gray-600'}`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-gray-500">Chọn <span className="font-bold text-white">Toàn bộ CSDL</span> để xuất tất cả bảng vào cùng một file SQL.</p>
                                </div>

                                <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4 space-y-3">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Dạng file xuất</div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        {[
                                            { key: 'FULL', label: 'SQL đầy đủ' },
                                            { key: 'DATA_ONLY', label: 'Chỉ dữ liệu' },
                                            { key: 'SCHEMA_ONLY', label: 'Chỉ cấu trúc' }
                                        ].map((option) => (
                                            <button
                                                key={option.key}
                                                onClick={() => setBackupFormat(option.key as BackupFormat)}
                                                className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase transition-all ${backupFormat === option.key ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300' : 'border-gray-700 bg-gray-950 text-gray-400 hover:text-white hover:border-gray-600'}`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-gray-500">Phù hợp cho sao lưu đầy đủ, migration cấu trúc hoặc trích xuất dữ liệu thuần SQL.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Settings size={12}/> Hệ thống ({backupTables.system.length})</h5>
                                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                        {backupTables.system.map(table => (
                                            <div key={table} onClick={() => toggleTableSelection(table)} className="flex items-center gap-3 p-3 bg-gray-900/50 hover:bg-gray-800 rounded-xl cursor-pointer border border-gray-800 transition-all group">
                                                <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedTables.includes(table) ? 'bg-green-600 border-green-600' : 'border-gray-600'}`}>
                                                    {selectedTables.includes(table) && <Check size={14}/>}
                                                </div>
                                                <span className="text-xs font-mono text-gray-300 group-hover:text-white">{table}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Table size={12}/> Bản đồ ({backupTables.spatial.length})</h5>
                                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                        {backupTables.spatial.map(table => (
                                            <div key={table} onClick={() => toggleTableSelection(table)} className="flex items-center gap-3 p-3 bg-gray-900/50 hover:bg-gray-800 rounded-xl cursor-pointer border border-gray-800 transition-all group">
                                                <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedTables.includes(table) ? 'bg-blue-600 border-blue-600' : 'border-gray-600'}`}>
                                                    {selectedTables.includes(table) && <Check size={14}/>}
                                                </div>
                                                <span className="text-xs font-mono text-gray-300 group-hover:text-white">{table}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="pt-6 border-t border-gray-700 flex justify-between items-center">
                                <div className="text-xs text-gray-500">
                                    Đã chọn: <span className="text-white font-bold">{(backupScope === 'CUSTOM' ? selectedTables : resolveTablesByScope(backupScope)).length}</span> bảng
                                    <span className="text-gray-600"> · {backupFormat === 'FULL' ? 'SQL đầy đủ' : backupFormat === 'DATA_ONLY' ? 'Chỉ dữ liệu' : 'Chỉ cấu trúc'}</span>
                                </div>
                                <button onClick={handleStartBackup} disabled={!canCreateBackup || loading || (backupScope === 'CUSTOM' ? selectedTables.length === 0 : resolveTablesByScope(backupScope).length === 0)} className="bg-green-700 hover:bg-green-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl disabled:opacity-30 transition-all flex items-center gap-2">
                                    {loading ? <RefreshCw className="animate-spin" size={16}/> : <Download size={16}/>} Xuất file SQL
                                </button>
                            </div>
                        </div>

                        {/* Restore section */}
                        <div className="bg-gray-950/40 rounded-2xl border border-amber-800/40 p-6 space-y-4">
                            <div className="flex items-center gap-3 pb-4 border-b border-gray-700">
                                <Upload className="text-amber-400 shrink-0" size={22}/>
                                <div>
                                    <h4 className="font-bold text-base uppercase tracking-tight">Khôi phục từ tệp SQL</h4>
                                    <p className="text-xs text-amber-600 mt-0.5">Thận trọng: thao tác này sẽ ghi đè dữ liệu hiện tại</p>
                                </div>
                            </div>
                            <input ref={restoreInputRef} type="file" accept=".sql,.txt" className="hidden" onChange={e => setRestoreFile(e.target.files?.[0] || null)}/>
                            <div className="flex items-center gap-3">
                                <button onClick={() => restoreInputRef.current?.click()} disabled={!canRestoreBackup} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm rounded-lg border border-gray-600 text-gray-300 flex items-center gap-2">
                                    <FileText size={14}/> {restoreFile ? restoreFile.name : 'Chọn tệp .sql...'}
                                </button>
                                {restoreFile && (
                                    <button onClick={() => setRestoreFile(null)} className="text-gray-500 hover:text-red-400"><X size={14}/></button>
                                )}
                                <button onClick={handleRestore} disabled={!canRestoreBackup || !restoreFile || restoring} className="ml-auto px-6 py-2 bg-amber-700 hover:bg-amber-600 text-white text-xs font-black uppercase rounded-xl disabled:opacity-40 flex items-center gap-2">
                                    {restoring ? <RefreshCw size={14} className="animate-spin"/> : <Upload size={14}/>} Khôi phục
                                </button>
                            </div>
                        </div>

                        {/* Backup history */}
                        <div className="bg-gray-950/40 rounded-2xl border border-gray-700 p-6 space-y-4">
                            <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                                <div className="flex items-center gap-3">
                                    <History className="text-blue-400" size={20}/>
                                    <h4 className="font-bold text-base uppercase tracking-tight">Lịch sử sao lưu</h4>
                                </div>
                                {backupHistory.length > 0 && (
                                    <button onClick={() => { localStorage.removeItem(BACKUP_HISTORY_KEY); setBackupHistory([]); }} className="text-[10px] text-red-500 hover:text-red-400 flex items-center gap-1"><Trash2 size={11}/> Xóa lịch sử</button>
                                )}
                            </div>
                            {backupHistory.length === 0 ? (
                                <p className="text-center text-gray-600 text-xs py-6">Chưa có lịch sử sao lưu trong phiên này</p>
                            ) : (
                                <div className="space-y-2">
                                    {[...backupHistory].reverse().map((rec, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                                            <CheckCircle2 size={14} className="text-green-500 shrink-0"/>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-mono text-gray-300 truncate">{rec.filename}</div>
                                                <div className="text-[10px] text-gray-600 mt-0.5">{rec.date} · {rec.tables} bảng{rec.scope ? ` · ${rec.scope}` : ''}{rec.format ? ` · ${rec.format}` : ''}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}


                {/* Sticky save bar for dirty tabs */}
                {hasAnyDirty && subTab !== 'BACKUP' && subTab !== 'STATUS' && (
                    <div className="sticky bottom-0 left-0 right-0 bg-yellow-900/90 border-t border-yellow-700 px-6 py-3 flex items-center justify-between backdrop-blur-sm rounded-b-xl z-10 mt-4">
                        <span className="text-yellow-200 text-xs flex items-center gap-2">
                            <AlertTriangle size={14}/> Có thay đổi chưa lưu ({dirtyTabs.length} tab)
                        </span>
                        <div className="flex gap-2">
                            <button onClick={loadData} className="px-3 py-1.5 text-xs text-yellow-300 hover:text-white transition-colors">Hoàn tác</button>
                            <button onClick={handleSave} disabled={loading || !canSaveSettings} className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-gray-900 text-xs font-black rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-all">
                                {loading ? <RefreshCw size={12} className="animate-spin"/> : <Save size={12}/>} Lưu ngay
                            </button>
                        </div>
                    </div>
                )}

                <div className="mt-8 flex flex-col md:flex-row justify-end gap-3 pt-6 border-t border-gray-700">
                    <button onClick={loadData} className="px-4 py-2 text-gray-400 hover:text-white font-bold uppercase text-[10px] tracking-widest order-2 md:order-1">Làm mới</button>
                    {subTab !== 'BACKUP' && subTab !== 'STATUS' && (
                        <button onClick={handleSave} disabled={loading || !canSaveSettings} className={`px-8 py-3 md:py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 order-1 md:order-2 ${hasAnyDirty ? 'bg-blue-500 hover:bg-blue-400 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                            {loading ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>} Lưu cấu hình
                        </button>
                    )}
                </div>
            </div>

            {dialog.isOpen && (
                <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-900 rounded-[2rem] w-full max-w-sm border border-gray-800 shadow-2xl overflow-hidden p-8 text-center flex flex-col items-center">
                        {dialog.type === 'success' && <div className="w-14 h-14 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-4"><CheckCircle2 size={28}/></div>}
                        {dialog.type === 'error' && <div className="w-14 h-14 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4"><AlertTriangle size={28}/></div>}
                        {dialog.type === 'alert' && <div className="w-14 h-14 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mb-4"><Info size={28}/></div>}
                        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">{dialog.title}</h3>
                        <p className="text-gray-400 text-xs leading-relaxed mb-6">{dialog.message}</p>
                        <button onClick={() => setDialog({ ...dialog, isOpen: false })} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95">OK</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemSettingsManager;
