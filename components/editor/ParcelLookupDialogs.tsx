import React from 'react';
import { Search, X, RefreshCw } from 'lucide-react';

interface ParcelModalState {
    isOpen: boolean;
    soTo: string;
    soThua: string;
    phuongXa: string;
    searchTable: string;
    includeNearby?: boolean;
    nearbyRadiusMeters?: string;
}

interface ParcelSearchDialogProps {
    parcelModal: ParcelModalState;
    setParcelModal: (next: ParcelModalState) => void;
    spatialTables: any[];
    loadingParcel: boolean;
    onSearchParcel: () => void;
    onClose: () => void;
}

export const ParcelSearchDialog: React.FC<ParcelSearchDialogProps> = ({
    parcelModal,
    setParcelModal,
    spatialTables,
    loadingParcel,
    onSearchParcel,
    onClose
}) => {
    if (!parcelModal.isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-500">
                            <Search size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight text-white">Tra cứu thửa đất</h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Nhập số tờ, số thửa và phường/xã để tìm kiếm</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-all">
                        <X size={28} />
                    </button>
                </div>
                <div className="p-8 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Số tờ *</label>
                            <input
                                autoFocus
                                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 outline-none font-black text-white transition-all shadow-inner"
                                placeholder="VD: 12"
                                value={parcelModal.soTo}
                                onChange={e => setParcelModal({ ...parcelModal, soTo: e.target.value })}
                                onKeyDown={e => e.key === 'Enter' && onSearchParcel()}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Số thửa *</label>
                            <input
                                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 outline-none font-black text-white transition-all shadow-inner"
                                placeholder="VD: 450"
                                value={parcelModal.soThua}
                                onChange={e => setParcelModal({ ...parcelModal, soThua: e.target.value })}
                                onKeyDown={e => e.key === 'Enter' && onSearchParcel()}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Bảng dữ liệu *</label>
                        <div className="relative">
                            <select
                                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 outline-none font-bold text-white transition-all shadow-inner appearance-none"
                                value={parcelModal.searchTable}
                                onChange={e => setParcelModal({ ...parcelModal, searchTable: e.target.value })}
                                onKeyDown={e => e.key === 'Enter' && onSearchParcel()}
                            >
                                <option value="">-- Chọn bảng dữ liệu --</option>
                                {spatialTables
                                    .filter(t => !t.table_name.toLowerCase().includes('donvihanhchinh') && !t.table_name.toLowerCase().includes('hanh_chinh'))
                                    .map((table, idx) => (
                                        <option key={idx} value={table.table_name}>{table.display_name || table.table_name}</option>
                                    ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path d="M6 9l6 6 6-6"/>
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-700 rounded-xl p-3 space-y-3">
                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!parcelModal.includeNearby}
                                onChange={(e) => setParcelModal({ ...parcelModal, includeNearby: e.target.checked })}
                            />
                            Lấy thêm các thửa lân cận
                        </label>
                        {parcelModal.includeNearby && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Bán kính (m)</label>
                                <input
                                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 outline-none font-black text-white transition-all shadow-inner"
                                    placeholder="VD: 50"
                                    value={parcelModal.nearbyRadiusMeters || '50'}
                                    onChange={(e) => setParcelModal({ ...parcelModal, nearbyRadiusMeters: e.target.value })}
                                />
                            </div>
                        )}
                    </div>
                    <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                        <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">Hướng dẫn</p>
                        <ul className="text-[10px] text-gray-400 space-y-1 list-disc pl-4">
                            <li>Nhập số tờ (VD: 12)</li>
                            <li>Nhập số thửa (VD: 450)</li>
                            <li>Chọn bảng dữ liệu để tra cứu</li>
                            <li>Hệ thống sẽ tìm kiếm trên bảng được chọn</li>
                        </ul>
                    </div>
                </div>
                <div className="p-6 bg-gray-950 border-t border-gray-800 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={onSearchParcel}
                        disabled={loadingParcel || (!parcelModal.soTo.trim() && !parcelModal.soThua.trim()) || !parcelModal.searchTable}
                        className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black uppercase text-xs tracking-[0.2em] flex justify-center items-center gap-2 shadow-xl shadow-emerald-900/30 active:scale-95 disabled:opacity-50 transition-all"
                    >
                        {loadingParcel ? <RefreshCw className="animate-spin" size={18}/> : <Search size={18}/>} TÌM KIẾM
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ParcelResultDialogProps {
    parcelModal: ParcelModalState;
    parcelList: any[];
    onSelectParcel: (parcel: any) => void;
    onClose: () => void;
}

export const ParcelResultDialog: React.FC<ParcelResultDialogProps> = ({
    parcelModal,
    parcelList,
    onSelectParcel,
    onClose
}) => {
    if (!parcelModal.isOpen || parcelList.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-500">
                            <Search size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight text-white">Danh sách thửa đất tìm thấy</h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Chọn thửa để tự động điền thông tin</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-all">
                        <X size={28} />
                    </button>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-3">
                    {parcelList.map((parcel, idx) => {
                        const props = parcel.properties || {};
                        const soTo = props.so_to || props.sodoto || '';
                        const soThua = props.so_thua || props.sothua || '';
                        const area = Math.round((props.area || 0));
                        const tableName = props.tableName || '';
                        return (
                            <div
                                key={idx}
                                onClick={() => onSelectParcel(parcel)}
                                className="p-4 bg-slate-900 border border-slate-700 rounded-xl hover:border-emerald-500/50 hover:bg-slate-800 cursor-pointer transition-all flex items-center justify-between group"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-black text-white">{soThua}</span>
                                        <span className="text-xs text-slate-500">/</span>
                                        <span className="text-sm font-bold text-blue-400">Tờ {soTo}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-3">
                                        <span>Diện tích: <span className="text-emerald-500 font-bold">{area.toLocaleString()} m²</span></span>
                                        <span className="text-slate-600">|</span>
                                        <span>Table: {tableName}</span>
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                    <Search size={16} />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="p-6 bg-gray-950 border-t border-gray-800">
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
