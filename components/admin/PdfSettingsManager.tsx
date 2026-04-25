import React, { useState, useEffect, useCallback } from 'react';
import { adminService, hasAnyPermission } from '../../services/mockBackend';
import { SystemSetting } from '../../types';
import { Save, RefreshCw, AlertTriangle, Image as ImageIcon, Trash2, CheckCircle2, Info, FileText } from 'lucide-react';
import { PDF_TEMPLATE_PRESETS, getPdfTemplatePreset } from '../../utils/pdfTemplatePresets';

interface PdfSettingsManagerProps {
    permissions?: string[];
}

const PDF_KEYS = [
    'pdf_template_preset', 'pdf_header_1', 'pdf_header_2', 'pdf_title',
    'pdf_location_text', 'pdf_signer_title', 'pdf_signer_name',
    'pdf_signature_style', 'pdf_signature_width', 'pdf_signature_height',
    'pdf_signature_image', 'pdf_show_signature_image',
    'pdf_stamp_image', 'pdf_show_stamp',
    'pdf_note_text', 'pdf_footer_text', 'pdf_show_qr', 'pdf_show_signer',
];

const BOOL_DEFAULT_TRUE = ['pdf_show_qr', 'pdf_show_signer', 'pdf_show_signature_image', 'pdf_show_stamp'];

const METADATA: Record<string, { label: string; description: string; type: 'text' | 'number' | 'boolean' | 'image' }> = {
    pdf_template_preset:    { label: 'Mẫu PDF mặc định',       description: 'Mẫu do quản trị hệ thống chọn và áp dụng cho toàn bộ người dùng', type: 'text' },
    pdf_header_1:           { label: 'Dòng tiêu đề 1',          description: 'Ví dụ: CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', type: 'text' },
    pdf_header_2:           { label: 'Dòng tiêu đề 2',          description: 'Ví dụ: Độc lập - Tự do - Hạnh phúc', type: 'text' },
    pdf_title:              { label: 'Tiêu đề biểu mẫu PDF',    description: 'Tên lớn của biểu mẫu khi xuất thửa đất', type: 'text' },
    pdf_location_text:      { label: 'Địa danh ký',             description: 'Ví dụ: TP. Hồ Chí Minh', type: 'text' },
    pdf_signer_title:       { label: 'Chức danh người ký',      description: 'Ví dụ: Người trích lục', type: 'text' },
    pdf_signer_name:        { label: 'Tên người ký',            description: 'Tên hiển thị ở phần cuối PDF', type: 'text' },
    pdf_signature_style:    { label: 'Mẫu chữ ký',              description: 'Chọn kiểu hiển thị khối chữ ký trên PDF', type: 'text' },
    pdf_signature_width:    { label: 'Chiều rộng chữ ký',       description: 'Chiều rộng ảnh chữ ký trong PDF (px)', type: 'number' },
    pdf_signature_height:   { label: 'Chiều cao chữ ký',        description: 'Chiều cao ảnh chữ ký trong PDF (px)', type: 'number' },
    pdf_signature_image:    { label: 'Ảnh chữ ký',              description: 'Tải lên ảnh chữ ký PNG nền trong suốt để chèn vào PDF', type: 'image' },
    pdf_show_signature_image: { label: 'Hiển thị ảnh chữ ký',  description: 'Bật hoặc tắt ảnh chữ ký trên biểu mẫu', type: 'boolean' },
    pdf_stamp_image:        { label: 'Ảnh mộc / con dấu',       description: 'Tải lên ảnh mộc đỏ hoặc dấu xác nhận để đóng trên PDF', type: 'image' },
    pdf_show_stamp:         { label: 'Hiển thị mộc / con dấu',  description: 'Bật hoặc tắt phần mộc đỏ trên biểu mẫu', type: 'boolean' },
    pdf_note_text:          { label: 'Ghi chú PDF',              description: 'Ghi chú hoặc thông tin bổ sung hiển thị trong mẫu PDF', type: 'text' },
    pdf_footer_text:        { label: 'Chân trang PDF',           description: 'Dòng chữ in dưới cùng trang PDF', type: 'text' },
    pdf_show_qr:            { label: 'Hiển thị mã QR',           description: 'Bật hoặc tắt khối mã QR xác thực trên biểu mẫu', type: 'boolean' },
    pdf_show_signer:        { label: 'Hiển thị khối chữ ký',    description: 'Bật hoặc tắt phần ngày ký và người ký', type: 'boolean' },
};

const GROUPS: { title: string; keys: string[] }[] = [
    { title: 'Mẫu & tiêu đề', keys: ['pdf_template_preset', 'pdf_header_1', 'pdf_header_2', 'pdf_title'] },
    { title: 'Thông tin người ký & địa danh', keys: ['pdf_location_text', 'pdf_signer_title', 'pdf_signer_name'] },
    { title: 'Chữ ký & con dấu', keys: ['pdf_signature_style', 'pdf_signature_width', 'pdf_signature_height', 'pdf_signature_image', 'pdf_show_signature_image', 'pdf_stamp_image', 'pdf_show_stamp'] },
    { title: 'Nội dung & hiển thị', keys: ['pdf_note_text', 'pdf_footer_text', 'pdf_show_qr', 'pdf_show_signer'] },
];

