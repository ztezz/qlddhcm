
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { adminService } from '../../services/mockBackend';
import { SystemLog } from '../../types';
import {
    Activity, RefreshCw, Search, Download, Filter,
    ChevronLeft, ChevronRight, Eye, X, Clock,
    User, Info, Zap, Terminal, Shield, Database,
    Settings, UserCheck, BarChart2, Calendar, Hash,
    ChevronDown, ChevronUp, AlertTriangle, type LucideProps
} from 'lucide-react';

type LucideIcon = React.ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>>;

// ─── Action / category metadata ──────────────────────────────────────────────
const ACTION_META: Record<string, { label: string; color: string; bg: string; ring: string; category: string }> = {
    LOGIN:           { label: 'Đăng nhập',        color: 'text-green-300',   bg: 'bg-green-900/50',   ring: 'ring-green-800',   category: 'AUTH' },
    LOGOUT:          { label: 'Đăng xuất',        color: 'text-gray-300',    bg: 'bg-gray-700/50',    ring: 'ring-gray-600',    category: 'AUTH' },
    BULK_IMPORT:     { label: 'Nạp dữ liệu',      color: 'text-blue-200',    bg: 'bg-blue-900/60',    ring: 'ring-blue-800',    category: 'DATA' },
    SYNC_TABLE:      { label: 'Đồng bộ bảng',     color: 'text-cyan-300',    bg: 'bg-cyan-900/50',    ring: 'ring-cyan-800',    category: 'DATA' },
    ADD_PARCEL:      { label: 'Thêm thửa đất',    color: 'text-blue-300',    bg: 'bg-blue-900/50',    ring: 'ring-blue-800',    category: 'DATA' },
    UPDATE_PARCEL:   { label: 'Sửa thửa đất',     color: 'text-blue-200',    bg: 'bg-blue-900/40',    ring: 'ring-blue-700',    category: 'DATA' },
    DELETE_PARCEL:   { label: 'Xóa thửa đất',     color: 'text-red-300',     bg: 'bg-red-900/50',     ring: 'ring-red-800',     category: 'DATA' },
    ADD_LAYER:       { label: 'Thêm lớp bản đồ',  color: 'text-purple-300',  bg: 'bg-purple-900/50',  ring: 'ring-purple-800',  category: 'LAYER' },
    UPDATE_LAYER:    { label: 'Sửa lớp bản đồ',   color: 'text-purple-200',  bg: 'bg-purple-900/40',  ring: 'ring-purple-700',  category: 'LAYER' },
    DELETE_LAYER:    { label: 'Xóa lớp bản đồ',   color: 'text-red-300',     bg: 'bg-red-900/50',     ring: 'ring-red-800',     category: 'LAYER' },
    ADD_MENU:        { label: 'Thêm menu',         color: 'text-indigo-300',  bg: 'bg-indigo-900/50',  ring: 'ring-indigo-800',  category: 'SYSTEM' },
    UPDATE_MENU:     { label: 'Sửa menu',          color: 'text-indigo-200',  bg: 'bg-indigo-900/40',  ring: 'ring-indigo-700',  category: 'SYSTEM' },
    DELETE_MENU:     { label: 'Xóa menu',          color: 'text-red-300',     bg: 'bg-red-900/50',     ring: 'ring-red-800',     category: 'SYSTEM' },
    UPDATE_PROFILE:  { label: 'Sửa hồ sơ',        color: 'text-teal-300',    bg: 'bg-teal-900/50',    ring: 'ring-teal-800',    category: 'USER' },
    RESET_PASSWORD:  { label: 'Đặt lại mật khẩu', color: 'text-orange-300',  bg: 'bg-orange-900/50',  ring: 'ring-orange-800',  category: 'USER' },
    TOGGLE_CHAT:     { label: 'Thay đổi chat',    color: 'text-yellow-300',  bg: 'bg-yellow-900/50',  ring: 'ring-yellow-800',  category: 'USER' },
    DELETE_USER:     { label: 'Xóa người dùng',   color: 'text-red-400',     bg: 'bg-red-900/60',     ring: 'ring-red-700',     category: 'USER' },
    UPDATE_SETTINGS: { label: 'Sửa cài đặt',      color: 'text-amber-300',   bg: 'bg-amber-900/50',   ring: 'ring-amber-800',   category: 'SYSTEM' },
};

