
import React, { useState, useEffect, useRef } from 'react';
import { adminService, hasAnyPermission } from '../../services/mockBackend';
import { MenuItem, UserRole } from '../../types';
import { LayoutList, Plus, Edit2, Trash2, X, Save, Info, Search, Link as LinkIcon, Globe, Monitor, Check, Loader2, AlertTriangle, CheckCircle2, GripVertical, RefreshCw, FolderCog, ChevronUp, ChevronDown } from 'lucide-react';
import * as Icons from 'lucide-react';

interface MenuManagerProps {
    permissions?: string[];
}

interface SidebarToolConfig {
    id: string;
    label: string;
    icon: string;
    path: string;
    enabled: boolean;
}

const DEFAULT_SIDEBAR_TOOLS: SidebarToolConfig[] = [
    { id: 'qr-generator', label: 'Tạo mã QR', icon: 'QrCode', path: '/taomaqr', enabled: true },
    { id: 'coordinate-converter', label: 'Chuyển hệ tọa độ', icon: 'ArrowRightLeft', path: '/chuyendoihetoado', enabled: true }
];

const TOOL_ICON_OPTIONS = [
    'QrCode', 'ArrowRightLeft', 'Calculator', 'Ruler', 'Map', 'MapPin', 'Compass',
    'Globe', 'Download', 'FileText', 'Database', 'Search', 'Layers', 'BarChart2',
    'Table2', 'FolderCog', 'ScanLine', 'Share2', 'Wrench', 'Settings'
];

