
import { User, UserRole, Branch, LandParcel, DashboardStats, SystemLog, LandPriceConfig, WMSLayerConfig, SystemSetting, RoleConfig, PermissionDefinition, BasemapConfig, MenuItem, Message, SystemNotification, LandPrice2026 } from '../types';

const PRODUCTION_API_URL = 'https://api.datdaihcm.pro';

const ALLOWED_HOSTS = [
    'geo.gisvn.space', 
    'datdaihcm.pro',
    'www.datdaihcm.pro',
    'www.geo.gisvn.space',
    'qlddhcm.io.vn',
    'aistudio.google.com',
    'www.qlddhcm.io.vn'
];

const getApiUrl = () => {
    const { hostname, origin } = window.location;
    const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

    if (configuredApiUrl) {
        return configuredApiUrl.replace(/\/$/, '');
    }
    
    // Kiểm tra môi trường AI Studio hoặc các tên miền đặc biệt đang chạy full-stack cùng origin.
    if (hostname.includes('.run.app') || 
        hostname.includes('aistudio.google.com')) {
        return origin; 
    }

    // Kiểm tra môi trường Dev/Local (localhost, IP nội bộ)
    const isLocal = hostname === 'localhost' || 
                   hostname === '127.0.0.1' || 
                   hostname === '0.0.0.0' ||
                   hostname.startsWith('192.168.') || 
                   hostname.startsWith('10.') || 
                   hostname.startsWith('172.');
    
    if (isLocal) {
        return origin; // Trong môi trường dev tích hợp, dùng luôn origin
    }

    // Mọi môi trường deploy còn lại mặc định gọi backend riêng.
    return PRODUCTION_API_URL;
};

export const API_URL = getApiUrl();

const getAuthHeaders = () => {
    const headers: any = {};
    const userStr = localStorage.getItem('geo_user');
    const token = localStorage.getItem('geo_token'); // Lấy JWT token

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (userStr) {
        try {
            const u = JSON.parse(userStr);
            // Vẫn giữ lại headers cũ để tương thích với logging system cũ (nhưng backend đã check Auth Bearer trước)
            headers['x-user-id'] = u.id;
            headers['x-user-name'] = encodeURIComponent(u.name);
            headers['x-branch-id'] = u.branchId || u.branch_id;
        } catch (e) {}
    }
    return headers;
};

const apiCall = async (endpoint: string, options?: RequestInit) => {
    const cleanEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
    const finalUrl = `${API_URL}${cleanEndpoint}`;
    try {
        const headers: any = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...options?.headers };
        if (options?.body instanceof FormData) delete headers['Content-Type'];
        const res = await fetch(finalUrl, { ...options, headers });
        
        // Handle 401/403 (Token hết hạn hoặc không hợp lệ)
        if (res.status === 401 || res.status === 403) {
            if (!endpoint.includes('/login')) { // Tránh loop nếu đang login
                localStorage.removeItem('geo_token');
                localStorage.removeItem('geo_user');
                window.location.reload(); // Reload để app đẩy về trang login
                throw new Error("Phiên làm việc hết hạn. Vui lòng đăng nhập lại.");
            }
        }

        const responseText = await res.text();
        let responseData: any = null;
        if (responseText) { 
            try { 
                responseData = JSON.parse(responseText); 
            } catch (e) {
                console.warn(`[API] Failed to parse JSON from ${endpoint}:`, responseText.substring(0, 100));
            } 
        }
        
        if (!res.ok) {
            let errorMessage = `Lỗi hệ thống (${res.status})`;
            if (responseData && (responseData.error || responseData.message)) errorMessage = responseData.error || responseData.message;
            throw new Error(errorMessage);
        }
        return responseData;
    } catch (error: any) { throw error; }
};