const CATEGORY_META: Record<string, { label: string; Icon: LucideIcon; color: string }> = {
    AUTH:   { label: 'Xác thực',    Icon: Shield,    color: 'text-green-400' },
    DATA:   { label: 'Dữ liệu',     Icon: Database,  color: 'text-blue-400' },
    LAYER:  { label: 'Lớp bản đồ',  Icon: Zap,       color: 'text-purple-400' },
    USER:   { label: 'Người dùng',  Icon: UserCheck, color: 'text-teal-400' },
    SYSTEM: { label: 'Hệ thống',    Icon: Settings,  color: 'text-amber-400' },
    OTHER:  { label: 'Khác',        Icon: Info,      color: 'text-gray-400' },
};

const getActionMeta = (action: string) =>
    ACTION_META[action] ?? { label: action, color: 'text-gray-300', bg: 'bg-gray-700/50', ring: 'ring-gray-600', category: 'OTHER' };

const formatDate = (ts: string) =>
    new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

const formatRelative = (ts: string) => {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s trước`;
    if (diff < 3600) return `${Math.floor(diff / 60)}p trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h trước`;
    return new Date(ts).toLocaleDateString('vi-VN');
};

interface LogsResponse { data: SystemLog[]; total: number; page: number; limit: number; pages: number; }
interface LogStats { today: number; actionStats: { action: string; count: number }[]; uniqueUsersWeek: number; }

const PAGE_SIZES = [25, 50, 100];

// ─── Detail Modal ─────────────────────────────────────────────────────────────
const LogDetailModal: React.FC<{ log: SystemLog; onClose: () => void }> = ({ log, onClose }) => {
    const meta = getActionMeta(log.action);
    return (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
                    <div className="flex items-center gap-2">
                        <Terminal size={16} className="text-orange-400" />
                        <span className="font-semibold text-white text-sm">Chi tiết Nhật ký</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ring-1 ${meta.bg} ${meta.color} ${meta.ring}`}>
                        <span>{meta.label}</span>
                        <span className="opacity-40">·</span>
                        <span className="font-mono opacity-60 text-[10px]">{log.action}</span>
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-gray-900/70 rounded-lg p-3">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1"><Clock size={9} /> Thời gian</div>
                            <div className="text-xs text-white font-mono leading-relaxed">{formatDate(log.timestamp)}</div>
                            <div className="text-[10px] text-gray-600 mt-0.5">{formatRelative(log.timestamp)}</div>
                        </div>
                        <div className="bg-gray-900/70 rounded-lg p-3">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1"><User size={9} /> Người dùng</div>
                            <div className="text-xs text-white font-semibold">{log.userName}</div>
                            {log.userId && <div className="text-[10px] text-gray-500 font-mono mt-0.5">ID: {log.userId}</div>}
                        </div>
                        {log.branchId && (
                            <div className="bg-gray-900/70 rounded-lg p-3">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1"><Hash size={9} /> Chi nhánh</div>
                                <div className="text-xs text-white font-mono">{log.branchId}</div>
                            </div>
                        )}
                        <div className="bg-gray-900/70 rounded-lg p-3">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1"><Hash size={9} /> Log ID</div>
                            <div className="text-[10px] text-gray-400 font-mono break-all leading-relaxed">{log.id}</div>
                        </div>
                    </div>
                    <div className="bg-gray-900/70 rounded-lg p-3">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1"><Info size={9} /> Chi tiết hành động</div>
                        <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap">{log.details || 'Không có thông tin chi tiết.'}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-600">Phân loại:</span>
                        {(() => {
                            const catMeta = CATEGORY_META[meta.category] ?? CATEGORY_META.OTHER;
                            const CatIcon = catMeta.Icon;
                            return (
                                <span className={`flex items-center gap-1 text-[10px] font-medium ${catMeta.color}`}>
                                    <CatIcon size={10} /> {catMeta.label}
                                </span>
                            );
                        })()}
                    </div>
                </div>
                <div className="px-5 py-3 border-t border-gray-700 flex justify-end">
                    <button onClick={onClose} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors">Đóng</button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const LogViewer: React.FC = () => {
    const [logsData, setLogsData] = useState<LogsResponse>({ data: [], total: 0, page: 1, limit: 50, pages: 0 });
    const [stats, setStats] = useState<LogStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo, setFilterTo] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);

    const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [countdown, setCountdown] = useState(30);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [showStats, setShowStats] = useState(true);

    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchData = useCallback(async (overridePage?: number) => {
        const p = overridePage ?? page;
        setLoading(true);
        setLoadError(null);
        try {
            const [logsResult, statsResult] = await Promise.all([
                adminService.getLogs({ page: p, limit, action: filterAction || undefined, search: search || undefined, from: filterFrom || undefined, to: filterTo || undefined }),
                adminService.getLogStats(),
            ]);
            setLogsData(logsResult);
            setStats(statsResult);
        } catch (e: any) {
            setLoadError(e?.message || 'Không thể tải dữ liệu nhật ký.');
        } finally {
            setLoading(false);
        }
    }, [page, limit, filterAction, search, filterFrom, filterTo]);

    useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { fetchData(); }, [page, limit, filterAction, filterFrom, filterTo]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSearchChange = (val: string) => {
        setSearch(val);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => { setPage(1); fetchData(1); }, 450);
    };

    useEffect(() => {
        if (autoRefresh) {
            setCountdown(30);
            countdownRef.current = setInterval(() => {
                setCountdown(c => { if (c <= 1) { fetchData(); return 30; } return c - 1; });
            }, 1000);
        } else {
            if (countdownRef.current) clearInterval(countdownRef.current);
        }
        return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }, [autoRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleResetFilters = () => {
        setSearch(''); setFilterAction(''); setFilterFrom(''); setFilterTo('');
        setPage(1); setTimeout(() => fetchData(1), 0);
    };

    const handleExportCSV = () => {
        const header = ['ID', 'Thời gian', 'Người dùng', 'User ID', 'Hành động', 'Chi tiết'];
        const rows = logsData.data.map(l => [
            l.id, formatDate(l.timestamp), l.userName, l.userId, l.action,
            `"${(l.details || '').replace(/"/g, '""')}"`,
        ]);
        const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `nhat-ky-${new Date().toISOString().split('T')[0]}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const displayedLogs = sortOrder === 'asc' ? [...logsData.data].reverse() : logsData.data;
    const hasFilters = !!(search || filterAction || filterFrom || filterTo);
    const getRowNum = (idx: number) =>
        sortOrder === 'desc' ? (page - 1) * limit + idx + 1 : logsData.total - ((page - 1) * limit + idx);
    const paginationPages = (() => {
        const nums: number[] = [];
        for (let i = Math.max(1, page - 2); i <= Math.min(logsData.pages, page + 2); i++) nums.push(i);
        return nums;
    })();

    return (
        <div className="p-4 md:p-6 space-y-4 bg-gray-900 min-h-full">

            {/* HEADER */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                        <Activity size={20} className="text-orange-400" /> Nhật ký Hoạt động Hệ thống
                    </h1>
                    <p className="text-xs text-gray-500 mt-0.5">Theo dõi toàn bộ thao tác của người dùng trong hệ thống</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setAutoRefresh(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors border ${autoRefresh ? 'bg-green-800/60 border-green-700 text-green-200' : 'bg-gray-700/60 border-gray-600 text-gray-300 hover:bg-gray-600'}`}>
                        <Clock size={12} /> {autoRefresh ? `Tự động (${countdown}s)` : 'Tự động làm mới'}
                    </button>
                    <button onClick={() => setShowStats(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-gray-700/60 border border-gray-600 text-gray-300 hover:bg-gray-600 transition-colors">
                        <BarChart2 size={12} /> {showStats ? 'Ẩn thống kê' : 'Xem thống kê'}
                    </button>
                    <button onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-gray-700/60 border border-gray-600 text-gray-300 hover:bg-gray-600 transition-colors">
                        <Download size={12} /> Xuất CSV
                    </button>
                    <button onClick={() => fetchData()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-blue-700/40 border border-blue-600/50 text-blue-200 hover:bg-blue-700/60 transition-colors">
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Làm mới
                    </button>
                </div>
            </div>

            {/* STATS CARDS */}
            {showStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 md:p-4">
                        <div className="text-2xl font-bold text-white tabular-nums">{logsData.total.toLocaleString('vi-VN')}</div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Activity size={10} /> Tổng nhật ký</div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 md:p-4">
                        <div className="text-2xl font-bold text-green-400 tabular-nums">{stats?.today ?? '—'}</div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Calendar size={10} /> Hôm nay</div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 md:p-4">
                        <div className="text-2xl font-bold text-blue-400 tabular-nums">{stats?.uniqueUsersWeek ?? '—'}</div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1"><User size={10} /> Người dùng (7 ngày)</div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 md:p-4">
                        <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide flex items-center gap-1"><BarChart2 size={9} /> Top hành động</div>
                        <div className="space-y-1.5">
                            {(stats?.actionStats ?? []).slice(0, 4).map(s => {
                                const meta = getActionMeta(s.action);
                                const maxCount = stats!.actionStats[0]?.count ?? 1;
                                return (
                                    <div key={s.action}>
                                        <div className="flex items-center justify-between gap-1 mb-0.5">
                                            <span className={`text-[10px] ${meta.color}`}>{meta.label}</span>
                                            <span className="text-[10px] text-gray-400 font-bold tabular-nums">{s.count}</span>
                                        </div>
                                        <div className="h-0.5 bg-gray-700 rounded overflow-hidden">
                                            <div className={`h-full rounded transition-all ${meta.bg}`} style={{ width: `${(s.count / maxCount) * 100}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* FILTER BAR */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 md:p-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[160px]">
                        <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide font-medium">Tìm kiếm</label>
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            <input type="text" value={search} onChange={e => handleSearchChange(e.target.value)}
                                placeholder="Tên người dùng, chi tiết..."
                                className="w-full bg-gray-900 border border-gray-600 rounded pl-7 pr-7 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors" />
                            {search && (
                                <button onClick={() => handleSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"><X size={11} /></button>
                            )}
                        </div>
                    </div>
                    <div className="min-w-[170px]">
                        <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide font-medium">Loại hành động</label>
                        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }}
                            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors">
                            <option value="">— Tất cả —</option>
                            {Object.entries(CATEGORY_META).filter(([k]) => k !== 'OTHER').map(([catKey, catMeta]) => (
                                <optgroup key={catKey} label={`── ${catMeta.label} ──`}>
                                    {Object.entries(ACTION_META).filter(([, m]) => m.category === catKey).map(([key, m]) => (
                                        <option key={key} value={key}>{m.label} ({key})</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide font-medium">Từ ngày</label>
                        <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1); }}
                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide font-medium">Đến ngày</label>
                        <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1); }}
                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide font-medium">Số dòng</label>
                        <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors">
                            {PAGE_SIZES.map(n => <option key={n} value={n}>{n} dòng</option>)}
                        </select>
                    </div>
                    {hasFilters && (
                        <button onClick={handleResetFilters}
                            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-red-900/30 text-red-300 hover:bg-red-900/60 border border-red-800/50 transition-colors">
                            <X size={11} /> Xóa bộ lọc
                        </button>
                    )}
                </div>
                {hasFilters && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-700/70">
                        <span className="text-[10px] text-gray-600 mr-0.5">Đang lọc:</span>
                        {search && <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-900/40 text-blue-200 rounded text-[10px] border border-blue-800/40"><Search size={8} /> "{search}"</span>}
                        {filterAction && <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-900/40 text-purple-200 rounded text-[10px] border border-purple-800/40"><Filter size={8} /> {filterAction}</span>}
                        {filterFrom && <span className="flex items-center gap-1 px-2 py-0.5 bg-teal-900/40 text-teal-200 rounded text-[10px] border border-teal-800/40"><Calendar size={8} /> Từ {filterFrom}</span>}
                        {filterTo && <span className="flex items-center gap-1 px-2 py-0.5 bg-teal-900/40 text-teal-200 rounded text-[10px] border border-teal-800/40"><Calendar size={8} /> Đến {filterTo}</span>}
                    </div>
                )}
            </div>

            {/* ERROR */}
            {loadError && (
                <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-sm text-red-300">
                    <AlertTriangle size={15} className="shrink-0" /> {loadError}
                </div>
            )}

            {/* TABLE */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-900/80 text-gray-400 text-[10px] uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3 w-10 text-center font-medium">#</th>
                                <th className="px-4 py-3 cursor-pointer hover:text-white select-none font-medium"
                                    onClick={() => setSortOrder(v => v === 'desc' ? 'asc' : 'desc')}>
                                    <span className="flex items-center gap-1">
                                        Thời gian {sortOrder === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
                                    </span>
                                </th>
                                <th className="px-4 py-3 font-medium">Người dùng</th>
                                <th className="px-4 py-3 font-medium">Hành động</th>
                                <th className="px-4 py-3 font-medium">Chi tiết</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/40">
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-20">
                                    <div className="flex flex-col items-center gap-2 text-gray-500">
                                        <RefreshCw size={22} className="animate-spin text-blue-500" />
                                        <span className="text-xs">Đang tải dữ liệu...</span>
                                    </div>
                                </td></tr>
                            ) : displayedLogs.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-20">
                                    <div className="flex flex-col items-center gap-2 text-gray-600">
                                        <Activity size={28} />
                                        <span className="text-sm text-gray-500">Không có nhật ký nào</span>
                                        {hasFilters && (
                                            <button onClick={handleResetFilters} className="text-xs text-blue-400 hover:text-blue-300 underline mt-1">
                                                Xóa bộ lọc và thử lại
                                            </button>
                                        )}
                                    </div>
                                </td></tr>
                            ) : displayedLogs.map((log, idx) => {
                                const meta = getActionMeta(log.action);
                                return (
                                    <tr key={log.id} className="hover:bg-gray-700/30 group transition-colors cursor-pointer"
                                        onClick={() => setSelectedLog(log)}>
                                        <td className="px-4 py-3 text-center text-[10px] text-gray-600 font-mono tabular-nums">{getRowNum(idx)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="text-[11px] font-mono text-gray-300">{formatDate(log.timestamp)}</div>
                                            <div className="text-[10px] text-gray-600 mt-0.5">{formatRelative(log.timestamp)}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-900/60 border border-blue-800/40 flex items-center justify-center text-[10px] text-blue-300 font-bold shrink-0 uppercase">
                                                    {(log.userName || '?').charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-semibold text-white leading-tight">{log.userName}</div>
                                                    {log.userId && <div className="text-[10px] text-gray-600 font-mono">#{String(log.userId).slice(-8)}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ring-1 leading-normal ${meta.bg} ${meta.color} ${meta.ring}`}>
                                                {meta.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 max-w-xs">
                                            <span className="text-xs text-gray-400 line-clamp-2 group-hover:text-gray-200 transition-colors">{log.details || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button onClick={e => { e.stopPropagation(); setSelectedLog(log); }}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-600/70 text-gray-400 hover:text-white transition-all" title="Xem chi tiết">
                                                <Eye size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION */}
                {logsData.total > 0 && (
                    <div className="border-t border-gray-700/70 px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-gray-800/40">
                        <span className="text-xs text-gray-500">
                            Hiển thị <b className="text-gray-200">{((page - 1) * limit + 1).toLocaleString('vi-VN')}</b> –{' '}
                            <b className="text-gray-200">{Math.min(page * limit, logsData.total).toLocaleString('vi-VN')}</b>{' '}
                            trong <b className="text-gray-200">{logsData.total.toLocaleString('vi-VN')}</b> nhật ký
                            {hasFilters && <span className="text-gray-600 ml-1">(đã lọc)</span>}
                        </span>
                        <div className="flex items-center gap-1">
                            <button disabled={page <= 1} onClick={() => setPage(1)} className="px-2 py-1 rounded text-[11px] bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="flex items-center gap-0.5 px-2 py-1 rounded text-[11px] bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                <ChevronLeft size={11} /> Trước
                            </button>
                            {paginationPages.map(p => (
                                <button key={p} onClick={() => setPage(p)}
                                    className={`w-7 h-7 rounded text-[11px] font-medium transition-colors ${p === page ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                    {p}
                                </button>
                            ))}
                            <button disabled={page >= logsData.pages} onClick={() => setPage(p => p + 1)} className="flex items-center gap-0.5 px-2 py-1 rounded text-[11px] bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                Tiếp <ChevronRight size={11} />
                            </button>
                            <button disabled={page >= logsData.pages} onClick={() => setPage(logsData.pages)} className="px-2 py-1 rounded text-[11px] bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
                        </div>
                    </div>
                )}
            </div>

            {/* DETAIL MODAL */}
            {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
        </div>
    );
};

export default LogViewer;
