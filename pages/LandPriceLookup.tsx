
import React, { useState, useEffect, useRef } from 'react';
import { adminService } from '../services/mockBackend';
import { LandPrice2026, User } from '../types';
import { Search, Calculator, MapPin, RefreshCw, AlertCircle, Info, ArrowRight, Landmark, Coins } from 'lucide-react';
import Seo from '../components/Seo';
import AutocompleteInput from '../components/common/AutocompleteInput';
import LandPriceDetailModal from '../components/land-price/LandPriceDetailModal';
import { formatCurrency } from '../utils/helpers';

interface LandPriceLookupProps {
    user?: User | null;
    systemSettings?: Record<string, string>;
}

const LOOKUP_PAGE_SIZE_STORAGE_KEY = 'land_price_lookup_page_size';

const LandPriceLookup: React.FC<LandPriceLookupProps> = ({ user, systemSettings }) => {
    const [phuongxa, setPhuongxa] = useState('');
    const [tenduong, setTenduong] = useState('');
    const [tu, setTu] = useState('');
    const [den, setDen] = useState('');

    const [wards, setWards] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<{streets: string[], fromPoints: string[], toPoints: string[]}>({
        streets: [], fromPoints: [], toPoints: []
    });

    const [results, setResults] = useState<LandPrice2026[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pageSize, setPageSize] = useState<number>(() => {
        if (typeof window === 'undefined') return 50;
        const raw = Number(window.localStorage.getItem(LOOKUP_PAGE_SIZE_STORAGE_KEY) || '50');
        if (![20, 50, 100].includes(raw)) return 50;
        return raw;
    });
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
    const [appliedFilters, setAppliedFilters] = useState({ phuongxa: '', tenduong: '', tu: '', den: '' });
    const [gotoPage, setGotoPage] = useState('');
    const [isPageTransition, setIsPageTransition] = useState(false);
    const jumpDebounceRef = useRef<number | null>(null);

    // Detail Modal State
    const [selectedRow, setSelectedRow] = useState<LandPrice2026 | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                const [wData, sData] = await Promise.all([
                    adminService.getLandPriceWards(),
                    adminService.getLandPriceSuggestions()
                ]);
                setWards(wData);
                setSuggestions(sData);
            } catch (e) {
                console.error("Failed to init lookup data", e);
            }
        };
        init();
    }, []);

    useEffect(() => {
        const updateSuggestions = async () => {
            try {
                const data = await adminService.getLandPriceSuggestions(phuongxa);
                setSuggestions(data);
            } catch (e) {}
        };
        updateSuggestions();
    }, [phuongxa]);

    useEffect(() => {
        return () => {
            if (jumpDebounceRef.current) {
                window.clearTimeout(jumpDebounceRef.current);
            }
        };
    }, []);

    useEffect(() => {
        setPagination((prev) => ({ ...prev, limit: pageSize }));
    }, [pageSize]);

    const runSearch = async (
        filters: { phuongxa: string; tenduong: string; tu: string; den: string },
        page = 1,
        overridePageSize?: number,
        options?: { preserveTable?: boolean }
    ) => {
        const nextLimit = overridePageSize || pageSize;
        const preserveTable = !!options?.preserveTable;

        if (preserveTable) {
            setIsPageTransition(true);
        } else {
            setLoading(true);
        }
        setError(null);
        setHasSearched(true);
        try {
            const response = await adminService.searchLandPrices2026(
                filters.phuongxa,
                filters.tenduong,
                filters.tu,
                filters.den,
                { limit: nextLimit, page }
            );
            setResults(response.data);
            setPagination({
                page: response.page,
                limit: response.limit,
                total: response.total,
                pages: response.pages
            });
        } catch (err: any) {
            setError(err.message || "Loi khi tra cuu du lieu.");
            setResults([]);
            setPagination((prev) => ({ ...prev, page: 1, limit: pageSize, total: 0, pages: 0 }));
        } finally {
            if (preserveTable) {
                setIsPageTransition(false);
            } else {
                setLoading(false);
            }
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();

        const nextFilters = {
            phuongxa: phuongxa.trim(),
            tenduong: tenduong.trim(),
            tu: tu.trim(),
            den: den.trim()
        };

        const hasFilter = Object.values(nextFilters).some((value) => value);
        if (!hasFilter) {
            setError('Vui long nhap it nhat mot dieu kien tra cuu.');
            setResults([]);
            setHasSearched(false);
            setPagination((prev) => ({ ...prev, page: 1, limit: pageSize, total: 0, pages: 0 }));
            return;
        }

        setAppliedFilters(nextFilters);
        await runSearch(nextFilters, 1);
    };

    const handlePageChange = async (nextPage: number) => {
        if (loading || isPageTransition || nextPage < 1 || nextPage > pagination.pages) return;
        await runSearch(appliedFilters, nextPage, undefined, { preserveTable: true });
    };

    const handlePageSizeChange = async (nextSize: number) => {
        setPageSize(nextSize);
        window.localStorage.setItem(LOOKUP_PAGE_SIZE_STORAGE_KEY, String(nextSize));
        setPagination((prev) => ({ ...prev, limit: nextSize }));
        if (hasSearched) {
            await runSearch(appliedFilters, 1, nextSize, { preserveTable: true });
        }
    };

    const handleJumpPage = async () => {
        const target = Math.floor(Number(gotoPage));
        if (!Number.isFinite(target)) return;
        const safePage = Math.max(1, Math.min(pagination.pages || 1, target));
        setGotoPage(String(safePage));
        await handlePageChange(safePage);
    };

    const triggerJumpPage = () => {
        if (jumpDebounceRef.current) {
            window.clearTimeout(jumpDebounceRef.current);
        }
        jumpDebounceRef.current = window.setTimeout(() => {
            void handleJumpPage();
        }, 180);
    };

    const disablePaging = loading || isPageTransition || pagination.pages <= 1;

    return (
        <>
            <Seo 
                title="Tra Cứu Bảng Giá Đất 2026" 
                description="Công cụ tra cứu bảng giá đất mới nhất năm 2026 tại TP.HCM và Bình Dương. Hỗ trợ tính giá đất theo vị trí mặt tiền, hẻm chính xác."
                keywords="bảng giá đất 2026, giá đất hcm, giá đất bình dương, tra cứu giá đất, hệ số điều chỉnh giá đất"
                systemSettings={systemSettings}
            />
            
            <div className="p-8 bg-slate-950 h-full overflow-y-auto custom-scrollbar flex flex-col font-sans text-white">
                <div className="max-w-7xl mx-auto w-full space-y-8 pb-20">
                    {/* Header */}
                    <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
                        <div className="bg-emerald-600/20 p-4 rounded-3xl border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                            <Calculator className="text-emerald-400 w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white uppercase tracking-tight">Tra cứu Bảng Giá Đất 2026 - Thành phố Hồ Chi Minh</h1>
                            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Hệ thống thông tin giá đất nhà nước</p>
                        </div>
                    </div>

                    {/* Search Form */}
                    <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl">
                        <form onSubmit={handleSearch} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <AutocompleteInput 
                                    label="Phường / Xã (Tỉnh cũ)" 
                                    icon={<MapPin size={12}/>}
                                    value={phuongxa}
                                    onChange={setPhuongxa}
                                    suggestions={wards}
                                    placeholder="Chọn phường/xã..."
                                />
                                
                                <AutocompleteInput 
                                    label="Tên đường" 
                                    icon={<Search size={12}/>}
                                    value={tenduong}
                                    onChange={setTenduong}
                                    suggestions={suggestions.streets}
                                    placeholder="Nhập tên đường..."
                                />

                                <AutocompleteInput 
                                    label="Từ (Điểm đầu)" 
                                    icon={<ArrowRight size={12} className="rotate-180"/>}
                                    value={tu}
                                    onChange={setTu}
                                    suggestions={suggestions.fromPoints}
                                    placeholder="Giao lộ / Cột mốc..."
                                />

                                <AutocompleteInput 
                                    label="Đến (Điểm cuối)" 
                                    icon={<ArrowRight size={12}/>}
                                    value={den}
                                    onChange={setDen}
                                    suggestions={suggestions.toPoints}
                                    placeholder="Giao lộ / Cột mốc..."
                                />
                            </div>
                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl shadow-emerald-900/30 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? <RefreshCw className="animate-spin" size={18}/> : <Search size={18}/>}
                                BẮT ĐẦU TRA CỨU
                            </button>
                        </form>
                    </div>

                    {/* Results Table */}
                    <div className="space-y-4">
                        {error && (
                            <div className="bg-red-900/20 border border-red-800 p-4 rounded-2xl flex items-center gap-3 text-red-400">
                                <AlertCircle size={20} />
                                <span className="text-sm font-bold">{error}</span>
                            </div>
                        )}

                        {loading ? (
                            <div className="p-20 text-center flex flex-col items-center gap-4 text-emerald-500/50 animate-pulse">
                                <RefreshCw size={48} className="animate-spin"/>
                                <p className="text-xs font-black uppercase tracking-widest">Đang truy xuất dữ liệu...</p>
                            </div>
                        ) : hasSearched && results.length === 0 ? (
                            <div className="p-20 text-center bg-slate-900/50 rounded-3xl border border-slate-800 flex flex-col items-center gap-4">
                                <Info size={48} className="text-slate-600"/>
                                <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Không tìm thấy kết quả nào phù hợp.</p>
                            </div>
                        ) : results.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex flex-col md:flex-row md:justify-between md:items-center px-2 gap-3">
                                    <div>
                                        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                            <Info size={16} className="text-blue-400"/>
                                            Kết quả tìm kiếm ({pagination.total})
                                        </h3>
                                        <div className="mt-1 flex items-center gap-1.5 text-amber-400">
                                            <Coins size={12}/>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Đơn vị tính: 1.000 đồng/m²</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1.5 rounded-xl border border-slate-700 font-mono self-start md:self-center">Năm áp dụng: {results[0].nam_ap_dung}</span>
                                </div>
                                
                                <div className="bg-slate-900 rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-950 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-800">
                                                <tr>
                                                    <th className="p-5 whitespace-nowrap">Đường / Phường xã</th>
                                                    <th className="p-5 whitespace-nowrap">Đoạn (Từ - Đến)</th>
                                                    <th className="p-5 text-right whitespace-nowrap">Đất Ở (ODT)</th>
                                                    <th className="p-5 text-right whitespace-nowrap">TMDV</th>
                                                    <th className="p-5 text-right whitespace-nowrap">SXKD</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800 text-sm">
                                                {results.map((r) => (
                                                    <tr 
                                                        key={r.id} 
                                                        onClick={() => setSelectedRow(r)}
                                                        className="hover:bg-blue-600/10 cursor-pointer transition-colors group"
                                                    >
                                                        <td className="p-5">
                                                            <div className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors">{r.tenduong}</div>
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex flex-col gap-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <MapPin size={10} className="text-emerald-500"/> {r.phuongxa}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                                    <Landmark size={10} className="text-blue-500"/> Tỉnh cũ: {r.tinhcu}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-5 text-slate-400 text-xs">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="flex gap-2"><b>Từ:</b> {r.tu || 'Đầu đường'}</span>
                                                                <span className="flex gap-2"><b>Đến:</b> {r.den || 'Cuối đường'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-5 text-right font-mono font-bold text-emerald-400 text-base bg-emerald-950/10 whitespace-nowrap">
                                                            {formatCurrency(r.dato, true)}
                                                        </td>
                                                        <td className="p-5 text-right font-mono font-bold text-blue-400 whitespace-nowrap">
                                                            {formatCurrency(r.dattmdv, true)}
                                                        </td>
                                                        <td className="p-5 text-right font-mono font-bold text-orange-400 whitespace-nowrap">
                                                            {formatCurrency(r.datsxkdpnn, true)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {isPageTransition && (
                                    <div className="px-2 text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                        <RefreshCw size={12} className="animate-spin" />
                                        Dang tai trang du lieu...
                                    </div>
                                )}
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-2">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                        Trang {pagination.page} / {Math.max(pagination.pages, 1)} - {'Hi\u1ec3n th\u1ecb'} {results.length} / {pagination.total} {'b\u1ea3n ghi'}
                                    </span>
                                    <div className={`flex flex-wrap items-center gap-2 ${disablePaging ? 'opacity-60' : ''}`}>
                                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{'S\u1ed1 d\u00f2ng/trang'}</label>
                                        <select
                                            value={pageSize}
                                            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                            className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] rounded-lg px-2 py-2"
                                        >
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => handlePageChange(1)}
                                            disabled={disablePaging || pagination.page <= 1}
                                            className="px-3 py-2 rounded-xl border border-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Trang dau
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handlePageChange(pagination.page - 1)}
                                            disabled={disablePaging || pagination.page <= 1}
                                            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {'Trang tr\u01b0\u1edbc'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handlePageChange(pagination.page + 1)}
                                            disabled={disablePaging || pagination.page >= pagination.pages}
                                            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Trang sau
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handlePageChange(Math.max(pagination.pages, 1))}
                                            disabled={disablePaging || pagination.page >= pagination.pages}
                                            className="px-3 py-2 rounded-xl border border-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Trang cuoi
                                        </button>
                                        <input
                                            type="number"
                                            min={1}
                                            max={Math.max(pagination.pages, 1)}
                                            value={gotoPage}
                                            onChange={(e) => setGotoPage(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); triggerJumpPage(); } }}
                                            placeholder="Trang"
                                            className="w-20 bg-slate-900 border border-slate-700 text-slate-200 text-[11px] rounded-lg px-2 py-2"
                                        />
                                        <button
                                            type="button"
                                            onClick={triggerJumpPage}
                                            disabled={disablePaging || pagination.pages <= 1}
                                            className="px-3 py-2 rounded-xl border border-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {'\u0110\u1ebfn trang'}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-600 italic mt-2 px-2">* Nhấp vào từng dòng để xem chi tiết tính toán giá đất cho các vị trí hẻm.</p>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Detail Modal Import from new component */}
                {selectedRow && (
                    <LandPriceDetailModal 
                        data={selectedRow} 
                        user={user}
                        systemSettings={systemSettings}
                        onClose={() => setSelectedRow(null)} 
                    />
                )}
            </div>
        </>
    );
};

export default LandPriceLookup;