export const notificationService = {
    getNotifications: async (): Promise<SystemNotification[]> => {
        const data = await apiCall('/notifications');
        return Array.isArray(data) ? data : [];
    },
    getAllForAdmin: async (): Promise<SystemNotification[]> => {
        const data = await apiCall('/notifications/admin');
        return Array.isArray(data) ? data : [];
    },
    sendNotification: async (data: any): Promise<any> => apiCall('/notifications', { method: 'POST', body: JSON.stringify(data) }),
    updateNotification: async (id: number, data: any): Promise<any> => apiCall(`/notifications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteNotification: async (id: number): Promise<any> => apiCall(`/notifications/${id}`, { method: 'DELETE' })
};

export const messageService = {
    getInbox: async (): Promise<Message[]> => {
        const data = await apiCall('/messages/inbox');
        return Array.isArray(data) ? data : [];
    },
    getSent: async (): Promise<Message[]> => {
        const data = await apiCall('/messages/sent');
        return Array.isArray(data) ? data : [];
    },
    getTrash: async (): Promise<Message[]> => {
        const data = await apiCall('/messages/trash');
        return Array.isArray(data) ? data : [];
    },
    sendMessage: async (receiverId: string, content: string): Promise<any> => apiCall('/messages', { method: 'POST', body: JSON.stringify({ receiverId, content }) }),
    deleteMessage: async (messageId: number): Promise<any> => apiCall(`/messages/${messageId}`, { method: 'DELETE' }),
    restoreMessage: async (messageId: number): Promise<any> => apiCall(`/messages/restore/${messageId}`, { method: 'PUT' }),
    getUnreadCount: async (): Promise<{ count: number }> => apiCall('/messages/unread/count'),
    markAsRead: async (messageId: number): Promise<any> => apiCall(`/messages/read/${messageId}`, { method: 'PUT' })
};

export const gisService = {
    getLayers: async (): Promise<WMSLayerConfig[]> => { try { const data = await apiCall('/wms-layers'); return Array.isArray(data) ? data : []; } catch { return []; } },
    getBasemaps: async (): Promise<BasemapConfig[]> => { try { const data = await apiCall('/basemaps'); return Array.isArray(data) ? data : []; } catch { return []; } },
    getSpatialTables: async (): Promise<any[]> => { try { const data = await apiCall('/spatial-tables'); return Array.isArray(data) ? data : []; } catch { return []; } },
    getExtent: async (tableName: string): Promise<any> => { try { return await apiCall(`/data/${tableName}/extent`); } catch { return null; } },
    searchParcels: async (tableName: string, filters: any): Promise<LandParcel[]> => {
        try {
             let qs = `?t=${Date.now()}`;
             if (filters.sodoto) qs += `&sodoto=${encodeURIComponent(filters.sodoto)}`;
             if (filters.sothua) qs += `&sothua=${encodeURIComponent(filters.sothua)}`;
             if (filters.tenchu) qs += `&tenchu=${encodeURIComponent(filters.tenchu)}`;
             if (filters.diachi) qs += `&diachi=${encodeURIComponent(filters.diachi)}`;
             const data = await apiCall(`/data/${tableName}${qs}`);
             if (!Array.isArray(data)) return [];
             return data.map((item: any) => ({
                 id: item.gid?.toString() || `p-${Math.random()}`, gid: item.gid, geometry: item.geometry,
                 properties: { ...item, so_to: item.sodoto, so_thua: item.sothua, ownerName: item.tenchu, address: item.diachi, area: item.dientich, landType: item.loaidat || item.kyhieumucd || 'Chưa cập nhật', tableName: tableName }
             }));
        } catch { return []; }
    }
};

export const adminService = {
    getMenuItems: async (): Promise<MenuItem[]> => {
        const data = await apiCall('/menu-items');
        return Array.isArray(data) ? data : [];
    },
    addMenuItem: async (item: MenuItem) => apiCall('/menu-items', { method: 'POST', body: JSON.stringify(item) }),
    updateMenuItem: async (item: MenuItem) => apiCall(`/menu-items/${item.id}`, { method: 'PUT', body: JSON.stringify(item) }),
    deleteMenuItem: async (id: string) => apiCall(`/menu-items/${id}`, { method: 'DELETE' }),
    checkDbConnection: async () => apiCall('/db-check'),
    getServerInfo: async () => apiCall('/server-info'),
    getUsers: async () => {
        const data = await apiCall('/users');
        return Array.isArray(data) ? data : [];
    },
    addUser: async (user: any) => apiCall('/users', { method: 'POST', body: JSON.stringify(user) }),
    updateUser: async (user: any) => apiCall(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify(user) }),
    resetPassword: async (id: string, password: string) => apiCall(`/users/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ password }) }),
    deleteUser: async (id: string) => apiCall(`/users/${id}`, { method: 'DELETE' }),
    toggleChatRestriction: async (userId: string, canChat: boolean) => apiCall(`/users/${userId}/chat-restriction`, { method: 'PUT', body: JSON.stringify({ canChat }) }),
    getBranches: async () => {
        const data = await apiCall('/branches');
        return Array.isArray(data) ? data : [];
    },
    addBranch: async (branch: any) => apiCall('/branches', { method: 'POST', body: JSON.stringify(branch) }),
    updateBranch: async (branch: any) => apiCall(`/branches/${branch.id}`, { method: 'PUT', body: JSON.stringify(branch) }),
    deleteBranch: async (id: string) => apiCall(`/branches/${id}`, { method: 'DELETE' }),
    getSettings: async (): Promise<SystemSetting[]> => {
        const data = await apiCall('/settings');
        return Array.isArray(data) ? data : [];
    },
    saveSettings: async (settings: SystemSetting[]) => apiCall('/settings', { method: 'POST', body: JSON.stringify({ settings }) }),
    getWmsLayers: async () => {
        const data = await apiCall('/wms-layers');
        return Array.isArray(data) ? data : [];
    },
    addWmsLayer: async (layer: any) => apiCall('/wms-layers', { method: 'POST', body: JSON.stringify(layer) }),
    updateWmsLayer: async (layer: any) => apiCall(`/wms-layers/${layer.id}`, { method: 'PUT', body: JSON.stringify(layer) }),
    reorderWmsLayers: async (items: Array<{ id: string; sortOrder: number }>) => apiCall('/wms-layers/reorder', { method: 'POST', body: JSON.stringify({ items }) }),
    deleteWmsLayer: async (id: string) => apiCall(`/wms-layers/${id}`, { method: 'DELETE' }),
    getBasemaps: async () => {
        const data = await apiCall('/basemaps');
        return Array.isArray(data) ? data : [];
    },
    addBasemap: async (bm: any) => apiCall('/basemaps', { method: 'POST', body: JSON.stringify(bm) }),
    updateBasemap: async (bm: any) => apiCall(`/basemaps/${bm.id}`, { method: 'PUT', body: JSON.stringify(bm) }),
    reorderBasemaps: async (items: Array<{ id: string; sortOrder: number }>) => apiCall('/basemaps/reorder', { method: 'POST', body: JSON.stringify({ items }) }),
    deleteBasemap: async (id: string) => apiCall(`/basemaps/${id}`, { method: 'DELETE' }),
    getLogs: async (params?: { page?: number; limit?: number; action?: string; search?: string; from?: string; to?: string }) => {
        let qs = `?t=${Date.now()}`;
        if (params?.page) qs += `&page=${params.page}`;
        if (params?.limit) qs += `&limit=${params.limit}`;
        if (params?.action) qs += `&action=${encodeURIComponent(params.action)}`;
        if (params?.search) qs += `&search=${encodeURIComponent(params.search)}`;
        if (params?.from) qs += `&from=${encodeURIComponent(params.from)}`;
        if (params?.to) qs += `&to=${encodeURIComponent(params.to)}`;
        const data = await apiCall(`/logs${qs}`);
        if (Array.isArray(data)) return { data, total: data.length, page: 1, limit: data.length, pages: 1 };
        return data as { data: SystemLog[]; total: number; page: number; limit: number; pages: number };
    },
    getLogStats: async () => {
        try {
            const data = await apiCall('/logs/stats');
            return data as { today: number; actionStats: { action: string; count: number }[]; uniqueUsersWeek: number };
        } catch { return { today: 0, actionStats: [], uniqueUsersWeek: 0 }; }
    },
    getRolePermissions: async () => {
        const data = await apiCall('/role-permissions');
        return Array.isArray(data) ? data : [];
    },
    saveRolePermissions: async (role: UserRole, permissions: string[]) => apiCall('/role-permissions', { method: 'POST', body: JSON.stringify({ role, permissions }) }),
    getPrices: async () => {
        const data = await apiCall('/land-prices');
        return Array.isArray(data) ? data : [];
    },
    addPrice: async (price: any) => apiCall('/land-prices', { method: 'POST', body: JSON.stringify(price) }),
    updatePrice: async (price: any) => apiCall(`/land-prices/${price.landType}`, { method: 'PUT', body: JSON.stringify(price) }),
    deletePrice: async (landType: string) => apiCall(`/land-prices/${landType}`, { method: 'DELETE' }),
    
    // Land Price 2026 Admin & Lookup
    getLandPriceWards: async (): Promise<string[]> => { try { return await apiCall('/land-prices-2026/wards'); } catch { return []; } },
    getLandPriceSuggestions: async (phuongxa?: string): Promise<{streets: string[], fromPoints: string[], toPoints: string[]}> => {
        let qs = `?t=${Date.now()}`;
        if (phuongxa) qs += `&phuongxa=${encodeURIComponent(phuongxa)}`;
        return await apiCall(`/land-prices-2026/suggestions${qs}`);
    },
    searchLandPrices2026: async (phuongxa: string, tenduong: string, tu?: string, den?: string): Promise<LandPrice2026[]> => {
        let qs = `?t=${Date.now()}`;
        if (phuongxa) qs += `&phuongxa=${encodeURIComponent(phuongxa)}`;
        if (tenduong) qs += `&tenduong=${encodeURIComponent(tenduong)}`;
        if (tu) qs += `&tu=${encodeURIComponent(tu)}`;
        if (den) qs += `&den=${encodeURIComponent(den)}`;
        return await apiCall(`/land-prices-2026/search${qs}`);
    },
    // Các phương thức quản trị mới
    addLandPrice2026: async (data: any) => apiCall('/land-prices-2026', { method: 'POST', body: JSON.stringify(data) }),
    updateLandPrice2026: async (id: number, data: any) => apiCall(`/land-prices-2026/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteLandPrice2026: async (id: number) => apiCall(`/land-prices-2026/${id}`, { method: 'DELETE' }),

    getBackupTables: async () => apiCall('/backup/tables'),
    createBackup: async (tables: string[]) => {
        const res = await fetch(`${API_URL}/api/backup/create`, { method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ tables }) });
        if (!res.ok) throw new Error("Tạo bản sao lưu thất bại");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `backup_${Date.now()}.sql`; a.click();
    },
    restoreDatabase: async (file: File) => {
        const formData = new FormData(); formData.append('file', file);
        return await apiCall('/backup/restore', { method: 'POST', body: formData });
    }
};

export const PERMISSIONS_LIST: PermissionDefinition[] = [
    { code: 'VIEW_MAP', name: 'Xem Bản đồ', group: 'MAP' }, { code: 'EDIT_MAP', name: 'Thêm/Sửa/Xóa Thửa đất', group: 'MAP' }, { code: 'DELETE_MAP', name: 'Xóa Thửa đất', group: 'MAP' }, { code: 'MANAGE_TABLES', name: 'Quản lý Bảng dữ liệu', group: 'DATA' }, { code: 'VIEW_DASHBOARD', name: 'Xem Báo cáo Thống kê', group: 'REPORT' }, { code: 'EXPORT_REPORT', name: 'Xuất Excel/PDF', group: 'REPORT' }, { code: 'MANAGE_USERS', name: 'Quản lý Người dùng', group: 'SYSTEM' }, { code: 'MANAGE_SYSTEM', name: 'Cấu hình Hệ thống', group: 'SYSTEM' }, { code: 'VIEW_LOGS', name: 'Xem Nhật ký Hệ thống', group: 'SYSTEM' },
];

export const authService = {
    // Sửa lại hàm login để lưu token
    login: async (email: string, pass: string): Promise<User> => {
        const response = await apiCall('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: pass }) });
        if (response.token) {
            localStorage.setItem('geo_token', response.token);
        }
        return response.user; // Trả về user object như cũ
    },
    getBranches: async (): Promise<Branch[]> => { 
        try { 
            const data = await apiCall('/branches'); 
            return Array.isArray(data) ? data : [];
        } catch { return []; } 
    },
    getProfile: async (id: string): Promise<User> => apiCall(`/users/${id}`),
    register: async (name: string, email: string, branchId: string): Promise<any> => apiCall('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, branchId }) }),
    forgotPassword: async (email: string): Promise<any> => apiCall('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: async (token: string, newPassword: string): Promise<any> => apiCall('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
    verifyEmail: async (token: string): Promise<any> => apiCall('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
    updateProfile: async (id: string, name: string, file: File | null): Promise<any> => {
        const formData = new FormData(); formData.append('name', name); if (file) formData.append('avatar', file);
        return await apiCall(`/users/${id}/profile`, { method: 'PUT', body: formData });
    },
    changePassword: async (id: string, oldPassword: string, newPassword: string): Promise<any> => apiCall(`/users/${id}/change-password`, { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) })
};

export const statsService = {
    getDashboardStats: async (params?: { period?: 'all' | '7d' | '30d' | '90d'; from?: string; to?: string }): Promise<DashboardStats> => {
        try {
            const qs = new URLSearchParams();
            if (params?.period) qs.set('period', params.period);
            if (params?.from) qs.set('from', params.from);
            if (params?.to) qs.set('to', params.to);
            const endpoint = qs.toString() ? `/stats/dashboard?${qs.toString()}` : '/stats/dashboard';
            return await apiCall(endpoint);
        } catch {
            return { totalParcels: 0, totalArea: 0, totalValue: 0, parcelsByType: [], valueByBranch: [] };
        }
    }
};