const MenuManager: React.FC<MenuManagerProps> = ({ permissions = [] }) => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [isEditMode, setIsEditMode] = useState(false);
    const [iconSearch, setIconSearch] = useState('');
    const [draggingMenuId, setDraggingMenuId] = useState<string | null>(null);
    const [dragOverMenuId, setDragOverMenuId] = useState<string | null>(null);
    const [menuSaveState, setMenuSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const menuSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const menuSavedHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSyncedMenuRef = useRef<MenuItem[]>([]);

    // Tools config state
    const [sidebarTools, setSidebarTools] = useState<SidebarToolConfig[]>(DEFAULT_SIDEBAR_TOOLS);
    const [toolsSaveState, setToolsSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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

    const canCreateMenu = hasAnyPermission(permissions, ['CREATE_MENU', 'MANAGE_MENU']);
    const canEditMenu = hasAnyPermission(permissions, ['EDIT_MENU', 'MANAGE_MENU']);
    const canDeleteMenu = hasAnyPermission(permissions, ['DELETE_MENU', 'MANAGE_MENU']);
    const canReorderMenu = hasAnyPermission(permissions, ['REORDER_MENU', 'MANAGE_MENU']);

    const sanitizeInternalId = (id: string) => id.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '');
    const normalizeOrderIndex = (value: unknown) => {
        const parsed = Number.parseInt(String(value), 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    };
    const isValidExternalUrl = (value: string) => /^https?:\/\//i.test(value);
    const isValidInternalRoutePath = (value: string) => value.startsWith('/') && !value.startsWith('//');

    useEffect(() => { loadMenu(); }, []);

    useEffect(() => {
        return () => {
            if (menuSaveTimerRef.current) clearTimeout(menuSaveTimerRef.current);
            if (menuSavedHintTimerRef.current) clearTimeout(menuSavedHintTimerRef.current);
        };
    }, []);

    const loadMenu = async () => {
        setLoading(true);
        try {
            if (adminService && typeof adminService.getMenuItems === 'function') {
                const [data, settings] = await Promise.all([
                    adminService.getMenuItems(),
                    adminService.getSettings().catch(() => [] as any[])
                ]);
                const sorted = [...data].sort((a, b) => a.order_index - b.order_index);
                setMenuItems(sorted);
                lastSyncedMenuRef.current = sorted;
                const toolsRaw = (settings as any[]).find((s: any) => s.key === 'sidebar_tools')?.value;
                if (toolsRaw) {
                    try {
                        const parsed = JSON.parse(toolsRaw);
                        if (Array.isArray(parsed)) {
                            const knownIds = new Set(parsed.map((t: SidebarToolConfig) => t.id));
                            const merged = [...parsed, ...DEFAULT_SIDEBAR_TOOLS.filter((t) => !knownIds.has(t.id))];
                            setSidebarTools(merged);
                        }
                    } catch {}
                }
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const saveTools = async (tools: SidebarToolConfig[]) => {
        setToolsSaveState('saving');
        try {
            await adminService.saveSettings([{ key: 'sidebar_tools', value: JSON.stringify(tools), type: 'text' } as any]);
            window.dispatchEvent(new CustomEvent('system-settings-updated', { detail: { sidebar_tools: JSON.stringify(tools) } }));
            setToolsSaveState('saved');
            setTimeout(() => setToolsSaveState('idle'), 1800);
        } catch {
            setToolsSaveState('error');
        }
    };

    const updateTool = (idx: number, patch: Partial<SidebarToolConfig>) => {
        const next = sidebarTools.map((t, i) => i === idx ? { ...t, ...patch } : t);
        setSidebarTools(next);
        saveTools(next);
    };

    const moveTool = (idx: number, dir: 'up' | 'down') => {
        const arr = [...sidebarTools];
        const swap = dir === 'up' ? idx - 1 : idx + 1;
        if (swap < 0 || swap >= arr.length) return;
        [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
        setSidebarTools(arr);
        saveTools(arr);
    };

    const handleLabelChange = (val: string) => {
        const updates: any = { label: val };
        if (!isEditMode && formData.type === 'EXTERNAL' && !formData.id) {
            updates.id = 'ext_' + val.toLowerCase().trim()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
                .replace(/[^a-z0-9]/g, '_');
        }
        setFormData({ ...formData, ...updates });
    };

    const handleSave = async () => {
        if (isEditMode ? !canEditMenu : !canCreateMenu) {
            return showDialog('error', 'Không đủ quyền', isEditMode ? 'Bạn không có quyền chỉnh sửa menu.' : 'Bạn không có quyền tạo mục menu mới.');
        }
        const payload = {
            ...formData,
            id: sanitizeInternalId(formData.id || ''),
            label: (formData.label || '').trim(),
            icon: (formData.icon || '').trim(),
            url: (formData.url || '').trim(),
            order_index: normalizeOrderIndex(formData.order_index),
            roles: Array.isArray(formData.roles) ? formData.roles : []
        };

        if (!payload.id || !payload.label || !payload.icon) {
            return showDialog('error', 'Lỗi nhập liệu', "Vui lòng nhập đầy đủ thông tin bắt buộc (Nhãn, Mã trang, Icon).");
        }
        if (payload.roles.length === 0) {
            return showDialog('error', 'Lỗi nhập liệu', 'Vui lòng chọn tối thiểu 1 vai trò được phép xem menu.');
        }
        if (!isEditMode && menuItems.some(item => item.id === payload.id)) {
            return showDialog('error', 'Trùng mã menu', 'Mã trang đã tồn tại. Vui lòng nhập mã khác.');
        }
        if (payload.type === 'EXTERNAL') {
            if (!payload.url || !isValidExternalUrl(payload.url)) {
                return showDialog('error', 'Lỗi nhập liệu', 'Vui lòng nhập URL hợp lệ và bắt đầu bằng http:// hoặc https://.');
            }
        } else if (payload.url && !isValidInternalRoutePath(payload.url)) {
            return showDialog('error', 'Lỗi nhập liệu', 'Đường dẫn nội bộ phải bắt đầu bằng dấu / (ví dụ: /thongke).');
        }

        setLoading(true);
        try {
            if (isEditMode) await adminService.updateMenuItem(payload);
            else await adminService.addMenuItem({ ...payload, is_active: true });
            setIsModalOpen(false);
            await loadMenu();
            showDialog('success', 'Thành công', 'Đã lưu thay đổi vào cấu hình Sidebar.');
        } catch (e: any) { showDialog('error', 'Lỗi hệ thống', e.message); } finally { setLoading(false); }
    };

    const handleDelete = async (id: string) => {
        if (!canDeleteMenu) return showDialog('error', 'Không đủ quyền', 'Bạn không có quyền xóa menu.');
        showDialog('confirm', 'Xác nhận xóa', "Thao tác này sẽ gỡ bỏ mục menu khỏi Sidebar của toàn bộ người dùng. Bạn vẫn muốn tiếp tục?", async () => {
            try {
                await adminService.deleteMenuItem(id);
                await loadMenu();
                showDialog('success', 'Đã xóa', 'Mục menu đã được loại bỏ.');
            } catch (e: any) { showDialog('error', 'Lỗi', e.message); }
        });
    };

    const openModal = (item?: MenuItem) => {
        if (item ? !canEditMenu : !canCreateMenu) {
            showDialog('error', 'Không đủ quyền', item ? 'Bạn không có quyền chỉnh sửa menu.' : 'Bạn không có quyền thêm menu mới.');
            return;
        }
        setIsEditMode(!!item);
        setFormData(item ? { ...item } : { 
            id: '', 
            label: '', 
            icon: 'LayoutDashboard', 
            roles: ['GUEST', 'ADMIN', 'EDITOR', 'VIEWER'], 
            is_active: true,
            type: 'INTERNAL',
            url: '',
            order_index: menuItems.length
        });
        setIconSearch('');
        setIsModalOpen(true);
    };

    const reindexMenuOrder = (items: MenuItem[]): MenuItem[] => {
        return items.map((item, index) => ({ ...item, order_index: index }));
    };

    const reorderMenuItemsById = (items: MenuItem[], fromId: string, toId: string): MenuItem[] => {
        const fromIndex = items.findIndex((item) => item.id === fromId);
        const toIndex = items.findIndex((item) => item.id === toId);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
        const next = [...items];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
    };

    const persistMenuOrder = async (orderedItems: MenuItem[]) => {
        await Promise.all(
            orderedItems.map((item, index) =>
                adminService.updateMenuItem({
                    ...item,
                    order_index: Number.isFinite(Number(item.order_index)) ? Number(item.order_index) : index
                })
            )
        );
    };

    const scheduleMenuAutoSave = (orderedItems: MenuItem[]) => {
        if (menuSaveTimerRef.current) clearTimeout(menuSaveTimerRef.current);
        if (menuSavedHintTimerRef.current) clearTimeout(menuSavedHintTimerRef.current);
        setMenuSaveState('saving');

        menuSaveTimerRef.current = setTimeout(async () => {
            try {
                await persistMenuOrder(orderedItems);
                lastSyncedMenuRef.current = orderedItems;
                setMenuSaveState('saved');
                menuSavedHintTimerRef.current = setTimeout(() => setMenuSaveState('idle'), 1800);
            } catch (e: any) {
                setMenuItems(lastSyncedMenuRef.current);
                setMenuSaveState('error');
                showDialog('error', 'Không thể lưu thứ tự', e.message || 'Đã có lỗi khi cập nhật vị trí Sidebar.');
            }
        }, 350);
    };

    const handleMenuDrop = (targetId: string) => {
        if (!canReorderMenu || !draggingMenuId || draggingMenuId === targetId || loading) return;
        const next = reindexMenuOrder(reorderMenuItemsById(menuItems, draggingMenuId, targetId));
        setMenuItems(next);
        setDraggingMenuId(null);
        setDragOverMenuId(null);
        scheduleMenuAutoSave(next);
    };

    const toggleRole = (role: string) => {
        const currentRoles = formData.roles || [];
        if (currentRoles.includes(role)) {
            setFormData({ ...formData, roles: currentRoles.filter((r: string) => r !== role) });
        } else {
            setFormData({ ...formData, roles: [...currentRoles, role] });
        }
    };

    const availableIcons = Object.keys(Icons).filter(name => {
        const item = (Icons as any)[name];
        const matchesSearch = name.toLowerCase().includes(iconSearch.toLowerCase());
        const isNotInternal = !['createLucideIcon', 'LucideProps', 'default', 'icons'].includes(name);
        const isComponent = typeof item === 'function' || (typeof item === 'object' && item !== null);
        return matchesSearch && isNotInternal && isComponent;
    }).slice(0, 30);

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            {/* Header & Button */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30">
                        <LayoutList size={24} className="text-blue-400"/>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-white">Quản lý Sidebar</h2>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Tùy biến thanh điều hướng hệ thống</p>
                    </div>
                </div>
                <button onClick={() => openModal()} disabled={!canCreateMenu} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-3 rounded-2xl text-xs font-black flex items-center gap-2 transition-all shadow-xl shadow-blue-900/40 active:scale-95">
                    <Plus size={18}/> THÊM MỤC MỚI
                </button>
            </div>

            {/* Main Table */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-[2rem] shadow-2xl overflow-hidden backdrop-blur-xl">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-4 border-b border-gray-800 bg-gray-950/50">
                    <div className="flex items-center gap-3 text-xs text-gray-400 font-bold uppercase tracking-wider">
                        <GripVertical size={14} className="text-blue-400" />
                        <span>Kéo thả để đổi vị trí menu trên Sidebar</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                        {menuSaveState === 'saving' && <span className="text-amber-400 flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Đang tự lưu</span>}
                        {menuSaveState === 'saved' && <span className="text-emerald-400">Đã lưu thứ tự</span>}
                        {menuSaveState === 'error' && <span className="text-red-400">Lưu thất bại</span>}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-950/80 text-gray-500 uppercase text-[10px] tracking-[0.2em] font-black border-b border-gray-800">
                            <tr>
                                <th className="p-5 w-12 text-center">Kéo</th>
                                <th className="p-5 w-16 text-center">#</th>
                                <th className="p-5">Icon</th>
                                <th className="p-5">Nhãn hiển thị</th>
                                <th className="p-5">Loại</th>
                                <th className="p-5">Mã / URL</th>
                                <th className="p-5">Quyền xem</th>
                                <th className="p-5 text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800 text-gray-300">
                            {menuItems.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={8} className="p-20 text-center text-gray-600 font-bold uppercase tracking-widest italic opacity-20">Chưa có mục menu nào</td>
                                </tr>
                            ) : menuItems.map((item) => {
                                const IconComponent = (Icons as any)[item.icon] || Icons.HelpCircle;
                                return (
                                    <tr
                                        key={item.id}
                                        draggable={!loading && canReorderMenu}
                                        onDragStart={() => setDraggingMenuId(item.id)}
                                        onDragOver={(e) => {
                                            if (!loading) {
                                                e.preventDefault();
                                                setDragOverMenuId(item.id);
                                            }
                                        }}
                                        onDrop={() => handleMenuDrop(item.id)}
                                        onDragEnd={() => { setDraggingMenuId(null); setDragOverMenuId(null); }}
                                        className={`hover:bg-blue-600/5 transition-colors group ${!loading ? 'cursor-move' : ''} ${draggingMenuId === item.id ? 'opacity-40' : ''} ${dragOverMenuId === item.id ? 'bg-blue-900/10' : ''}`}
                                    >
                                        <td className="p-5 text-center text-gray-600 group-hover:text-blue-400">
                                            <GripVertical size={16} className="mx-auto" />
                                        </td>
                                        <td className="p-5 text-center font-mono text-gray-600 group-hover:text-blue-400 transition-colors">
                                            <span className="inline-flex min-w-8 justify-center px-2 py-1 rounded-lg bg-gray-800 border border-gray-700">{item.order_index}</span>
                                        </td>
                                        <td className="p-5">
                                            <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform border border-gray-700">
                                                <IconComponent size={20}/>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex flex-col">
                                                <span className="font-black text-white text-base group-hover:text-blue-400 transition-colors">{item.label}</span>
                                                {!item.is_active && <span className="text-[9px] text-red-500 font-black uppercase">Đang ẩn</span>}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            {item.type === 'EXTERNAL' ? (
                                                <span className="px-2 py-1 bg-orange-950/30 text-orange-400 text-[9px] font-black rounded-lg border border-orange-800/40 uppercase tracking-tighter">Liên kết ngoài</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-cyan-950/30 text-cyan-400 text-[9px] font-black rounded-lg border border-cyan-800/40 uppercase tracking-tighter">Trang nội bộ</span>
                                            )}
                                        </td>
                                        <td className="p-5 font-mono text-[10px] text-gray-500 truncate max-w-[180px]">
                                            {item.type === 'EXTERNAL' ? item.url : item.id}
                                        </td>
                                        <td className="p-5">
                                            <div className="flex flex-wrap gap-1">
                                                {item.roles.map(r => (
                                                    <span key={r} className="text-[8px] font-black px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 uppercase">{r}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => openModal(item)} disabled={!canEditMenu} className="p-2.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"><Edit2 size={16}/></button>
                                                <button onClick={() => handleDelete(item.id)} disabled={!canDeleteMenu} className="p-2.5 bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── NHÓM TIỆN ÍCH ── */}
            <div className="bg-gray-900/50 border border-violet-800/30 rounded-[2rem] shadow-2xl overflow-hidden backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800 bg-gray-950/50">
                    <div className="flex items-center gap-3">
                        <FolderCog size={16} className="text-violet-400" />
                        <span className="text-xs text-gray-400 font-black uppercase tracking-wider">Nhóm Tiện ích (hiển thị dưới menu chính)</span>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest">
                        {toolsSaveState === 'saving' && <span className="text-amber-400 flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Đang lưu</span>}
                        {toolsSaveState === 'saved' && <span className="text-emerald-400">Đã lưu</span>}
                        {toolsSaveState === 'error' && <span className="text-red-400">Lỗi lưu</span>}
                    </div>
                </div>
                <div className="p-5 space-y-3">
                    {sidebarTools.map((tool, idx) => {
                        const ToolIcon = (Icons as any)[tool.icon] as React.ElementType | undefined;
                        return (
                            <div key={tool.id} className={`rounded-2xl border p-4 transition-all ${tool.enabled ? 'border-gray-700 bg-gray-900/60' : 'border-gray-800 bg-gray-950/60 opacity-60'}`}>
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col gap-0.5 shrink-0">
                                        <button onClick={() => moveTool(idx, 'up')} disabled={idx === 0} className="p-1 rounded text-gray-600 hover:text-white disabled:opacity-20 transition-colors"><ChevronUp size={13} /></button>
                                        <button onClick={() => moveTool(idx, 'down')} disabled={idx === sidebarTools.length - 1} className="p-1 rounded text-gray-600 hover:text-white disabled:opacity-20 transition-colors"><ChevronDown size={13} /></button>
                                    </div>
                                    <div className="w-9 h-9 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
                                        {ToolIcon ? <ToolIcon size={17} className="text-violet-400" /> : <FolderCog size={17} className="text-gray-500" />}
                                    </div>
                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="text-[9px] uppercase tracking-widest text-gray-600 font-black mb-1">Tên hiển thị</div>
                                            <input
                                                value={tool.label}
                                                onChange={e => updateTool(idx, { label: e.target.value })}
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs font-bold outline-none focus:border-violet-500 transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <div className="text-[9px] uppercase tracking-widest text-gray-600 font-black mb-1">Biểu tượng</div>
                                            <select
                                                value={tool.icon}
                                                onChange={e => updateTool(idx, { icon: e.target.value })}
                                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs font-bold outline-none focus:border-violet-500 transition-colors"
                                            >
                                                {TOOL_ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className={`text-[9px] font-black uppercase ${tool.enabled ? 'text-emerald-400' : 'text-gray-600'}`}>
                                            {tool.enabled ? 'Hiện' : 'Ẩn'}
                                        </span>
                                        <button
                                            onClick={() => updateTool(idx, { enabled: !tool.enabled })}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${tool.enabled ? 'bg-emerald-600' : 'bg-gray-700'}`}
                                        >
                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${tool.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-2 pl-[76px] text-[9px] text-gray-700 font-mono">{tool.path}</div>
                            </div>
                        );
                    })}
                </div>
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
                                    <button onClick={() => setDialog({ ...dialog, isOpen: false })} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all">ĐÓNG</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CẤU HÌNH */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[#1a1f2e] rounded-[2.5rem] w-full max-w-md p-8 border border-gray-700 shadow-[0_20px_80px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Cấu hình Mục Menu</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-all"><X size={28}/></button>
                        </div>

                        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar no-scrollbar">
                            <div>
                                <label className="text-[10px] text-gray-500 font-black uppercase mb-3 block tracking-[0.15em]">Loại Menu</label>
                                <div className="grid grid-cols-2 gap-2 bg-[#0d1117] p-1.5 rounded-2xl border border-gray-700/50">
                                    <button 
                                        type="button"
                                        onClick={() => setFormData({...formData, type: 'INTERNAL', id: ''})}
                                        className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black uppercase transition-all ${formData.type === 'INTERNAL' ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/30' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        <Monitor size={16}/> Trang Nội Bộ
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setFormData({...formData, type: 'EXTERNAL'})}
                                        className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black uppercase transition-all ${formData.type === 'EXTERNAL' ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/30' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        <Globe size={16}/> Link Bên Ngoài
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] text-gray-500 font-black uppercase mb-2 block tracking-[0.15em]">Nhãn hiển thị *</label>
                                <input 
                                    className="w-full bg-[#0d1117] border border-gray-700 rounded-2xl p-4 text-white outline-none focus:border-blue-500 transition-all font-bold text-lg placeholder:text-gray-700" 
                                    value={formData.label || ''} 
                                    onChange={e => handleLabelChange(e.target.value)} 
                                    placeholder="Nhập tên trang..."
                                />
                            </div>
                            
                            {formData.type === 'INTERNAL' ? (
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="col-span-3">
                                        <label className="text-[10px] text-gray-500 font-black uppercase mb-2 block tracking-[0.15em]">Mã trang (Router ID) *</label>
                                        <input className="w-full bg-[#0d1117] border border-gray-700 rounded-2xl p-4 text-white font-mono text-sm outline-none focus:border-blue-500 transition-all" value={formData.id || ''} onChange={e => setFormData({...formData, id: sanitizeInternalId(e.target.value)})} placeholder="vd: map" disabled={isEditMode} />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[10px] text-gray-500 font-black uppercase mb-2 block tracking-[0.15em]">Thứ tự</label>
                                        <input type="number" className="w-full bg-[#0d1117] border border-gray-700 rounded-2xl p-4 text-white text-center font-black outline-none focus:border-blue-500 transition-all" value={formData.order_index || 0} onChange={e => setFormData({...formData, order_index: normalizeOrderIndex(e.target.value)})} />
                                    </div>
                                    <div className="col-span-4">
                                        <label className="text-[10px] text-gray-500 font-black uppercase mb-2 block tracking-[0.15em]">Đường dẫn nội bộ (không bắt buộc)</label>
                                        <input
                                            className="w-full bg-[#0d1117] border border-gray-700 rounded-2xl p-4 text-white font-mono text-sm outline-none focus:border-blue-500 transition-all"
                                            value={formData.url || ''}
                                            onChange={e => setFormData({...formData, url: e.target.value.trim()})}
                                            placeholder="vd: /thongke"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] text-orange-400 font-black uppercase mb-2 block tracking-[0.15em]">Địa chỉ URL Link *</label>
                                        <div className="relative">
                                            <LinkIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <input className="w-full bg-[#0d1117] border border-orange-900/30 rounded-2xl p-4 pl-12 text-white font-mono text-sm outline-none focus:border-orange-500 transition-all shadow-inner" value={formData.url || ''} onChange={e => setFormData({...formData, url: e.target.value})} placeholder="https://example.com" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] text-gray-500 font-black uppercase mb-2 block tracking-[0.15em]">Mã ID (Tự sinh)</label>
                                            <input className="w-full bg-[#0d1117] border border-gray-700 rounded-2xl p-4 text-gray-500 font-mono text-xs outline-none" value={formData.id || ''} disabled />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 font-black uppercase mb-2 block tracking-[0.15em]">Thứ tự</label>
                                            <input type="number" className="w-full bg-[#0d1117] border border-gray-700 rounded-2xl p-4 text-white text-center font-black outline-none" value={formData.order_index || 0} onChange={e => setFormData({...formData, order_index: normalizeOrderIndex(e.target.value)})} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] text-gray-500 font-black uppercase mb-2 block tracking-[0.15em]">Chọn Icon *</label>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                        <input className="w-full bg-[#0d1117] border border-gray-700 rounded-2xl p-3 pl-12 text-xs text-white outline-none focus:border-blue-500 transition-all placeholder:text-gray-700" placeholder="Tìm kiếm icon (vd: map, home, chart)..." value={iconSearch} onChange={e => setIconSearch(e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-6 gap-3 p-3 bg-[#0d1117] rounded-3xl border border-gray-800 max-h-40 overflow-y-auto custom-scrollbar shadow-inner">
                                        {availableIcons.length === 0 ? (
                                            <div className="col-span-6 py-6 text-center text-gray-600 text-[10px] uppercase font-bold italic">Không thấy icon nào</div>
                                        ) : availableIcons.map(name => {
                                            const Icon = (Icons as any)[name];
                                            const isSelected = formData.icon === name;
                                            return (
                                                <button 
                                                    key={name} 
                                                    type="button"
                                                    onClick={() => setFormData({...formData, icon: name})} 
                                                    className={`p-3 rounded-2xl flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800/50 text-gray-500 hover:bg-gray-800 hover:text-gray-300'}`}
                                                    title={name}
                                                >
                                                    <Icon size={20} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] text-gray-500 font-black uppercase mb-3 block tracking-[0.15em]">Quyền xem</label>
                                <div className="flex flex-wrap gap-2">
                                    {['GUEST', UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER].map(role => {
                                        const isSelected = formData.roles?.includes(role);
                                        return (
                                            <button 
                                                key={role} 
                                                type="button"
                                                onClick={() => toggleRole(role)} 
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all flex items-center gap-2 ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-[#0d1117] border-gray-700 text-gray-600 hover:border-gray-500'}`}
                                            >
                                                {isSelected && <Check size={12} />}
                                                {role}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 mt-10 pt-6 border-t border-gray-800">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-4 text-gray-500 hover:text-white font-black text-sm uppercase tracking-widest transition-colors">HỦY</button>
                            <button type="button" onClick={handleSave} disabled={loading || (isEditMode ? !canEditMenu : !canCreateMenu)} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black text-sm shadow-[0_10px_30px_rgba(37,99,235,0.3)] flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest">
                                {loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} 
                                {isEditMode ? "Lưu thay đổi" : "Thêm mục mới"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MenuManager;
