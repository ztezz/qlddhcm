
import React, { useState, useEffect, useMemo } from 'react';
import { notificationService, hasAnyPermission } from '../../services/mockBackend';
import { SystemNotification, UserRole, getRoleLabel } from '../../types';
import { Bell, Send, Trash2, Plus, X, Loader2, AlertCircle, Info, CheckCircle2, AlertTriangle, Search, RefreshCw, Users, ShieldAlert, Eye, Edit2, Clock } from 'lucide-react';

// Config per type
const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; badge: string; preview: string }> = {
    INFO:    { label: 'Thông tin',  icon: <Info size={14}/>,          badge: 'bg-blue-900/30 text-blue-400 border-blue-800',    preview: 'border-blue-500 bg-blue-950/40' },
    WARNING: { label: 'Cảnh báo',  icon: <AlertTriangle size={14}/>, badge: 'bg-orange-900/30 text-orange-400 border-orange-800', preview: 'border-orange-500 bg-orange-950/40' },
    DANGER:  { label: 'Quan trọng',icon: <ShieldAlert size={14}/>,   badge: 'bg-red-900/30 text-red-400 border-red-800',        preview: 'border-red-500 bg-red-950/40' },
    SUCCESS: { label: 'Thành công',icon: <CheckCircle2 size={14}/>,  badge: 'bg-emerald-900/30 text-emerald-400 border-emerald-800', preview: 'border-emerald-500 bg-emerald-950/40' },
};

// Chuyển ISO sang giá trị datetime-local input (YYYY-MM-DDTHH:mm)
const toDatetimeLocal = (iso?: string | null): string => {
    if (!iso) return '';
    try { return new Date(iso).toISOString().slice(0, 16); } catch { return ''; }
};

// Kiểm tra đã hết hạn chưa
const isExpired = (expires_at?: string | null): boolean => {
    if (!expires_at) return false;
    return new Date(expires_at) < new Date();
};

interface NotificationManagerProps {
    permissions?: string[];
}

