import { Settings, Map as MapIcon, Globe, Mail, Activity, DatabaseBackup, Sparkles } from 'lucide-react';

export const SETTING_METADATA: Record<string, { label: string; description: string; type: 'text' | 'number' | 'boolean' | 'image' }> = {
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
    'pdf_show_signer': { label: 'Hiển thị khối chữ ký', description: 'Bật hoặc tắt phần ngày ký và người ký', type: 'boolean' },
    'ocr_use_gemini': { label: 'Kích hoạt Gemini OCR', description: 'Sử dụng mô hình Google Gemini để nhận diện ranh đất từ ảnh với độ chính xác 99.9%', type: 'boolean' },
    'ocr_gemini_key': { label: 'Gemini API Key', description: 'Khóa API Key miễn phí lấy từ Google AI Studio', type: 'text' }
};

// ─── Tab → keys mapping ──────────────────────────────────────────────────────
export const TAB_KEYS: Record<string, string[]> = {
    GENERAL: ['system_name', 'site_logo', 'site_favicon', 'maintenance_mode', 'allow_registration', 'footer_text'],
    MAP:     ['map_center_lat', 'map_center_lng', 'default_zoom', 'map_max_zoom', 'map_min_zoom', 'thematic_map_center_lat', 'thematic_map_center_lng', 'thematic_default_zoom', 'thematic_map_max_zoom', 'thematic_map_min_zoom', 'thematic_default_basemap_id', 'parcel_identifier_format'],
    SEO:     ['seo_title', 'seo_description', 'seo_keywords', 'seo_og_image'],
    MAIL:    ['mail_provider', 'mail_host', 'mail_port', 'mail_user', 'mail_pass', 'mail_from_email', 'mail_from_name'],
    AI:      ['ocr_use_gemini', 'ocr_gemini_key'],
};

export const SETTINGS_GROUPS = [
    {
        title: 'Cấu hình hệ thống',
        items: [
            { key: 'GENERAL', label: 'Web & bảo mật', Icon: Settings, style: 'text-blue-400 border-blue-500/40 bg-blue-950/20', desc: 'Tên hệ thống, logo, quyền truy cập và chân trang.' },
            { key: 'MAP', label: 'Bản đồ & nền', Icon: MapIcon, style: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/20', desc: 'Tâm bản đồ, zoom và nền mặc định cho từng trang.' },
            { key: 'AI', label: 'AI & Tiện ích', Icon: Sparkles, style: 'text-purple-400 border-purple-500/40 bg-purple-950/20', desc: 'Cấu hình Google Gemini API Key để quét ảnh bản vẽ.' }
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

export const TAB_TITLES: Record<string, { title: string; description: string }> = {
    GENERAL: { title: 'Thiết lập hệ thống chung', description: 'Các cấu hình nền tảng của website và quyền truy cập.' },
    MAP: { title: 'Thiết lập bản đồ', description: 'Nhóm cấu hình điều hướng, tâm bản đồ và nền mặc định.' },
    SEO: { title: 'Thiết lập SEO', description: 'Quản lý cách website hiển thị trên Google và mạng xã hội.' },
    MAIL: { title: 'Thiết lập Mail Server', description: 'Cấu hình SMTP và thử gửi email trực tiếp.' },
    AI: { title: 'Thiết lập Trí tuệ nhân tạo (AI)', description: 'Cấu hình Google Gemini API Key và các công cụ AI khác.' },
    STATUS: { title: 'Trạng thái hệ thống', description: 'Theo dõi máy chủ và kiểm tra kết nối dịch vụ.' },
    BACKUP: { title: 'Sao lưu và khôi phục', description: 'Xuất hoặc phục hồi dữ liệu từ tệp SQL.' }
};

export const MAIL_PROVIDER_PRESETS = {
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
export const validate = (key: string, value: string): string => {
    if (!value) return '';
    if ((key === 'mail_user' || key === 'mail_from_email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email không hợp lệ';
    if (key === 'mail_port') { const n = parseInt(value); if (isNaN(n) || n < 1 || n > 65535) return 'Port phải từ 1 → 65535'; }
    if (key === 'map_center_lat' || key === 'thematic_map_center_lat') { const n = parseFloat(value); if (isNaN(n) || n < -90 || n > 90) return 'Vĩ độ phải từ -90 → 90'; }
    if (key === 'map_center_lng' || key === 'thematic_map_center_lng') { const n = parseFloat(value); if (isNaN(n) || n < -180 || n > 180) return 'Kinh độ phải từ -180 → 180'; }
    if (['default_zoom', 'map_max_zoom', 'map_min_zoom', 'thematic_default_zoom', 'thematic_map_max_zoom', 'thematic_map_min_zoom'].includes(key)) { const n = parseInt(value); if (isNaN(n) || n < 0 || n > 22) return 'Zoom phải từ 0 → 22'; }
    return '';
};

export const BACKUP_HISTORY_KEY = 'geo_backup_history';
export type BackupScope = 'ALL' | 'SYSTEM' | 'SPATIAL' | 'CUSTOM';
export type BackupFormat = 'FULL' | 'DATA_ONLY' | 'SCHEMA_ONLY';
export type BackupRecord = { date: string; tables: number; filename: string; format?: BackupFormat; scope?: BackupScope };
