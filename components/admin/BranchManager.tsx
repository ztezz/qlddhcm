
import React, { useEffect, useMemo, useState } from 'react';
import { adminService, hasAnyPermission } from '../../services/mockBackend';
import { Branch } from '../../types';
import {
    AlertTriangle,
    Building2,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Edit2,
    Loader2,
    Plus,
    RefreshCw,
    Save,
    Search,
    ShieldAlert,
    Trash2,
    X,
} from 'lucide-react';
import { removeAccents } from '../../utils/helpers';

interface BranchManagerProps {
    permissions?: string[];
}

const BranchManager: React.FC<BranchManagerProps> = ({ permissions = [] }) => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 8;

    const [formData, setFormData] = useState<{ code: string; name: string; address: string }>({ code: '', name: '', address: '' });
    const [formErrors, setFormErrors] = useState<{ code?: string; name?: string; address?: string }>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const canCreateBranch = useMemo(() => hasAnyPermission(permissions, ['CREATE_BRANCHES', 'MANAGE_BRANCHES']), [permissions]);
    const canEditBranch = useMemo(() => hasAnyPermission(permissions, ['EDIT_BRANCHES', 'MANAGE_BRANCHES']), [permissions]);
    const canDeleteBranch = useMemo(() => hasAnyPermission(permissions, ['DELETE_BRANCHES', 'MANAGE_BRANCHES']), [permissions]);
    const canMutate = canCreateBranch || canEditBranch || canDeleteBranch;

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const data = await adminService.getBranches();
            setBranches(data);
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: 'Không thể tải danh sách chi nhánh.' });
        } finally {
            setLoading(false);
        }
    };

    const filteredBranches = useMemo(() => {
        const q = removeAccents(searchQuery.trim());
        if (!q) return branches;
        return branches.filter((b) =>
            [b.code, b.name, b.address].some((value) => removeAccents(String(value || '')).includes(q))
        );
    }, [branches, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredBranches.length / pageSize));

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const paginatedBranches = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredBranches.slice(start, start + pageSize);
    }, [filteredBranches, currentPage]);

    const resetModalState = () => {
        setEditingId(null);
        setFormErrors({});
        setFormData({ code: '', name: '', address: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (branch: Branch) => {
        if (!canEditBranch) {
            setMessage({ type: 'error', text: 'Bạn không có quyền sửa chi nhánh.' });
            return;
        }
        setEditingId(branch.id);
        setFormErrors({});
        setFormData({
            code: String(branch.code || ''),
            name: String(branch.name || ''),
            address: String(branch.address || ''),
        });
        setIsModalOpen(true);
    };

    const validateForm = () => {
        const errors: { code?: string; name?: string; address?: string } = {};
        const code = formData.code.trim().toUpperCase();
        const name = formData.name.trim();
        const address = formData.address.trim();

        if (!code) {
            errors.code = 'Mã chi nhánh không được để trống.';
        } else if (!/^[A-Z0-9_-]{2,20}$/.test(code)) {
            errors.code = 'Mã chỉ gồm A-Z, số, dấu gạch dưới hoặc gạch ngang (2-20 ký tự).';
        }

        if (!name) {
            errors.name = 'Tên chi nhánh không được để trống.';
        } else if (name.length < 3) {
            errors.name = 'Tên chi nhánh phải có ít nhất 3 ký tự.';
        }

        if (!address) {
            errors.address = 'Địa chỉ không được để trống.';
        } else if (address.length < 5) {
            errors.address = 'Địa chỉ phải có ít nhất 5 ký tự.';
        }

        const duplicatedCode = branches.some(
            (b) => b.id !== editingId && String(b.code || '').toUpperCase() === code
        );
        if (duplicatedCode) {
            errors.code = 'Mã chi nhánh đã tồn tại.';
        }

        const duplicatedName = branches.some(
            (b) => b.id !== editingId && String(b.name || '').trim().toLowerCase() === name.toLowerCase()
        );
        if (duplicatedName) {
            errors.name = 'Tên chi nhánh đã tồn tại.';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!canMutate) {
            setMessage({ type: 'error', text: 'Bạn không có quyền thao tác chi nhánh.' });
            return;
        }

        if (!validateForm()) return;

        setSaving(true);
        setMessage(null);
        try {
            const payload = {
                code: formData.code.trim().toUpperCase(),
                name: formData.name.trim(),
                address: formData.address.trim(),
            };

            if (editingId) await adminService.updateBranch({ ...payload, id: editingId });
            else await adminService.addBranch(payload);

            setMessage({ type: 'success', text: editingId ? 'Đã cập nhật chi nhánh.' : 'Đã thêm chi nhánh mới.' });
            setIsModalOpen(false);
            await loadData();
        } catch (e: any) {
            setMessage({ type: 'error', text: e?.message || 'Lưu dữ liệu thất bại.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!canMutate) {
            setMessage({ type: 'error', text: 'Bạn không có quyền xóa chi nhánh.' });
            return;
        }

        if (confirm("Bạn có chắc chắn muốn xóa chi nhánh này?")) {
            try {
                await adminService.deleteBranch(id);
                setMessage({ type: 'success', text: 'Đã xóa chi nhánh.' });
                await loadData();
            } catch (e: any) {
                setMessage({ type: 'error', text: e?.message || 'Xóa chi nhánh thất bại.' });
            }
        }
    };

    return (
        <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Tổng chi nhánh', value: branches.length },
                    { label: 'Theo bộ lọc', value: filteredBranches.length },
                    { label: 'Trang hiện tại', value: currentPage },
                    { label: 'Tổng số trang', value: totalPages },
                ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-blue-900/50 bg-blue-950/20 p-3">
                        <p className="text-xl font-black text-white leading-none">{item.value}</p>
                        <p className="text-[10px] uppercase tracking-wide text-blue-300/80 mt-1">{item.label}</p>
                    </div>
                ))}
            </div>

            {message && (
                <div className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${message.type === 'success' ? 'border-emerald-700 bg-emerald-900/20 text-emerald-300' : 'border-red-700 bg-red-900/20 text-red-300'}`}>
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{message.text}</span>
                </div>
            )}

            {!canMutate && (
                <div className="rounded-lg border border-amber-700 bg-amber-900/20 text-amber-300 px-4 py-3 text-sm flex items-center gap-2">
                    <ShieldAlert size={16} />
                    <span>Tài khoản hiện tại chỉ có quyền xem danh sách chi nhánh.</span>
                </div>
            )}

            <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
                <div className="p-4 flex flex-col md:flex-row md:items-center gap-3 border-b border-gray-700 bg-gray-800/50">
                    <span className="font-semibold text-gray-300 flex items-center gap-2 flex-shrink-0">
                        <Building2 size={18} /> Quản lý Chi nhánh
                    </span>

                    <div className="relative flex-1 md:max-w-md">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Tìm theo mã, tên hoặc địa chỉ..."
                            className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                        />
                    </div>

                    <button
                        onClick={loadData}
                        title="Tải lại"
                        className="p-2 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    </button>

                    <button 
                        onClick={resetModalState}
                        disabled={!canMutate}
                        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded text-sm font-medium flex items-center gap-2"
                    >
                        <Plus size={14} /> Thêm Chi nhánh
                    </button>
                </div>
                <table className="w-full text-sm text-left text-gray-300">
                    <thead className="bg-gray-900 text-gray-400 uppercase text-xs">
                        <tr>
                            <th className="p-4">Mã</th>
                            <th className="p-4">Tên Chi nhánh</th>
                            <th className="p-4">Địa chỉ</th>
                            <th className="p-4 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {paginatedBranches.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-gray-500 italic">
                                    {loading ? 'Đang tải danh sách chi nhánh...' : 'Không có dữ liệu phù hợp.'}
                                </td>
                            </tr>
                        ) : paginatedBranches.map((b) => (
                            <tr key={b.id} className="hover:bg-gray-700/50 transition-colors">
                                <td className="p-4 font-mono text-blue-400">{b.code}</td>
                                <td className="p-4 font-medium text-white">{b.name}</td>
                                <td className="p-4 text-gray-400 text-xs">{b.address}</td>
                                <td className="p-4 flex justify-end gap-3">
                                    <button
                                        onClick={() => openEditModal(b)}
                                        disabled={!canMutate}
                                        className="text-blue-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Sửa"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(b.id)}
                                        disabled={!canMutate}
                                        className="text-red-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Xóa"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/50 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-400">
                        Hiển thị {(filteredBranches.length === 0 ? 0 : (currentPage - 1) * pageSize + 1)}-
                        {Math.min(currentPage * pageSize, filteredBranches.length)} / {filteredBranches.length} kết quả
                    </p>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded border border-gray-600 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-xs text-gray-300 px-2">
                            Trang {currentPage}/{totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded border border-gray-600 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-gray-800 rounded-xl w-full max-w-md p-6 border border-gray-700 shadow-2xl">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
                            <h3 className="text-xl font-bold text-white">{editingId ? "Sửa chi nhánh" : "Thêm chi nhánh mới"}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase">Mã Chi nhánh</label>
                                <input
                                    className={`w-full bg-gray-900 border rounded p-2.5 text-white outline-none focus:border-green-500 ${formErrors.code ? 'border-red-500' : 'border-gray-600'}`}
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="VD: CN_HCM"
                                />
                                {formErrors.code && <p className="text-[11px] text-red-400 mt-1">{formErrors.code}</p>}
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase">Tên Chi nhánh</label>
                                <input
                                    className={`w-full bg-gray-900 border rounded p-2.5 text-white outline-none focus:border-green-500 ${formErrors.name ? 'border-red-500' : 'border-gray-600'}`}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="VD: Chi nhánh TP. Hồ Chí Minh"
                                />
                                {formErrors.name && <p className="text-[11px] text-red-400 mt-1">{formErrors.name}</p>}
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase">Địa chỉ</label>
                                <textarea
                                    className={`w-full bg-gray-900 border rounded p-2.5 text-white outline-none focus:border-green-500 h-20 ${formErrors.address ? 'border-red-500' : 'border-gray-600'}`}
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Nhập địa chỉ trụ sở..."
                                />
                                {formErrors.address && <p className="text-[11px] text-red-400 mt-1">{formErrors.address}</p>}
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Hủy</button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !canMutate}
                                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded font-bold shadow-lg flex items-center gap-2"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={18} />} Lưu lại
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchManager;
