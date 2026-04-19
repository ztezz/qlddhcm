import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { User, WMSLayerConfig } from '../types';
import Seo from '../components/Seo';
import { API_URL } from '../services/parcelApi';
import { gisService } from '../services/mockBackend';
import { parcelApi, AdminSearchResult } from '../services/parcelApi';

// Hooks
import { useMap } from '../hooks/useMap';

// Components
import MapStatusIndicators from '../components/map/MapStatusIndicators';
import MapInfoOverlay from '../components/map/MapInfoOverlay';
import MapControls from '../components/map/MapControls';
import MapDialog from '../components/map/MapDialog';
import AdminMapPanel, { ProvinceSuggestion } from '../components/map/admin/AdminMapPanel';
import AdminInfoCard, { SelectedAdminInfo } from '../components/map/admin/AdminInfoCard';
import { AdminPanelStyle, getAdminPanelTheme } from '../components/map/admin/adminPanelTheme';

// Utilities
import { highlightStyle, locationStyle, measureStyle } from '../components/map/mapUtils';
import { MAP_CONFIG } from '../utils/mapConstants';
import { removeAccents } from '../utils/helpers';
import { isLayerVisibleInMap } from '../utils/layerScope';

// OpenLayers
import Map from 'ol/Map';
import View from 'ol/View';
import Overlay from 'ol/Overlay';
import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import { Tile as TileLayer, Vector as VectorLayer, Group as LayerGroup } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import * as proj from 'ol/proj';
import { defaults as defaultControls } from 'ol/control/defaults';
import { isEmpty as isExtentEmpty } from 'ol/extent';
import proj4 from "proj4";
import { register } from 'ol/proj/proj4';

// Đăng ký VN-2000 (Kinh tuyến trục 105.75 cho Bình Dương/HCM)
proj4.defs("EPSG:9210", "+proj=tmerc +lat_0=0 +lon_0=105.75 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.904,-39.303,-111.450,0,0,0,0 +units=m +no_defs");
register(proj4);

