
import React, { useState, useEffect } from 'react';
import { adminService, hasAnyPermission } from '../../services/mockBackend';
import { LandPrice2026 } from '../../types';
import { Search, Plus, Edit2, Trash2, X, Save, Coins, MapPin, Landmark, ArrowRight, Loader2, AlertCircle, Filter, Database, Info } from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import AutocompleteInput from '../common/AutocompleteInput';

interface LandPrice2026ManagerProps {
    permissions?: string[];
}

const LandPrice2026Manager: React.FC<LandPrice2026ManagerProps> = ({ permissions = [] }) => {
    const [data, setData] = useState<LandPrice2026[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    
    // Search Filters
    const [phuongxa, setPhuongxa] = useState('');
    const [tenduong, setTenduong] = useState('');
    
    // Suggestions data
    const [wards, setWards] = useState<string[]>([]);
    const [streets, setStreets] = useState<string[]>([]);

    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [editingId, setEditingId] = useState<number | null>(null);

    const canCreateLandPrice = hasAnyPermission(permissions, ['CREATE_LAND_PRICES', 'MANAGE_LAND_PRICES']);
    const canEditLandPrice = hasAnyPermission(permissions, ['EDIT_LAND_PRICES', 'MANAGE_LAND_PRICES']);
    const canDeleteLandPrice = hasAnyPermission(permissions, ['DELETE_LAND_PRICES', 'MANAGE_LAND_PRICES']);

    // 1. Load danh sách phường ban đầu
    useEffect(() => {
        const fetchWards = async () => {
            try {
                const wData = await adminService.getLandPriceWards();
                setWards(wData);
            } catch (e) {}
        };
        fetchWards();
    }, []);

    // 2. Tự động cập nhật gợi ý đường khi Phường/Xã thay đổi
    useEffect(() => {
        const fetchStreetSuggestions = async () => {
            try {
                // Tách tên phường nếu label có dạng "Tên Phường (Tỉnh Cũ)"
                const sData = await adminService.getLandPriceSuggestions(phuongxa);
                setStreets(sData.streets);
                
                // Nếu phường thay đổi, có thể xóa tên đường cũ nếu nó không thuộc phường mới (tùy chọn)
                // if (phuongxa && !sData.streets.includes(tenduong)) setTenduong('');
            } catch (e) {
                console.error("Lỗi lấy gợi ý đường:", e);
            }
        };

        const timer = setTimeout(() => {
            fetchStreetSuggestions();
        }, 300); // Debounce nhẹ để tránh gọi API liên tục khi gõ

        return () => clearTimeout(timer);
    }, [phuongxa]);

    const handleSearch = async () => {
        setLoading(true);
        setHasSearched(true);
        try {
            const results = await adminService.searchLandPrices2026(phuongxa, tenduong, undefined, undefined, { limit: 300 });
            setData(results);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (editingId ? !canEditLandPrice : !canCreateLandPrice) {
            alert(editingId ? 'Bạn không có quyền cập nhật giá đất.' : 'Bạn không có quyền thêm giá đất mới.');
            return;
        }
        if (!formData.phuongxa || !formData.tenduong || !formData.dato) {
            alert("Vui lòng nhập đầy đủ các trường bắt buộc (*)");
            return;
        }

        setLoading(true);
        try {
            if (editingId) {
                await adminService.updateLandPrice2026(editingId, formData);
            } else {
                await adminService.addLandPrice2026(formData);
            }
            setIsModalOpen(false);
            handleSearch(); // Refresh current search view
        } catch (e: any) {
            alert("Lỗi: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!canDeleteLandPrice) {
            alert('Bạn không có quyền xóa giá đất.');
            return;
        }
        if (confirm(`Xóa dòng giá đất tại đường ${name}?`)) {
            try {
                await adminService.deleteLandPrice2026(id);
                handleSearch();
            } catch (e: any) {
                alert(e.message);
            }
        }
    };

    const openEdit = (item: LandPrice2026) => {
        if (!canEditLandPrice) {
            alert('Bạn không có quyền chỉnh sửa giá đất.');
            return;
        }
        setEditingId(item.id);
        setFormData({ ...item });
        setIsModalOpen(true);
    };

    const openAdd = () => {
        if (!canCreateLandPrice) {
            alert('Bạn không có quyền thêm giá đất mới.');
            return;
        }
        setEditingId(null);
        setFormData({
            phuongxa: '', tenduong: '', tinhcu: 'TP.HCM', 
            tu: '', den: '', dato: 0, dattmdv: 0, datsxkdpnn: 0,
            nam_ap_dung: 2026
        });
        setIsModalOpen(true);
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            {/* Toolbar Tìm kiếm thông minh */}
            <div className="bg-gray-800 p-6 rounded-[2.5rem] border border-gray-700 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <Filter className="text-blue-500" size={18}/>
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Bộ lọc quản lý</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                    <AutocompleteInput 
                        label="Phường / Xã"
                        icon={<MapPin size={12}/>}
                        value={phuongxa}
                        onChange={setPhuongxa}
                        suggestions={wards}
                        placeholder="Chọn hoặc gõ tên phường..."
                    />

                    <AutocompleteInput 
                        label="Tên đường"
                        icon={<Search size={12}/>}
                        value={tenduong}
                        onChange={setTenduong}
                        suggestions={streets}
                        placeholder={phuongxa ? `Đường tại ${phuongxa}...` : "Nhập tên tuyến đường..."}
                        disabled={loading}
                    />

                    <div className="flex gap-2">
                        <button 
                            onClick={handleSearch}
                            disabled={loading}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-blue-900/30 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" size={16}/> : <Search size={16}/>} LỌC DỮ LIỆU
                        </button>
                        <button 
                            onClick={openAdd}
                            disabled={!canCreateLandPrice}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white p-4 rounded-2xl font-black shadow-xl shadow-emerald-900/30 transition-all active:scale-95"
                            title="Thêm tuyến đường mới"
                        >
                            <Plus size={20}/>
                        </button>
                    </div>
                </div>
            </div>

            {/* Vùng hiển thị kết quả */}
            {!hasSearched ? (
                <div className="bg-gray-800/30 border-2 border-dashed border-gray-700 rounded-[3rem] p-24 flex flex-col items-center justify-center text-center gap-6">
                    <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700">
                        <Database className="text-gray-600" size={32} />
                    </div>
                    <div className="max-w-xs">
                        <p className="text-sm font-black text-gray-500 uppercase tracking-widest mb-2">Chế độ chờ truy vấn</p>
                        <p className="text-xs text-gray-600 font-bold leading-relaxed">Nhập thông tin Phường hoặc Đường ở trên để bắt đầu quản trị dữ liệu giá đất.</p>
                    </div>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-3xl border border-gray-700 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                    <div className="p-5 border-b border-gray-700 bg-gray-800/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-500/20 p-2 rounded-lg"><Coins className="text-amber-500" size={18} /></div>
                            <div>
                                <span className="font-bold text-gray-200 block leading-none">Kết quả lọc dữ liệu</span>
                                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Tìm thấy {data.length} bản ghi</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-900 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b border-gray-700">
                                <tr>
                                    <th className="p-4">Khu vực / Tên đường</th>
                                    <th className="p-4">Đoạn đường</th>
                                    <th className="p-4 text-right text-emerald-400">Đất Ở</th>
                                    <th className="p-4 text-right text-blue-400">TMDV</th>
                                    <th className="p-4 text-right text-orange-400">SXKD</th>
                                    <th className="p-4 text-right">Quản lý</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700 text-gray-300">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-20 text-center"><Loader2 className="animate-spin mx-auto mb-2 text-blue-500" size={32}/> Đang truy xuất...</td></tr>
                                ) : data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-20 text-center">
                                            <div className="flex flex-col items-center gap-3 text-gray-600">
                                                <Info size={32} />
                                                <p className="font-bold italic">Không tìm thấy dữ liệu giá đất nào phù hợp.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : data.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-700/30 transition-colors group">
                                        <td className="p-4">
                                            <div className="font-bold text-white group-hover:text-blue-400 transition-colors">{item.tenduong}</div>
                                            <div className="text-[10px] text-gray-500 font-bold uppercase mt-1 flex items-center gap-1">
                                                <MapPin size={10}/> {item.phuongxa} | {item.tinhcu}
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate max-w-[120px]">{item.tu || 'Đầu đường'}</span>
                                                <ArrowRight size={10} className="shrink-0"/>
                                                <span className="truncate max-w-[120px]">{item.den || 'Cuối đường'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono font-black text-emerald-500">
                                            {formatCurrency(item.dato)}
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold text-blue-400">
                                            {formatCurrency(item.dattmdv)}
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold text-orange-400">
                                            {formatCurrency(item.datsxkdpnn)}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => openEdit(item)} disabled={!canEditLandPrice} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed" title="Sửa"><Edit2 size={16}/></button>
                                                <button onClick={() => handleDelete(item.id, item.tenduong)} disabled={!canDeleteLandPrice} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed" title="Xóa"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Form remains the same but handles search refresh */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                <Coins className="text-amber-500"/>
                                {editingId ? 'Cập nhật giá đất' : 'Thêm tuyến đường mới'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-all"><X size={28}/></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar no-scrollbar">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-l-2 border-blue-500 pl-2">Vị trí hành chính</h4>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-gray-500 font-bold uppercase">Tên đường *</label>
                                    <input className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white font-bold outline-none focus:border-blue-500 shadow-inner" value={formData.tenduong || ''} onChange={e => setFormData({...formData, tenduong: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-gray-500 font-bold uppercase">Phường / Xã *</label>
                                    <input className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 shadow-inner" value={formData.phuongxa || ''} onChange={e => setFormData({...formData, phuongxa: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-gray-500 font-bold uppercase">Quận / Huyện / Tỉnh cũ</label>
                                    <input className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 shadow-inner" value={formData.tinhcu || ''} onChange={e => setFormData({...formData, tinhcu: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Từ điểm</label>
                                        <input className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs text-white" value={formData.tu || ''} onChange={e => setFormData({...formData, tu: e.target.value})} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Đến điểm</label>
                                        <input className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs text-white" value={formData.den || ''} onChange={e => setFormData({...formData, den: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest border-l-2 border-emerald-500 pl-2">Giá quy định (x1000 VNĐ)</h4>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-emerald-500 font-bold uppercase">Giá đất Ở (ODT) *</label>
                                    <input type="number" className="w-full bg-gray-950 border border-emerald-900/30 rounded-xl p-3 text-emerald-400 font-mono font-bold outline-none" value={formData.dato || 0} onChange={e => setFormData({...formData, dato: parseFloat(e.target.value)})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-blue-400 font-bold uppercase">Giá đất TMDV</label>
                                    <input type="number" className="w-full bg-gray-950 border border-blue-900/30 rounded-xl p-3 text-blue-400 font-mono outline-none" value={formData.dattmdv || 0} onChange={e => setFormData({...formData, dattmdv: parseFloat(e.target.value)})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-orange-400 font-bold uppercase">Giá đất SXKD</label>
                                    <input type="number" className="w-full bg-gray-950 border border-orange-900/30 rounded-xl p-3 text-orange-400 font-mono outline-none" value={formData.datsxkdpnn || 0} onChange={e => setFormData({...formData, datsxkdpnn: parseFloat(e.target.value)})} />
                                </div>
                                <div className="pt-4 border-t border-gray-800">
                                    <label className="text-[10px] text-gray-500 font-bold uppercase mb-2 block">Ghi chú</label>
                                    <textarea className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs text-white h-20 resize-none outline-none focus:border-blue-500" value={formData.ghi_chu || ''} onChange={e => setFormData({...formData, ghi_chu: e.target.value})} placeholder="..." />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 mt-10 pt-6 border-t border-gray-800">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-500 hover:text-white font-black uppercase text-xs tracking-widest transition-all">HỦY BỎ</button>
                            <button 
                                onClick={handleSave} 
                                disabled={loading || (editingId ? !canEditLandPrice : !canCreateLandPrice)}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} 
                                {editingId ? 'LƯU THAY ĐỔI' : 'XÁC NHẬN THÊM'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandPrice2026Manager;
