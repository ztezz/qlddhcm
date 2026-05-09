
import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, MapPin, User, Home, Filter, AlertCircle, AlertTriangle, Crosshair, Navigation, ChevronDown } from 'lucide-react';
import { gisService } from '../../services/mockBackend';
import { LandParcel } from '../../types';
import { formatParcelIdentifier, removeAccents } from '../../utils/helpers';

interface SearchPanelProps {
    isOpen: boolean;
    onToggle: () => void;
    spatialTables: any[];
    systemSettings?: Record<string, string>;
    onSelectResult: (parcel: LandParcel) => void;
    onSearchCoordinate?: (lat: number, lon: number) => void;
}

const SearchPanel: React.FC<SearchPanelProps> = ({ isOpen, onToggle, spatialTables, systemSettings, onSelectResult, onSearchCoordinate }) => {
    const [searchMode, setSearchMode] = useState<'ATTR' | 'COORD'>('ATTR');
    const [searchForm, setSearchForm] = useState({ table: '', soTo: '', soThua: '', owner: '', address: '' });
    const [coordInput, setCoordInput] = useState('');
    const [results, setResults] = useState<LandParcel[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Searchable Select State for Wards
    const [isTableListOpen, setIsTableListOpen] = useState(false);
    const [tableSearchText, setTableSearchText] = useState('');
    const tableDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (error) setError(null);
    }, [searchForm, coordInput, searchMode]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (tableDropdownRef.current && !tableDropdownRef.current.contains(e.target as Node)) {
                setIsTableListOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredTables = spatialTables.filter(t => {
        if (!tableSearchText.trim()) return true;
        const search = removeAccents(tableSearchText);
        return removeAccents(t.display_name || t.table_name).includes(search);
    });

    const selectedTableDisplayName = spatialTables.find(t => t.table_name === searchForm.table)?.display_name || '';

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();

        const normalizedFilters = {
            table: searchForm.table.trim(),
            soTo: searchForm.soTo.trim(),
            soThua: searchForm.soThua.trim(),
            owner: searchForm.owner.trim(),
            address: searchForm.address.trim()
        };
        
        if (searchMode === 'COORD') {
            handleCoordSearch();
            return;
        }

        if (!normalizedFilters.table) {
            setError("Vui lòng chọn khu vực dữ liệu.");
            return;
        }

        if (!normalizedFilters.soTo && !normalizedFilters.soThua && !normalizedFilters.owner && !normalizedFilters.address) {
            setError("Vui lòng nhập ít nhất một thông tin lọc.");
            return;
        }

        setLoading(true);
        setError(null);
        setHasSearched(true);
        try {
            const res = await gisService.searchParcels(normalizedFilters.table, {
                sodoto: normalizedFilters.soTo,
                sothua: normalizedFilters.soThua,
                tenchu: normalizedFilters.owner,
                diachi: normalizedFilters.address
            });
            setResults(res);
        } catch (err: any) {
            const message = typeof err?.message === 'string' ? err.message : '';
            setError(message || "Lỗi kết nối máy chủ.");
            setResults([]);
        } finally { setLoading(false); }
    };

    const parseLatLonPair = (n1: number, n2: number): { lat: number; lon: number } => {
        if (Math.abs(n1) <= 90 && Math.abs(n2) > 90) return { lat: n1, lon: n2 };
        if (Math.abs(n2) <= 90 && Math.abs(n1) > 90) return { lat: n2, lon: n1 };
        return { lat: n1, lon: n2 };
    };

    const isValidLatLon = (lat: number, lon: number) => (
        Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    );

    const parseCoordPairFromText = (value: string): { lat: number; lon: number } | null => {
        const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
        if (!match) return null;
        const n1 = parseFloat(match[1]);
        const n2 = parseFloat(match[2]);
        if (Number.isNaN(n1) || Number.isNaN(n2)) return null;
        return parseLatLonPair(n1, n2);
    };

    const parsePlainCoordinate = (value: string): { lat: number; lon: number } | null => {
        const cleanInput = value.replace(/[^0-9.,-\s]/g, '').trim();
        const parts = cleanInput.split(/[\s,]+/).filter(Boolean);
        if (parts.length !== 2) return null;

        const n1 = parseFloat(parts[0]);
        const n2 = parseFloat(parts[1]);
        if (Number.isNaN(n1) || Number.isNaN(n2)) return null;

        return parseLatLonPair(n1, n2);
    };

    const parseGoogleMapsCoordinate = (value: string): { lat: number; lon: number } | null => {
        const raw = value.trim();

        try {
            const normalizedUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
            const url = new URL(normalizedUrl);
            const queryCandidates = ['q', 'll', 'query', 'center'];
            for (const key of queryCandidates) {
                const val = url.searchParams.get(key);
                if (!val) continue;
                const parsed = parseCoordPairFromText(decodeURIComponent(val));
                if (parsed) return parsed;
            }

            const atMatch = `${url.pathname}${url.hash}`.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
            if (atMatch) {
                const lat = parseFloat(atMatch[1]);
                const lon = parseFloat(atMatch[2]);
                if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
            }

            const dMatch = url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
            if (dMatch) {
                const lat = parseFloat(dMatch[1]);
                const lon = parseFloat(dMatch[2]);
                if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
            }

            const pathPair = parseCoordPairFromText(decodeURIComponent(url.pathname));
            if (pathPair) return pathPair;

            return null;
        } catch {
            return null;
        }
    };

    const handleCoordSearch = () => {
        const input = coordInput.trim();
        if (!input) {
            setError('Vui lòng nhập tọa độ hoặc link Google Maps.');
            return;
        }

        const parsed = parsePlainCoordinate(input) || parseGoogleMapsCoordinate(input);

        if (!parsed) {
            if (/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(input)) {
                setError('Liên kết rút gọn chưa có tọa độ trực tiếp. Vui lòng mở link rồi sao chép URL đầy đủ.');
                return;
            }
            setError('Không đọc được tọa độ. Nhập "lat,lng" hoặc dán link Google Maps hợp lệ.');
            return;
        }

        if (!isValidLatLon(parsed.lat, parsed.lon)) {
            setError('Tọa độ không hợp lệ (vĩ độ [-90,90], kinh độ [-180,180]).');
            return;
        }

        if (onSearchCoordinate) {
            onSearchCoordinate(parsed.lat, parsed.lon);
        }
    };

    if (!isOpen) return (
        <button 
          onClick={onToggle} 
          className="absolute top-16 left-4 md:top-4 md:left-16 z-[400] p-2.5 bg-white rounded-lg shadow-lg hover:bg-gray-50 text-gray-700 border border-gray-100 transition-transform active:scale-95"
        >
            <Search size={22} />
        </button>
    );

    return (
        <div className="absolute top-16 left-4 right-4 md:top-4 md:right-auto md:left-16 z-[400] bg-white p-3.5 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.15)] border border-gray-200 md:w-[320px] animate-in slide-in-from-top-10 md:slide-in-from-left-10 duration-300">
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-black text-slate-950 flex items-center gap-2 tracking-tight uppercase text-[12px]">
                    <Search size={16} className="text-blue-600"/> Công cụ Tìm kiếm
                </h4>
                <button onClick={onToggle} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-red-500"><X size={18}/></button>
            </div>

            <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                <button 
                  onClick={() => setSearchMode('ATTR')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${searchMode === 'ATTR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                    <Filter size={14}/> Thuộc tính
                </button>
                <button 
                  onClick={() => setSearchMode('COORD')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${searchMode === 'COORD' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}
                >
                    <Navigation size={14}/> Tọa độ
                </button>
            </div>
            
            <form onSubmit={handleSearch} className="space-y-3">
                {searchMode === 'ATTR' ? (
                    <>
                      <div className="space-y-1 relative" ref={tableDropdownRef}>
                          <label className="text-[10px] font-black text-slate-800 uppercase ml-1 tracking-wider">Khu vực dữ liệu</label>
                          
                          <div 
                              onClick={() => setIsTableListOpen(!isTableListOpen)}
                              className={`w-full bg-slate-50 border ${error && !searchForm.table ? 'border-red-500' : 'border-slate-300'} rounded-lg p-2.5 text-xs text-slate-950 font-bold flex items-center justify-between cursor-pointer group hover:border-blue-500 transition-all shadow-inner`}
                          >
                              <span className={searchForm.table ? 'text-slate-950' : 'text-slate-400'}>
                                  {selectedTableDisplayName || '-- Chọn xã / phường --'}
                              </span>
                              <ChevronDown size={14} className={`text-slate-400 group-hover:text-blue-500 transition-transform ${isTableListOpen ? 'rotate-180' : ''}`} />
                          </div>

                          {isTableListOpen && (
                              <div className="absolute z-[500] left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                  <div className="p-2 border-b border-slate-100 bg-slate-50">
                                      <div className="relative">
                                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                                          <input 
                                              autoFocus
                                              className="w-full bg-white border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-[11px] outline-none focus:border-blue-500"
                                              placeholder="Tìm nhanh xã/phường..."
                                              value={tableSearchText}
                                              onChange={e => setTableSearchText(e.target.value)}
                                          />
                                      </div>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                      {filteredTables.length === 0 ? (
                                          <div className="p-4 text-center text-[10px] text-slate-400 italic">Không tìm thấy khu vực</div>
                                      ) : filteredTables.map(t => (
                                          <div 
                                              key={t.table_name}
                                              onClick={() => {
                                                  setSearchForm({...searchForm, table: t.table_name});
                                                  setIsTableListOpen(false);
                                                  setTableSearchText('');
                                              }}
                                              className={`p-2.5 text-[11px] font-bold transition-colors cursor-pointer border-b border-slate-50 last:border-0 ${searchForm.table === t.table_name ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-blue-50'}`}
                                          >
                                              {t.display_name || t.table_name}
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-800 uppercase ml-1 tracking-wider">Số tờ</label>
                              <input className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-950 outline-none" placeholder="Tờ..." value={searchForm.soTo} onChange={e => setSearchForm({...searchForm, soTo: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-800 uppercase ml-1 tracking-wider">Số thửa</label>
                              <input className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-950 outline-none" placeholder="Thửa..." value={searchForm.soThua} onChange={e => setSearchForm({...searchForm, soThua: e.target.value})} />
                          </div>
                      </div>

                      <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-800 uppercase ml-1 tracking-wider">Tên chủ sử dụng</label>
                          <div className="relative">
                              <User size={12} className="absolute left-2.5 top-2.5 text-slate-600"/>
                              <input className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 pl-8 text-xs font-bold text-slate-950 outline-none" placeholder="Họ và tên..." value={searchForm.owner} onChange={e => setSearchForm({...searchForm, owner: e.target.value})} />
                          </div>
                      </div>
                    </>
                ) : (
                    <div className="space-y-1 animate-in fade-in duration-300">
                        <label className="text-[10px] font-black text-red-600 uppercase ml-1 tracking-wider flex items-center gap-1">
                            <Crosshair size={10}/> Tọa độ Google Maps
                        </label>
                        <div className="relative">
                            <MapPin size={14} className="absolute left-3 top-3 text-red-500"/>
                            <input 
                                className="w-full bg-red-50/30 border border-red-200 rounded-lg p-3 pl-10 text-xs font-black text-slate-950 outline-none" 
                                placeholder="VD: 10.77611, 106.70111 hoặc link Google Maps"
                                value={coordInput} 
                                onChange={e => setCoordInput(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 p-2 rounded-lg flex items-center gap-2 text-red-600 animate-in fade-in">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span className="text-[10px] font-bold uppercase">{error}</span>
                    </div>
                )}

                <button type="submit" disabled={loading} className={`w-full ${searchMode === 'COORD' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white p-3 rounded-lg font-black uppercase text-[11px] tracking-widest flex justify-center items-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50`}>
                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16}/>} 
                    {loading ? 'Đang truy vấn...' : searchMode === 'COORD' ? 'Tìm vị trí' : 'Tìm thửa đất'}
                </button>
            </form>

            {searchMode === 'ATTR' && (hasSearched || loading) && (
                <div className="mt-5 pt-4 border-t border-slate-200 animate-in fade-in duration-500">
                    <div className="max-h-48 md:max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {loading ? (
                            <div className="py-10 flex flex-col items-center justify-center gap-3">
                                <Loader2 size={24} className="text-blue-500 animate-spin" />
                                <p className="text-[10px] font-bold text-blue-600 uppercase">Đang tìm kiếm...</p>
                            </div>
                        ) : results.length === 0 ? (
                            <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                <p className="text-slate-700 italic text-[10px] font-bold">Không thấy kết quả</p>
                            </div>
                        ) : (
                            results.map(r => (
                                <div 
                                    key={r.id} 
                                    onClick={() => onSelectResult(r)} 
                                    className="p-2.5 bg-white hover:bg-blue-50 border border-slate-200 rounded-xl cursor-pointer transition-all"
                                >
                                    <div className="flex justify-between items-start mb-1.5">
                                        <div className="font-black text-slate-950 text-[11px]">{formatParcelIdentifier(r.properties, systemSettings?.parcel_identifier_format)}</div>
                                        <span className="bg-blue-100 text-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{r.properties.landType}</span>
                                    </div>
                                    <div className="text-slate-900 text-[10px] font-bold flex items-center gap-1.5 truncate">
                                        <User size={10} className="text-blue-600 shrink-0"/> 
                                        <span>{r.properties.ownerName || 'Chưa xác định chủ'}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchPanel;
