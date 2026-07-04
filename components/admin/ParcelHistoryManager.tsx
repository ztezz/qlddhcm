import React, { useState, useEffect, useCallback } from 'react';
import {
    History, RefreshCw, Search, Filter, ChevronLeft, ChevronRight,
    PlusCircle, Edit3, XCircle, RotateCcw, Trash2, Eye, EyeOff,
    Database, Clock, User, StickyNote, AlertTriangle, CheckCircle,
    Loader2, ChevronDown, ChevronUp, Download,
} from 'lucide-react';
import { parcelHistoryApi } from '../../services/parcelApi';
import { gisService } from '../../services/apiClient';
import { ParcelHistoryRecord, ParcelHistoryAction } from '../../types';

interface ParcelHistoryManagerProps {
    permissions?: string[];
}

// ─── Metadata cho từng loại hành động ───────────────────────────────────────
const ACTION_META: Record<ParcelHistoryAction, {
    label: string; icon: React.ReactNode;
    textColor: string; bgColor: string; borderColor: string;
}> = {
    CREATE: {
        label: 'Tạo mới',
        icon: <PlusCircle size={12} />,
        textColor: 'text-emerald-400',
        bgColor: 'bg-emerald-900/40',
        borderColor: 'border-emerald-700/50',
    },
    UPDATE: {
        label: 'Cập nhật',
        icon: <Edit3 size={12} />,
        textColor: 'text-blue-400',
        bgColor: 'bg-blue-900/40',
        borderColor: 'border-blue-700/50',
    },
    DELETE: {
        label: 'Đã xóa',
        icon: <XCircle size={12} />,
        textColor: 'text-red-400',
        bgColor: 'bg-red-900/40',
        borderColor: 'border-red-700/50',
    },
};

const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

// ─── Snapshot viewer nhỏ gọn ─────────────────────────────────────────────────
const SnapshotViewer: React.FC<{ snapshot: Record<string, any> | null }> = ({ snapshot }) => {
    if (!snapshot) return <p className="text-xs text-gray-500 italic">Không có dữ liệu snapshot.</p>;

    const SKIP = ['gid', 'created_at', 'updated_at', 'madinhdanh'];
    const hasGeometry = !!snapshot.geometry;
    const entries = Object.entries(snapshot).filter(([k]) => !SKIP.includes(k) && k !== 'geometry' && snapshot[k] != null);

    return (
        <div className="bg-gray-900 rounded-lg p-3 border border-gray-700/50 mt-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {entries.map(([k, v]) => (
                    <div key={k} className="flex gap-1.5 items-start min-w-0">
                        <span className="text-[10px] text-gray-500 uppercase shrink-0 min-w-[60px]">{k}:</span>
                        <span className="text-[11px] text-gray-200 font-mono break-all">{String(v)}</span>
                    </div>
                ))}
            </div>
            {hasGeometry && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-gray-700/50">
                    <Database size={10} className="text-emerald-400" />
                    <span className="text-[10px] text-emerald-400">Có dữ liệu hình học (geometry)</span>
                </div>
            )}
        </div>
    );
};

