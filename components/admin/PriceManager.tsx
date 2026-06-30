
import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/apiClient';
import { LandPriceConfig } from '../../types';
import { Calculator, Plus, Edit2, Trash2, X, Save, DollarSign, Tag } from 'lucide-react';

const PriceManager: React.FC = () => {
    const [prices, setPrices] = useState<LandPriceConfig[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const data = await adminService.getPrices();
            setPrices(data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSave = async () => {
        try {
            if (editingId) await adminService.updatePrice({ ...formData });
            else await adminService.addPrice(formData);
            setIsModalOpen(false);
            loadData();
        } catch (e: any) {
            alert("Lỗi: " + e.message);
        }
    };

    const handleDelete = async (landType: string) => {
        if (confirm(`Xóa cấu hình giá cho loại đất ${landType}?`)) {
            try {
                await adminService.deletePrice(landType);
                loadData();
            } catch (e: any) {
                alert(e.message);
            }
        }
    };

    return (
        <div className="p-8">
            <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
                <div className="p-4 flex justify-between border-b border-gray-700 bg-gray-800/50">
                    <span className="font-semibold text-gray-300 flex items-center gap-2">
                        <Calculator size={18} /> Quản lý Bảng giá đất theo Loại
                    </span>
                    <button 
                        onClick={() => { setEditingId(null); setFormData({}); setIsModalOpen(true); }} 
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-sm font-medium"
                    >
                        + Thêm Loại Giá
                    </button>
                </div>
                <table className="w-full text-sm text-left text-gray-300">
                    <thead className="bg-gray-900 text-gray-400 uppercase text-xs">
                        <tr>
                            <th className="p-4">Loại Đất (Mã)</th>
                            <th className="p-4">Mô tả</th>
                            <th className="p-4 text-right">Giá cơ sở (VNĐ/m²)</th>
                            <th className="p-4 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {prices.map(p => (
                            <tr key={p.landType} className="hover:bg-gray-700/50 transition-colors">
                                <td className="p-4"><span className="bg-blue-900/40 text-blue-300 px-2 py-1 rounded font-bold border border-blue-800">{p.landType}</span></td>
                                <td className="p-4 text-gray-400">{p.description}</td>
                                <td className="p-4 text-right font-mono text-green-400 font-bold">{Number(p.basePrice).toLocaleString()}</td>
                                <td className="p-4 flex justify-end gap-3">
                                    <button onClick={() => { setEditingId(p.landType); setFormData(p); setIsModalOpen(true); }} className="text-blue-400 hover:text-white">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(p.landType)} className="text-red-400 hover:text-white">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-gray-800 rounded-xl w-full max-w-md p-6 border border-gray-700 shadow-2xl">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
                            <h3 className="text-xl font-bold text-white">{editingId ? "Cập nhật giá đất" : "Thêm cấu hình giá mới"}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase">Loại đất (Mã hiệu)</label>
                                <input 
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white outline-none focus:border-blue-500" 
                                    value={formData.landType || ''} 
                                    onChange={e => setFormData({ ...formData, landType: e.target.value.toUpperCase() })} 
                                    placeholder="VD: ODT" 
                                    disabled={!!editingId}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase">Giá cơ sở (VNĐ/m²)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-3 text-gray-500" size={16} />
                                    <input type="number" className="w-full bg-gray-900 border border-gray-600 rounded p-2.5 pl-10 text-white outline-none focus:border-blue-500" value={formData.basePrice || ''} onChange={e => setFormData({ ...formData, basePrice: parseFloat(e.target.value) })} placeholder="0" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase">Mô tả chi tiết</label>
                                <textarea className="w-full bg-gray-900 border border-gray-600 rounded p-2.5 text-white outline-none focus:border-blue-500 h-24" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="VD: Đất ở tại đô thị..." />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Hủy</button>
                            <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold shadow-lg flex items-center gap-2">
                                <Save size={18} /> Lưu lại
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PriceManager;
