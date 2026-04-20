
export enum UserRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER'
}

export interface Message {
    id: number;
    sender_id: string;
    receiver_id: string;
    content: string;
    timestamp: string;
    is_read: boolean;
    is_deleted: boolean;
    sender_name?: string;
    receiver_name?: string;
    sender_avatar?: string;
    sender_email?: string;
    receiver_email?: string;
    receiver_avatar?: string;
}

export interface SystemNotification {
    id: number;
    title: string;
    content: string;
    type: 'INFO' | 'WARNING' | 'DANGER' | 'SUCCESS';
    target_role: string; 
    is_active: boolean;
    created_at: string;
    expires_at?: string | null;
    sender_name?: string;
}

export interface MenuItem {
    id: string;
    label: string;
    icon: string;
    roles: string[];
    order_index: number;
    is_active: boolean;
    type?: 'INTERNAL' | 'EXTERNAL';
    url?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  contactEmail: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  branchId: string;
  is_verified?: boolean; 
  can_chat?: boolean; 
  avatar?: string;
}

export interface LandParcel {
  id: string;
  gid?: any;
  geometry: any;
  properties: {
    ownerName: string;
    landType: string;
    area: number;
    pricePerM2: number;
    totalValue: number;
    planningStatus: 'Safe' | 'Planning' | 'Disputed';
    branchId: string;
    updatedBy?: string;
    updatedAt?: string;
    [key: string]: any;
  };
}

export interface LandPrice2026 {
    id: number;
    phuongxa: string;
    tinhcu: string;    // Tỉnh cũ (Ví dụ: Long Khánh, Biên Hòa cũ...)
    tenduong: string;
    tu: string;
    den: string;
    dato: number;
    dattmdv: number;
    datsxkdpnn: number;
    nam_ap_dung: number;
    nguon_du_lieu?: string;
    ghi_chu?: string;
    created_at?: string;
    updated_at?: string;
}

export interface DashboardStats {
  totalParcels: number;
  totalArea: number;
  totalValue: number;
  parcelsByType: { name: string; value: number }[];
  valueByBranch: { name: string; value: number }[];
}

export interface SystemLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
  branchId: string;
}

export interface LandPriceConfig {
  landType: string;
  basePrice: number;
  description: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface WMSLayerConfig {
    id: string;
    name: string;
    url: string;
    layers: string;
    visible: boolean;
    opacity?: number;
    type?: 'WMS' | 'XYZ'; 
    category?: 'STANDARD' | 'PLANNING' | 'ADMINISTRATIVE';
    mapScope?: 'MAIN' | 'ADMIN' | 'SHARED';
    availableMaps?: string[];
    description?: string;
    sortOrder?: number;
}

export interface BasemapConfig {
    id: string;
    name: string;
    url: string; 
    type: 'XYZ' | 'OSM' | 'GOOGLE';
    isDefault: boolean;
    visible: boolean;
    useProxy?: boolean; // Thêm thuộc tính này
  description?: string;
  sortOrder?: number;
}

export interface SystemSetting {
    key: string;
    value: string;
    label?: string;
    description?: string;
    type: 'text' | 'number' | 'boolean' | 'image';
}

export interface PermissionDefinition {
    code: string;
    name: string;
    group: 'MAP' | 'DATA' | 'SYSTEM' | 'REPORT' | 'USERS' | 'CONTENT';
    description?: string;
}

export interface RoleConfig {
    role: UserRole;
    permissions: string[];
}
