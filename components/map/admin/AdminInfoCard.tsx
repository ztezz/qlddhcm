import React from 'react';

export interface SelectedAdminInfo {
    layerName: string;
    properties: Record<string, any>;
}

interface AdminInfoCardProps {
    info: SelectedAdminInfo | null;
    onClose: () => void;
}

const AdminInfoCard: React.FC<AdminInfoCardProps> = ({ info, onClose }) => {
    if (!info) return null;

    const properties = info.properties || {};
    const detailRows = [
        { label: 'Mã tỉnh', value: properties.ma_tinh },
        { label: 'Tên tỉnh', value: properties.ten_tinh },
        { label: 'Sáp nhập', value: properties.sap_nhap },
        { label: 'Quy mô', value: properties.quy_mo },
        { label: 'Trụ sở', value: properties.tru_so },
        { label: 'Loại', value: properties.loai },
        { label: 'Cấp', value: properties.cap },
        { label: 'Diện tích (km²)', value: properties.dtich_km2 },
        { label: 'Dân số', value: properties.dan_so },
        { label: 'Mật độ (ng/km²)', value: properties.matdo_km2 }
    ].filter((item) => item.value !== null && item.value !== undefined && String(item.value).trim() !== '');

    return (
        <div className="absolute left-4 bottom-4 z-[650] w-[340px] max-w-[calc(100vw-2rem)] bg-slate-950/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-start justify-between gap-2">
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-black">Thông tin lớp hành chính</p>
                    <p className="text-sm text-white font-bold mt-1">{properties.ten_tinh || properties.name || info.layerName}</p>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-slate-800"
                >
                    Đóng
                </button>
            </div>
            <div className="p-4 text-xs text-slate-200 space-y-1.5">
                {detailRows.length > 0 ? detailRows.map((item) => (
                    <p key={item.label}>
                        <span className="text-slate-400">{item.label}:</span> {item.value}
                    </p>
                )) : (
                    <p className="text-slate-400">Không có dữ liệu chi tiết.</p>
                )}
            </div>
        </div>
    );
};

export default AdminInfoCard;