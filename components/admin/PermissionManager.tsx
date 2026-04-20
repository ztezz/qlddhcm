
import React, { useState, useEffect, useCallback } from 'react';
import { adminService, DEFAULT_ROLE_PERMISSIONS, PERMISSIONS_LIST } from '../../services/mockBackend';
import { RoleConfig, UserRole } from '../../types';
import {
    ShieldCheck, Loader2, Info, CheckSquare, Square,
    Lock, Map, Database, BarChart2, Settings,
    Users, Eye, Edit, Crown, Search, CheckCircle2,
    XCircle, RefreshCw
} from 'lucide-react';

// ─── Role metadata ─────────────────────────────────────────────────────────────
const ROLE_META: Record<UserRole, { label: string; desc: string; color: string; bg: string; border: string; Icon: React.FC<any> }> = {
    [UserRole.ADMIN]:  { label: 'Quản trị viên', desc: 'Toàn quyền hệ thống',       color: 'text-red-300',    bg: 'bg-red-900/30',    border: 'border-red-700',    Icon: Crown },
    [UserRole.EDITOR]: { label: 'Biên tập viên', desc: 'Chỉnh sửa bản đồ & dữ liệu', color: 'text-blue-300',   bg: 'bg-blue-900/30',   border: 'border-blue-700',   Icon: Edit },
    [UserRole.VIEWER]: { label: 'Người xem',     desc: 'Chỉ xem, không thay đổi',    color: 'text-green-300',  bg: 'bg-green-900/30',  border: 'border-green-700',  Icon: Eye },
};

// ─── Group metadata ────────────────────────────────────────────────────────────
const GROUP_META: Record<string, { label: string; Icon: React.FC<any>; color: string }> = {
    MAP:     { label: 'Bản đồ & Thửa đất', Icon: Map,       color: 'text-blue-400' },
    DATA:    { label: 'Dữ liệu & Lớp bản đồ', Icon: Database,  color: 'text-purple-400' },
    REPORT:  { label: 'Báo cáo & Thống kê', Icon: BarChart2, color: 'text-teal-400' },
    USERS:   { label: 'Người dùng & Vai trò', Icon: Users, color: 'text-amber-400' },
    CONTENT: { label: 'Nội dung quản trị', Icon: Settings, color: 'text-pink-400' },
    SYSTEM:  { label: 'Hệ thống & Bảo trì', Icon: Settings,  color: 'text-orange-400' },
};

const ROLES = [UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER];

// ─── Toast ────────────────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error'; }

let toastId = 0;