const ThematicMapPage: React.FC<{ user: User | null; systemSettings?: Record<string, string> }> = ({ user, systemSettings }) => {
    const mapElement = useRef<HTMLDivElement>(null);
    const activeLayerIdRef = useRef<string | null>(null);
    const adminMapLayerFilter = useCallback((layer: WMSLayerConfig) => isLayerVisibleInMap(layer, 'ADMIN'), []);
    const visibleLayerIdsRef = useRef<string[]>([]);
    const thematicLayersRef = useRef<WMSLayerConfig[]>([]);
    const thematicLayerIdSetRef = useRef<Set<string>>(new Set());
    const provinceFeatureCacheRef = useRef<Partial<Record<string, any[]>>>({});
    const provinceFeatureFetchRef = useRef<Partial<Record<string, Promise<any[]>>>>({});
    const failedAdminSearchLayerRef = useRef<Set<string>>(new Set());
    const thematicBasemapAppliedRef = useRef(false);
    const [isQuerying, setIsQuerying] = useState(false);
    const [provinceKeyword, setProvinceKeyword] = useState('');
    const [isProvinceSearching, setIsProvinceSearching] = useState(false);
    const [provinceSuggestions, setProvinceSuggestions] = useState<ProvinceSuggestion[]>([]);
    const [showProvinceSuggestions, setShowProvinceSuggestions] = useState(false);
    const [selectedAdminInfo, setSelectedAdminInfo] = useState<SelectedAdminInfo | null>(null);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(() => window.innerWidth >= 1024);
    const [adminPanelTab, setAdminPanelTab] = useState<'SEARCH' | 'LAYERS'>('SEARCH');
    const [panelStyle, setPanelStyle] = useState<AdminPanelStyle>('LIGHT');
    const [isTabletViewport, setIsTabletViewport] = useState(() => window.innerWidth >= 768 && window.innerWidth < 1024);
    
    const {
        // Refs
        mapInstance,
        highlightLayer,
        wmsLayerGroup,
        baseLayerRef,
        overlayInstance,
        measureSource,

        // State
        availableLayers, setAvailableLayers,
        visibleLayerIds, setVisibleLayerIds,
        activeLayerId, setActiveLayerId,
        basemaps, setBasemaps,
        activeBasemapId, setActiveBasemapId,
        isInitialLoading, setIsInitialLoading,
        mapRotation, setMapRotation,
        mapZoom, setMapZoom,
        mouseCoord, setMouseCoord,
        dialog, setDialog,

        // Actions
        handleLocateUser,
        initData
    } = useMap(user, systemSettings, adminMapLayerFilter);

    const thematicLayers = useMemo(() => {
        return availableLayers.filter((layer) => {
            const category = String(layer.category || 'STANDARD').toUpperCase();
            return category === 'ADMINISTRATIVE' && isLayerVisibleInMap(layer, 'ADMIN');
        });
    }, [availableLayers]);

    const thematicLayerIdSet = useMemo(
        () => new Set(thematicLayers.map((layer) => layer.id)),
        [thematicLayers]
    );

    const isRasterTiffLayer = useCallback((layer: WMSLayerConfig) => {
        const description = String(layer.description || '').toLowerCase();
        const explicitMarkers = ['#tiff', '[tiff]', 'raster:tiff', 'layer:tiff', 'format:tiff'];
        if (explicitMarkers.some((marker) => description.includes(marker))) {
            return true;
        }

        const text = `${layer.url || ''} ${layer.layers || ''} ${layer.name || ''} ${description}`.toLowerCase();
        return text.includes('.tif') || text.includes('.tiff') || text.includes('image/tiff') || text.includes('geotiff') || text.includes('tiff');
    }, []);

    const isInteractiveAdministrativeLayer = useCallback((layer: WMSLayerConfig) => {
        if (layer.type === 'XYZ') return false;
        if (isRasterTiffLayer(layer)) return false;
        return true;
    }, [isRasterTiffLayer]);

    const getLayerTypeLabel = useCallback((layer: WMSLayerConfig) => {
        if (layer.type === 'XYZ') return 'XYZ';
        if (isRasterTiffLayer(layer)) return 'WMS TIFF';
        return 'WMS';
    }, [isRasterTiffLayer]);

    const thematicBasemapOptions = useMemo(() => {
        return Array.isArray(basemaps) ? basemaps.filter((b) => b.visible !== false) : [];
    }, [basemaps]);

    const sanitizeAdminProperties = useCallback((rawProperties: Record<string, any> = {}, fallbackName = '') => {
        const allowedKeys = ['ma_tinh', 'ten_tinh', 'sap_nhap', 'quy_mo', 'tru_so', 'loai', 'cap', 'dtich_km2', 'dan_so', 'matdo_km2', 'name'];
        const cleaned = Object.fromEntries(
            allowedKeys
                .map((key) => [key, rawProperties[key]])
                .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
        ) as Record<string, any>;

        const normalizedName = cleaned.ten_tinh || cleaned.name || fallbackName;
        if (normalizedName) {
            cleaned.ten_tinh = normalizedName;
        }

        return cleaned;
    }, []);

    useEffect(() => {
        activeLayerIdRef.current = activeLayerId;
    }, [activeLayerId]);

    useEffect(() => {
        if (window.innerWidth < 1024) {
            setIsAdminPanelOpen(false);
        }
    }, []);

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            setIsTabletViewport(width >= 768 && width < 1024);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        visibleLayerIdsRef.current = visibleLayerIds;
    }, [visibleLayerIds]);

    useEffect(() => {
        thematicLayersRef.current = thematicLayers;
        thematicLayerIdSetRef.current = thematicLayerIdSet;
    }, [thematicLayers, thematicLayerIdSet]);

    // Chỉ giữ lớp hành chính ở trang này để đảm bảo tách biệt với MapPage.
    useEffect(() => {
        setVisibleLayerIds((prev) => {
            const next = prev.filter((id) => thematicLayerIdSet.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [thematicLayerIdSet, setVisibleLayerIds]);

    useEffect(() => {
        if (activeLayerId && !thematicLayerIdSet.has(activeLayerId)) {
            const fallback = visibleLayerIds.find((id) => thematicLayerIdSet.has(id)) || thematicLayers[0]?.id || null;
            setActiveLayerId(fallback);
        }
    }, [activeLayerId, visibleLayerIds, thematicLayerIdSet, thematicLayers, setActiveLayerId]);

    useEffect(() => {
        if (thematicBasemapAppliedRef.current) return;
        if (!Array.isArray(basemaps) || basemaps.length === 0) return;

        const configuredBasemapId = String(systemSettings?.thematic_default_basemap_id || '').trim();
        if (!configuredBasemapId) {
            thematicBasemapAppliedRef.current = true;
            return;
        }

        const exists = basemaps.find((b) => b.id === configuredBasemapId);
        if (exists) {
            setActiveBasemapId(configuredBasemapId);
        }
        thematicBasemapAppliedRef.current = true;
    }, [basemaps, systemSettings, setActiveBasemapId]);

    const buildPreferredLayerIds = useCallback(() => {
        const currentActiveLayerId = activeLayerIdRef.current;
        const currentVisibleLayerIds = visibleLayerIdsRef.current;
        const allThematic = thematicLayersRef.current;

        const ids: string[] = [];
        if (currentActiveLayerId) ids.push(currentActiveLayerId);
        currentVisibleLayerIds.forEach((id) => {
            if (!ids.includes(id)) ids.push(id);
        });
        allThematic.forEach((layer) => {
            if (!ids.includes(layer.id)) ids.push(layer.id);
        });
        return ids;
    }, []);

    const detectGeometryProjection = useCallback((geometryData: any): string => {
        try {
            let coord: any = null;
            if (geometryData?.type === 'Point') coord = geometryData.coordinates;
            if (geometryData?.type === 'MultiPoint' && Array.isArray(geometryData.coordinates)) coord = geometryData.coordinates[0];
            if (geometryData?.type === 'LineString' && Array.isArray(geometryData.coordinates)) coord = geometryData.coordinates[0];
            if (geometryData?.type === 'Polygon' && Array.isArray(geometryData.coordinates)) coord = geometryData.coordinates[0]?.[0];
            if (geometryData?.type === 'MultiPolygon' && Array.isArray(geometryData.coordinates)) coord = geometryData.coordinates[0]?.[0]?.[0];
            if (!Array.isArray(coord) || coord.length < 2) return 'EPSG:4326';

            const x = Math.abs(Number(coord[0]));
            const y = Math.abs(Number(coord[1]));
            if (!Number.isFinite(x) || !Number.isFinite(y)) return 'EPSG:4326';
            if (x > 1000000 || y > 1000000) return 'EPSG:3857';
            if ((x > 300000 && x < 900000) || (y > 1000000 && y < 2000000)) return 'EPSG:9210';
            return 'EPSG:4326';
        } catch (_) {
            return 'EPSG:4326';
        }
    }, []);

    const highlightGeoJsonGeometry = useCallback((geometryData: any, shouldFit = true) => {
        if (!geometryData) return;
        try {
            const format = new GeoJSON();
            const dataProjection = detectGeometryProjection(geometryData);
            const geometry = format.readGeometry(geometryData, { dataProjection, featureProjection: 'EPSG:3857' });
            if (!geometry) return;

            const source = highlightLayer.current?.getSource();
            source?.clear();
            source?.addFeature(new Feature({ geometry }));

            if (shouldFit) {
                const extent = geometry.getExtent();
                if (extent && !isExtentEmpty(extent)) {
                    mapInstance.current?.getView().fit(extent, {
                        padding: [90, 90, 90, 90],
                        duration: 700,
                        maxZoom: 12
                    });
                }
            }
        } catch (err) {
            console.error('Highlight geometry failed:', err);
        }
    }, [highlightLayer, mapInstance, detectGeometryProjection]);

    const renderSearchResult = useCallback((match: AdminSearchResult, config: WMSLayerConfig, currentVisibleLayerIds: string[], currentOlLayers: any[]) => {
        const properties = match?.properties || {};
        setSelectedAdminInfo({
            layerName: config.name || 'Đơn vị hành chính',
            properties: sanitizeAdminProperties(properties, properties.ten_tinh || properties.name || match.name)
        });

        const olLayer = currentOlLayers.find((layer) => layer.get('layerId') === config.id) as TileLayer<any>;
        if (olLayer && !currentVisibleLayerIds.includes(config.id)) {
            setVisibleLayerIds((prev) => [...prev, config.id]);
        }
        setActiveLayerId(config.id);
        highlightGeoJsonGeometry(match?.geometry, true);
    }, [setVisibleLayerIds, setActiveLayerId, highlightGeoJsonGeometry, sanitizeAdminProperties]);

    useEffect(() => {
        const keyword = provinceKeyword.replace(/\\+/g, ' ').trim();
        if (keyword.length < 2) {
            setProvinceSuggestions([]);
            return;
        }

        const currentThematicLayers = thematicLayersRef.current;
        const targetLayerIds = buildPreferredLayerIds();

        if (targetLayerIds.length === 0) {
            setProvinceSuggestions([]);
            return;
        }

        const timer = window.setTimeout(async () => {
            try {
                const chunks = await Promise.all(targetLayerIds.map(async (layerId) => {
                    const config = currentThematicLayers.find((l) => l.id === layerId);
                    if (!config || !isInteractiveAdministrativeLayer(config)) return [] as Array<{ name: string; layerId: string }>;
                    if (failedAdminSearchLayerRef.current.has(layerId)) return [] as Array<{ name: string; layerId: string }>;
                    const tableName = config.layers.includes(':') ? config.layers.split(':').pop() || '' : config.layers;
                    if (!tableName) return [] as Array<{ name: string; layerId: string }>;

                    const s = await parcelApi.adminSearch.suggest(tableName, keyword, 6).catch((err) => {
                        if (String(err?.message || '').includes('(500)')) {
                            failedAdminSearchLayerRef.current.add(layerId);
                        }
                        return [];
                    });
                    return s.map((item) => ({ name: item.name, layerId }));
                }));

                const flat = chunks.flat();
                const dedupMap: Record<string, { name: string; layerId: string }> = {};
                flat.forEach((item) => {
                    const key = `${item.layerId}::${item.name}`;
                    if (!dedupMap[key]) dedupMap[key] = item;
                });
                let dedup = Object.values(dedupMap).slice(0, 12);

                // Fallback to local feature cache so dropdown still works when DB suggest endpoint is unavailable.
                if (dedup.length === 0) {
                    const localMatches: Array<{ name: string; layerId: string }> = [];
                    const normKeyword = removeAccents(keyword);
                    for (const layerId of targetLayerIds) {
                        const config = currentThematicLayers.find((l) => l.id === layerId);
                        if (!config || !isInteractiveAdministrativeLayer(config)) continue;
                        const features = provinceFeatureCacheRef.current[layerId] || [];
                        for (const f of features) {
                            const props = f?.properties || {};
                            const nameVal = props.ten_tinh || props.ten_tinh_tp || props.ten_dvhc || props.ten || props.name || props.province;
                            const name = typeof nameVal === 'string' ? nameVal.trim() : '';
                            if (!name) continue;
                            if (removeAccents(name).includes(normKeyword)) {
                                localMatches.push({ name, layerId });
                            }
                        }
                    }

                    const localDedupMap: Record<string, { name: string; layerId: string }> = {};
                    localMatches.forEach((item) => {
                        const key = `${item.layerId}::${item.name}`;
                        if (!localDedupMap[key]) localDedupMap[key] = item;
                    });
                    dedup = Object.values(localDedupMap).slice(0, 12);
                }

                setProvinceSuggestions(dedup);
            } catch {
                setProvinceSuggestions([]);
            }
        }, 220);

        return () => window.clearTimeout(timer);
    }, [provinceKeyword, buildPreferredLayerIds, thematicLayers, visibleLayerIds, activeLayerId, isInteractiveAdministrativeLayer]);

    const buildWfsUrl = useCallback((config: WMSLayerConfig, maxFeatures = 200) => {
        const rawLayerUrl = (config.url || '').trim();
        if (!rawLayerUrl) return null;

        let wfsUrl: URL;
        try {
            wfsUrl = new URL(rawLayerUrl);
        } catch (_) {
            return null;
        }

        wfsUrl.pathname = wfsUrl.pathname.replace(/\/wms$/i, '/wfs');
        wfsUrl.search = '';
        wfsUrl.searchParams.set('service', 'WFS');
        wfsUrl.searchParams.set('version', '1.1.0');
        wfsUrl.searchParams.set('request', 'GetFeature');
        wfsUrl.searchParams.set('outputFormat', 'application/json');
        wfsUrl.searchParams.set('typeName', config.layers);
        wfsUrl.searchParams.set('maxFeatures', String(maxFeatures));
        return wfsUrl;
    }, []);

    const fetchWfsFeatures = useCallback(async (wfsUrl: URL): Promise<any[]> => {
        const proxiedUrl = `${API_URL}/api/proxy/forward?url=${encodeURIComponent(wfsUrl.toString())}`;
        try {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 10000);
            const response = await fetch(proxiedUrl, { signal: controller.signal });
            window.clearTimeout(timeoutId);

            if (!response.ok) return [];

            const rawText = await response.text();
            if (!rawText || rawText.trim().length === 0) return [];

            const parsed = JSON.parse(rawText);
            return Array.isArray(parsed?.features) ? parsed.features : [];
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                console.warn('Province search request timed out');
            }
            return [];
        }
    }, []);

    const getLayerFeaturesCached = useCallback(async (config: WMSLayerConfig): Promise<any[]> => {
        const cached = provinceFeatureCacheRef.current[config.id];
        if (cached) {
            return cached;
        }

        const pendingExisting = provinceFeatureFetchRef.current[config.id];
        if (pendingExisting) {
            return pendingExisting;
        }

        const pending = (async () => {
            const wfsUrl = buildWfsUrl(config, 500);
            if (!wfsUrl) return [];
            const features = await fetchWfsFeatures(wfsUrl);
            provinceFeatureCacheRef.current[config.id] = features;
            return features;
        })();

        provinceFeatureFetchRef.current[config.id] = pending;
        try {
            return await pending;
        } finally {
            delete provinceFeatureFetchRef.current[config.id];
        }
    }, [buildWfsUrl, fetchWfsFeatures]);

    useEffect(() => {
        const visibleAdminLayers = thematicLayers.filter((layer) =>
            visibleLayerIds.includes(layer.id) && isInteractiveAdministrativeLayer(layer)
        );
        visibleAdminLayers.forEach((layer) => {
            void getLayerFeaturesCached(layer);
        });
    }, [thematicLayers, visibleLayerIds, getLayerFeaturesCached, isInteractiveAdministrativeLayer]);

    const handleSearchProvinceByName = useCallback(async () => {
        const keyword = provinceKeyword.replace(/\\+/g, ' ').trim();
        if (!keyword || !mapInstance.current) return;

        const currentOlLayers = wmsLayerGroup.current?.getLayers().getArray() || [];
        const currentVisibleLayerIds = visibleLayerIdsRef.current;
        const currentThematicLayers = thematicLayersRef.current;

        const targetLayerIds = buildPreferredLayerIds();

        if (targetLayerIds.length === 0) {
            setDialog({
                isOpen: true,
                type: 'info',
                title: 'Chưa có lớp hành chính',
                message: 'Chưa có lớp hành chính khả dụng để tìm kiếm theo tên tỉnh.'
            });
            return;
        }

        setIsProvinceSearching(true);
        setShowProvinceSuggestions(false);
        const normalizedKeyword = removeAccents(keyword);

        const getProvinceName = (properties: Record<string, any>) => {
            return String(
                properties?.ten_tinh ||
                properties?.ten_tinh_tp ||
                properties?.ten ||
                properties?.name ||
                properties?.province ||
                ''
            );
        };

        const isProvinceMatch = (properties: Record<string, any>): boolean => {
            const name = removeAccents(getProvinceName(properties));
            if (name && name.includes(normalizedKeyword)) return true;

            const knownKeys = ['ten_tinh', 'ten_tinh_tp', 'ten', 'name', 'province', 'ten_dvhc', 'ten_don_vi'];
            for (const key of knownKeys) {
                const value = properties?.[key];
                if (typeof value === 'string' && removeAccents(value).includes(normalizedKeyword)) {
                    return true;
                }
            }
            return false;
        };

        try {
            for (const layerId of targetLayerIds) {
                const config = currentThematicLayers.find((layer) => layer.id === layerId);
                if (!config || !isInteractiveAdministrativeLayer(config)) continue;

                const tableName = config.layers.includes(':') ? config.layers.split(':').pop() || '' : config.layers;
                if (tableName && !failedAdminSearchLayerRef.current.has(layerId)) {
                    const dbResults = await parcelApi.adminSearch.search(tableName, keyword, 5).catch((err) => {
                        if (String(err?.message || '').includes('(500)')) {
                            failedAdminSearchLayerRef.current.add(layerId);
                        }
                        return [];
                    });
                    const dbMatched = dbResults.find((r) => isProvinceMatch(r?.properties || {})) || dbResults[0];
                    if (dbMatched) {
                        renderSearchResult(dbMatched, config, currentVisibleLayerIds, currentOlLayers);
                        return;
                    }
                }

                const features = await getLayerFeaturesCached(config);

                if (features.length === 0) continue;

                const matched = features.find((f: any) => {
                    return isProvinceMatch(f?.properties || {});
                });

                if (!matched) continue;

                renderSearchResult({
                    gid: Number(matched?.id || 0),
                    name: getProvinceName(matched?.properties || {}),
                    properties: matched?.properties || {},
                    geometry: matched?.geometry || null
                }, config, currentVisibleLayerIds, currentOlLayers);

                return;
            }

            setDialog({
                isOpen: true,
                type: 'info',
                title: 'Không tìm thấy kết quả',
                message: `Không có tỉnh nào khớp với từ khóa "${keyword}" trong các lớp hành chính đang bật.`
            });
        } catch (error) {
            console.error('Province search failed:', error);
            setDialog({
                isOpen: true,
                type: 'error',
                title: 'Lỗi tìm kiếm',
                message: 'Không thể tìm kiếm theo tên tỉnh vào lúc này. Vui lòng thử lại.'
            });
        } finally {
            setIsProvinceSearching(false);
        }
    }, [provinceKeyword, mapInstance, wmsLayerGroup, setDialog, getLayerFeaturesCached, renderSearchResult, buildPreferredLayerIds, isInteractiveAdministrativeLayer]);

    const handleProvinceSuggestionSelect = useCallback(async (item: ProvinceSuggestion) => {
        setProvinceKeyword(item.name);
        setShowProvinceSuggestions(false);

        const config = thematicLayersRef.current.find((l) => l.id === item.layerId);
        if (!config || !isInteractiveAdministrativeLayer(config)) return;

        const tableName = config.layers.includes(':') ? config.layers.split(':').pop() || '' : config.layers;
        if (!tableName) return;

        setIsProvinceSearching(true);
        try {
            const rows = await parcelApi.adminSearch.search(tableName, item.name.replace(/\\+/g, ' ').trim(), 5).catch((err) => {
                if (String(err?.message || '').includes('(500)')) {
                    failedAdminSearchLayerRef.current.add(item.layerId);
                }
                return [];
            });
            const matched = rows.find((r) => removeAccents(String(r.name || '')).includes(removeAccents(item.name))) || rows[0];
            if (!matched) return;
            const currentOlLayers = wmsLayerGroup.current?.getLayers().getArray() || [];
            const currentVisibleLayerIds = visibleLayerIdsRef.current;
            renderSearchResult(matched, config, currentVisibleLayerIds, currentOlLayers);
        } finally {
            setIsProvinceSearching(false);
        }
    }, [isInteractiveAdministrativeLayer, renderSearchResult, wmsLayerGroup]);

    const handleLayerOpacityChange = useCallback((id: string, opacity: number) => {
        setAvailableLayers((prev) => prev.map((layer) => layer.id === id ? { ...layer, opacity } : layer));
    }, [setAvailableLayers]);

    const zoomToLayerExtent = useCallback(async (layerId: string) => {
        const map = mapInstance.current;
        if (!map) return;

        const layerConfig = thematicLayersRef.current.find((l) => l.id === layerId);
        if (!layerConfig) return;

        const tableName = layerConfig.layers.includes(':')
            ? layerConfig.layers.split(':').pop()
            : layerConfig.layers;

        if (!tableName) return;

        try {
            const extentData = await gisService.getExtent(tableName);
            if (!extentData || extentData.xmin == null || extentData.ymin == null || extentData.xmax == null || extentData.ymax == null) {
                return;
            }

            const xmin = Number(extentData.xmin);
            const ymin = Number(extentData.ymin);
            const xmax = Number(extentData.xmax);
            const ymax = Number(extentData.ymax);

            if ([xmin, ymin, xmax, ymax].some((v) => Number.isNaN(v))) return;

            const rawExtent: [number, number, number, number] = [xmin, ymin, xmax, ymax];

            let sourceProj = 'EPSG:4326';
            if (Math.abs(xmin) > 300000 && Math.abs(xmin) < 900000) {
                sourceProj = 'EPSG:9210';
            } else if (Math.abs(xmin) > 1000000) {
                sourceProj = 'EPSG:3857';
            }

            const fitExtent = sourceProj === 'EPSG:3857'
                ? rawExtent
                : proj.transformExtent(rawExtent, sourceProj, 'EPSG:3857');

            if (fitExtent.some((v) => Number.isNaN(v))) return;

            map.getView().fit(fitExtent, {
                padding: [80, 80, 80, 80],
                duration: 700,
                maxZoom: 13
            });
        } catch (error) {
            console.error('Zoom to administrative layer failed:', error);
        }
    }, [mapInstance]);

    useEffect(() => {
        if (!mapElement.current || mapInstance.current) return;
        const initLng = parseFloat(systemSettings?.thematic_map_center_lng ?? '') || parseFloat(systemSettings?.map_center_lng ?? '') || MAP_CONFIG.DEFAULT_CENTER[0];
        const initLat = parseFloat(systemSettings?.thematic_map_center_lat ?? '') || parseFloat(systemSettings?.map_center_lat ?? '') || MAP_CONFIG.DEFAULT_CENTER[1];
        const initZoom = parseFloat(systemSettings?.thematic_default_zoom ?? '') || parseFloat(systemSettings?.default_zoom ?? '') || MAP_CONFIG.DEFAULT_ZOOM;
        const initMinZoom = parseFloat(systemSettings?.thematic_map_min_zoom ?? '') || parseFloat(systemSettings?.map_min_zoom ?? '') || MAP_CONFIG.MIN_ZOOM;
        const initMaxZoom = parseFloat(systemSettings?.thematic_map_max_zoom ?? '') || parseFloat(systemSettings?.map_max_zoom ?? '') || MAP_CONFIG.MAX_ZOOM;

        const map = new Map({
            target: mapElement.current,
            layers: [
                new TileLayer({ zIndex: 0 }),
                new LayerGroup({ zIndex: 10 }),
                new VectorLayer({ source: new VectorSource(), zIndex: 10000, style: highlightStyle }),
                new VectorLayer({ source: new VectorSource(), zIndex: 20000, style: locationStyle }),
                new VectorLayer({ source: measureSource.current, zIndex: 30000, style: measureStyle }),
            ],
            view: new View({ 
                center: proj.fromLonLat([initLng, initLat]), 
                zoom: initZoom, 
                minZoom: initMinZoom, 
                maxZoom: initMaxZoom 
            }),
            controls: defaultControls({ attribution: false })
        });
        
        baseLayerRef.current = map.getLayers().getArray()[0] as TileLayer<any>;
        wmsLayerGroup.current = map.getLayers().getArray()[1] as LayerGroup;
        highlightLayer.current = map.getLayers().getArray()[2] as VectorLayer<VectorSource>;
        overlayInstance.current = new Overlay({ 
            element: document.createElement('div'), 
            autoPan: { animation: { duration: MAP_CONFIG.POPUP_ANIMATION_DURATION } }, 
            offset: [0, -15],
            positioning: 'bottom-center' 
        });
        
        map.addOverlay(overlayInstance.current);

        map.on('pointermove', (evt) => {
            if (!evt.dragging) {
                setMouseCoord(proj.toLonLat(evt.coordinate));
            }
        });

        map.on('singleclick', async (evt) => {
            const view = map.getView();
            const resolution = view.getResolution();
            const projection = view.getProjection();
            const currentOlLayers = wmsLayerGroup.current?.getLayers().getArray() || [];
            if (currentOlLayers.length === 0) {
                setSelectedAdminInfo(null);
                return;
            }

            const targetLayerIds: string[] = [];
            const currentActiveLayerId = activeLayerIdRef.current;
            const currentVisibleLayerIds = visibleLayerIdsRef.current;
            const currentThematicLayerIdSet = thematicLayerIdSetRef.current;
            const currentThematicLayers = thematicLayersRef.current;

            if (currentActiveLayerId && currentThematicLayerIdSet.has(currentActiveLayerId)) {
                targetLayerIds.push(currentActiveLayerId);
            }
            currentVisibleLayerIds.forEach((id) => {
                if (id !== currentActiveLayerId && currentThematicLayerIdSet.has(id)) {
                    targetLayerIds.push(id);
                }
            });

            if (targetLayerIds.length === 0) {
                setSelectedAdminInfo(null);
                return;
            }

            setIsQuerying(true);
            setSelectedAdminInfo(null);

            try {
                for (const layerId of targetLayerIds) {
                    const config = currentThematicLayers.find((layer) => layer.id === layerId);
                    if (!config || !isInteractiveAdministrativeLayer(config)) continue;

                    const olLayer = currentOlLayers.find((layer) => layer.get('layerId') === layerId) as TileLayer<any>;
                    const source = olLayer?.getSource() as any;
                    if (!source?.getFeatureInfoUrl) continue;

                    const url = source.getFeatureInfoUrl(evt.coordinate, resolution!, projection, {
                        INFO_FORMAT: 'application/json',
                        FEATURE_COUNT: 1
                    });

                    if (!url) continue;

                    const response = await fetch(url);
                    if (!response.ok) continue;
                    const data = await response.json();
                    if (data?.features?.length > 0) {
                        const feature = data.features[0];
                        const props = feature.properties || {};
                        setSelectedAdminInfo({
                            layerName: config.name || 'Đơn vị hành chính',
                            properties: sanitizeAdminProperties(props, props.ten_tinh || props.name || config.name)
                        });

                        if (feature.geometry) {
                            highlightGeoJsonGeometry(feature.geometry, false);
                        } else {
                            const tableName = config.layers.includes(':') ? config.layers.split(':').pop() || '' : config.layers;
                            const gidFromProps = Number(props.gid || 0);
                            const gidFromId = Number(String(feature.id || '').split('.').pop() || 0);
                            const gid = gidFromProps > 0 ? gidFromProps : (gidFromId > 0 ? gidFromId : 0);
                            if (tableName && gid > 0) {
                                const full = await parcelApi.adminSearch.getByGid(tableName, gid).catch(() => null);
                                if (full?.geometry) {
                                    highlightGeoJsonGeometry(full.geometry, false);
                                    setSelectedAdminInfo((prev) => prev ? {
                                        ...prev,
                                        properties: sanitizeAdminProperties({ ...full.properties, ...prev.properties }, prev.properties.ten_tinh || prev.properties.name || prev.layerName)
                                    } : prev);
                                }
                            }
                        }
                        break;
                    }
                }
            } catch (error) {
                console.error('Administrative layer query failed:', error);
            } finally {
                setIsQuerying(false);
            }
        });

        map.getView().on('change:rotation', () => setMapRotation(map.getView().getRotation()));
        map.getView().on('change:resolution', () => setMapZoom(map.getView().getZoom() || 0));

        mapInstance.current = map;
        initData();
        
        const resizeObserver = new ResizeObserver(() => map.updateSize());
        resizeObserver.observe(mapElement.current);
        return () => resizeObserver.disconnect();
    }, [
        initData,
        setMapRotation,
        setMapZoom,
        setMouseCoord,
        wmsLayerGroup,
        highlightGeoJsonGeometry,
        isInteractiveAdministrativeLayer,
        sanitizeAdminProperties
    ]);

    const handleToggleWMS = (id: string) => {
        const isCurrentlyVisible = visibleLayerIds.includes(id);
        setVisibleLayerIds(prev => {
            if (prev.includes(id)) return prev.filter(i => i !== id);
            return [...prev, id];
        });

        if (isCurrentlyVisible) {
            if (activeLayerId === id) setActiveLayerId(null);
            return;
        }

        setActiveLayerId(id);
        void zoomToLayerExtent(id);
    };

    const handleActivateLayer = (id: string) => {
        if (!visibleLayerIds.includes(id)) {
            handleToggleWMS(id);
        } else {
            setActiveLayerId(id);
            void zoomToLayerExtent(id);
        }
    };

    const panelTheme = useMemo(() => getAdminPanelTheme(panelStyle), [panelStyle]);

    return (
        <div className="relative w-full h-full bg-slate-950 flex flex-col min-h-0 overflow-hidden font-sans">
            <Seo 
                title="Bản Đồ Đơn Vị Hành Chính" 
                description="Xem bản đồ chuyên đề về đơn vị hành chính, ranh giới tỉnh, thành phố, quận huyện." 
            />

            <MapStatusIndicators 
                isInitialLoading={isInitialLoading} 
                isQuerying={isQuerying} 
                isPrinting={false} 
            />

            <MapInfoOverlay 
                mouseCoord={mouseCoord} 
                mapZoom={mapZoom} 
            />

            <AdminMapPanel
                isOpen={isAdminPanelOpen}
                isTabletViewport={isTabletViewport}
                panelStyle={panelStyle}
                panelTheme={panelTheme}
                adminPanelTab={adminPanelTab}
                thematicLayers={thematicLayers}
                visibleLayerIds={visibleLayerIds}
                activeLayerId={activeLayerId}
                thematicBasemapOptions={thematicBasemapOptions}
                activeBasemapId={activeBasemapId}
                provinceKeyword={provinceKeyword}
                provinceSuggestions={provinceSuggestions}
                showProvinceSuggestions={showProvinceSuggestions}
                isProvinceSearching={isProvinceSearching}
                isInteractiveAdministrativeLayer={isInteractiveAdministrativeLayer}
                getLayerTypeLabel={getLayerTypeLabel}
                onOpenPanel={() => setIsAdminPanelOpen(true)}
                onClosePanel={() => setIsAdminPanelOpen(false)}
                onPanelStyleChange={setPanelStyle}
                onPanelTabChange={setAdminPanelTab}
                onProvinceKeywordChange={setProvinceKeyword}
                onShowProvinceSuggestions={setShowProvinceSuggestions}
                onSearch={handleSearchProvinceByName}
                onBasemapChange={setActiveBasemapId}
                onActivateLayer={handleActivateLayer}
                onToggleWMS={handleToggleWMS}
                onLayerOpacityChange={handleLayerOpacityChange}
                onZoomToLayerExtent={zoomToLayerExtent}
                onSelectSuggestion={handleProvinceSuggestionSelect}
            />
            
            <div ref={mapElement} className="flex-1 w-full relative" />
            
            <MapControls 
                mapInstance={mapInstance.current} 
                mapRotation={mapRotation} 
                isLocating={false} 
                onLocate={handleLocateUser} 
                showLegendToggle={false}
            />

            <MapDialog 
                isOpen={dialog.isOpen} 
                type={dialog.type} 
                title={dialog.title} 
                message={dialog.message} 
                onClose={() => setDialog({ ...dialog, isOpen: false })} 
            />

            <AdminInfoCard
                info={selectedAdminInfo}
                onClose={() => setSelectedAdminInfo(null)}
            />
        </div>
    );
};

export default ThematicMapPage;
