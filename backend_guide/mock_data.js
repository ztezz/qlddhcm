
export const MOCK_DATA = {
    branches: [
        { id: 'br-1', code: 'HCM', name: 'Chi nhánh TP.HCM', address: 'Quận 1, TP.HCM' },
        { id: 'br-2', code: 'BD', name: 'Chi nhánh Bình Dương', address: 'Thủ Dầu Một, Bình Dương' }
    ],
    land_prices: [
        { landType: 'ONT', basePrice: 15000000, description: 'Đất ở nông thôn' },
        { landType: 'ODT', basePrice: 45000000, description: 'Đất ở đô thị' },
        { landType: 'CLN', basePrice: 500000, description: 'Đất trồng cây lâu năm' }
    ],
    wms_layers: [
        { id: 'l1', name: 'Quy hoạch sử dụng đất', url: 'https://geoserver.example.com/wms', layers: 'qh_sd_dat', is_active: true, opacity: 0.7, type: 'wms' },
        { id: 'l2', name: 'Hiện trạng sử dụng đất', url: 'https://geoserver.example.com/wms', layers: 'ht_sd_dat', is_active: true, opacity: 0.6, type: 'wms' }
    ],
    basemaps: [
        { id: 'b1', name: 'Bản đồ vệ tinh', url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', is_active: true, type: 'xyz' },
        { id: 'b2', name: 'Bản đồ giao thông', url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', is_active: true, type: 'xyz' }
    ],
    menu_items: [
        { id: 'm1', label: 'Bản đồ', icon: 'Map', roles: ['admin', 'user'], order_index: 1, is_active: true, type: 'route', url: '/map' },
        { id: 'm2', label: 'Thống kê', icon: 'BarChart', roles: ['admin'], order_index: 2, is_active: true, type: 'route', url: '/stats' },
        { id: 'm3', label: 'Cấu hình', icon: 'Settings', roles: ['admin'], order_index: 3, is_active: true, type: 'route', url: '/settings' },
        { id: 'about', label: 'Giới thiệu', icon: 'Info', roles: ['GUEST', 'VIEWER', 'EDITOR', 'ADMIN'], order_index: 10, is_active: true, type: 'INTERNAL', url: '/gioithieu' }
    ],
    system_settings: [
        { key: 'site_name', value: 'GeoMaster Enterprise' },
        { key: 'allow_registration', value: 'true' }
    ],
    users: [
        { id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'admin', branch_id: 'br-1', is_active: true, password_hash: '123', is_verified: true },
        { id: 'u2', name: 'User', email: 'user@example.com', role: 'user', branch_id: 'br-2', is_active: true, password_hash: '123', is_verified: true }
    ],
    spatial_tables: [
        { table_name: 'thua_dat', table_label: 'Thửa đất', geometry_column: 'geom', srid: 4326 }
    ]
};
