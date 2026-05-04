import React, { useEffect, useMemo, useState } from 'react';
import { User, SystemNotification } from '../types';
import { notificationService } from '../services/mockBackend';
import { Bell, RefreshCw, Search, Info, AlertTriangle, CheckCircle2, ShieldAlert, Filter } from 'lucide-react';

interface NotificationsProps {
    user: User;
}

type FilterType = 'ALL' | SystemNotification['type'];

const typeStyles: Record<SystemNotification['type'], string> = {
    INFO: 'bg-blue-900/30 text-blue-300 border-blue-700/60',
    WARNING: 'bg-amber-900/30 text-amber-300 border-amber-700/60',
    DANGER: 'bg-red-900/30 text-red-300 border-red-700/60',
    SUCCESS: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/60'
};

const typeIcons: Record<SystemNotification['type'], React.ReactNode> = {
    INFO: <Info size={16} />,
    WARNING: <AlertTriangle size={16} />,
    DANGER: <ShieldAlert size={16} />,
    SUCCESS: <CheckCircle2 size={16} />
};

const Notifications: React.FC<NotificationsProps> = ({ user }) => {
    const [items, setItems] = useState<SystemNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<FilterType>('ALL');

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const data = await notificationService.getNotifications();
            setItems(data);
        } catch (e) {
            console.error('Failed to load notifications', e);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
        notificationService.markAllAsRead().catch(() => undefined);
        const interval = setInterval(loadNotifications, 60000);

        return () => clearInterval(interval);
    }, [user.id]);

    const filteredItems = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return items.filter((n) => {
            if (typeFilter !== 'ALL' && n.type !== typeFilter) return false;
            if (!keyword) return true;

            const haystack = `${n.title} ${n.content} ${n.sender_name || ''}`.toLowerCase();
            return haystack.includes(keyword);
        });
    }, [items, query, typeFilter]);

    return (
        <div className="h-full w-full bg-slate-950 text-white overflow-hidden">
            <div className="h-full max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 flex flex-col gap-5">
                <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 to-slate-900/70 p-5 md:p-6 shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
                                    <Bell className="text-blue-300" size={20} />
                                </div>
                                <div>
                                    <h1 className="text-xl md:text-2xl font-black tracking-tight">Trung Tâm Thông Báo</h1>
                                    <p className="text-slate-400 text-sm">Thông báo hệ thống được cập nhật theo thời gian thực.</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={loadNotifications}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider transition-colors"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                            Làm mới
                        </button>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:p-5">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                        <div className="relative">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Tìm theo tiêu đề, nội dung, người gửi..."
                                className="w-full h-11 pl-10 pr-3 rounded-xl bg-slate-800 border border-slate-700 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                            />
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto">
                            <div className="inline-flex items-center gap-1.5 text-slate-400 text-xs uppercase font-bold tracking-wider whitespace-nowrap">
                                <Filter size={14} />
                                Loại
                            </div>
                            {(['ALL', 'INFO', 'WARNING', 'DANGER', 'SUCCESS'] as const).map((type) => {
                                const active = typeFilter === type;
                                const label: Record<string, string> = { ALL: 'Tất cả', INFO: 'Thông tin', WARNING: 'Cảnh báo', DANGER: 'Nguy hiểm', SUCCESS: 'Thành công' };
                                return (
                                    <button
                                        key={type}
                                        onClick={() => setTypeFilter(type)}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-colors ${
                                            active
                                                ? 'bg-blue-600 border-blue-500 text-white'
                                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                                        }`}
                                    >
                                        {label[type]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="p-6 md:p-8 grid gap-3">
                                {[1, 2, 3, 4].map((idx) => (
                                    <div key={idx} className="h-24 rounded-xl bg-slate-800/70 animate-pulse" />
                                ))}
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-8">
                                <Bell size={40} className="text-slate-700 mb-3" />
                                <h3 className="text-slate-300 font-bold">Không có thông báo phù hợp</h3>
                                <p className="text-slate-500 text-sm mt-1">Thử bộ lọc khác hoặc làm mới danh sách.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800/80">
                                {filteredItems.map((n) => (
                                    <article key={n.id} className="p-4 md:p-5 hover:bg-slate-800/35 transition-colors">
                                        <div className="flex items-start gap-3 md:gap-4">
                                            <div className={`mt-0.5 w-9 h-9 rounded-lg border flex items-center justify-center ${typeStyles[n.type]}`}>
                                                {typeIcons[n.type]}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                    <h3 className="text-sm md:text-base font-black text-slate-100 leading-tight">{n.title}</h3>
                                                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md border ${typeStyles[n.type]}`}>
                                                        {n.type}
                                                    </span>
                                                </div>

                                                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{n.content}</p>

                                                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">
                                                    <span>{new Date(n.created_at).toLocaleString('vi-VN')}</span>
                                                    <span className="opacity-50">•</span>
                                                    <span>Từ: {n.sender_name || 'Hệ thống'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Notifications;
