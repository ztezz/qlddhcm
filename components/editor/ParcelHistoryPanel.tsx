import React, { useEffect, useState, useCallback } from 'react';
import {
    History,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Trash2,
    PlusCircle,
    Edit3,
    XCircle,
    Info,
    AlertTriangle,
    CheckCircle,
    Loader2,
    User,
    Clock,
    StickyNote,
} from 'lucide-react';
import { parcelHistoryApi } from '../../services/parcelApi';
import { ParcelHistoryRecord, ParcelHistoryAction, UserRole } from '../../types';
import GeometryPreview from '../common/GeometryPreview';

interface ParcelHistoryPanelProps {
    /** gid của thửa đang xem, null khi chưa chọn */
    parcelGid:   number | null;
    /** tên bảng spatial đang chọn */
    tableName:   string;
    soTo:        string;
    soThua:      string;
    userRole:    UserRole | string;
    /** Gọi sau khi restore thành công để EditorPage reload thửa từ DB */
    onRestored:  (snapshot: Record<string, any>) => void;
}

const ACTION_META: Record<ParcelHistoryAction, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    CREATE: { label: 'Tạo mới',   icon: <PlusCircle  size={12} />, color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
    UPDATE: { label: 'Cập nhật',  icon: <Edit3       size={12} />, color: 'text-blue-400',    bg: 'bg-blue-500/15 border-blue-500/30'       },
    DELETE: { label: 'Đã xóa',    icon: <XCircle     size={12} />, color: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/30'         },
};

const LIMIT = 10;

const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const valueChanged = (a: any, b: any) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);

const SnapshotDiff: React.FC<{ snapshot: Record<string, any> | null; compareSnapshot?: Record<string, any> | null }> = ({ snapshot, compareSnapshot }) => {
    if (!snapshot) return <p className="text-[10px] text-slate-500 italic">Không có dữ liệu snapshot.</p>;

    const SKIP = ['gid', 'created_at', 'updated_at', 'geometry', 'madinhdanh'];
    const entries = Object.entries(snapshot).filter(([k]) => !SKIP.includes(k) && snapshot[k] != null);

    if (entries.length === 0) return <p className="text-[10px] text-slate-500 italic">Snapshot trống.</p>;

    return (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
            {entries.map(([k, v]) => {
                const changed = compareSnapshot ? valueChanged(v, compareSnapshot[k]) : false;
                return (
                <div key={k} className={changed ? 'rounded bg-amber-500/10 px-1 py-0.5 ring-1 ring-amber-500/20' : ''}>
                    <span className="text-[9px] text-slate-500 uppercase">{k}:</span>
                    <span className={`text-[10px] ml-1 font-mono ${changed ? 'text-amber-200' : 'text-slate-200'}`}>{String(v)}</span>
                </div>
                );
            })}
            {snapshot.geometry && (
                <div className="col-span-2">
                    <span className="text-[9px] text-slate-500 uppercase">geometry:</span>
                    <span className="text-[10px] text-emerald-400 ml-1">✓ có dữ liệu hình học</span>
                </div>
            )}
        </div>
    );
};

const HistorySnapshots: React.FC<{ rec: ParcelHistoryRecord }> = ({ rec }) => {
    const before = rec.snapshot_before ?? (rec.action !== 'CREATE' ? rec.snapshot : null);
    const after = rec.snapshot_after ?? (rec.action === 'CREATE' ? rec.snapshot : null);

    return (
        <div className="grid grid-cols-1 gap-3">
            <div>
                <p className="text-[9px] text-purple-300 uppercase font-bold mb-1">Overlay trước/sau</p>
                <GeometryPreview
                    geometry={after?.geometry}
                    compareGeometry={before?.geometry}
                    height={130}
                    stroke="#34d399"
                    fill="rgba(52, 211, 153, 0.14)"
                    compareStroke="#f87171"
                    compareFill="rgba(248, 113, 113, 0.12)"
                    className="mb-2"
                />
                <div className="flex gap-3 text-[9px] text-slate-500 mb-1">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1"/>Trước</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1"/>Sau</span>
                </div>
            </div>
            <div>
                <p className="text-[9px] text-red-300 uppercase font-bold mb-1">Trước biến động</p>
                <GeometryPreview geometry={before?.geometry} height={120} stroke="#f87171" fill="rgba(248, 113, 113, 0.16)" className="mb-2" />
                <SnapshotDiff snapshot={before} compareSnapshot={after} />
            </div>
            <div>
                <p className="text-[9px] text-emerald-300 uppercase font-bold mb-1">Sau biến động</p>
                <GeometryPreview geometry={after?.geometry} height={120} stroke="#34d399" fill="rgba(52, 211, 153, 0.16)" className="mb-2" />
                <SnapshotDiff snapshot={after} compareSnapshot={before} />
            </div>
        </div>
    );
};

