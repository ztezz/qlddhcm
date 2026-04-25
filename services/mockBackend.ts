
import { User, UserRole, Branch, LandParcel, DashboardStats, SystemLog, LandPriceConfig, WMSLayerConfig, SystemSetting, RoleConfig, PermissionDefinition, BasemapConfig, MenuItem, Message, SystemNotification, LandPrice2026, BlogPost } from '../types';

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

const isPrivateNetworkHost = (hostname: string) => {
    if (/^10\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    const match = hostname.match(/^172\.(\d+)\./);
    if (match) {
        const block = Number(match[1]);
        if (block >= 16 && block <= 31) return true;
    }
    return false;
};

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

    // Chỉ coi localhost là môi trường dev nội bộ.
    // Tránh tự fallback về IP LAN (10.x/192.168.x/172.x) khi deploy nội bộ.
    const isLocalhost = hostname === 'localhost' || 
                   hostname === '127.0.0.1' || 
                   hostname === '0.0.0.0';
    
    if ((isLocalhost || isPrivateNetworkHost(hostname)) && import.meta.env.DEV) {
        return origin;
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
            headers['x-user-role'] = u.role;
        } catch (e) {}
    }
    return headers;
};

const apiCall = async (
    endpoint: string,
    options?: RequestInit,
    config?: { suppressAuthReload?: boolean }
) => {
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
                if (!config?.suppressAuthReload) {
                    window.location.reload(); // Reload để app đẩy về trang login
                }
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

const pickFirstValue = (source: Record<string, any>, keys: string[]) => {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }
    return undefined;
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

export const blogService = {
    getPosts: async (): Promise<BlogPost[]> => {
        const data = await apiCall('/blog-posts');
        return Array.isArray(data) ? data : [];
    },
    getPostById: async (id: number): Promise<BlogPost> => apiCall(`/blog-posts/${id}`),
    createPost: async (payload: {
        title: string;
        summary: string;
        content_html: string;
        cover_image?: string;
        tags?: string[];
        publish_at?: string;
    }): Promise<BlogPost> => apiCall('/blog-posts', { method: 'POST', body: JSON.stringify(payload) }),
    updatePost: async (id: number, payload: {
        title: string;
        summary: string;
        content_html: string;
        cover_image?: string;
        tags?: string[];
        publish_at?: string;
    }): Promise<BlogPost> => apiCall(`/blog-posts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deletePost: async (id: number): Promise<any> => apiCall(`/blog-posts/${id}`, { method: 'DELETE' })
};

export const gisService = {
    getLayers: async (): Promise<WMSLayerConfig[]> => { try { const data = await apiCall('/wms-layers'); return Array.isArray(data) ? data : []; } catch { return []; } },
    getBasemaps: async (): Promise<BasemapConfig[]> => { try { const data = await apiCall('/basemaps'); return Array.isArray(data) ? data : []; } catch { return []; } },
    getSpatialTables: async (): Promise<any[]> => { try { const data = await apiCall('/spatial-tables'); return Array.isArray(data) ? data : []; } catch { return []; } },
    getExtent: async (tableName: string): Promise<any> => { try { return await apiCall(`/data/${tableName}/extent`); } catch { return null; } },
    searchParcels: async (tableName: string, filters: any): Promise<LandParcel[]> => {
        try {
             const normalizedTableName = String(tableName || '').trim().toLowerCase();
             const normalizedFilters = {
                sodoto: String(filters?.sodoto || '').trim(),
                sothua: String(filters?.sothua || '').trim(),
                tenchu: String(filters?.tenchu || '').trim(),
                diachi: String(filters?.diachi || '').trim()
             };

             let qs = `?t=${Date.now()}`;
             if (normalizedFilters.sodoto) qs += `&sodoto=${encodeURIComponent(normalizedFilters.sodoto)}`;
             if (normalizedFilters.sothua) qs += `&sothua=${encodeURIComponent(normalizedFilters.sothua)}`;
             if (normalizedFilters.tenchu) qs += `&tenchu=${encodeURIComponent(normalizedFilters.tenchu)}`;
             if (normalizedFilters.diachi) qs += `&diachi=${encodeURIComponent(normalizedFilters.diachi)}`;

             const payload = await apiCall(`/data/${encodeURIComponent(normalizedTableName)}${qs}`, undefined, { suppressAuthReload: true });
             const rows = Array.isArray(payload)
                ? payload
                : (Array.isArray(payload?.data) ? payload.data : []);

             if (!Array.isArray(rows)) return [];

             return rows.map((item: any, index: number) => {
                 const soTo = pickFirstValue(item, ['sodoto', 'so_to', 'shbando', 'sh_ban_do', 'tobando']);
                 const soThua = pickFirstValue(item, ['sothua', 'so_thua', 'shthua', 'sh_thua', 'thua_dat']);
                 const ownerName = pickFirstValue(item, ['tenchu', 'ten_chu', 'ownerName', 'owner_name', 'chusudung']);
                 const address = pickFirstValue(item, ['diachi', 'dia_chi', 'address', 'location', 'vitri', 'vi_tri']);
                 const area = pickFirstValue(item, ['dientich', 'dien_tich', 'area', 'shape_area', 'st_area']);
                 const landType = pickFirstValue(item, ['loaidat', 'loai_dat', 'kyhieumucd', 'ky_hieu_muc_dich', 'mucdich', 'mdsd']);
                 const geometry = typeof item.geometry === 'string' ? JSON.parse(item.geometry) : item.geometry;
                 const gid = Number(item.gid);
                 const fallbackId = [normalizedTableName, soTo, soThua, index].filter(Boolean).join('-') || `p-${index}`;

                 return {
                     id: Number.isFinite(gid) && gid > 0 ? String(gid) : fallbackId,
                     gid: Number.isFinite(gid) && gid > 0 ? gid : item.gid,
                     geometry,
                     properties: {
                         ...item,
                         so_to: soTo,
                         so_thua: soThua,
                         ownerName,
                         address,
                         area,
                         landType: landType || 'Chưa cập nhật',
                         tableName: normalizedTableName
                     }
                 };
             });
        } catch (error) {
            throw error;
        }
    }
};

export const adminService = {
    getMenuItems: async (): Promise<MenuItem[]> => {
        const data = await apiCall('/menu-items');
        return Array.isArray(data) ? data : [];
    },
    addMenuItem: async (item: MenuItem) => apiCall('/menu-items', { method: 'POST', body: JSON.stringify(item) }),
    updateMenuItem: async (item: MenuItem) => apiCall(`/menu-items/${item.id}`, { method: 'PUT', body: JSON.stringify(item) }),
    reorderMenuItems: async (items: Array<{ id: string; order_index: number }>) => apiCall('/menu-items/reorder', { method: 'POST', body: JSON.stringify({ items }) }),
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
    testMail: async (payload: { to?: string; smtp?: Record<string, string> }) =>
        apiCall('/settings/test-mail', { method: 'POST', body: JSON.stringify(payload) }),
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
    createBackup: async (payload: string[] | { tables?: string[]; format?: string; scope?: string }) => {
        const body = Array.isArray(payload) ? { tables: payload } : payload;
        const res = await fetch(`${API_URL}/api/backup/create`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const errorText = await res.text();
            let message = "Tạo bản sao lưu thất bại";
            try {
                const parsed = JSON.parse(errorText);
                message = parsed?.error || parsed?.message || message;
            } catch {
                if (errorText) message = errorText;
            }
            throw new Error(message);
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const header = res.headers.get('Content-disposition') || res.headers.get('Content-Disposition') || '';
        const matched = header.match(/filename="?([^";]+)"?/i);
        const fileName = matched?.[1] || `backup_${Date.now()}.sql`;
        const skippedCount = Number(res.headers.get('X-Backup-Skipped') || '0');
        const warningHeader = res.headers.get('X-Backup-Warnings') || '';
        const warnings = warningHeader ? decodeURIComponent(warningHeader) : '';
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
        return { fileName, skippedCount, warnings };
    },
    restoreDatabase: async (file: File) => {
        const formData = new FormData(); formData.append('file', file);
        return await apiCall('/backup/restore', { method: 'POST', body: formData });
    }
};

export const PERMISSIONS_LIST: PermissionDefinition[] = [
    { code: 'VIEW_MAP', name: 'Xem bản đồ', group: 'MAP', description: 'Cho phép mở và xem bản đồ nền, lớp dữ liệu.' },
    { code: 'SEARCH_PARCELS', name: 'Tra cứu thửa đất', group: 'MAP', description: 'Tìm kiếm thửa đất và xem popup thông tin.' },
    { code: 'PRINT_PARCEL_PDF', name: 'In / xuất PDF thửa đất', group: 'MAP', description: 'Xuất trích lục, in biểu mẫu và mã QR.' },
    { code: 'MANAGE_PARCELS', name: 'Truy cập quản lý thửa đất', group: 'MAP', description: 'Mở module quản trị thửa đất.' },
    { code: 'CREATE_PARCELS', name: 'Thêm thửa đất', group: 'MAP', description: 'Tạo mới hồ sơ thửa đất.' },
    { code: 'EDIT_PARCELS', name: 'Sửa thửa đất', group: 'MAP', description: 'Cập nhật thông tin thửa đất hiện có.' },
    { code: 'DELETE_PARCELS', name: 'Xóa thửa đất', group: 'MAP', description: 'Xóa hồ sơ thửa đất khỏi hệ thống.' },
    { code: 'IMPORT_PARCELS', name: 'Nhập dữ liệu thửa đất', group: 'MAP', description: 'Import dữ liệu hàng loạt cho thửa đất.' },

    { code: 'MANAGE_TABLES', name: 'Quản lý bảng dữ liệu', group: 'DATA', description: 'Quản lý registry và nguồn dữ liệu bản đồ.' },
    { code: 'CREATE_TABLES', name: 'Tạo / liên kết bảng', group: 'DATA', description: 'Tạo bảng mới hoặc liên kết bảng không gian có sẵn.' },
    { code: 'EDIT_TABLES', name: 'Sửa registry bảng', group: 'DATA', description: 'Đổi tên hiển thị và mô tả bảng dữ liệu.' },
    { code: 'DELETE_TABLES', name: 'Xóa / hủy liên kết bảng', group: 'DATA', description: 'Hủy liên kết hoặc xóa bảng dữ liệu không gian.' },
    { code: 'SYNC_TABLES', name: 'Đồng bộ cấu trúc bảng', group: 'DATA', description: 'Đồng bộ metadata, SRID và các cột hệ thống.' },
    { code: 'REPAIR_TABLES', name: 'Sửa lỗi cấu trúc bảng', group: 'DATA', description: 'Repair schema cho bảng dữ liệu không gian.' },
    { code: 'MANAGE_LAYERS', name: 'Quản lý lớp bản đồ', group: 'DATA', description: 'Truy cập cấu hình lớp WMS/XYZ.' },
    { code: 'CREATE_LAYERS', name: 'Thêm lớp bản đồ', group: 'DATA', description: 'Thêm cấu hình lớp mới.' },
    { code: 'EDIT_LAYERS', name: 'Sửa lớp bản đồ', group: 'DATA', description: 'Cập nhật thông tin lớp bản đồ.' },
    { code: 'DELETE_LAYERS', name: 'Xóa lớp bản đồ', group: 'DATA', description: 'Xóa cấu hình lớp bản đồ.' },
    { code: 'TOGGLE_LAYERS', name: 'Ẩn/hiện lớp bản đồ', group: 'DATA', description: 'Bật hoặc tắt trạng thái hiển thị lớp.' },
    { code: 'MANAGE_BASEMAPS', name: 'Quản lý bản đồ nền', group: 'DATA', description: 'Truy cập cấu hình basemap.' },
    { code: 'CREATE_BASEMAPS', name: 'Thêm bản đồ nền', group: 'DATA', description: 'Tạo basemap mới.' },
    { code: 'EDIT_BASEMAPS', name: 'Sửa bản đồ nền', group: 'DATA', description: 'Cập nhật basemap hiện có.' },
    { code: 'DELETE_BASEMAPS', name: 'Xóa bản đồ nền', group: 'DATA', description: 'Xóa basemap khỏi hệ thống.' },
    { code: 'REORDER_MAP_LAYERS', name: 'Sắp xếp thứ tự lớp', group: 'DATA', description: 'Đổi vị trí ưu tiên của lớp và basemap.' },

    { code: 'VIEW_DASHBOARD', name: 'Xem báo cáo thống kê', group: 'REPORT', description: 'Truy cập dashboard thống kê hệ thống.' },
    { code: 'EXPORT_REPORT', name: 'Xuất báo cáo Excel/PDF', group: 'REPORT', description: 'Xuất số liệu báo cáo ra file.' },

    { code: 'MANAGE_USERS', name: 'Quản lý người dùng', group: 'USERS', description: 'Quyền tổng hợp cho module người dùng.' },
    { code: 'VIEW_USERS', name: 'Xem danh sách người dùng', group: 'USERS', description: 'Truy cập và xem danh sách tài khoản.' },
    { code: 'CREATE_USERS', name: 'Tạo người dùng', group: 'USERS', description: 'Tạo mới tài khoản người dùng.' },
    { code: 'EDIT_USERS', name: 'Sửa người dùng', group: 'USERS', description: 'Cập nhật hồ sơ, trạng thái người dùng.' },
    { code: 'DELETE_USERS', name: 'Xóa người dùng', group: 'USERS', description: 'Xóa hoặc vô hiệu hóa tài khoản.' },
    { code: 'RESET_USER_PASSWORD', name: 'Đặt lại mật khẩu', group: 'USERS', description: 'Reset mật khẩu cho tài khoản khác.' },
    { code: 'VERIFY_USERS', name: 'Kích hoạt / khóa người dùng', group: 'USERS', description: 'Bật tắt trạng thái xác thực tài khoản.' },
    { code: 'TOGGLE_USER_CHAT', name: 'Quản lý quyền chat', group: 'USERS', description: 'Mở hoặc khóa chức năng nhắn tin.' },
    { code: 'MANAGE_BRANCHES', name: 'Quản lý chi nhánh', group: 'USERS', description: 'Truy cập module chi nhánh / đơn vị.' },
    { code: 'CREATE_BRANCHES', name: 'Thêm chi nhánh', group: 'USERS', description: 'Tạo mới chi nhánh hoặc đơn vị.' },
    { code: 'EDIT_BRANCHES', name: 'Sửa chi nhánh', group: 'USERS', description: 'Cập nhật thông tin chi nhánh.' },
    { code: 'DELETE_BRANCHES', name: 'Xóa chi nhánh', group: 'USERS', description: 'Xóa chi nhánh khỏi hệ thống.' },
    { code: 'MANAGE_PERMISSIONS', name: 'Phân quyền vai trò', group: 'USERS', description: 'Quản lý ma trận phân quyền theo vai trò.' },

    { code: 'MANAGE_LAND_PRICES', name: 'Quản lý bảng giá đất', group: 'CONTENT', description: 'Truy cập module giá đất.' },
    { code: 'CREATE_LAND_PRICES', name: 'Thêm giá đất', group: 'CONTENT', description: 'Tạo mới dữ liệu bảng giá đất.' },
    { code: 'EDIT_LAND_PRICES', name: 'Sửa giá đất', group: 'CONTENT', description: 'Cập nhật dữ liệu giá đất.' },
    { code: 'DELETE_LAND_PRICES', name: 'Xóa giá đất', group: 'CONTENT', description: 'Xóa bản ghi giá đất.' },
    { code: 'MANAGE_NOTIFICATIONS', name: 'Quản lý thông báo hệ thống', group: 'CONTENT', description: 'Truy cập module thông báo.' },
    { code: 'CREATE_NOTIFICATIONS', name: 'Soạn thông báo', group: 'CONTENT', description: 'Tạo mới thông báo hệ thống.' },
    { code: 'EDIT_NOTIFICATIONS', name: 'Sửa thông báo', group: 'CONTENT', description: 'Chỉnh sửa thông báo đã tạo.' },
    { code: 'DELETE_NOTIFICATIONS', name: 'Xóa thông báo', group: 'CONTENT', description: 'Xóa thông báo khỏi hệ thống.' },
    { code: 'MANAGE_MENU', name: 'Quản lý sidebar / menu', group: 'CONTENT', description: 'Truy cập module menu điều hướng.' },
    { code: 'CREATE_MENU', name: 'Thêm mục menu', group: 'CONTENT', description: 'Tạo mục điều hướng mới.' },
    { code: 'EDIT_MENU', name: 'Sửa mục menu', group: 'CONTENT', description: 'Cập nhật mục điều hướng hiện có.' },
    { code: 'DELETE_MENU', name: 'Xóa mục menu', group: 'CONTENT', description: 'Xóa mục điều hướng.' },
    { code: 'REORDER_MENU', name: 'Sắp xếp menu', group: 'CONTENT', description: 'Thay đổi thứ tự sidebar bằng kéo thả.' },

    { code: 'MANAGE_SYSTEM', name: 'Thiết lập hệ thống', group: 'SYSTEM', description: 'Truy cập cấu hình hệ thống, mail, SEO, bản đồ và PDF.' },
    { code: 'SAVE_SYSTEM_SETTINGS', name: 'Lưu thiết lập hệ thống', group: 'SYSTEM', description: 'Ghi thay đổi cấu hình hệ thống.' },
    { code: 'TEST_MAIL_SERVER', name: 'Kiểm tra mail / kết nối', group: 'SYSTEM', description: 'Test SMTP và kiểm tra kết nối dịch vụ.' },
    { code: 'VIEW_LOGS', name: 'Xem nhật ký hệ thống', group: 'SYSTEM', description: 'Xem log hành động và giám sát hệ thống.' },
    { code: 'EXPORT_LOGS', name: 'Xuất nhật ký hệ thống', group: 'SYSTEM', description: 'Tải log phục vụ kiểm tra hoặc lưu trữ.' },
    { code: 'MANAGE_BACKUP', name: 'Tạo sao lưu SQL', group: 'SYSTEM', description: 'Xuất file sao lưu SQL.' },
    { code: 'RESTORE_BACKUP', name: 'Khôi phục SQL', group: 'SYSTEM', description: 'Khôi phục dữ liệu từ file SQL.' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
    [UserRole.ADMIN]: PERMISSIONS_LIST.map((item) => item.code),
    [UserRole.EDITOR]: [
        'VIEW_MAP', 'SEARCH_PARCELS', 'PRINT_PARCEL_PDF',
        'MANAGE_PARCELS', 'CREATE_PARCELS', 'EDIT_PARCELS', 'IMPORT_PARCELS',
        'VIEW_DASHBOARD', 'EXPORT_REPORT',
        'MANAGE_LAND_PRICES', 'CREATE_LAND_PRICES', 'EDIT_LAND_PRICES',
        'VIEW_LOGS'
    ],
    [UserRole.VIEWER]: [
        'VIEW_MAP', 'SEARCH_PARCELS', 'PRINT_PARCEL_PDF', 'VIEW_DASHBOARD'
    ]
};

export const ADMIN_TAB_PERMISSIONS: Record<string, string[]> = {
    PARCEL_MANAGER: ['MANAGE_PARCELS', 'CREATE_PARCELS', 'EDIT_PARCELS', 'DELETE_PARCELS'],
    MENU_MANAGER: ['MANAGE_MENU', 'CREATE_MENU', 'EDIT_MENU', 'DELETE_MENU'],
    USERS: ['MANAGE_USERS', 'VIEW_USERS', 'CREATE_USERS', 'EDIT_USERS', 'DELETE_USERS'],
    NOTIFICATIONS: ['MANAGE_NOTIFICATIONS', 'CREATE_NOTIFICATIONS', 'EDIT_NOTIFICATIONS', 'DELETE_NOTIFICATIONS'],
    PERMISSIONS: ['MANAGE_PERMISSIONS'],
    BRANCHES: ['MANAGE_BRANCHES', 'CREATE_BRANCHES', 'EDIT_BRANCHES', 'DELETE_BRANCHES'],
    PRICES_2026: ['MANAGE_LAND_PRICES', 'CREATE_LAND_PRICES', 'EDIT_LAND_PRICES', 'DELETE_LAND_PRICES'],
    DATA_LAYERS: ['MANAGE_LAYERS', 'MANAGE_TABLES', 'MANAGE_BASEMAPS'],
    SETTINGS: ['MANAGE_SYSTEM', 'SAVE_SYSTEM_SETTINGS', 'MANAGE_BACKUP', 'RESTORE_BACKUP'],
    PDF_SETTINGS: ['MANAGE_SYSTEM', 'SAVE_SYSTEM_SETTINGS'],
    LOGS: ['VIEW_LOGS', 'EXPORT_LOGS']
};

export const hasAnyPermission = (permissions: string[] = [], required: string | string[]) => {
    const requiredList = Array.isArray(required) ? required : [required];
    if (requiredList.length === 0) return true;
    return requiredList.some((code) => permissions.includes(code));
};

export const authService = {
    // Sửa lại hàm login để lưu token
    getCaptchaChallenge: async (): Promise<{ challengeId: string; question: string; expiresInSec: number }> => {
        return apiCall('/auth/captcha-challenge');
    },
    login: async (identifier: string, pass: string, captchaChallengeId: string, captchaAnswer: string): Promise<User> => {
        const response = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password: pass, captchaChallengeId, captchaAnswer })
        });
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
    register: async (name: string, email: string, branchId: string, password?: string): Promise<any> => apiCall('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, branchId, password }) }),
    forgotPassword: async (identifier: string): Promise<any> => apiCall('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ identifier }) }),
    resetPassword: async (token: string, newPassword: string): Promise<any> => apiCall('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
    verifyEmail: async (token: string): Promise<any> => apiCall('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
    updateProfile: async (id: string, name: string, file: File | null, username?: string): Promise<any> => {
        const formData = new FormData();
        formData.append('name', name);
        if (username !== undefined) formData.append('username', username);
        if (file) formData.append('avatar', file);
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
