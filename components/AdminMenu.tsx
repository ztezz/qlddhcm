
import React, { useState } from 'react';
import { Users, Building2, Calculator, Map, FileText, Settings, Database, Layers, ShieldCheck, LayoutList, BellRing, Coins, Menu, X, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminMenuProps {
    activeTab: string;
    onSelect: (tab: any) => void;
    systemName?: string;
    logoUrl?: string;
    allowedTabs?: string[];
}

const AdminMenu: React.FC<AdminMenuProps> = ({ activeTab, onSelect, systemName, logoUrl, allowedTabs }) => {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const navigate = useNavigate();

    const menuItems = [
        { header: 'Điều hướng' },
        { id: 'BACK_TO_APP', icon: ArrowLeft, label: 'Quay lại Bản đồ', isLink: true, path: '/' },

        { header: 'Hệ thống' },
        { id: 'USERS', icon: Users, label: 'Người dùng' },
        { id: 'PRICES_2026', icon: Coins, label: 'Quản lý Bảng giá đất', highlight: true },
        { id: 'NOTIFICATIONS', icon: BellRing, label: 'Thông báo hệ thống' },
        { id: 'PERMISSIONS', icon: ShieldCheck, label: 'Phân quyền & Vai trò' },
        { id: 'BRANCHES', icon: Building2, label: 'Chi nhánh' },
        { id: 'LOGS', icon: FileText, label: 'Nhật ký (Logs)' },
        
        { header: 'Giao diện & Điều hướng' },
        { id: 'MENU_MANAGER', icon: LayoutList, label: 'Quản lý Sidebar', highlight: true },
        { id: 'SETTINGS', icon: Settings, label: 'Thiết lập hệ thống', highlight: true },

        { header: 'Nghiệp vụ Đất đai' },
        { id: 'PARCEL_MANAGER', icon: Map, label: 'Quản lý Thửa đất', highlight: true },
        { id: 'PDF_SETTINGS', icon: FileText, label: 'Cấu hình Tài liệu & PDF', highlight: true },
        
        { header: 'Cấu hình Dữ liệu' },
        { id: 'DATA_LAYERS', icon: Layers, label: 'Lớp bản đồ & DB' },
    ];

    const visibleMenuItems = menuItems.filter((item: any) => {
        if (item.header) return true;
        if (item.isLink) return true;
        if (!allowedTabs || allowedTabs.length === 0) return true;
        return allowedTabs.includes(item.id);
    });

    const handleSelect = (item: any) => {
        if (item.isLink) {
            navigate(item.path);
        } else {
            onSelect(item.id);
        }
        setIsMobileOpen(false);
    };

    return (
        <>
            {/* Mobile Toggle */}
            <button 
                onClick={() => setIsMobileOpen(true)}
                className="md:hidden fixed top-4 left-4 z-[500] p-2 bg-gray-800 text-white rounded-lg shadow-lg border border-gray-700"
            >
                <Menu size={20} />
            </button>

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div 
                    className="md:hidden fixed inset-0 bg-black/60 z-[500] backdrop-blur-sm"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed md:relative z-[510] w-64 bg-gray-800 h-screen md:h-full border-r border-gray-700 flex flex-col shadow-xl shrink-0 transition-transform duration-300 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-6 border-b border-gray-700 bg-gray-900/50 flex justify-between items-start">
                    <div>
                        {logoUrl ? (
                            <div className="flex items-center gap-3 mb-2">
                                <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                                <h3 className="text-white font-bold text-sm">
                                    {systemName || 'Quản Trị Viên'}
                                </h3>
                            </div>
                        ) : (
                            <h3 className="text-white font-bold flex items-center gap-2 text-lg">
                                <Database className="text-blue-500" />
                                Quản Trị Viên
                            </h3>
                        )}
                        <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-tighter">Hệ thống GIS Trung tâm</p>
                    </div>
                    <button 
                        onClick={() => setIsMobileOpen(false)}
                        className="md:hidden text-gray-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {visibleMenuItems.map((item: any, index) => (
                        item.header ? (
                            <div key={`head-${index}`} className="mt-6 mb-2 px-4 text-xs font-black text-gray-500 uppercase tracking-widest">
                                {item.header}
                            </div>
                        ) : (
                            <button
                                key={item.id}
                                onClick={() => handleSelect(item)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                                    activeTab === item.id 
                                    ? 'bg-blue-600 text-white shadow-lg translate-x-1' 
                                    : item.highlight 
                                        ? 'text-blue-400 hover:bg-blue-900/20 hover:text-blue-300' 
                                        : item.isLink
                                            ? 'text-emerald-400 hover:bg-emerald-900/20 hover:text-emerald-300'
                                            : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                }`}
                            >
                                <item.icon size={18} className={`${activeTab === item.id ? 'text-white' : ''} group-hover:scale-110 transition-transform`} />
                                <span className="font-bold text-xs uppercase tracking-tight text-left">{item.label}</span>
                            </button>
                        )
                    ))}
                </nav>
                
                <div className="p-4 border-t border-gray-700 text-[10px] text-center text-gray-600 font-bold uppercase tracking-widest">
                    GISVN v2.5.0 Admin
                </div>
            </div>
        </>
    );
};

export default AdminMenu;