const PermissionManager: React.FC = () => {
    const [rolePermissions, setRolePermissions] = useState<RoleConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [search, setSearch] = useState('');

    const addToast = useCallback((message: string, type: 'success' | 'error') => {
        const id = ++toastId;
        setToasts(t => [...t, { id, message, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
    }, []);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try { setRolePermissions(await adminService.getRolePermissions()); }
        catch (e: any) { addToast('Không thể tải phân quyền: ' + e.message, 'error'); }
        finally { setLoading(false); }
    };

    const getPerms = (role: UserRole) =>
        rolePermissions.find(rp => rp.role === role)?.permissions ?? DEFAULT_ROLE_PERMISSIONS[role] ?? [];

    const handleToggle = async (role: UserRole, code: string, checked: boolean) => {
        const current = getPerms(role);
        const next = checked ? [...current, code] : current.filter(p => p !== code);
        const key = `${role}-${code}`;
        setSaving(key);
        try {
            await adminService.saveRolePermissions(role, next);
            setRolePermissions(prev => {
                const idx = prev.findIndex(rp => rp.role === role);
                if (idx === -1) return [...prev, { role, permissions: next }];
                const arr = [...prev];
                arr[idx] = { ...arr[idx], permissions: next };
                return arr;
            });
            addToast(`Đã ${checked ? 'cấp' : 'thu hồi'} quyền cho ${ROLE_META[role].label}`, 'success');
        } catch (e: any) {
            addToast('Lỗi lưu phân quyền: ' + e.message, 'error');
        } finally {
            setSaving(null);
        }
    };

    const handleGroupToggle = async (role: UserRole, group: string, selectAll: boolean) => {
        const groupPerms = PERMISSIONS_LIST.filter(p => p.group === group).map(p => p.code);
        const current = getPerms(role);
        const next = selectAll
            ? Array.from(new Set([...current, ...groupPerms]))
            : current.filter(p => !groupPerms.includes(p));
        setSaving(`${role}-group-${group}`);
        try {
            await adminService.saveRolePermissions(role, next);
            setRolePermissions(prev => {
                const idx = prev.findIndex(rp => rp.role === role);
                if (idx === -1) return [...prev, { role, permissions: next }];
                const arr = [...prev]; arr[idx] = { ...arr[idx], permissions: next }; return arr;
            });
            addToast(`Đã ${selectAll ? 'cấp toàn bộ' : 'thu hồi toàn bộ'} nhóm "${GROUP_META[group]?.label}" cho ${ROLE_META[role].label}`, 'success');
        } catch (e: any) {
            addToast('Lỗi: ' + e.message, 'error');
        } finally { setSaving(null); }
    };

    const groups = Array.from(new Set(PERMISSIONS_LIST.map(p => p.group)));
    const filtered = search
        ? PERMISSIONS_LIST.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
        : PERMISSIONS_LIST;

    if (loading) {
        return (
            <div className="p-12 flex justify-center items-center text-blue-400 gap-3">
                <Loader2 className="animate-spin" /> <span>Đang tải ma trận phân quyền...</span>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-5 bg-gray-900 min-h-full">
            {/* Toasts */}
            <div className="fixed top-5 right-5 z-50 space-y-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-xl border text-sm font-medium pointer-events-auto transition-all
                        ${t.type === 'success' ? 'bg-green-900/90 border-green-700 text-green-200' : 'bg-red-900/90 border-red-700 text-red-200'}`}>
                        {t.type === 'success' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                        {t.message}
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                        <ShieldCheck size={20} className="text-green-400" /> Ma trận Phân quyền & Vai trò
                    </h1>
                    <p className="text-xs text-gray-500 mt-0.5">Cấp quyền truy cập các tính năng cho từng nhóm người dùng. Thay đổi có hiệu lực ngay lập tức.</p>
                </div>
                <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-gray-700/60 border border-gray-600 text-gray-300 hover:bg-gray-600 transition-colors">
                    <RefreshCw size={12} /> Tải lại
                </button>
            </div>

            {/* Role summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {ROLES.map(role => {
                    const m = ROLE_META[role];
                    const perms = getPerms(role);
                    const RoleIcon = m.Icon;
                    return (
                        <div key={role} className={`rounded-lg border p-4 ${m.bg} ${m.border}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <RoleIcon size={16} className={m.color} />
                                <span className={`font-bold text-sm ${m.color}`}>{m.label}</span>
                                {role === UserRole.ADMIN && <Lock size={12} className="text-gray-500 ml-auto" title="Không thể giảm quyền Admin" />}
                            </div>
                            <p className="text-[11px] text-gray-500 mb-3">{m.desc}</p>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-400">Quyền được cấp</span>
                                <span className={`font-bold tabular-nums ${m.color}`}>{perms.length} / {PERMISSIONS_LIST.length}</span>
                            </div>
                            <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${role === UserRole.ADMIN ? 'bg-red-500' : role === UserRole.EDITOR ? 'bg-blue-500' : 'bg-green-500'}`}
                                    style={{ width: `${(perms.length / PERMISSIONS_LIST.length) * 100}%` }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Search */}
            <div className="relative max-w-xs">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Tìm quyền..."
                    className="w-full bg-gray-800 border border-gray-600 rounded pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors" />
            </div>

            {/* Permission matrix */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-900/80 text-gray-400 text-[11px] uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3 w-2/5 font-medium">Chức năng</th>
                                {ROLES.map(role => {
                                    const m = ROLE_META[role];
                                    const RoleIcon = m.Icon;
                                    return (
                                        <th key={role} className="px-4 py-3 text-center font-medium">
                                            <div className={`flex items-center justify-center gap-1.5 ${m.color}`}>
                                                <RoleIcon size={13} /> {m.label}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {(search ? [{ group: 'SEARCH', perms: filtered }] : groups.map(g => ({ group: g, perms: PERMISSIONS_LIST.filter(p => p.group === g) }))).map(({ group, perms: groupPerms }) => {
                                const gm = GROUP_META[group] ?? { label: 'Tìm kiếm', Icon: Search, color: 'text-gray-400' };
                                const GIcon = gm.Icon;
                                return (
                                    <React.Fragment key={group}>
                                        {/* Group header */}
                                        <tr className="bg-gray-900/60 border-y border-gray-700/60">
                                            <td className="px-4 py-2">
                                                <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${gm.color}`}>
                                                    <GIcon size={12} /> {gm.label}
                                                </span>
                                            </td>
                                            {!search && ROLES.map(role => {
                                                const perms = getPerms(role);
                                                const groupCodes = groupPerms.map(p => p.code);
                                                const allChecked = groupCodes.every(c => perms.includes(c));
                                                const isSavingGroup = saving === `${role}-group-${group}`;
                                                if (role === UserRole.ADMIN) return <td key={role} className="px-4 py-2 text-center"><Lock size={12} className="inline text-gray-600" /></td>;
                                                return (
                                                    <td key={role} className="px-4 py-2 text-center">
                                                        <button
                                                            disabled={!!saving}
                                                            onClick={() => handleGroupToggle(role, group, !allChecked)}
                                                            className="flex items-center justify-center gap-1 mx-auto text-[10px] text-gray-500 hover:text-white transition-colors disabled:opacity-40"
                                                            title={allChecked ? 'Bỏ chọn tất cả nhóm này' : 'Chọn tất cả nhóm này'}
                                                        >
                                                            {isSavingGroup ? <Loader2 size={12} className="animate-spin" /> : allChecked ? <CheckSquare size={12} className="text-blue-400" /> : <Square size={12} />}
                                                            <span>{allChecked ? 'Bỏ tất cả' : 'Chọn tất cả'}</span>
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                            {search && <td colSpan={3} />}
                                        </tr>
                                        {/* Permission rows */}
                                        {groupPerms.map(perm => (
                                            <tr key={perm.code} className="hover:bg-gray-700/20 transition-colors border-b border-gray-700/30 last:border-0">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-200 text-xs">{perm.name}</div>
                                                    {perm.description && <div className="text-[10px] text-gray-500 mt-0.5">{perm.description}</div>}
                                                    <div className="text-[10px] text-gray-600 font-mono mt-0.5">{perm.code}</div>
                                                </td>
                                                {ROLES.map(role => {
                                                    const perms = getPerms(role);
                                                    const checked = perms.includes(perm.code);
                                                    const isLocked = role === UserRole.ADMIN;
                                                    const key = `${role}-${perm.code}`;
                                                    const isSavingThis = saving === key;
                                                    return (
                                                        <td key={role} className="px-4 py-3 text-center">
                                                            {isLocked ? (
                                                                <div className="flex items-center justify-center">
                                                                    <div className="w-5 h-5 rounded flex items-center justify-center bg-green-900/50 border border-green-700/50" title="Luôn được cấp">
                                                                        <CheckSquare size={13} className="text-green-400" />
                                                                    </div>
                                                                </div>
                                                            ) : isSavingThis ? (
                                                                <Loader2 size={16} className="inline animate-spin text-blue-400" />
                                                            ) : (
                                                                <button
                                                                    disabled={!!saving}
                                                                    onClick={() => handleToggle(role, perm.code, !checked)}
                                                                    className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-all border
                                                                        ${checked
                                                                            ? 'bg-blue-600/80 border-blue-500 hover:bg-blue-500'
                                                                            : 'bg-gray-700 border-gray-600 hover:border-gray-400'
                                                                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                                                                    title={checked ? 'Thu hồi quyền' : 'Cấp quyền'}
                                                                >
                                                                    {checked
                                                                        ? <CheckSquare size={13} className="text-white" />
                                                                        : <Square size={13} className="text-gray-500" />
                                                                    }
                                                                </button>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-3 bg-gray-900/50 border-t border-gray-700 flex items-center gap-2 text-[11px] text-gray-500">
                    <Info size={13} />
                    Vai trò <span className="text-red-400 font-medium">Quản trị viên</span> luôn có toàn quyền và không thể thay đổi. Mọi thay đổi tự động lưu ngay lập tức.
                </div>
            </div>
        </div>
    );
};

export default PermissionManager;