const NotificationManager: React.FC<NotificationManagerProps> = ({ permissions = [] }) => {
    const [notifications, setNotifications] = useState<SystemNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ title: '', content: '', type: 'INFO', targetRole: 'ALL', expiresAt: '' });

    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [filterTarget, setFilterTarget] = useState('ALL');
    const [filterExpiry, setFilterExpiry] = useState('ALL'); // ALL | ACTIVE | EXPIRED

    // System Dialog State
    const [dialog, setDialog] = useState<{
        isOpen: boolean;
        type: 'alert' | 'confirm' | 'success' | 'error' | 'warning';
        title: string;
        message: string;
        onConfirm?: () => void;
    }>({ isOpen: false, type: 'alert', title: '', message: '' });

    const showDialog = (type: any, title: string, message: string, onConfirm?: () => void) => {
        setDialog({ isOpen: true, type, title, message, onConfirm });
    };

    const canCreateNotification = hasAnyPermission(permissions, ['CREATE_NOTIFICATIONS', 'MANAGE_NOTIFICATIONS', 'MANAGE_SYSTEM']);
    const canEditNotification = hasAnyPermission(permissions, ['EDIT_NOTIFICATIONS', 'MANAGE_NOTIFICATIONS', 'MANAGE_SYSTEM']);
    const canDeleteNotification = hasAnyPermission(permissions, ['DELETE_NOTIFICATIONS', 'MANAGE_NOTIFICATIONS', 'MANAGE_SYSTEM']);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await notificationService.getAllForAdmin();
            setNotifications(data);
        } catch (e) {
            console.error("Load notifications failed", e);
        } finally { setLoading(false); }
    };

    // Stats
    const stats = useMemo(() => ({
        total: notifications.length,
        active: notifications.filter(n => !isExpired(n.expires_at)).length,
        expired: notifications.filter(n => isExpired(n.expires_at)).length,
        info: notifications.filter(n => n.type === 'INFO').length,
        warning: notifications.filter(n => n.type === 'WARNING').length,
        danger: notifications.filter(n => n.type === 'DANGER').length,
        success: notifications.filter(n => n.type === 'SUCCESS').length,
    }), [notifications]);

    // Filtered list
    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return notifications.filter(n => {
            const matchSearch = !q || n.title.toLowerCase().includes(q) || (n.content ?? '').toLowerCase().includes(q);
            const matchType = filterType === 'ALL' || n.type === filterType;
            const matchTarget = filterTarget === 'ALL' || n.target_role === filterTarget;
            const matchExpiry = filterExpiry === 'ALL'
                || (filterExpiry === 'ACTIVE' && !isExpired(n.expires_at))
                || (filterExpiry === 'EXPIRED' && isExpired(n.expires_at));
            return matchSearch && matchType && matchTarget && matchExpiry;
        });
    }, [notifications, searchQuery, filterType, filterTarget, filterExpiry]);

    const openNewModal = () => {
        if (!canCreateNotification) {
            showDialog('error', 'Không đủ quyền', 'Bạn không có quyền soạn thông báo mới.');
            return;
        }
        setEditingId(null);
        setFormData({ title: '', content: '', type: 'INFO', targetRole: 'ALL', expiresAt: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (n: SystemNotification) => {
        if (!canEditNotification) {
            showDialog('error', 'Không đủ quyền', 'Bạn không có quyền chỉnh sửa thông báo.');
            return;
        }
        setEditingId(n.id);
        setFormData({
            title: n.title,
            content: n.content,
            type: n.type,
            targetRole: n.target_role,
            expiresAt: toDatetimeLocal(n.expires_at),
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (editingId !== null ? !canEditNotification : !canCreateNotification) {
            showDialog('error', 'Không đủ quyền', editingId !== null ? 'Bạn không có quyền cập nhật thông báo.' : 'Bạn không có quyền gửi thông báo mới.');
            return;
        }
        if (!formData.title || !formData.content) {
            showDialog('warning', 'Thiếu dữ liệu', 'Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo.');
            return;
        }
        setLoading(true);
        try {
            const payload = {
                title: formData.title,
                content: formData.content,
                type: formData.type,
                targetRole: formData.targetRole,
                expiresAt: formData.expiresAt || null,
            };
            if (editingId !== null) {
                await notificationService.updateNotification(editingId, payload);
            } else {
                await notificationService.sendNotification(payload);
            }
            setIsModalOpen(false);
            await loadData();
            showDialog('success', 'Thành công', editingId !== null ? 'Đã cập nhật thông báo thành công.' : 'Thông báo đã được phát đi cho đối tượng mục tiêu.');
        } catch (e: any) {
            showDialog('error', 'Lỗi', e.message);
        } finally { setLoading(false); }
    };

    const handleDelete = (id: number) => {
        if (!canDeleteNotification) {
            showDialog('error', 'Không đủ quyền', 'Bạn không có quyền xóa thông báo.');
            return;
        }
        showDialog('confirm', 'Xác nhận xóa', 'Bạn có chắc chắn muốn xóa vĩnh viễn thông báo này khỏi hệ thống không?', async () => {
            setLoading(true);
            try {
                await notificationService.deleteNotification(id);
                await loadData();
                showDialog('success', 'Đã xóa', 'Xóa thông báo thành công.');
            } catch (e: any) {
                showDialog('error', 'Lỗi xóa', e.message || 'Không thể xóa thông báo vào lúc này.');
            } finally {
                setLoading(false);
            }
        });
    };

    return (
        <div className="p-6 space-y-5">
            {/* ── HEADER ─────────────────────────────────────── */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30">
                        <Bell className="text-blue-500" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Quản lý Thông báo Hệ thống</h2>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Gửi tin nhắn công khai đến người dùng</p>
                    </div>
                </div>
                <button onClick={openNewModal} disabled={!canCreateNotification} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95">
                    <Plus size={18}/> SOẠN THÔNG BÁO MỚI
                </button>
            </div>

            {/* ── STATS ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                {[
                    { label: 'Tổng',        value: stats.total,   color: 'text-gray-300 bg-gray-700/30 border-gray-700',        icon: <Bell size={16}/> },
                    { label: 'Còn hiệu lực',value: stats.active,  color: 'text-emerald-400 bg-emerald-900/20 border-emerald-800',icon: <CheckCircle2 size={16}/> },
                    { label: 'Hết hạn',     value: stats.expired, color: 'text-gray-500 bg-gray-900/40 border-gray-700',        icon: <Clock size={16}/> },
                    { label: 'INFO',        value: stats.info,    color: 'text-blue-400 bg-blue-900/20 border-blue-800',        icon: <Info size={16}/> },
                    { label: 'WARNING',     value: stats.warning, color: 'text-orange-400 bg-orange-900/20 border-orange-800',  icon: <AlertTriangle size={16}/> },
                    { label: 'DANGER',      value: stats.danger,  color: 'text-red-400 bg-red-900/20 border-red-800',          icon: <ShieldAlert size={16}/> },
                ].map(s => (
                    <div key={s.label} className={`flex items-center gap-3 p-3 rounded-xl border ${s.color}`}>
                        <div className={`p-1.5 rounded-lg ${s.color}`}>{s.icon}</div>
                        <div>
                            <p className="text-xl font-black text-white leading-none">{s.value}</p>
                            <p className="text-[10px] uppercase tracking-wide mt-0.5 opacity-70">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── TABLE CARD ─────────────────────────────────── */}
            <div className="bg-gray-800 rounded-3xl border border-gray-700 shadow-2xl overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-gray-700 bg-gray-800/50">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"/>
                        <input
                            type="text"
                            placeholder="Tìm tiêu đề hoặc nội dung..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-300 focus:border-blue-500 outline-none cursor-pointer">
                        <option value="ALL">Tất cả loại</option>
                        <option value="INFO">INFO</option>
                        <option value="WARNING">WARNING</option>
                        <option value="DANGER">DANGER</option>
                        <option value="SUCCESS">SUCCESS</option>
                    </select>
                    <select value={filterTarget} onChange={e => setFilterTarget(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-300 focus:border-blue-500 outline-none cursor-pointer">
                        <option value="ALL">Tất cả đối tượng</option>
                        <option value="ADMIN">{getRoleLabel(UserRole.ADMIN)}</option>
                        <option value="EDITOR">{getRoleLabel(UserRole.EDITOR)}</option>
                        <option value="VIEWER">{getRoleLabel(UserRole.VIEWER)}</option>
                    </select>
                    <select value={filterExpiry} onChange={e => setFilterExpiry(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-300 focus:border-blue-500 outline-none cursor-pointer">
                        <option value="ALL">Tất cả hạn</option>
                        <option value="ACTIVE">Còn hiệu lực</option>
                        <option value="EXPIRED">Đã hết hạn</option>
                    </select>
                    <button onClick={loadData} title="Tải lại" className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0">
                        <RefreshCw size={16}/>
                    </button>
                </div>

                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-900 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b border-gray-700">
                        <tr>
                            <th className="p-4">Loại</th>
                            <th className="p-4">Tiêu đề & Nội dung</th>
                            <th className="p-4">Đối tượng</th>
                            <th className="p-4">Ngày gửi</th>
                            <th className="p-4">Hết hạn</th>
                            <th className="p-4 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700 text-gray-300">
                        {loading && notifications.length === 0 ? (
                            <tr><td colSpan={6} className="p-20 text-center text-gray-500"><Loader2 className="animate-spin mx-auto mb-2" size={32}/> Đang tải...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={6} className="p-16 text-center">
                                <Bell size={36} className="text-gray-700 mx-auto mb-3"/>
                                <p className="text-gray-500 italic text-sm">{notifications.length === 0 ? 'Chưa có thông báo nào được phát đi.' : 'Không tìm thấy thông báo phù hợp.'}</p>
                            </td></tr>
                        ) : filtered.map(n => {
                            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG['INFO'];
                            const expired = isExpired(n.expires_at);
                            return (
                                <tr key={n.id} className={`hover:bg-gray-700/50 transition-colors group ${expired ? 'opacity-50' : ''}`}>
                                    <td className="p-4">
                                        <span className={`flex items-center gap-1.5 w-fit px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${cfg.badge}`}>
                                            {cfg.icon} {cfg.label}
                                        </span>
                                    </td>
                                    <td className="p-4 max-w-xs">
                                        <p className="font-bold text-white truncate">{n.title}</p>
                                        {n.content && <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{n.content}</p>}
                                    </td>
                                    <td className="p-4">
                                        <span className="text-gray-400 text-[10px] font-mono bg-gray-900 px-2 py-0.5 rounded border border-gray-700">{getRoleLabel(n.target_role)}</span>
                                    </td>
                                    <td className="p-4 text-xs text-gray-500">{new Date(n.created_at).toLocaleString('vi-VN')}</td>
                                    <td className="p-4">
                                        {n.expires_at ? (
                                            expired
                                                ? <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-900 border border-gray-700 px-2 py-0.5 rounded-full w-fit"><Clock size={10}/> Hết hạn</span>
                                                : <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-900/20 border border-amber-800 px-2 py-0.5 rounded-full w-fit" title={new Date(n.expires_at).toLocaleString('vi-VN')}><Clock size={10}/> {new Date(n.expires_at).toLocaleDateString('vi-VN')}</span>
                                        ) : (
                                            <span className="text-[10px] text-gray-600 italic">Vĩnh viễn</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right flex justify-end gap-1">
                                        <button
                                            onClick={() => openEditModal(n)}
                                            disabled={loading || !canEditNotification}
                                            className="p-2 text-gray-500 hover:text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Chỉnh sửa"
                                        >
                                            <Edit2 size={15}/>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(n.id)} 
                                            disabled={loading || !canDeleteNotification}
                                            className="p-2 text-gray-500 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Xóa"
                                        >
                                            <Trash2 size={15}/>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {filtered.length > 0 && (
                    <div className="px-5 py-2 border-t border-gray-700 bg-gray-800/50 text-[11px] text-gray-500">
                        Hiển thị <span className="text-gray-300 font-semibold">{filtered.length}</span> / {notifications.length} thông báo
                    </div>
                )}
            </div>

            {/* ── MODAL SOẠN / CHỈNH SỬA ────────────────────── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] w-full max-w-5xl p-8 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[92vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                                {editingId !== null
                                    ? <><Edit2 size={20} className="text-amber-400"/> Chỉnh sửa Thông báo</>
                                    : <><Send size={20} className="text-blue-500"/> Soạn thông báo mới</>
                                }
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-all"><X size={24}/></button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* LEFT: Form */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Loại thông báo</label>
                                        <select className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                            <option value="INFO">Thông tin</option>
                                            <option value="WARNING">Cảnh báo</option>
                                            <option value="DANGER">Quan trọng</option>
                                            <option value="SUCCESS">Thành công</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Đối tượng nhận</label>
                                        <select className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formData.targetRole} onChange={e => setFormData({...formData, targetRole: e.target.value})}>
                                            <option value="ALL">Tất cả người dùng</option>
                                            <option value="ADMIN">Chỉ Quản trị viên</option>
                                            <option value="EDITOR">Chỉ Biên tập viên</option>
                                            <option value="VIEWER">Chỉ Người xem</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Tiêu đề ngắn *</label>
                                        <span className={`text-[10px] font-mono ${formData.title.length > 80 ? 'text-red-400' : 'text-gray-600'}`}>{formData.title.length}/100</span>
                                    </div>
                                    <input maxLength={100} className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white font-bold outline-none focus:border-blue-500" placeholder="vd: Bảo trì hệ thống tối nay..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Nội dung chi tiết *</label>
                                        <span className={`text-[10px] font-mono ${formData.content.length > 450 ? 'text-red-400' : 'text-gray-600'}`}>{formData.content.length}/500</span>
                                    </div>
                                    <textarea maxLength={500} className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 h-44 resize-none" placeholder="Nhập nội dung thông báo..." value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
                                </div>

                                {/* Thời gian hiệu lực */}
                                <div className="space-y-2">
                                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-1.5"><Clock size={11}/> Thời gian hết hạn (để trống = vĩnh viễn)</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-amber-500 [color-scheme:dark]"
                                        value={formData.expiresAt}
                                        min={new Date().toISOString().slice(0, 16)}
                                        onChange={e => setFormData({...formData, expiresAt: e.target.value})}
                                    />
                                    {formData.expiresAt && (
                                        <button onClick={() => setFormData({...formData, expiresAt: ''})} className="text-[10px] text-gray-500 hover:text-red-400 transition-colors">
                                            × Xóa thời hạn (đặt thành vĩnh viễn)
                                        </button>
                                    )}
                                </div>

                                <button onClick={handleSave} disabled={loading || (editingId !== null ? !canEditNotification : !canCreateNotification)} className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-xl ${editingId !== null ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'} text-white`}>
                                    {loading ? <Loader2 className="animate-spin" size={20}/> : editingId !== null ? <><Edit2 size={18}/> LƯU THAY ĐỔI</> : <><Send size={18}/> PHÁT THÔNG BÁO NGAY</>}
                                </button>
                            </div>

                            {/* RIGHT: Live Preview */}
                            <div className="space-y-3">
                                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-1.5"><Eye size={12}/> Xem trước</p>
                                <div className={`rounded-2xl border-l-4 p-4 ${TYPE_CONFIG[formData.type]?.preview ?? ''}`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-0.5 flex-shrink-0 ${
                                            formData.type === 'INFO' ? 'text-blue-400' :
                                            formData.type === 'WARNING' ? 'text-orange-400' :
                                            formData.type === 'DANGER' ? 'text-red-400' : 'text-emerald-400'
                                        }`}>
                                            {TYPE_CONFIG[formData.type]?.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-white text-sm truncate">{formData.title || 'Tiêu đề thông báo...'}</p>
                                            <p className="text-gray-400 text-xs mt-1 leading-relaxed line-clamp-4">{formData.content || 'Nội dung sẽ hiển thị ở đây...'}</p>
                                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${TYPE_CONFIG[formData.type]?.badge ?? ''}`}>
                                                    {TYPE_CONFIG[formData.type]?.label}
                                                </span>
                                                <span className="text-[9px] text-gray-600 font-mono">→ {getRoleLabel(formData.targetRole)}</span>
                                                {formData.expiresAt && (
                                                    <span className="text-[9px] text-amber-500 flex items-center gap-0.5 font-mono">
                                                        <Clock size={9}/> Hết hạn: {new Date(formData.expiresAt).toLocaleString('vi-VN')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-600 italic">* Giao diện xem trước có thể khác nhẹ so với hiển thị thực tế.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SYSTEM DIALOG ──────────────────────────────── */}
            {dialog.isOpen && (
                <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-sm border border-slate-800 shadow-2xl overflow-hidden">
                        <div className="p-8 text-center flex flex-col items-center">
                            {dialog.type === 'success' && <div className="w-14 h-14 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-4"><CheckCircle2 size={28}/></div>}
                            {dialog.type === 'error' && <div className="w-14 h-14 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4"><AlertTriangle size={28}/></div>}
                            {dialog.type === 'confirm' && <div className="w-14 h-14 bg-orange-500/20 text-orange-500 rounded-full flex items-center justify-center mb-4"><Info size={28}/></div>}
                            {dialog.type === 'warning' && <div className="w-14 h-14 bg-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center mb-4"><AlertTriangle size={28}/></div>}
                            {dialog.type === 'alert' && <div className="w-14 h-14 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mb-4"><Info size={28}/></div>}
                            
                            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">{dialog.title}</h3>
                            <p className="text-gray-400 text-xs leading-relaxed mb-6">{dialog.message}</p>
                            
                            <div className="flex gap-2 w-full">
                                {dialog.type === 'confirm' ? (
                                    <>
                                        <button onClick={() => setDialog({ ...dialog, isOpen: false })} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-gray-400 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">HỦY BỎ</button>
                                        <button onClick={() => { setDialog({ ...dialog, isOpen: false }); dialog.onConfirm?.(); }} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all">XÁC NHẬN</button>
                                    </>
                                ) : (
                                    <button onClick={() => setDialog({ ...dialog, isOpen: false })} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all">OK</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationManager;
