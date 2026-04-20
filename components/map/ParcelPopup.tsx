
import React, { useState, useEffect } from 'react';
import { LandParcel, User } from '../../types';
import { X, Info, Map as MapIcon, Maximize2, FileText, Trash2, Edit3, Navigation, QrCode, Download, Share2 } from 'lucide-react';
import QRCode from 'qrcode';
import { formatParcelIdentifier, toSafeFilename } from '../../utils/helpers';

interface ParcelPopupProps {
    parcel: LandParcel;
    user: User | null;
    systemSettings?: Record<string, string>;
    onClose: () => void;
    onPrint: (parcel: LandParcel) => void;
    onEdit?: (parcel: LandParcel) => void;
    onDelete?: (parcel: LandParcel) => void;
}

const ParcelPopup: React.FC<ParcelPopupProps> = ({ parcel, user, systemSettings, onClose, onPrint, onEdit, onDelete }) => {
    const p = parcel.properties || {};
    const [showQR, setShowQR] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const parcelIdentifier = formatParcelIdentifier(p, systemSettings?.parcel_identifier_format);

    useEffect(() => {
        if (showQR) {
            const generateQR = async () => {
                try {
                    // Tạo nội dung mã QR: Thông tin thửa đất để tra cứu nhanh
                    const qrText = `MÃ THỬA: ${parcelIdentifier}\nCHỦ: ${p.ownerName || 'N/A'}\nDIỆN TÍCH: ${Math.round(p.area || 0)} m2\nLOẠI ĐẤT: ${p.landType || 'N/A'}\nWEBGIS GEOMASTER`;
                    const url = await QRCode.toDataURL(qrText, {
                        width: 400,
                        margin: 2,
                        color: { dark: '#000000ff', light: '#ffffffff' }
                    });
                    setQrDataUrl(url);
                } catch (err) {
                    console.error(err);
                }
            };
            generateQR();
        }
    }, [showQR, p, parcelIdentifier]);

    return (
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[calc(100vw-2rem)] md:w-80 overflow-hidden animate-in zoom-in-95 duration-200 relative">
            {/* Header */}
            <div className="bg-blue-600 p-3 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                    <MapIcon size={18} />
                    <span className="font-bold text-sm">Thông tin Thửa đất</span>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setShowQR(!showQR)} 
                        className={`p-1.5 rounded-lg transition-all ${showQR ? 'bg-white text-blue-600 shadow-inner' : 'hover:bg-blue-500'}`}
                        title="Tạo mã QR"
                    >
                        <QrCode size={18} />
                    </button>
                    <button onClick={onClose} className="hover:bg-blue-700 p-1.5 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* QR Overlay */}
            {showQR && (
                <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white p-2 rounded-2xl shadow-xl border border-gray-100 mb-6">
                        {qrDataUrl ? (
                            <img src={qrDataUrl} alt="Parcel QR" className="w-48 h-48" />
                        ) : (
                            <div className="w-48 h-48 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        )}
                    </div>
                    <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-1">Mã định danh thửa đất</p>
                    <p className="text-sm font-black text-slate-800 mb-1">{parcelIdentifier}</p>
                    <p className="text-[10px] text-gray-500 font-medium mb-6">Sử dụng camera điện thoại để quét</p>
                    
                    <div className="grid grid-cols-2 gap-3 w-full">
                        <a 
                            href={qrDataUrl} 
                            download={`QR_${toSafeFilename(parcelIdentifier, 'parcel')}.png`}
                            className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
                        >
                            <Download size={14}/> Lưu ảnh
                        </a>
                        <button 
                            onClick={() => setShowQR(false)}
                            className="bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg"
                        >
                            Đóng lại
                        </button>
                    </div>
                </div>
            )}

            {/* Body */}
            <div className="p-4 space-y-3 max-h-[50vh] md:max-h-[400px] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 p-2 rounded">
                        <p className="text-gray-500 font-bold uppercase text-[9px]">Số tờ</p>
                        <p className="text-blue-700 font-bold text-sm">{p.so_to || '--'}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                        <p className="text-gray-500 font-bold uppercase text-[9px]">Số thửa</p>
                        <p className="text-blue-700 font-bold text-sm">{p.so_thua || '--'}</p>
                    </div>
                </div>

                <div className="space-y-2 border-b border-gray-100 pb-3">
                    <div className="flex items-start gap-2">
                        <Info size={14} className="text-gray-400 mt-0.5" />
                        <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase">Chủ sở hữu</p>
                            <p className="text-sm font-semibold text-gray-800">{p.ownerName || 'Chưa cập nhật'}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <Navigation size={14} className="text-gray-400 mt-0.5" />
                        <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase">Địa chỉ</p>
                            <p className="text-xs text-gray-600 leading-relaxed">{p.address || 'Không có dữ liệu địa chỉ'}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Loại đất</p>
                        <span className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-[10px]">
                            {p.landType || '--'}
                        </span>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Diện tích</p>
                        <p className="text-sm font-bold text-green-600">{Math.round(p.area || 0).toLocaleString()} m²</p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="p-3 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-2">
                <button
                    onClick={() => onPrint(parcel)}
                    className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 hover:border-blue-500 hover:text-blue-600 py-2 rounded-lg text-xs font-bold transition-all text-gray-600"
                >
                    <FileText size={14} /> Trích lục PDF
                </button>

                {user && (user.role === 'ADMIN' || user.role === 'EDITOR') ? (
                    <button
                        onClick={() => onEdit && onEdit(parcel)}
                        className="flex items-center justify-center gap-1.5 bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white py-2 rounded-lg text-xs font-bold transition-all"
                    >
                        <Edit3 size={14} /> Chỉnh sửa
                    </button>
                ) : (
                    <button className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-400 cursor-not-allowed py-2 rounded-lg text-xs font-bold">
                        <Maximize2 size={14} /> Xem chi tiết
                    </button>
                )}
            </div>
        </div>
    );
};

export default ParcelPopup;