const PdfSettingsManager: React.FC<PdfSettingsManagerProps> = ({ permissions = [] }) => {
    const [settings, setSettings] = useState<SystemSetting[]>([]);
    const [savedSettings, setSavedSettings] = useState<SystemSetting[]>([]);
    const [loading, setLoading] = useState(false);
    const [validationErrors] = useState<Record<string, string>>({});
    const [dialog, setDialog] = useState<{ open: boolean; type: 'success' | 'error' | 'alert'; title: string; message: string }>({ open: false, type: 'alert', title: '', message: '' });

    const canSave = hasAnyPermission(permissions, ['SAVE_SYSTEM_SETTINGS', 'MANAGE_SYSTEM']);

    const showDialog = (type: 'success' | 'error' | 'alert', title: string, message: string) =>
        setDialog({ open: true, type, title, message });

    const isDirty = useCallback((key: string) => {
        const cur = settings.find(s => s.key === key)?.value ?? '';
        const orig = savedSettings.find(s => s.key === key)?.value ?? '';
        return cur !== orig;
    }, [settings, savedSettings]);

    const hasAnyDirty = PDF_KEYS.some(k => isDirty(k));

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await adminService.getSettings();
            setSettings(data);
            setSavedSettings(data.map(s => ({ ...s })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const updateValue = (key: string, value: string) => {
        setSettings(prev => {
            let next = prev.some(s => s.key === key)
                ? prev.map(s => s.key === key ? { ...s, value } : s)
                : [...prev, { key, value, type: METADATA[key]?.type || 'text' } as SystemSetting];

            if (key === 'pdf_template_preset') {
                const preset = getPdfTemplatePreset(value);
                Object.entries(preset.settings).forEach(([pKey, pVal]) => {
                    if (next.some(s => s.key === pKey)) {
                        next = next.map(s => s.key === pKey ? { ...s, value: pVal } : s);
                    } else {
                        next.push({ key: pKey, value: pVal, type: METADATA[pKey]?.type || 'text' } as SystemSetting);
                    }
                });
            }
            return next;
        });
    };

    const handleFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { showDialog('error', 'File quá lớn', 'Vui lòng chọn ảnh dưới 2MB.'); return; }
        const reader = new FileReader();
        reader.onloadend = () => updateValue(key, reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!canSave) { showDialog('error', 'Không đủ quyền', 'Bạn không có quyền lưu cấu hình hệ thống.'); return; }
        setLoading(true);
        try {
            await adminService.saveSettings(settings);
            setSavedSettings(settings.map(s => ({ ...s })));
            const map = settings.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {} as Record<string, string>);
            window.dispatchEvent(new CustomEvent('system-settings-updated', { detail: map }));
            showDialog('success', 'Đã lưu', 'Cấu hình tài liệu PDF đã được ghi nhận.');
        } catch (e: any) {
            showDialog('error', 'Lỗi lưu', e.message);
        } finally {
            setLoading(false);
        }
    };

    const renderInput = (key: string) => {
        const meta = METADATA[key];
        const boolDefault = BOOL_DEFAULT_TRUE.includes(key) ? 'true' : '';
        const setting = settings.find(s => s.key === key) || { key, value: meta?.type === 'boolean' ? boolDefault : '', type: meta?.type || 'text' };
        const dirty = isDirty(key);
        const error = validationErrors[key];

        if (meta?.type === 'image') {
            return (
                <div className="space-y-3">
                    {setting.value && (
                        <div className="relative w-32 h-32 bg-gray-900 rounded border border-gray-700 overflow-hidden group">
                            <img src={setting.value} alt={key} className="w-full h-full object-contain p-1" />
                            <button onClick={() => updateValue(key, '')} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="text-red-400" size={20} />
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

        if (meta?.type === 'boolean') {
            const isTrue = setting.value === 'true';
            return (
                <div className="flex items-center gap-3">
                    <button onClick={() => updateValue(key, isTrue ? 'false' : 'true')}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isTrue ? 'bg-blue-600' : 'bg-gray-700'} ${dirty ? 'ring-2 ring-yellow-500/50' : ''}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isTrue ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-sm font-bold uppercase tracking-widest ${isTrue ? 'text-blue-400' : 'text-gray-400'}`}>{isTrue ? 'ĐANG BẬT' : 'ĐANG TẮT'}</span>
                    {dirty && <span className="text-[10px] text-yellow-500">● Chưa lưu</span>}
                </div>
            );
        }

        if (key === 'pdf_template_preset') {
            return (
                <div className="space-y-2">
                    <select className={`w-full bg-gray-900 border rounded p-2.5 text-white outline-none font-medium transition-colors ${dirty ? 'border-yellow-500/60' : 'border-gray-600 focus:border-blue-500'}`}
                        value={setting.value || 'DEFAULT'}
                        onChange={e => updateValue(key, e.target.value)}>
                        {Object.entries(PDF_TEMPLATE_PRESETS).map(([k, v]) => (
                            <option key={k} value={k}>{(v as any).label}</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-gray-500">Quản trị hệ thống chọn mẫu tại đây; toàn bộ người dùng sẽ dùng chung khi xuất PDF.</p>
                    {dirty && <p className="text-[10px] text-yellow-500">● Chưa lưu</p>}
                </div>
            );
        }

        if (key === 'pdf_signature_style') {
            return (
                <div className="space-y-2">
                    <select className={`w-full bg-gray-900 border rounded p-2.5 text-white outline-none font-medium transition-colors ${dirty ? 'border-yellow-500/60' : 'border-gray-600 focus:border-blue-500'}`}
                        value={setting.value || 'HANDWRITTEN'}
                        onChange={e => updateValue(key, e.target.value)}>
                        <option value="HANDWRITTEN">Ký tay mềm</option>
                        <option value="FORMAL">Ký hành chính trang trọng</option>
                        <option value="DIGITAL">Ký số màu xanh</option>
                    </select>
                    <p className="text-[10px] text-gray-500">Có thể kết hợp cùng ảnh chữ ký và ảnh mộc để tạo mẫu trình bày hoàn chỉnh.</p>
                    {dirty && <p className="text-[10px] text-yellow-500">● Chưa lưu</p>}
                </div>
            );
        }

        return (
            <div className="space-y-1">
                <input
                    className={`w-full bg-gray-900 border rounded p-2.5 text-white outline-none font-medium transition-colors ${error ? 'border-red-500' : dirty ? 'border-yellow-500/60' : 'border-gray-600 focus:border-blue-500'}`}
                    value={setting.value || ''}
                    type={meta?.type === 'number' ? 'number' : 'text'}
                    step={meta?.type === 'number' ? 'any' : undefined}
                    onChange={e => updateValue(key, e.target.value)}
                />
                {error && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertTriangle size={10} /> {error}</p>}
                {dirty && !error && <p className="text-[10px] text-yellow-500">● Chưa lưu</p>}
            </div>
        );
    };

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 text-white relative">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                        <FileText size={20} className="text-orange-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Cấu hình Tài liệu & PDF</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Biểu mẫu, header, chữ ký và con dấu khi xuất hồ sơ PDF nghiệp vụ đất đai</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadData} disabled={loading} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5">
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Làm mới
                    </button>
                    <button onClick={handleSave} disabled={loading || !canSave || !hasAnyDirty}
                        className={`px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all active:scale-95 ${hasAnyDirty && canSave ? 'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-900/30' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}>
                        {loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        Lưu cấu hình
                    </button>
                </div>
            </div>

            {/* Groups */}
            {GROUPS.map(group => (
                <div key={group.title} className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-800 bg-gray-950/40">
                        <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">{group.title}</span>
                    </div>
                    <div className="p-5 space-y-0 divide-y divide-gray-800/60">
                        {group.keys.map(key => (
                            <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-4 py-5 first:pt-0 last:pb-0">
                                <div className="col-span-1">
                                    <label className="text-sm font-bold text-gray-200 block mb-1">{METADATA[key]?.label || key}</label>
                                    <span className="text-xs text-gray-500 italic">{METADATA[key]?.description}</span>
                                </div>
                                <div className="col-span-2">{renderInput(key)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Sticky dirty bar */}
            {hasAnyDirty && (
                <div className="sticky bottom-0 bg-yellow-900/90 border-t border-yellow-700 px-6 py-3 flex items-center justify-between backdrop-blur-sm rounded-b-xl z-10">
                    <span className="text-yellow-200 text-xs flex items-center gap-2"><AlertTriangle size={14} /> Có thay đổi chưa lưu</span>
                    <div className="flex gap-2">
                        <button onClick={loadData} className="px-3 py-1.5 text-xs text-yellow-300 hover:text-white transition-colors">Hoàn tác</button>
                        <button onClick={handleSave} disabled={loading || !canSave}
                            className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-gray-900 text-xs font-black rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-all">
                            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />} Lưu ngay
                        </button>
                    </div>
                </div>
            )}

            {/* Dialog */}
            {dialog.open && (
                <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-[2rem] w-full max-w-sm border border-gray-800 shadow-2xl p-8 text-center flex flex-col items-center">
                        {dialog.type === 'success' && <div className="w-14 h-14 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-4"><CheckCircle2 size={28} /></div>}
                        {dialog.type === 'error' && <div className="w-14 h-14 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4"><AlertTriangle size={28} /></div>}
                        {dialog.type === 'alert' && <div className="w-14 h-14 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mb-4"><Info size={28} /></div>}
                        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">{dialog.title}</h3>
                        <p className="text-gray-400 text-xs leading-relaxed mb-6">{dialog.message}</p>
                        <button onClick={() => setDialog(d => ({ ...d, open: false }))} className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95">OK</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PdfSettingsManager;