const ParcelHistoryPanel: React.FC<ParcelHistoryPanelProps> = ({
    parcelGid,
    tableName,
    soTo,
    soThua,
    userRole,
    onRestored,
}) => {
    const [records, setRecords]         = useState<ParcelHistoryRecord[]>([]);
    const [total, setTotal]             = useState(0);
    const [page, setPage]               = useState(1);
    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState<string | null>(null);
    const [expandedId, setExpandedId]   = useState<number | null>(null);
    const [restoringId, setRestoringId] = useState<number | null>(null);
    const [restoreMsg, setRestoreMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [clearLoading, setClearLoading] = useState(false);

    const totalPages = Math.ceil(total / LIMIT);
    const isAdmin    = userRole === UserRole.ADMIN || userRole === 'ADMIN';

    const load = useCallback(async () => {
        if (!parcelGid || !tableName) { setRecords([]); setTotal(0); return; }
        setLoading(true);
        setError(null);
        try {
            const res = await parcelHistoryApi.getByGid(tableName, parcelGid, page, LIMIT);
            setRecords(res.data);
            setTotal(res.total);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [parcelGid, tableName, page]);

    useEffect(() => { load(); }, [load]);

    // Reset page khi đổi thửa
    useEffect(() => { setPage(1); setExpandedId(null); setRestoreMsg(null); }, [parcelGid, tableName]);

    const handleRestore = async (rec: ParcelHistoryRecord) => {
        if (!parcelGid) return;
        if (!window.confirm(
            `Phục hồi thửa ${soThua}/${soTo} về trạng thái ${ACTION_META[rec.action]?.label} lúc ${formatDate(rec.changed_at)}?\n\nThao tác này sẽ ghi đè dữ liệu hiện tại.`
        )) return;

        setRestoringId(rec.id);
        setRestoreMsg(null);
        try {
            const result = await parcelHistoryApi.restore(tableName, parcelGid, rec.id);
            setRestoreMsg({ type: 'ok', text: 'Phục hồi thành công.' });
            onRestored(result.snapshot);
            load(); // reload history
        } catch (e: any) {
            setRestoreMsg({ type: 'err', text: e.message });
        } finally {
            setRestoringId(null);
        }
    };

    const handleClearHistory = async () => {
        if (!parcelGid) return;
        if (!window.confirm(`Xóa toàn bộ lịch sử của thửa ${soThua}/${soTo}? Thao tác này không thể hoàn tác.`)) return;
        setClearLoading(true);
        try {
            await parcelHistoryApi.clearHistory(tableName, parcelGid);
            setRecords([]);
            setTotal(0);
        } catch (e: any) {
            setRestoreMsg({ type: 'err', text: e.message });
        } finally {
            setClearLoading(false);
        }
    };

    // ── Render ──────────────────────────────────────────────────────────────
    if (!parcelGid || !tableName) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4 gap-3">
                <History size={32} className="text-slate-700" />
                <p className="text-xs text-slate-500">Chọn một thửa đất đã lưu vào CSDL để xem lịch sử biến động.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
                <div>
                    <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                        <History size={12} /> Lịch sử biến động
                    </h4>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                        Thửa <span className="text-white font-bold">{soThua}</span> / Tờ <span className="text-white font-bold">{soTo}</span>
                        {total > 0 && <span className="ml-1">— {total} bản ghi</span>}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={load}
                        disabled={loading}
                        title="Tải lại"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors disabled:opacity-40"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {isAdmin && total > 0 && (
                        <button
                            onClick={handleClearHistory}
                            disabled={clearLoading}
                            title="Xóa toàn bộ lịch sử"
                            className="p-1.5 rounded-lg text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        >
                            {clearLoading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Restore message */}
            {restoreMsg && (
                <div className={`mx-4 mt-3 px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${
                    restoreMsg.type === 'ok'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                    {restoreMsg.type === 'ok' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
                    {restoreMsg.text}
                    <button onClick={() => setRestoreMsg(null)} className="ml-auto opacity-60 hover:opacity-100">
                        <XCircle size={12} />
                    </button>
                </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar">
                {error && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        <AlertTriangle size={13} /> {error}
                    </div>
                )}

                {loading && records.length === 0 && (
                    <div className="flex items-center justify-center py-8 gap-2 text-slate-500 text-xs">
                        <Loader2 size={16} className="animate-spin" /> Đang tải...
                    </div>
                )}

                {!loading && records.length === 0 && !error && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                        <Info size={24} className="text-slate-700" />
                        <p className="text-xs text-slate-500">Chưa có lịch sử biến động nào.</p>
                    </div>
                )}

                {records.map((rec, idx) => {
                    const meta      = ACTION_META[rec.action] ?? ACTION_META.UPDATE;
                    const isExpanded = expandedId === rec.id;
                    const isFirst    = idx === 0 && page === 1;

                    return (
                        <div
                            key={rec.id}
                            className={`rounded-xl border transition-all duration-150 ${meta.bg} ${isFirst ? 'ring-1 ring-purple-500/30' : ''}`}
                        >
                            {/* Row header */}
                            <div
                                className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer"
                                onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                            >
                                {/* Timeline dot */}
                                <div className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border ${meta.bg} ${meta.color}`}>
                                    {meta.icon}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`text-[10px] font-black uppercase ${meta.color}`}>{meta.label}</span>
                                        {isFirst && (
                                            <span className="text-[8px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                                mới nhất
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="flex items-center gap-1 text-[9px] text-slate-400">
                                            <User size={9} /> {rec.changed_by_name}
                                        </span>
                                        <span className="flex items-center gap-1 text-[9px] text-slate-500">
                                            <Clock size={9} /> {formatDate(rec.changed_at)}
                                        </span>
                                    </div>
                                    {rec.note && (
                                        <div className="flex items-center gap-1 mt-0.5 text-[9px] text-slate-400 italic">
                                            <StickyNote size={9} /> {rec.note}
                                        </div>
                                    )}
                                </div>

                                {/* Restore button — không cho restore bản CREATE (không có snapshot trước đó) */}
                                {rec.action !== 'CREATE' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRestore(rec); }}
                                        disabled={restoringId === rec.id}
                                        title="Phục hồi về trạng thái này"
                                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold bg-slate-800/80 text-slate-300 hover:bg-purple-600/30 hover:text-purple-300 border border-slate-700/60 hover:border-purple-500/40 transition-all disabled:opacity-40"
                                    >
                                        {restoringId === rec.id
                                            ? <Loader2 size={10} className="animate-spin" />
                                            : <RotateCcw size={10} />
                                        }
                                        Phục hồi
                                    </button>
                                )}
                            </div>

                            {/* Expanded snapshot diff */}
                            {isExpanded && (
                                <div className="px-3 pb-3 border-t border-white/5 mt-0.5 pt-2">
                                    <HistorySnapshots rec={rec} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-slate-800 text-[10px] text-slate-400">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1 || loading}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-700/60 disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft size={12} /> Trước
                    </button>
                    <span>{page} / {totalPages}</span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || loading}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-700/60 disabled:opacity-30 transition-colors"
                    >
                        Sau <ChevronRight size={12} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ParcelHistoryPanel;
