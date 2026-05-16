
import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, Layers, Database, ChevronDown, X } from 'lucide-react';
import { SpatialTable } from '../../../services/parcelApi';
import { removeAccents } from '../../../utils/helpers';

interface TableFilterProps {
    layer: string;
    setLayer: (val: string) => void;
    availableTables: SpatialTable[];
    searchFilters: any;
    setSearchFilters: (val: any) => void;
    handleSearch: () => void;
    loading: boolean;
}

const TableFilter: React.FC<TableFilterProps> = ({ 
    layer, setLayer, availableTables, searchFilters, setSearchFilters, handleSearch, loading 
}) => {
    // Searchable Select States
    const [isOpen, setIsOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const filteredTables = availableTables.filter(t => {
        if (!searchText.trim()) return true;
        const search = removeAccents(searchText);
        return removeAccents(t.display_name || t.table_name).includes(search);
    });

    const currentTable = availableTables.find(t => t.table_name === layer);

    return (
        <div className="p-5 bg-gray-900/50 border-b border-gray-800 grid grid-cols-1 md:grid-cols-7 gap-4 items-end animate-in fade-in duration-500">
            {/* SEARCHABLE TABLE SELECT */}
            <div className="space-y-1.5 md:col-span-1 relative" ref={dropdownRef}>
                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-widest flex items-center gap-1">
                    <Database size={10} /> Lớp dữ liệu
                </label>
                
                <div 
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white flex items-center justify-between cursor-pointer hover:border-blue-500 transition-all group"
                >
                    <span className="font-bold truncate pr-2">
                        {currentTable?.display_name || currentTable?.table_name || 'Chọn lớp...'}
                    </span>
                    <ChevronDown size={14} className={`text-gray-500 group-hover:text-blue-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>

                {isOpen && (
                    <div className="absolute z-[100] left-0 right-0 top-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-2 border-b border-gray-700 bg-gray-900/50">
                            <div className="relative">
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"/>
                                <input 
                                    autoFocus
                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg py-1.5 pl-8 pr-3 text-[11px] text-white outline-none focus:border-blue-600"
                                    placeholder="Tìm tên lớp..."
                                    value={searchText}
                                    onChange={e => setSearchText(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto custom-scrollbar">
                            {filteredTables.length === 0 ? (
                                <div className="p-4 text-center text-[10px] text-gray-500 italic">Không tìm thấy kết quả</div>
                            ) : filteredTables.map(t => (
                                <div 
                                    key={t.table_name}
                                    onClick={() => {
                                        setLayer(t.table_name);
                                        setIsOpen(false);
                                        setSearchText('');
                                    }}
                                    className={`p-3 text-[11px] font-bold transition-colors cursor-pointer border-b border-gray-700/50 last:border-0 ${layer === t.table_name ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                                >
                                    <div className="flex flex-col">
                                        <span>{t.display_name}</span>
                                        <span className={`text-[9px] font-mono mt-0.5 ${layer === t.table_name ? 'text-blue-100' : 'text-gray-500'}`}>{t.table_name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-1.5 md:col-span-1">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-widest">Mã định danh</label>
                <input
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs focus:border-blue-500 outline-none font-mono text-amber-300"
                    placeholder="12 chữ số..."
                    value={searchFilters.madinhdanh}
                    onChange={e => setSearchFilters({...searchFilters, madinhdanh: e.target.value})}
                />
            </div>
            <div className="space-y-1.5 md:col-span-1">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-widest">Số tờ</label>
                <input 
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs focus:border-blue-500 outline-none font-bold text-blue-400" 
                    placeholder="Số tờ..." 
                    value={searchFilters.sodoto} 
                    onChange={e => setSearchFilters({...searchFilters, sodoto: e.target.value})} 
                />
            </div>
            <div className="space-y-1.5 md:col-span-1">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-widest">Số thửa</label>
                <input 
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs focus:border-blue-500 outline-none font-bold text-blue-400" 
                    placeholder="Số thửa..." 
                    value={searchFilters.sothua} 
                    onChange={e => setSearchFilters({...searchFilters, sothua: e.target.value})} 
                />
            </div>
            <div className="space-y-1.5 md:col-span-1">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-widest">Tên chủ</label>
                <input 
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs focus:border-blue-500 outline-none" 
                    placeholder="Tên chủ..." 
                    value={searchFilters.tenchu} 
                    onChange={e => setSearchFilters({...searchFilters, tenchu: e.target.value})} 
                />
            </div>
            <div className="space-y-1.5 md:col-span-1">
                <label className="text-[10px] font-black text-gray-500 uppercase ml-1 tracking-widest">Địa chỉ</label>
                <input 
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs focus:border-blue-500 outline-none" 
                    placeholder="Địa chỉ..." 
                    value={searchFilters.diachi} 
                    onChange={e => setSearchFilters({...searchFilters, diachi: e.target.value})} 
                />
            </div>
            <div className="md:col-span-1">
                <button 
                    onClick={handleSearch} 
                    disabled={loading || !layer} 
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 transition-all uppercase tracking-widest disabled:opacity-50 active:scale-95 shadow-lg shadow-blue-900/20"
                >
                    {loading ? <Search size={14} className="animate-spin" /> : <Filter size={14}/>} TRUY VẤN
                </button>
            </div>
        </div>
    );
};

export default TableFilter;
