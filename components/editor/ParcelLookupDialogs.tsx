import React, { useState, useRef, useEffect } from 'react';
import { Search, X, RefreshCw, ChevronDown, Sparkles } from 'lucide-react';

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
    onSearchParcel: (overrideSoTo?: string, overrideSoThua?: string) => void;
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
    const [searchMode, setSearchMode] = useState<'standard' | 'quick'>('quick');
    const [quickSearchText, setQuickSearchText] = useState('');
    const [isTableDropdownOpen, setIsTableDropdownOpen] = useState(false);
    const [tableSearchText, setTableSearchText] = useState('');
    const tableDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (tableDropdownRef.current && !tableDropdownRef.current.contains(e.target as Node)) {
                setIsTableDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!parcelModal.isOpen) return null;

    const parseQuickSearch = (text: string) => {
        const trimmed = text.trim();
        const match = trimmed.match(/^(\d+)[\/\-\s\:]+(\d+)$/);
        if (match) {
            return { soTo: match[1], soThua: match[2] };
        }
        const matchSingle = trimmed.match(/^(\d+)$/);
        if (matchSingle) {
            return { soTo: '', soThua: matchSingle[1] };
        }
        return { soTo: '', soThua: '' };
    };

    const triggerSearch = () => {
        if (searchMode === 'quick') {
            const { soTo, soThua } = parseQuickSearch(quickSearchText);
            setParcelModal({
                ...parcelModal,
                soTo,
                soThua
            });
            onSearchParcel(soTo, soThua);
        } else {
            onSearchParcel();
        }
    };

    const filteredTables = spatialTables
        .filter(t => !t.table_name.toLowerCase().includes('donvihanhchinh') && !t.table_name.toLowerCase().includes('hanh_chinh'))
        .filter(t => {
            if (!tableSearchText.trim()) return true;
            return (t.display_name || t.table_name).toLowerCase().includes(tableSearchText.toLowerCase());
        });

    const selectedTableDisplayName = spatialTables.find(t => t.table_name === parcelModal.searchTable)?.display_name || parcelModal.searchTable;

    const isSearchDisabled = loadingParcel || !parcelModal.searchTable || (
        searchMode === 'quick' ? !quickSearchText.trim() : (!parcelModal.soTo.trim() && !parcelModal.soThua.trim())
    );

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
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Tìm kiếm nhanh chóng theo tờ/thửa và khu vực</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-all">
                        <X size={28} />
                    </button>
                </div>

                {/* Search Mode Selector */}
                <div className="px-8 pt-6">
                    <div className="flex p-1 bg-gray-950 rounded-2xl border border-gray-800">
                        <button
                            onClick={() => setSearchMode('quick')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${searchMode === 'quick' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/25' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Sparkles size={14} /> Tìm nhanh tờ/thửa
                        </button>
                        <button
                            onClick={() => setSearchMode('standard')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${searchMode === 'standard' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/25' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Search size={14} /> Ô nhập chi tiết
                        </button>
                    </div>
                </div>

                <div className="p-8 space-y-4">
                    {/* Ward/Table Selector (Quick Searchable Select Dropdown) */}
                    <div className="space-y-2 relative" ref={tableDropdownRef}>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Khu vực (Phường/Xã) *</label>
                        <div
                            onClick={() => setIsTableDropdownOpen(!isTableDropdownOpen)}
                            className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 outline-none font-bold text-white transition-all shadow-inner flex items-center justify-between cursor-pointer group hover:border-emerald-500"
                        >
                            <span className={parcelModal.searchTable ? 'text-white' : 'text-gray-500'}>
                                {selectedTableDisplayName || '-- Chọn phường / xã / khu vực --'}
                            </span>
                            <ChevronDown size={16} className={`text-gray-500 group-hover:text-emerald-500 transition-transform ${isTableDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>

                        {isTableDropdownOpen && (
                            <div className="absolute z-[1050] left-0 right-0 top-full mt-2 bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                <div className="p-3 border-b border-gray-800 bg-gray-900">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                        <input
                                            autoFocus
                                            className="w-full bg-gray-950 border border-gray-700 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-500 text-white"
                                            placeholder="Tìm nhanh tên phường/xã..."
                                            value={tableSearchText}
                                            onChange={e => setTableSearchText(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                    {filteredTables.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-gray-500 italic">Không tìm thấy khu vực</div>
                                    ) : filteredTables.map(t => (
                                        <div
                                            key={t.table_name}
                                            onClick={() => {
                                                setParcelModal({ ...parcelModal, searchTable: t.table_name });
                                                setIsTableDropdownOpen(false);
                                                setTableSearchText('');
                                            }}
                                            className={`p-3 text-xs font-bold transition-colors cursor-pointer border-b border-gray-900 last:border-0 ${parcelModal.searchTable === t.table_name ? 'bg-emerald-600 text-white font-black' : 'text-gray-300 hover:bg-gray-900'}`}
                                        >
                                            {t.display_name || t.table_name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Conditional Input Rendering based on Search Mode */}
                    {searchMode === 'quick' ? (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Nhập Tờ/Thửa nhanh *</label>
                            <input
                                autoFocus
                                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 outline-none font-black text-white transition-all shadow-inner"
                                placeholder="VD: 12/450 hoặc 12-450 hoặc chỉ nhập 450"
                                value={quickSearchText}
                                onChange={e => setQuickSearchText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !isSearchDisabled && triggerSearch()}
                            />
                            <p className="text-[9px] text-gray-500 ml-1">Cách nhập: [Số tờ]/[Số thửa], [Số tờ]-[Số thửa] hoặc chỉ nhập [Số thửa].</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Số tờ *</label>
                                <input
                                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 outline-none font-black text-white transition-all shadow-inner"
                                    placeholder="VD: 12"
                                    value={parcelModal.soTo}
                                    onChange={e => setParcelModal({ ...parcelModal, soTo: e.target.value })}
                                    onKeyDown={e => e.key === 'Enter' && !isSearchDisabled && triggerSearch()}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Số thửa *</label>
                                <input
                                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-500 outline-none font-black text-white transition-all shadow-inner"
                                    placeholder="VD: 450"
                                    value={parcelModal.soThua}
                                    onChange={e => setParcelModal({ ...parcelModal, soThua: e.target.value })}
                                    onKeyDown={e => e.key === 'Enter' && !isSearchDisabled && triggerSearch()}
                                />
                            </div>
                        </div>
                    )}

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
                </div>
                
                <div className="p-6 bg-gray-950 border-t border-gray-800 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={triggerSearch}
                        disabled={isSearchDisabled}
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
                                        <span>Khu vực: {tableName}</span>
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
