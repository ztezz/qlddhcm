
import React, { useState, useEffect, useMemo } from 'react';
import { adminService, hasAnyPermission } from '../../services/mockBackend';
import { User, UserRole, Branch, getRoleLabel } from '../../types';
import { Users, Plus, Edit2, Trash2, X, Save, Loader2, Key, Check, AlertTriangle, CheckCircle2, Info, Ban, UserCheck, MessageCircle, MessageCircleOff, Search, Filter, ShieldCheck, Eye, RefreshCw } from 'lucide-react';

// Lấy chữ cái đầu cho avatar
const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const avatarColors: Record<string, string> = {
    [UserRole.ADMIN]: 'bg-red-700 text-red-100',
    [UserRole.EDITOR]: 'bg-blue-700 text-blue-100',
    [UserRole.VIEWER]: 'bg-gray-600 text-gray-200',
};

interface UserManagerProps {
    permissions?: string[];
}

const UserManager: React.FC<UserManagerProps> = ({ permissions = [] }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetData, setResetData] = useState({ userId: '', userName: '', newPassword: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Filter & Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState<string>('ALL');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    // System Dialog State
    const [dialog, setDialog] = useState<{
        isOpen: boolean;
        type: 'alert' | 'confirm' | 'success' | 'error';
        title: string;
        message: string;
        onConfirm?: () => void;
    }>({ isOpen: false, type: 'alert', title: '', message: '' });

    const showDialog = (type: any, title: string, message: string, onConfirm?: () => void) => {
        setDialog({ isOpen: true, type, title, message, onConfirm });
    };

    const canCreateUser = hasAnyPermission(permissions, ['CREATE_USERS', 'MANAGE_USERS']);
    const canEditUser = hasAnyPermission(permissions, ['EDIT_USERS', 'MANAGE_USERS']);
    const canDeleteUser = hasAnyPermission(permissions, ['DELETE_USERS', 'MANAGE_USERS']);
    const canResetPassword = hasAnyPermission(permissions, ['RESET_USER_PASSWORD', 'MANAGE_USERS']);
    const canVerifyUser = hasAnyPermission(permissions, ['VERIFY_USERS', 'EDIT_USERS', 'MANAGE_USERS']);
    const canToggleChat = hasAnyPermission(permissions, ['TOGGLE_USER_CHAT', 'EDIT_USERS', 'MANAGE_USERS']);

    const denyAction = (message: string) => showDialog('error', 'Không đủ quyền', message);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [usersData, branchesData] = await Promise.all([
                adminService.getUsers(),
                adminService.getBranches()
            ]);
            setUsers(usersData);
            setBranches(branchesData);
        } catch (e) { console.error("Load users error:", e); }
    };

    // Derived stats
    const stats = useMemo(() => ({
        total: users.length,
        active: users.filter(u => u.is_verified).length,
        admins: users.filter(u => u.role === UserRole.ADMIN).length,
        editors: users.filter(u => u.role === UserRole.EDITOR).length,
    }), [users]);

    // Filtered list
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const q = searchQuery.toLowerCase();
            const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
            const matchRole = filterRole === 'ALL' || u.role === filterRole;
            const matchStatus = filterStatus === 'ALL'
                || (filterStatus === 'ACTIVE' && u.is_verified)
                || (filterStatus === 'INACTIVE' && !u.is_verified);
            return matchSearch && matchRole && matchStatus;
        });
    }, [users, searchQuery, filterRole, filterStatus]);

    const handleSave = async () => {
        if (editingId ? !canEditUser : !canCreateUser) {
            denyAction(editingId ? 'Bạn không có quyền cập nhật người dùng.' : 'Bạn không có quyền tạo người dùng mới.');
            return;
        }
        if (!formData.name || !formData.email) {
            showDialog('error', 'Thiếu dữ liệu', "Vui lòng nhập đầy đủ Họ tên và Email");
            return;
        }
        if (!editingId && !formData.password) {
            showDialog('error', 'Thiếu dữ liệu', "Vui lòng nhập mật khẩu cho người dùng mới");
            return;
        }
        if (!editingId && formData.password !== confirmPassword) {
            showDialog('error', 'Mật khẩu không khớp', "Mật khẩu xác nhận không trùng với mật khẩu đã nhập");
            return;
        }

        setLoading(true);
        try {
            if (editingId) {
                await adminService.updateUser({...formData, id: editingId});
            } else {
                await adminService.addUser(formData);
            }
            setIsModalOpen(false);
            await loadData();
            showDialog('success', 'Thành công', editingId ? 'Đã cập nhật thông tin người dùng.' : 'Đã khởi tạo tài khoản mới.');
        } catch(e: any) { 
            showDialog('error', 'Lỗi hệ thống', e.message); 
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!canResetPassword) return denyAction('Bạn không có quyền đặt lại mật khẩu cho tài khoản khác.');
        if (!resetData.newPassword) return showDialog('error', 'Thiếu mật khẩu', "Vui lòng nhập mật khẩu mới");
        setLoading(true);
        try {
            await adminService.resetPassword(resetData.userId, resetData.newPassword);
            showDialog('success', 'Đã đặt lại', `Đã đặt lại mật khẩu thành công cho ${resetData.userName}`);
            setIsResetModalOpen(false);
        } catch (e: any) {
            showDialog('error', 'Lỗi', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!canDeleteUser) return denyAction('Bạn không có quyền xóa người dùng.');
        showDialog('confirm', 'Xác nhận xóa', "Bạn có chắc chắn muốn xóa vĩnh viễn người dùng này khỏi hệ thống?", async () => {
            try {
                await adminService.deleteUser(id);
                await loadData();
                showDialog('success', 'Đã xóa', 'Người dùng đã được gỡ bỏ.');
            } catch (e: any) { showDialog('error', 'Lỗi', e.message); }
        });
    };

    const handleToggleVerification = async (u: User) => {
        if (!canVerifyUser) return denyAction('Bạn không có quyền thay đổi trạng thái kích hoạt tài khoản.');
        const action = u.is_verified ? 'HỦY KÍCH HOẠT' : 'KÍCH HOẠT';
        showDialog('confirm', `Xác nhận ${action}`, `Bạn có muốn thay đổi trạng thái tài khoản của ${u.name}?`, async () => {
            setLoading(true);
            try {
                await adminService.updateUser({ ...u, is_verified: !u.is_verified });
                await loadData();
                showDialog('success', 'Thành công', `Đã cập nhật trạng thái người dùng.`);
            } catch (e: any) { showDialog('error', 'Lỗi', e.message); } finally { setLoading(false); }
        });
    };

    const handleToggleChat = async (u: User) => {
        if (!canToggleChat) return denyAction('Bạn không có quyền thay đổi quyền chat của người dùng.');
        const action = u.can_chat ? 'HẠN CHẾ CHAT' : 'MỞ KHÓA CHAT';
        showDialog('confirm', `Xác nhận ${action}`, `Bạn có muốn thay đổi quyền nhắn tin của ${u.name}?`, async () => {
            setLoading(true);
            try {
                await adminService.toggleChatRestriction(u.id, !u.can_chat);
                await loadData();
                showDialog('success', 'Thành công', `Đã cập nhật quyền nhắn tin.`);
            } catch (e: any) { showDialog('error', 'Lỗi', e.message); } finally { setLoading(false); }
        });
    };

    const openAddModal = () => {
        if (!canCreateUser) return denyAction('Bạn không có quyền mở biểu mẫu tạo người dùng.');
        setEditingId(null);
        setConfirmPassword('');
        setFormData({
            role: UserRole.VIEWER,
            branchId: branches.length > 0 ? branches[0].id : 'HEAD_OFFICE',
            password: '',
            is_verified: true,
            can_chat: true
        });
        setIsModalOpen(true);
    };

    const openEditModal = (u: User) => {
        if (!canEditUser) return denyAction('Bạn không có quyền chỉnh sửa người dùng.');
        setEditingId(u.id);
        setFormData({ ...u });
        setIsModalOpen(true);
    };

    const openResetModal = (u: User) => {
        if (!canResetPassword) return denyAction('Bạn không có quyền mở chức năng đặt lại mật khẩu.');
        setResetData({ userId: u.id, userName: u.name, newPassword: '' });
        setIsResetModalOpen(true);
    };

    return (
        <div className="p-6 space-y-5">
            {/* ── STATS ROW ─────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Tổng người dùng', value: stats.total, icon: <Users size={18}/>, color: 'text-blue-400 bg-blue-900/20 border-blue-800' },
                    { label: 'Đang hoạt động', value: stats.active, icon: <CheckCircle2 size={18}/>, color: 'text-emerald-400 bg-emerald-900/20 border-emerald-800' },
                    { label: 'Quản trị viên', value: stats.admins, icon: <ShieldCheck size={18}/>, color: 'text-red-400 bg-red-900/20 border-red-800' },
                    { label: 'Biên tập viên', value: stats.editors, icon: <Edit2 size={18}/>, color: 'text-purple-400 bg-purple-900/20 border-purple-800' },
                ].map(s => (
                    <div key={s.label} className={`flex items-center gap-3 p-3 rounded-xl border ${s.color}`}>
                        <div className={`p-2 rounded-lg ${s.color}`}>{s.icon}</div>
                        <div>
                            <p className="text-xl font-black text-white leading-none">{s.value}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── MAIN TABLE CARD ───────────────────────────── */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
                {/* Header */}
                <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-gray-700 bg-gray-800/50">
                    <span className="font-semibold text-gray-300 flex items-center gap-2 flex-shrink-0">
                        <Users size={18} className="text-blue-400"/> Danh sách Người dùng
                    </span>

                    {/* Search */}
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"/>
                        <input
                            type="text"
                            placeholder="Tìm theo tên hoặc email..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                        />
                    </div>

                    {/* Filter Role */}
                    <select
                        value={filterRole}
                        onChange={e => setFilterRole(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-300 focus:border-blue-500 outline-none cursor-pointer"
                    >
                        <option value="ALL">Tất cả vai trò</option>
                        <option value={UserRole.ADMIN}>{getRoleLabel(UserRole.ADMIN)}</option>
                        <option value={UserRole.EDITOR}>{getRoleLabel(UserRole.EDITOR)}</option>
                        <option value={UserRole.VIEWER}>{getRoleLabel(UserRole.VIEWER)}</option>
                    </select>

                    {/* Filter Status */}
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-300 focus:border-blue-500 outline-none cursor-pointer"
                    >
                        <option value="ALL">Tất cả trạng thái</option>
                        <option value="ACTIVE">Đã kích hoạt</option>
                        <option value="INACTIVE">Chờ duyệt</option>
                    </select>

                    {/* Refresh */}
                    <button onClick={loadData} title="Tải lại" className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors flex-shrink-0">
                        <RefreshCw size={16}/>
                    </button>

                    <button onClick={openAddModal} disabled={!canCreateUser} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded text-sm font-bold shadow-lg transition-all flex items-center gap-2 flex-shrink-0">
                        <Plus size={16}/> Thêm mới
                    </button>
                </div>

                <table className="w-full text-sm text-left text-gray-300">
                    <thead className="bg-gray-900 text-gray-400 uppercase text-[10px] tracking-wider">
                        <tr>
                            <th className="p-4">Người dùng</th>
                            <th className="p-4">Email / Tên đăng nhập</th>
                            <th className="p-4">Quyền</th>
                            <th className="p-4">Chi nhánh</th>
                            <th className="p-4 text-center">Trạng thái</th>
                            <th className="p-4 text-center">Chat</th>
                            <th className="p-4 text-right">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-10 text-center text-gray-500 italic">
                                    {users.length === 0 ? 'Đang tải danh sách người dùng...' : 'Không tìm thấy người dùng phù hợp.'}
                                </td>
                            </tr>
                        ) : filteredUsers.map(u => (
                            <tr key={u.id} className="hover:bg-gray-700/50 transition-colors group">
                                {/* Avatar + Name */}
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${avatarColors[u.role] ?? 'bg-gray-600 text-gray-200'}`}>
                                            {getInitials(u.name)}
                                        </div>
                                        <span className="font-medium text-white">{u.name}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="text-gray-400">{u.email}</div>
                                    {u.username && <div className="text-[11px] text-blue-400 mt-0.5">@{u.username}</div>}
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        u.role === UserRole.ADMIN ? 'bg-red-900/40 text-red-300 border border-red-800' 
                                        : u.role === UserRole.EDITOR ? 'bg-purple-900/40 text-purple-300 border border-purple-800'
                                        : 'bg-blue-900/40 text-blue-300 border border-blue-800'
                                    }`}>
                                        {getRoleLabel(u.role)}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-400 text-xs">
                                    {branches.find(b => b.id === u.branchId)?.name || u.branchId}
                                </td>
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={() => handleToggleVerification(u)}
                                        disabled={!canVerifyUser}
                                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border mx-auto transition-all disabled:opacity-40 disabled:cursor-not-allowed ${u.is_verified 
                                            ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800 hover:bg-emerald-800/50' 
                                            : 'bg-orange-900/30 text-orange-400 border-orange-800 hover:bg-orange-800/50'}`}
                                        title={u.is_verified ? "Click để vô hiệu hóa" : "Click để kích hoạt"}
                                    >
                                        {u.is_verified ? <CheckCircle2 size={12}/> : <AlertTriangle size={12}/>}
                                        {u.is_verified ? 'Đã kích hoạt' : 'Chờ duyệt'}
                                    </button>
                                </td>
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={() => handleToggleChat(u)}
                                        disabled={!canToggleChat}
                                        className={`p-2 rounded-lg transition-all mx-auto flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed ${u.can_chat ? 'text-blue-400 bg-blue-900/20 hover:bg-blue-900/40' : 'text-gray-500 bg-gray-900 hover:bg-gray-700'}`}
                                        title={u.can_chat ? "Hạn chế Chat" : "Mở khóa Chat"}
                                    >
                                        {u.can_chat ? <MessageCircle size={18}/> : <MessageCircleOff size={18}/>}
                                    </button>
                                </td>
                                <td className="p-4 flex justify-end gap-2">
                                    <button onClick={() => openResetModal(u)} disabled={!canResetPassword} title="Đặt lại mật khẩu" className="p-1.5 text-orange-400 hover:bg-orange-400/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><Key size={16}/></button>
                                    <button onClick={() => openEditModal(u)} disabled={!canEditUser} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><Edit2 size={16}/></button>
                                    <button onClick={() => handleDelete(u.id)} disabled={!canDeleteUser} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Footer count */}
                {filteredUsers.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-700 bg-gray-800/50 text-[11px] text-gray-500">
                        Hiển thị <span className="text-gray-300 font-semibold">{filteredUsers.length}</span> / {users.length} người dùng
                    </div>
                )}
            </div>

            {/* --- SYSTEM DIALOG --- */}
            {dialog.isOpen && (
                <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-900 rounded-[2rem] w-full max-w-sm border border-gray-800 shadow-2xl overflow-hidden">
                        <div className="p-8 text-center flex flex-col items-center">
                            {dialog.type === 'success' && <div className="w-14 h-14 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-4"><CheckCircle2 size={28}/></div>}
                            {dialog.type === 'error' && <div className="w-14 h-14 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4"><AlertTriangle size={28}/></div>}
                            {dialog.type === 'confirm' && <div className="w-14 h-14 bg-orange-500/20 text-orange-500 rounded-full flex items-center justify-center mb-4"><Info size={28}/></div>}
                            {dialog.type === 'alert' && <div className="w-14 h-14 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mb-4"><Info size={28}/></div>}
                            
                            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">{dialog.title}</h3>
                            <p className="text-gray-400 text-xs leading-relaxed mb-6">{dialog.message}</p>
                            
                            <div className="flex gap-2 w-full">
                                {dialog.type === 'confirm' ? (
                                    <>
                                        <button onClick={() => setDialog({ ...dialog, isOpen: false })} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">HỦY BỎ</button>
                                        <button onClick={() => { setDialog({ ...dialog, isOpen: false }); dialog.onConfirm?.(); }} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-900/20 transition-all">XÁC NHẬN</button>
                                    </>
                                ) : (
                                    <button onClick={() => setDialog({ ...dialog, isOpen: false })} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all">OK</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Thêm/Sửa */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-gray-800 rounded-xl w-full max-w-md p-6 border border-gray-700 shadow-2xl">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                {editingId ? <Edit2 size={20} className="text-blue-400"/> : <Plus size={20} className="text-green-400"/>}
                                {editingId ? "Cập nhật Người dùng" : "Thêm Người dùng mới"}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                    <div>
                                <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Tên đăng nhập <span className="text-gray-500">(tùy chọn)</span></label>
                                <input className="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white focus:border-blue-500 outline-none" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="VD: nguyen.van.a" />
                                <p className="text-[10px] text-gray-500 mt-1">Dùng để đăng nhập thay thế email</p>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Họ tên <span className="text-red-500">*</span></label>
                                <input className="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white focus:border-blue-500 outline-none" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="VD: Nguyễn Văn A" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Email <span className="text-red-500">*</span></label>
                                <input className="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white focus:border-blue-500 outline-none" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@example.com" />
                            </div>
                            {!editingId && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Mật khẩu <span className="text-red-500">*</span></label>
                                        <input type="password" placeholder="Nhập mật khẩu..." className="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white focus:border-blue-500 outline-none" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Xác nhận MK <span className="text-red-500">*</span></label>
                                        <input
                                            type="password"
                                            placeholder="Nhập lại mật khẩu..."
                                            className={`w-full bg-gray-900 border rounded p-2.5 text-white focus:outline-none ${confirmPassword && confirmPassword !== formData.password ? 'border-red-500 focus:border-red-400' : 'border-gray-600 focus:border-blue-500'}`}
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                        />
                                        {confirmPassword && confirmPassword !== formData.password && (
                                            <p className="text-red-400 text-[10px] mt-1">Mật khẩu không khớp</p>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Vai trò hệ thống</label>
                                <select className="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white focus:border-blue-500 outline-none cursor-pointer" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                                    <option value={UserRole.ADMIN}>{getRoleLabel(UserRole.ADMIN)} (Toàn quyền)</option>
                                    <option value={UserRole.EDITOR}>{getRoleLabel(UserRole.EDITOR)} (Biên tập dữ liệu)</option>
                                    <option value={UserRole.VIEWER}>{getRoleLabel(UserRole.VIEWER)} (Chỉ xem)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Chi nhánh công tác</label>
                                <select className="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white focus:border-blue-500 outline-none cursor-pointer" value={formData.branchId || ''} onChange={e => setFormData({...formData, branchId: e.target.value})}>
                                    <option value="">-- Chọn chi nhánh --</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                {/* Trạng thái xác thực */}
                                <div className="flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded-lg">
                                    <label className="text-[10px] text-gray-400 font-bold uppercase">Kích hoạt</label>
                                    <button 
                                        type="button"
                                        onClick={() => setFormData({...formData, is_verified: !formData.is_verified})}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formData.is_verified ? 'bg-green-600' : 'bg-gray-700'}`}
                                    >
                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${formData.is_verified ? 'translate-x-4.5' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                {/* Quyền chat */}
                                <div className="flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded-lg">
                                    <label className="text-[10px] text-gray-400 font-bold uppercase">Quyền Chat</label>
                                    <button 
                                        type="button"
                                        onClick={() => setFormData({...formData, can_chat: !formData.can_chat})}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formData.can_chat ? 'bg-blue-600' : 'bg-gray-700'}`}
                                    >
                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${formData.can_chat ? 'translate-x-4.5' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-700">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white font-medium">Hủy bỏ</button>
                            <button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                                {loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                                {editingId ? "Lưu thay đổi" : "Tạo tài khoản"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Đặt lại mật khẩu */}
            {isResetModalOpen && (
                <div className="fixed inset-0 z-[600] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-sm p-6 border border-orange-500/30 shadow-[0_0_50px_rgba(249,115,22,0.1)]">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-3">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
                                    <Key size={20} className="text-orange-500"/> Đặt lại mật khẩu
                                </h3>
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1">Người dùng: {resetData.userName}</p>
                            </div>
                            <button onClick={() => setIsResetModalOpen(false)} className="text-gray-500 hover:text-white"><X size={24}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-400 font-black uppercase mb-1.5 block tracking-widest">Mật khẩu mới</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:border-orange-500 outline-none font-mono text-lg tracking-widest" 
                                    value={resetData.newPassword} 
                                    onChange={e => setResetData({...resetData, newPassword: e.target.value})} 
                                    placeholder="Nhập mật khẩu mới..." 
                                    autoFocus
                                />
                                <p className="text-[9px] text-gray-500 italic mt-2">* Mật khẩu sẽ được cập nhật trực tiếp vào cơ sở dữ liệu.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setIsResetModalOpen(false)} className="flex-1 py-3 text-gray-500 hover:text-white font-black text-[10px] uppercase tracking-widest transition-colors">HỦY BỎ</button>
                            <button 
                                onClick={handleResetPassword} 
                                disabled={loading} 
                                className="flex-[2] bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin" size={14}/> : <Check size={14}/>} XÁC NHẬN ĐỔI
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManager;
