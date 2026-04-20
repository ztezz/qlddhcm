
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import AdminMenu from '../components/AdminMenu';
import ParcelManager from './ParcelManager';
import { adminService, ADMIN_TAB_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '../services/mockBackend';

import UserManager from '../components/admin/UserManager';
import PermissionManager from '../components/admin/PermissionManager';
import BranchManager from '../components/admin/BranchManager';
import LandPrice2026Manager from '../components/admin/LandPriceManager';
import LayerManager from '../components/admin/LayerManager';
import SystemSettingsManager from '../components/admin/SystemSettingsManager';
import LogViewer from '../components/admin/LogViewer';
import MenuManager from '../components/admin/MenuManager';
import NotificationManager from '../components/admin/NotificationManager';
import { User, UserRole } from '../types';

interface AdminPageProps {
    systemName?: string;
    logoUrl?: string;
    user?: User | null;
}

const AdminPage: React.FC<AdminPageProps> = ({ systemName, logoUrl, user }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'PARCEL_MANAGER';
    
    const [dbStatus, setDbStatus] = useState<any>({ status: 'checking' });
    const [rolePermissions, setRolePermissions] = useState<any[]>([]);
    const [permissionLoading, setPermissionLoading] = useState(true);

    const setActiveTab = (tab: string) => {
        setSearchParams({ tab });
    };

    const checkDB = async () => {
        try {
            const status = await adminService.checkDbConnection();
            setDbStatus(status);
        } catch (e: any) { 
            setDbStatus({ status: 'error', message: e.message }); 
        }
    };

    useEffect(() => {
        checkDB();
        const loadPermissions = async () => {
            try {
                const data = await adminService.getRolePermissions();
                setRolePermissions(Array.isArray(data) ? data : []);
            } catch {
                setRolePermissions([]);
            } finally {
                setPermissionLoading(false);
            }
        };
        loadPermissions();
    }, []);

    const currentPermissions = user?.role === UserRole.ADMIN
        ? DEFAULT_ROLE_PERMISSIONS[UserRole.ADMIN]
        : rolePermissions.find((rp) => rp.role === user?.role)?.permissions || (user?.role ? DEFAULT_ROLE_PERMISSIONS[user.role] || [] : []);

    const hasTabAccess = (tab: string) => {
        if (user?.role === UserRole.ADMIN) return true;
        const required = ADMIN_TAB_PERMISSIONS[tab] || [];
        if (required.length === 0) return false;
        return required.some((code) => currentPermissions.includes(code));
    };

    const allowedTabs = Object.keys(ADMIN_TAB_PERMISSIONS).filter((tab) => hasTabAccess(tab));

    useEffect(() => {
        if (!permissionLoading && !hasTabAccess(activeTab) && allowedTabs.length > 0) {
            setActiveTab(allowedTabs[0]);
        }
    }, [permissionLoading, activeTab, allowedTabs.join('|')]);

    const renderNoAccess = () => (
        <div className="p-8 md:p-12 h-full flex items-center justify-center">
            <div className="max-w-xl w-full rounded-3xl border border-amber-700/40 bg-amber-950/10 p-8 text-center">
                <ShieldAlert className="mx-auto mb-4 text-amber-400" size={40} />
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Không đủ quyền truy cập</h3>
                <p className="text-sm text-gray-400 mt-2">Vai trò hiện tại chưa được cấp quyền cho module quản trị này. Hãy vào mục phân quyền để cấp thêm quyền chi tiết.</p>
            </div>
        </div>
    );

    const renderModule = () => {
        if (permissionLoading) {
            return <div className="p-8 text-gray-500 italic">Đang tải quyền truy cập...</div>;
        }
        if (user?.role !== UserRole.ADMIN && !hasTabAccess(activeTab)) {
            return renderNoAccess();
        }
        switch (activeTab) {
            case 'PARCEL_MANAGER': return <ParcelManager permissions={currentPermissions} />;
            case 'MENU_MANAGER': return <MenuManager permissions={currentPermissions} />;
            case 'USERS': return <UserManager permissions={currentPermissions} />;
            case 'NOTIFICATIONS': return <NotificationManager permissions={currentPermissions} />;
            case 'PERMISSIONS': return <PermissionManager />;
            case 'BRANCHES': return <BranchManager permissions={currentPermissions} />;
            case 'PRICES_2026': return <LandPrice2026Manager permissions={currentPermissions} />;
            case 'DATA_LAYERS': return <LayerManager dbStatus={dbStatus} permissions={currentPermissions} />;
            case 'SETTINGS': return <SystemSettingsManager permissions={currentPermissions} />;
            case 'LOGS': return <LogViewer />;
            default: return <div className="p-8 text-gray-500 italic">Module đang phát triển...</div>;
        }
    };

    return (
        <div className="flex h-full bg-gray-900 text-white overflow-hidden font-sans">
            <AdminMenu 
                activeTab={activeTab} 
                onSelect={setActiveTab} 
                systemName={systemName} 
                logoUrl={logoUrl} 
                allowedTabs={allowedTabs}
            />
            
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-900">
                <div className="flex-1 overflow-auto bg-gray-900 relative custom-scrollbar">
                    {renderModule()}
                </div>
            </div>
        </div>
    );
};

export default AdminPage;
