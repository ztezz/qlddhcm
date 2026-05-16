import React from 'react';
import { LandParcel, User } from '../../types';
import { X, FileText, RotateCcw, Printer, Eye, CheckSquare, Square } from 'lucide-react';
import { getRawParcelIdentifier } from '../../utils/helpers';

interface PdfTemplateEditorProps {
    isOpen: boolean;
    parcel: LandParcel | null;
    user: User | null;
    systemSettings?: Record<string, string>;
    templateSettings: Record<string, string>;
    onChange: (next: Record<string, string>) => void;
    onClose: () => void;
    onReset: () => void;
    onPrint: () => void;
}

const PdfTemplateEditor: React.FC<PdfTemplateEditorProps> = ({
    isOpen,
    parcel,
    user,
    systemSettings,
    templateSettings,
    onChange,
    onClose,
    onReset,
    onPrint
}) => {
    if (!isOpen) return null;

    const p = (parcel?.properties || {}) as Record<string, any>;
    const rawParcelIdentifier = getRawParcelIdentifier(p) || '--';
    const resolveValue = (key: string, fallback = '') => {
        return templateSettings[key] ?? systemSettings?.[key] ?? fallback;
    };

    const updateField = (key: string, value: string) => {
        onChange({ ...templateSettings, [key]: value });
    };

    const toggleField = (key: string, defaultValue = true) => {
        const current = resolveValue(key, defaultValue ? 'true' : 'false') !== 'false';
        updateField(key, current ? 'false' : 'true');
    };

    const applyPreset = (preset: Record<string, string>) => {
        onChange({ ...templateSettings, ...preset });
    };

    const showQr = resolveValue('pdf_show_qr', 'true') !== 'false';
    const showSigner = resolveValue('pdf_show_signer', 'true') !== 'false';

    return (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-7xl max-h-[94vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">Chỉnh sửa mẫu xuất PDF thửa đất</h3>
                        <p className="text-xs text-slate-400">Tùy biến nhanh tiêu đề, chữ ký, ghi chú và nội dung hiển thị trước khi xuất.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-0 max-h-[calc(94vh-72px)]">
                    <div className="p-5 border-r border-slate-800 overflow-y-auto space-y-5">
                        <div className="space-y-3">
                            <div className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-500">Mẫu nhanh</div>
                            <div className="grid grid-cols-1 gap-2">
                                <button
                                    type="button"
                                    onClick={() => applyPreset({
                                        pdf_header_1: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
                                        pdf_header_2: 'Độc lập - Tự do - Hạnh phúc',
                                        pdf_title: 'TRÍCH LỤC BẢN ĐỒ ĐỊA CHÍNH',
                                        pdf_signer_title: 'Người trích lục',
                                        pdf_show_qr: 'true',
                                        pdf_show_signer: 'true'
                                    })}
                                    className="text-left px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold"
                                >
                                    Mẫu hành chính chuẩn
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset({
                                        pdf_header_1: 'HỆ THỐNG THÔNG TIN ĐẤT ĐAI',
                                        pdf_header_2: 'Phiếu trích xuất dữ liệu số',
                                        pdf_title: 'PHIẾU THÔNG TIN THỬA ĐẤT',
                                        pdf_signer_title: 'Người xác nhận',
                                        pdf_show_qr: 'true',
                                        pdf_show_signer: 'true'
                                    })}
                                    className="text-left px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold"
                                >
                                    Mẫu thông tin số
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset({
                                        pdf_header_1: 'WEBGIS HỒ CHÍ MINH',
                                        pdf_header_2: 'Trích xuất nội bộ',
                                        pdf_title: 'SƠ ĐỒ THỬA ĐẤT',
                                        pdf_signer_title: 'Người lập phiếu',
                                        pdf_show_qr: 'false',
                                        pdf_show_signer: 'true'
                                    })}
                                    className="text-left px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold"
                                >
                                    Mẫu nội bộ gọn
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-500">Nội dung chính</div>
                            {[
                                ['pdf_header_1', 'Dòng đầu tiêu đề'],
                                ['pdf_header_2', 'Dòng thứ hai'],
                                ['pdf_title', 'Tiêu đề lớn'],
                                ['pdf_location_text', 'Địa danh ký'],
                                ['pdf_signer_title', 'Chức danh ký'],
                                ['pdf_signer_name', 'Người ký / hiển thị'],
                                ['pdf_footer_text', 'Chân trang PDF'],
                                ['pdf_note_text', 'Ghi chú thêm']
                            ].map(([key, label]) => (
                                <div key={key}>
                                    <label className="block text-[11px] font-bold text-slate-300 mb-1">{label}</label>
                                    {key === 'pdf_note_text' ? (
                                        <textarea
                                            value={resolveValue(key, '')}
                                            onChange={(e) => updateField(key, e.target.value)}
                                            className="w-full min-h-[84px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                        />
                                    ) : (
                                        <input
                                            value={resolveValue(key, '')}
                                            onChange={(e) => updateField(key, e.target.value)}
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="space-y-3">
                            <div className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-500">Tùy chọn hiển thị</div>
                            <button onClick={() => toggleField('pdf_show_qr', true)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white">
                                <span>Hiển thị mã QR xác thực</span>
                                {showQr ? <CheckSquare size={16} className="text-emerald-400" /> : <Square size={16} className="text-slate-500" />}
                            </button>
                            <button onClick={() => toggleField('pdf_show_signer', true)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white">
                                <span>Hiển thị khối chữ ký</span>
                                {showSigner ? <CheckSquare size={16} className="text-emerald-400" /> : <Square size={16} className="text-slate-500" />}
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                            <button onClick={onReset} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2">
                                <RotateCcw size={14} /> Khôi phục mặc định
                            </button>
                            <button onClick={onPrint} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg">
                                <Printer size={14} /> Xuất PDF ngay
                            </button>
                        </div>
                    </div>

                    <div className="p-5 overflow-y-auto bg-slate-950/40">
                        <div className="flex items-center gap-2 mb-4 text-slate-300">
                            <Eye size={16} />
                            <span className="text-xs font-black uppercase tracking-widest">Xem nhanh mẫu PDF</span>
                        </div>

                        <div className="bg-white text-black rounded-2xl shadow-2xl p-6 max-w-3xl mx-auto border border-slate-300">
                            <div className="text-center mb-5">
                                <div className="text-sm font-bold uppercase">{resolveValue('pdf_header_1', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')}</div>
                                <div className="text-sm font-bold border-b border-black inline-block mt-1 pb-1">{resolveValue('pdf_header_2', 'Độc lập - Tự do - Hạnh phúc')}</div>
                            </div>

                            <div className="text-center mb-5">
                                <div className="text-xl font-black uppercase">{resolveValue('pdf_title', 'TRÍCH LỤC BẢN ĐỒ ĐỊA CHÍNH')}</div>
                            </div>

                            <div className="space-y-2 text-sm leading-6">
                                <div><strong>Mã định danh:</strong> {rawParcelIdentifier}</div>
                                <div><strong>Thửa đất số:</strong> {p.so_thua || p.sothua || '--'} &nbsp; <strong>Tờ bản đồ số:</strong> {p.so_to || p.sodoto || '--'}</div>
                                <div><strong>Chủ sử dụng:</strong> {p.ownerName || p.tenchu || 'Chưa cập nhật'}</div>
                                <div><strong>Địa chỉ:</strong> {p.address || p.diachi || 'Chưa cập nhật'}</div>
                                <div><strong>Diện tích:</strong> {Math.round(Number(p.area || p.dientich || 0)).toLocaleString()} m²</div>
                                <div><strong>Loại đất:</strong> {p.landType || p.loaidat || '--'}</div>
                            </div>

                            {resolveValue('pdf_note_text', '').trim() && (
                                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                                    <strong>Ghi chú:</strong> {resolveValue('pdf_note_text', '')}
                                </div>
                            )}

                            <div className="mt-6 grid grid-cols-2 gap-4 items-end">
                                <div className="text-xs text-slate-600">
                                    {showQr ? 'QR xác thực: Bật' : 'QR xác thực: Tắt'}
                                </div>
                                {showSigner && (
                                    <div className="text-center">
                                        <div className="italic text-sm">{resolveValue('pdf_location_text', 'TP. Hồ Chí Minh')}, ngày ... tháng ... năm ...</div>
                                        <div className="font-bold uppercase mt-2">{resolveValue('pdf_signer_title', 'Người trích lục')}</div>
                                        <div className="h-10" />
                                        <div className="font-bold uppercase">{resolveValue('pdf_signer_name', user?.name || 'HỆ THỐNG WEBGIS')}</div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 pt-3 border-t text-center text-xs text-slate-600">
                                {resolveValue('pdf_footer_text', systemSettings?.footer_text || 'Trung tâm dữ liệu GIS')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PdfTemplateEditor;
