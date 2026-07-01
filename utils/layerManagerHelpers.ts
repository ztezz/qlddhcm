import { MapScope } from './layerScope';

export const TIFF_MARKER = '#TIFF';
export const ACTIVE_TAB_STORAGE_KEY = 'admin.layerManager.activeTab';

export const parseIsTiffLayer = (description: string): boolean => {
    const text = (description || '').toLowerCase();
    return text.includes('#tiff') || text.includes('[tiff]') || text.includes('raster:tiff') || text.includes('layer:tiff') || text.includes('format:tiff');
};

export const applyTiffMarkerToDescription = (description: string, isTiff: boolean): string => {
    const cleaned = (description || '')
        .replace(/#tiff/gi, '')
        .replace(/\[tiff\]/gi, '')
        .replace(/raster:tiff/gi, '')
        .replace(/layer:tiff/gi, '')
        .replace(/format:tiff/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    if (!isTiff) return cleaned;
        return cleaned ? `${cleaned} ${TIFF_MARKER}` : TIFF_MARKER;
};

export const stripScopeMarker = (description: string): string => {
    return (description || '')
        .replace(/\[map:(main|admin|shared|all)\]/gi, '')
        .replace(/#map-(main|admin|shared)/gi, '')
        .replace(/scope:(main|admin|shared)/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

export const applyScopeMarkerToDescription = (description: string, mapScope: MapScope): string => {
    const cleaned = stripScopeMarker(description);
        const marker = mapScope === 'SHARED' ? '[map:shared]' : mapScope === 'ADMIN' ? '[map:admin]' : '[map:main]';
        return cleaned ? `${cleaned} ${marker}` : marker;
};

export const getScopeMeta = (scope: MapScope) => {
        if (scope === 'ADMIN') return { label: 'Map hành chính', badge: 'bg-indigo-900/40 text-indigo-300 border-indigo-700/60' };
        if (scope === 'SHARED') return { label: 'Dùng chung', badge: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/60' };
        return { label: 'Map chính', badge: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/60' };
};

export const BASEMAP_PRESETS = [
        { key: 'osm-standard', name: 'OpenStreetMap', type: 'OSM', url: '', useProxy: false, description: 'Nền bản đồ OSM chuẩn, nhẹ và ổn định.' },
        { key: 'google-road', name: 'Google Road', type: 'XYZ', url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', useProxy: true, description: 'Bản đồ đường phố Google.' },
        { key: 'google-satellite', name: 'Google Satellite', type: 'XYZ', url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', useProxy: true, description: 'Ảnh vệ tinh Google.' },
        { key: 'google-hybrid', name: 'Google Hybrid', type: 'XYZ', url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', useProxy: true, description: 'Ảnh vệ tinh kèm nhãn đường.' },
        { key: 'google-terrain', name: 'Google Terrain', type: 'XYZ', url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', useProxy: true, description: 'Địa hình Google.' },
        { key: 'carto-light', name: 'Carto Light', type: 'XYZ', url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', useProxy: false, description: 'Nền sáng, sạch cho lớp chuyên đề.' },
        { key: 'carto-dark', name: 'Carto Dark', type: 'XYZ', url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', useProxy: false, description: 'Nền tối phù hợp dashboard.' },
        { key: 'esri-imagery', name: 'Esri World Imagery', type: 'XYZ', url: 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', useProxy: false, description: 'Ảnh vệ tinh Esri.' },
        { key: 'esri-topo', name: 'Esri Topographic', type: 'XYZ', url: 'https://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', useProxy: false, description: 'Bản đồ địa hình Esri.' }
] as const;

export const normalizeSortOrderValue = (value: unknown, fallback: number): number => {
    const normalized = Number(value);
        return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
};

export const reindexSortOrder = <T extends { sortOrder?: number }>(items: T[]): T[] => {
    return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
};

export const reorderById = <T extends { id: string }>(items: T[], fromId: string, toId: string): T[] => {
    const fromIndex = items.findIndex((item) => item.id === fromId);
    const toIndex = items.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
};
