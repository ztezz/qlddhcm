
import { LandParcel } from '../types';

const PRODUCTION_API_URL = 'https://api.datdaihcm.pro';

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
    
    const isLocalhost = hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname === '0.0.0.0';

    if (((isLocalhost || isPrivateNetworkHost(hostname)) && import.meta.env.DEV) || hostname.includes('.run.app') || hostname.includes('aistudio.google.com')) {
        return origin;
    }

    return PRODUCTION_API_URL;
};

export const API_URL = getApiUrl();

export interface ParcelDTO {
    gid?: number;
    madinhdanh?: string;
    sothua: string;
    sodoto: string;
    tenchu?: string;
    diachi?: string;
    loaidat?: string; 
    dientich?: number;
    geometry?: any; 
    file?: File | null; 
    [key: string]: any; 
}

export interface SpatialTable {
    table_name: string;
    display_name: string;
    description?: string;
}

export interface AdminSearchResult {
    gid: number;
    name: string;
    properties: Record<string, any>;
    geometry: any;
}

export interface ParcelListResponse {
    data: ParcelDTO[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

const getAuthHeaders = () => {
    const headers: any = { 'Content-Type': 'application/json' };
    const userStr = localStorage.getItem('geo_user');
    const token = localStorage.getItem('geo_token'); // Lấy JWT token

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (userStr) {
        try {
            const u = JSON.parse(userStr);
            headers['x-user-id'] = u.id;
            headers['x-user-name'] = encodeURIComponent(u.name);
            headers['x-branch-id'] = u.branchId || u.branch_id;
        } catch (e) {}
    }
    return headers;
};

const handleResponse = async (res: Response) => {
    // Handle 401/403
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('geo_token');
        localStorage.removeItem('geo_user');
        window.location.reload();
        throw new Error("Phiên làm việc hết hạn. Vui lòng đăng nhập lại.");
    }

    const responseText = await res.text();
    let responseData: any = null;
    if (responseText) {
        try { responseData = JSON.parse(responseText); } catch (e) {}
    }
    if (!res.ok) {
        let message = `Lỗi API (${res.status})`;
        if (responseData && (responseData.error || responseData.message)) {
            message = responseData.error || responseData.message;
        }
        throw new Error(message);
    }
    return responseData || { status: 'ok' };
};

export const parcelApi = {
    adminSearch: {
        suggest: async (table: string, keyword: string, limit = 8): Promise<Array<{ name: string }>> => {
            const t = (table || '').toLowerCase().trim();
            const q = (keyword || '').trim();
            if (!t || !q) return [];
            const res = await fetch(`${API_URL}/api/admin-search/${encodeURIComponent(t)}/suggest?q=${encodeURIComponent(q)}&limit=${limit}`);
            const data = await handleResponse(res);
            return Array.isArray(data) ? data : [];
        },
        search: async (table: string, keyword: string, limit = 5): Promise<AdminSearchResult[]> => {
            const t = (table || '').toLowerCase().trim();
            const q = (keyword || '').trim();
            if (!t || !q) return [];
            const res = await fetch(`${API_URL}/api/admin-search/${encodeURIComponent(t)}?q=${encodeURIComponent(q)}&limit=${limit}`);
            const data = await handleResponse(res);
            return Array.isArray(data) ? data : [];
        },
        getByGid: async (table: string, gid: number): Promise<AdminSearchResult | null> => {
            const t = (table || '').toLowerCase().trim();
            const id = Number(gid);
            if (!t || !Number.isFinite(id) || id <= 0) return null;
            const res = await fetch(`${API_URL}/api/admin-search/${encodeURIComponent(t)}/by-gid/${id}`);
            const data = await handleResponse(res);
            if (!data || typeof data !== 'object') return null;
            return data as AdminSearchResult;
        }
    },

    getAll: async (layer: string, filters?: { madinhdanh?: string, sodoto?: string, sothua?: string, tenchu?: string, diachi?: string }, pagination?: { page?: number; limit?: number }): Promise<ParcelListResponse> => {
        let queryString = `?t=${Date.now()}`;
        if (filters) {
            if (filters.madinhdanh) queryString += `&madinhdanh=${encodeURIComponent(filters.madinhdanh)}`;
            if (filters.sodoto) queryString += `&sodoto=${encodeURIComponent(filters.sodoto)}`;
            if (filters.sothua) queryString += `&sothua=${encodeURIComponent(filters.sothua)}`;
            if (filters.tenchu) queryString += `&tenchu=${encodeURIComponent(filters.tenchu)}`;
            if (filters.diachi) queryString += `&diachi=${encodeURIComponent(filters.diachi)}`;
        }
        if (pagination?.page) queryString += `&page=${pagination.page}`;
        if (pagination?.limit) queryString += `&limit=${pagination.limit}`;
        const res = await fetch(`${API_URL}/api/data/${layer}${queryString}`, { headers: { ...getAuthHeaders() } });
        const response = await handleResponse(res);
        if (Array.isArray(response)) {
            return { data: response, total: response.length, page: 1, limit: response.length || 100, pages: 1 };
        }
        return {
            data: Array.isArray(response?.data) ? response.data : [],
            total: Number(response?.total || 0),
            page: Number(response?.page || 1),
            limit: Number(response?.limit || 100),
            pages: Number(response?.pages || 1)
        };
    },

    getExtent: async (layer: string) => {
        const res = await fetch(`${API_URL}/api/data/${layer}/extent`, { headers: { ...getAuthHeaders() } });
        return await handleResponse(res);
    },

    create: async (layer: string, data: ParcelDTO) => {
        const res = await fetch(`${API_URL}/api/data/${layer}`, { method: 'POST', headers: { ...getAuthHeaders() }, body: JSON.stringify(data) });
        return await handleResponse(res);
    },

    bulkCreate: async (layer: string, items: ParcelDTO[]) => {
        const res = await fetch(`${API_URL}/api/data/${layer}/bulk`, { 
            method: 'POST', 
            headers: { ...getAuthHeaders() }, 
            body: JSON.stringify({ items }) 
        });
        return await handleResponse(res);
    },

    createWithUpload: async (layer: string, data: ParcelDTO) => {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            if (key === 'file' && data[key]) formData.append('file', data[key] as File);
            else if (key === 'geometry' && data[key]) formData.append(key, JSON.stringify(data[key]));
            else if (data[key] !== undefined && data[key] !== null) formData.append(key, String(data[key]));
        });
        const headers = { ...getAuthHeaders() };
        delete headers['Content-Type'];
        const res = await fetch(`${API_URL}/api/data/${layer}/upload`, { method: 'POST', headers, body: formData });
        return await handleResponse(res);
    },

    update: async (layer: string, gid: number, data: ParcelDTO) => {
        const res = await fetch(`${API_URL}/api/data/${layer}/${gid}`, { method: 'PUT', headers: { ...getAuthHeaders() }, body: JSON.stringify(data) });
        return await handleResponse(res);
    },

    updateGeometry: async (layer: string, gid: number, geometry: any, area: number) => {
        const res = await fetch(`${API_URL}/api/data/${layer}/${gid}/geometry`, { method: 'PUT', headers: { ...getAuthHeaders() }, body: JSON.stringify({ geometry, area }) });
        return await handleResponse(res);
    },

    delete: async (layer: string, gid: number) => {
        const res = await fetch(`${API_URL}/api/data/${layer}/${gid}`, { method: 'DELETE', headers: { ...getAuthHeaders() } });
        return await handleResponse(res);
    },

    manageTables: {
        getAll: async (): Promise<SpatialTable[]> => {
            const res = await fetch(`${API_URL}/api/spatial-tables?t=${Date.now()}`, { headers: { ...getAuthHeaders() } });
            return await handleResponse(res);
        },
        create: async (tableName: string, displayName?: string, description?: string) => {
            const name = (tableName || '').toLowerCase().trim();
            const res = await fetch(`${API_URL}/api/spatial-tables`, {
                method: 'POST',
                headers: { ...getAuthHeaders() },
                body: JSON.stringify({ tableName: name, displayName, description })
            });
            return await handleResponse(res);
        },
        link: async (tableName: string, displayName?: string, description?: string) => {
            const name = (tableName || '').toLowerCase().trim();
            const res = await fetch(`${API_URL}/api/spatial-tables/link`, {
                method: 'POST',
                headers: { ...getAuthHeaders() },
                body: JSON.stringify({ tableName: name, displayName, description })
            });
            return await handleResponse(res);
        },
        rename: async (oldName: string, newName: string, displayName: string, description?: string, renamePhysical?: boolean) => {
            const res = await fetch(`${API_URL}/api/spatial-tables/rename`, {
                method: 'POST',
                headers: { ...getAuthHeaders() },
                body: JSON.stringify({ 
                    oldName: oldName.toLowerCase().trim(), 
                    newName: newName.toLowerCase().trim(), 
                    displayName, 
                    description,
                    renamePhysical: !!renamePhysical
                })
            });
            return await handleResponse(res);
        },
        syncTable: async (tableName: string) => {
            const res = await fetch(`${API_URL}/api/spatial-tables/sync/${tableName}`, {
                method: 'POST',
                headers: { ...getAuthHeaders() }
            });
            return await handleResponse(res);
        },
        syncAll: async () => {
            const res = await fetch(`${API_URL}/api/spatial-tables/sync-all`, {
                method: 'POST',
                headers: { ...getAuthHeaders() }
            });
            return await handleResponse(res);
        },
        repairTable: async (tableName: string) => {
            const res = await fetch(`${API_URL}/api/spatial-tables/repair/${tableName}`, {
                method: 'POST',
                headers: { ...getAuthHeaders() }
            });
            return await handleResponse(res);
        },
        syncParcelCode: async (tableName: string) => {
            const res = await fetch(`${API_URL}/api/sync-table/${tableName}`, {
                method: 'POST',
                headers: { ...getAuthHeaders() }
            });
            return await handleResponse(res);
        },
        unlink: async (tableName: string) => {
            const name = (tableName || '').toLowerCase().trim();
            const res = await fetch(`${API_URL}/api/spatial-tables/unlink`, { 
                method: 'POST', 
                headers: { ...getAuthHeaders() }, 
                body: JSON.stringify({ tableName: name }) 
            });
            return await handleResponse(res);
        },
        delete: async (tableName: string) => {
            const name = (tableName || '').toLowerCase().trim();
            const res = await fetch(`${API_URL}/api/spatial-tables/${name}`, { method: 'DELETE', headers: { ...getAuthHeaders() } });
            return await handleResponse(res);
        },
        importGeoJsonParcels: async (payload: {
            file: File;
            tableName: string;
            displayName: string;
            description?: string;
            sourceSrid?: number;
            mapping: Record<string, string>;
            onProgress?: (percent: number) => void;
        }) => {
            const formData = new FormData();
            formData.append('file', payload.file);
            formData.append('tableName', (payload.tableName || '').toLowerCase().trim());
            formData.append('displayName', payload.displayName || '');
            formData.append('description', payload.description || '');
            formData.append('sourceSrid', String(payload.sourceSrid || 4326));
            formData.append('mapping', JSON.stringify(payload.mapping || {}));

            const headers = { ...getAuthHeaders() };
            delete headers['Content-Type'];

            const url = `${API_URL}/api/spatial-tables/import-geojson-parcels`;

            return await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);

                Object.entries(headers).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        xhr.setRequestHeader(key, String(value));
                    }
                });

                if (payload.onProgress) {
                    payload.onProgress(0);
                    xhr.upload.onprogress = (event) => {
                        if (!event.lengthComputable) return;
                        const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
                        payload.onProgress?.(percent);
                    };
                }

                xhr.onerror = () => {
                    reject(new Error('Không thể kết nối máy chủ. Có thể bị chặn CORS hoặc mạng không ổn định.'));
                };

                xhr.onload = () => {
                    const responseText = xhr.responseText || '';
                    let responseData: any = null;
                    if (responseText) {
                        try {
                            responseData = JSON.parse(responseText);
                        } catch {
                            responseData = null;
                        }
                    }

                    if (xhr.status === 401 || xhr.status === 403) {
                        localStorage.removeItem('geo_token');
                        localStorage.removeItem('geo_user');
                        window.location.reload();
                        reject(new Error('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.'));
                        return;
                    }

                    if (xhr.status >= 200 && xhr.status < 300) {
                        payload.onProgress?.(100);
                        resolve(responseData || { status: 'ok' });
                        return;
                    }

                    let message = `Lỗi API (${xhr.status})`;
                    if (responseData && (responseData.error || responseData.message)) {
                        message = responseData.error || responseData.message;
                    }
                    reject(new Error(message));
                };

                xhr.send(formData);
            });
        }
    }
};
