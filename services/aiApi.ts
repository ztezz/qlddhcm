import { API_URL } from './parcelApi';

const getAuthHeaders = () => {
    const headers: any = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('geo_token');
    const userStr = localStorage.getItem('geo_user');
    if (token) headers.Authorization = `Bearer ${token}`;
    if (userStr) {
        try {
            const u = JSON.parse(userStr);
            headers['x-user-id'] = u.id;
            headers['x-user-name'] = encodeURIComponent(u.name || 'User');
            headers['x-branch-id'] = u.branchId || u.branch_id || '';
            headers['x-user-role'] = u.role || '';
        } catch {}
    }
    return headers;
};

const handleResponse = async (res: Response) => {
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(data?.error || `Lỗi API (${res.status})`);
    return data;
};

export const aiApi = {
    analyzeParcelHistory: async (payload: {
        action: string;
        before: Record<string, any> | null;
        after: Record<string, any> | null;
        context?: Record<string, any>;
    }): Promise<{ status: string; provider: string; analysis: string; changedFields: any[] }> => {
        const res = await fetch(`${API_URL}/api/ai/analyze-parcel-history`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    chat: async (payload: {
        message: string;
        history?: { role: 'user' | 'assistant'; content: string }[];
        context?: Record<string, any>;
    }): Promise<{ status: string; provider: string; reply: string; parcels?: any[]; landPrices?: any[] }> => {
        const res = await fetch(`${API_URL}/api/ai/chat`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    analyzeTopologyBatch: async (payload: {
        features: any[];
        context?: Record<string, any>;
    }): Promise<{ status: string; provider: string; analysis: string }> => {
        const res = await fetch(`${API_URL}/api/ai/analyze-topology-batch`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    }
};