// ─── Row lịch sử ─────────────────────────────────────────────────────────────
const HistoryRow: React.FC<{
    rec: ParcelHistoryRecord;
    canRestore: boolean;
    canDelete: boolean;
    onRestore: (rec: ParcelHistoryRecord) => void;
    onDeleteRecord: (id: number) => void;
    restoringId: number | null;
    deletingId: number | null;
}> = ({ rec, canRestore, canDelete, onRestore, onDeleteRecord, restoringId, deletingId }) => {
    const [expanded, setExpanded] = useState(false);
    const meta = ACTION_META[rec.action] ?? ACTION_META.UPDATE;

    return (
        <tr className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors group">
            {/* Action badge */}
            <td className="px-4 py-3 whitespace-nowrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${meta.textColor} ${meta.bgColor} ${meta.borderColor}`}>
                    {meta.icon} {meta.label}
                </span>
            </td>

            {/* Table + GID */}
            <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-xs font-mono text-blue-300">{rec.table_name || '—'}</div>
                <div className="text-[10px] text-gray-500">GID: {rec.parcel_gid}</div>
            </td>

            {/* Số tờ / Số thửa */}
            <td className="px-4 py-3 whitespace-nowrap">
                {(rec.sodoto || rec.sothua) ? (
                    <div className="text-xs text-white">
                        Thửa <span className="font-bold text-amber-300">{rec.sothua || '?'}</span>
                        {' '}/ Tờ <span className="font-bold text-amber-300">{rec.sodoto || '?'}</span>
                    </div>
                ) : (
                    <span className="text-[10px] text-gray-500 italic">—</span>
                )}
            </td>

            {/* Người thực hiện */}
            <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                    <User size={11} className="text-gray-500" />
                    <span className="text-xs text-gray-300">{rec.changed_by_name}</span>
                </div>
            </td>

            {/* Thời gian */}
            <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                    <Clock size={11} className="text-gray-500" />
                    <span className="text-xs text-gray-400">{formatDate(rec.changed_at)}</span>
                </div>
            </td>

            {/* Ghi chú */}
            <td className="px-4 py-3 max-w-[200px]">
                {rec.note ? (
                    <div className="flex items-start gap-1 text-[11px] text-gray-400">
                        <StickyNote size={10} className="mt-0.5 shrink-0 text-gray-500" />
                        <span className="break-words">{rec.note}</span>
                    </div>
                ) : <span className="text-gray-600">—</span>}
            </td>

            {/* Snapshot expand */}
            <td className="px-3 py-3 text-center">
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
                    title="Xem snapshot"
                >
                    {expanded ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
            </td>

            {/* Actions */}
            <td className="px-3 py-3">
                <div className="flex items-center gap-1.5">
                    {canRestore && rec.action !== 'CREATE' && (
                        <button
                            onClick={() => onRestore(rec)}
                            disabled={restoringId === rec.id}
                            title="Phục hồi về trạng thái này"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-900/40 text-purple-300 hover:bg-purple-800/60 border border-purple-700/40 transition-all disabled:opacity-40"
                        >
                            {restoringId === rec.id
                                ? <Loader2 size={10} className="animate-spin" />
                                : <RotateCcw size={10} />}
                            Phục hồi
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={() => onDeleteRecord(rec.id)}
                            disabled={deletingId === rec.id}
                            title="Xóa bản ghi này"
                            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-40"
                        >
                            {deletingId === rec.id
                                ? <Loader2 size={12} className="animate-spin" />
                                : <Trash2 size={12} />}
                        </button>
                    )}
                </div>
            </td>

            {/* Expanded snapshot row */}
            {expanded && (
                <tr className="bg-gray-900/60">
                    <td colSpan={8} className="px-6 pb-4">
                        <SnapshotViewer snapshot={rec.snapshot} />
                    </td>
                </tr>
            ) as any}
        </tr>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ParcelHistoryManager: React.FC<ParcelHistoryManagerProps> = ({ permissions = [] }) => {
    const canRestore = permissions.includes('RESTORE_PARCEL_HISTORY');
    const canDelete  = permissions.includes('DELETE_PARCEL_HISTORY');

    // Filter state
    const [tables, setTables]           = useState<{ table_name: string; display_name: string }[]>([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [filterAction, setFilterAction]   = useState('');
    const [filterUser, setFilterUser]       = useState('');
    const [page, setPage]                   = useState(1);
    const LIMIT = 30;

    // Data state
    const [records, setRecords]   = useState<ParcelHistoryRecord[]>([]);
    const [total, setTotal]       = useState(0);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState<string | null>(null);

    // Action state
    const [restoringId, setRestoringId] = useState<number | null>(null);
    const [deletingId, setDeletingId]   = useState<number | null>(null);
    const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const totalPages = Math.ceil(total / LIMIT);

    // Load spatial tables for filter dropdown
    useEffect(() => {
        gisService.getSpatialTables().then((data: any[]) => {
            setTables(data || []);
            if (data?.length > 0) setSelectedTable(data[0].table_name);
        }).catch(() => {});
    }, []);

    const load = useCallback(async () => {
        if (!selectedTable) return;
        setLoading(true);
        setError(null);
        try {
            const res = await parcelHistoryApi.getByTable(selectedTable, {
                page,
                limit: LIMIT,
                action: filterAction || undefined,
                user:   filterUser   || undefined,
            });
            setRecords(res.data);
            setTotal(res.total);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [selectedTable, page, filterAction, filterUser]);

    useEffect(() => { load(); }, [load]);

    // Reset page khi thay filter
    useEffect(() => { setPage(1); }, [selectedTable, filterAction, filterUser]);

    const showToast = (type: 'ok' | 'err', text: string) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 4000);
    };

    const handleRestore = async (rec: ParcelHistoryRecord) => {
        if (!rec.table_name) return;
        if (!window.confirm(
            `Phục hồi GID ${rec.parcel_gid} (bảng ${rec.table_name}) về trạng thái ${ACTION_META[rec.action]?.label} lúc ${formatDate(rec.changed_at)}?\n\nThao tác này sẽ ghi đè dữ liệu hiện tại trong CSDL.`
        )) return;

        setRestoringId(rec.id);
        try {
            await parcelHistoryApi.restore(rec.table_name, rec.parcel_gid, rec.id);
            showToast('ok', `Đã phục hồi GID ${rec.parcel_gid} thành công.`);
            load();
        } catch (e: any) {
            showToast('err', e.message);
        } finally {
            setRestoringId(null);
        }
    };

    const handleDeleteRecord = async (id: number) => {
        if (!window.confirm('Xóa bản ghi lịch sử này? Thao tác không thể hoàn tác.')) return;
        setDeletingId(id);
        try {
            // Tìm record để lấy table + gid
            const rec = records.find(r => r.id === id);
            if (rec?.table_name) {
                await parcelHistoryApi.clearHistory(rec.table_name, rec.parcel_gid);
                showToast('ok', 'Đã xóa toàn bộ lịch sử của thửa đất.');
            }
            load();
        } catch (e: any) {
            showToast('err', e.message);
        } finally {
            setDeletingId(null);
        }
    };

    // ── Export CSV ──────────────────────────────────────────────────────────
    const handleExportCsv = () => {
        if (records.length === 0) return;
        const header = ['ID', 'Bảng', 'GID', 'Hành động', 'Số tờ', 'Số thửa', 'Người thực hiện', 'Thời gian', 'Ghi chú'];
        const rows = records.map(r => [
            r.id, r.table_name, r.parcel_gid, r.action,
            r.sodoto ?? '', r.sothua ?? '',
            r.changed_by_name, formatDate(r.changed_at), r.note ?? ''
        ]);
        const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `lich_su_bien_dong_${selectedTable}_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Thống kê nhanh ──────────────────────────────────────────────────────
    const stats = {
        CREATE: records.filter(r => r.action === 'CREATE').length,
        UPDATE: records.filter(r => r.action === 'UPDATE').length,
        DELETE: records.filter(r => r.action === 'DELETE').length,
    };

    return (
        <div className="p-6 space-y-6 min-h-full">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-xl font-black text-white flex items-center gap-3">
                        <History className="text-purple-400" size={24} />
                        Lịch sử biến động thửa đất
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Toàn bộ lịch sử tạo mới, chỉnh sửa và xóa thửa đất trong cơ sở dữ liệu.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportCsv}
                        disabled={records.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 border border-gray-600 transition-colors disabled:opacity-40"
                    >
                        <Download size={15} /> Xuất CSV
                    </button>
                    <button
                        onClick={load}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white border border-blue-500 transition-colors disabled:opacity-60"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        Tải lại
                    </button>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
                    toast.type === 'ok'
                        ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300'
                        : 'bg-red-900/40 border-red-700/50 text-red-300'
                }`}>
                    {toast.type === 'ok' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {toast.text}
                </div>
            )}

            {/* Bộ lọc */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={15} className="text-gray-400" />
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Bộ lọc</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Bảng dữ liệu */}
                    <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Bảng dữ liệu</label>
                        <select
                            value={selectedTable}
                            onChange={e => setSelectedTable(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                        >
                            {tables.map(t => (
                                <option key={t.table_name} value={t.table_name}>
                                    {t.display_name || t.table_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Loại hành động */}
                    <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Hành động</label>
                        <select
                            value={filterAction}
                            onChange={e => setFilterAction(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="">Tất cả</option>
                            <option value="CREATE">Tạo mới</option>
                            <option value="UPDATE">Cập nhật</option>
                            <option value="DELETE">Đã xóa</option>
                        </select>
                    </div>

                    {/* Người thực hiện */}
                    <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Người thực hiện</label>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            <input
                                type="text"
                                value={filterUser}
                                onChange={e => setFilterUser(e.target.value)}
                                placeholder="Tìm theo tên..."
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-gray-600 transition-colors"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Thống kê nhanh */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Tổng bản ghi', value: total, color: 'text-white', bg: 'bg-gray-800', border: 'border-gray-700' },
                    { label: 'Tạo mới', value: stats.CREATE, color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-800/50' },
                    { label: 'Cập nhật', value: stats.UPDATE, color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-800/50' },
                    { label: 'Đã xóa', value: stats.DELETE, color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-800/50' },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4`}>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
                        <p className={`text-2xl font-black mt-1 ${s.color}`}>{loading ? '—' : s.value.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">trang này</p>
                    </div>
                ))}
            </div>

            {/* Bảng dữ liệu */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                {error && (
                    <div className="flex items-center gap-3 px-6 py-4 bg-red-900/20 border-b border-red-800/40 text-sm text-red-300">
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-700 bg-gray-900/50">
                                {['Hành động', 'Bảng / GID', 'Thửa đất', 'Người thực hiện', 'Thời gian', 'Ghi chú', 'Snapshot', 'Thao tác'].map(h => (
                                    <th key={h} className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && records.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-16 text-center">
                                        <div className="flex items-center justify-center gap-3 text-gray-500">
                                            <Loader2 size={20} className="animate-spin" />
                                            <span className="text-sm">Đang tải...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-gray-600">
                                            <History size={32} />
                                            <p className="text-sm">Chưa có lịch sử biến động nào cho bảng này.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                records.map(rec => (
                                    <HistoryRow
                                        key={rec.id}
                                        rec={rec}
                                        canRestore={canRestore}
                                        canDelete={canDelete}
                                        onRestore={handleRestore}
                                        onDeleteRecord={handleDeleteRecord}
                                        restoringId={restoringId}
                                        deletingId={deletingId}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-900/30">
                        <p className="text-xs text-gray-500">
                            Trang {page}/{totalPages} — {total.toLocaleString()} bản ghi
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1 || loading}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700 disabled:opacity-30 transition-colors"
                            >
                                <ChevronLeft size={13} /> Trước
                            </button>

                            {/* Page numbers */}
                            <div className="flex gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p)}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                                                p === page
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-gray-400 hover:bg-gray-700'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages || loading}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700 disabled:opacity-30 transition-colors"
                            >
                                Sau <ChevronRight size={13} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ParcelHistoryManager;
