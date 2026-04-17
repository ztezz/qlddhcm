import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { User, WMSLayerConfig } from '../types';
import Seo from '../components/Seo';
import { API_URL } from '../services/parcelApi';
import { gisService } from '../services/mockBackend';
import { parcelApi, AdminSearchResult } from '../services/parcelApi';

import { useMap } from '../hooks/useMap';

import MapStatusIndicators from '../components/map/MapStatusIndicators';
import MapInfoOverlay from '../components/map/MapInfoOverlay';
import MapControls from '../components/map/MapControls';
import MapDialog from '../components/map/MapDialog';

import { highlightStyle, locationStyle, measureStyle } from '../components/map/mapUtils';
import { MAP_CONFIG } from '../utils/mapConstants';
import { removeAccents } from '../utils/helpers';

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
import { SlidersHorizontal, X, Search, Layers, Eye, EyeOff } from 'lucide-react';

proj4.defs("EPSG:9210", "+proj=tmerc +lat_0=0 +lon_0=105.75 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.904,-39.303,-111.450,0,0,0,0 +units=m +no_defs");
register(proj4);

const ThematicMapPage: React.FC<{ user: User | null; systemSettings?: Record<string, string> }> = ({ user, systemSettings }) => {
    const mapElement = useRef<HTMLDivElement>(null);
    const activeLayerIdRef = useRef<string | null>(null);
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
    const [provinceSuggestions, setProvinceSuggestions] = useState<Array<{ name: string; layerId: string }>>([]);
    const [showProvinceSuggestions, setShowProvinceSuggestions] = useState(false);
    const [selectedAdminInfo, setSelectedAdminInfo] = useState<{ layerName: string; properties: Record<string, any> } | null>(null);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(() => window.innerWidth >= 1024);
    const [adminPanelTab, setAdminPanelTab] = useState<'SEARCH' | 'LAYERS'>('SEARCH');
    const [panelStyle, setPanelStyle] = useState<'LIGHT' | 'DARK' | 'MINIMAL'>('LIGHT');
    const [isTabletViewport, setIsTabletViewport] = useState(() => window.innerWidth >= 768 && window.innerWidth < 1024);
    
    const {
        mapInstance,
        highlightLayer,
        wmsLayerGroup,
        baseLayerRef,
        overlayInstance,
        measureSource,

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

        handleLocateUser,
        initData
    } = useMap(user, systemSettings);

    const thematicLayers = useMemo(() => {
        return availableLayers.filter((layer) => {
            const category = String(layer.category || 'STANDARD').toUpperCase();
            return category === 'ADMINISTRATIVE';
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
            properties: { ...properties, ten_tinh: properties.ten_tinh || properties.name || match.name }
        });

        const olLayer = currentOlLayers.find((layer) => layer.get('layerId') === config.id) as TileLayer<any>;
        if (olLayer && !currentVisibleLayerIds.includes(config.id)) {
            setVisibleLayerIds((prev) => [...prev, config.id]);
        }
        setActiveLayerId(config.id);
        highlightGeoJsonGeometry(match?.geometry, true);
    }, [setVisibleLayerIds, setActiveLayerId, highlightGeoJsonGeometry]);

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
                            properties: props
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
                                        properties: { ...full.properties, ...prev.properties }
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
        isInteractiveAdministrativeLayer
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

    const showSearchSection = !isTabletViewport || adminPanelTab === 'SEARCH';
    const showLayerSection = !isTabletViewport || adminPanelTab === 'LAYERS';
    const panelTheme = useMemo(() => {
        if (panelStyle === 'DARK') {
            return {
                triggerButton: 'bg-slate-950/90 text-cyan-300 border-slate-700',
                triggerBadge: 'bg-cyan-600 text-white border-slate-900',
                panelShell: 'bg-slate-950/90 border-slate-700 text-slate-100',
                headingText: 'text-cyan-300',
                closeButton: 'bg-slate-900/70 text-slate-300 hover:text-white hover:bg-slate-800',
                tabWrap: 'bg-slate-900/70 border-slate-700',
                tabSearchActive: 'bg-cyan-600 text-white',
                tabLayersActive: 'bg-emerald-600 text-white',
                tabIdle: 'text-slate-300 hover:bg-slate-800',
                field: 'bg-slate-900 border-slate-700 text-white focus:border-cyan-500',
                actionBtn: 'bg-cyan-600 hover:bg-cyan-500 text-white',
                divider: 'border-slate-800',
                countPill: 'text-slate-300 bg-slate-800/80 border-slate-700',
                listWrap: 'border-slate-700 bg-slate-900/40',
                cardActive: 'border-cyan-500/60 bg-cyan-900/20 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]',
                cardIdle: 'border-slate-700 bg-slate-900/60 hover:border-slate-500',
                subText: 'text-slate-400',
                typeInteractive: 'border-cyan-500/40 text-cyan-300',
                typeRaster: 'border-amber-500/40 text-amber-300',
                statusOn: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
                statusOff: 'border-slate-600 text-slate-300 bg-slate-700/20',
                activePill: 'border-cyan-500/40 text-cyan-200 bg-cyan-500/10',
                eyeOn: 'bg-rose-600 text-white hover:bg-rose-500',
                eyeOff: 'bg-cyan-700 text-white hover:bg-cyan-600',
                activeBox: 'border-slate-700 bg-slate-900/70',
                activeBoxTitle: 'text-cyan-300',
                zoomBtn: 'bg-slate-800 text-slate-200 hover:bg-slate-700',
                note: 'text-slate-400',
                suggestBox: 'border-slate-700 bg-slate-900/95',
                suggestItem: 'text-slate-200 hover:bg-slate-800',
                emptyBox: 'text-slate-400 border-slate-700'
            };
        }
        if (panelStyle === 'MINIMAL') {
            return {
                triggerButton: 'bg-white/92 text-slate-700 border-slate-300',
                triggerBadge: 'bg-slate-700 text-white border-white',
                panelShell: 'bg-white/92 border-slate-300 text-slate-800',
                headingText: 'text-slate-700',
                closeButton: 'bg-slate-100 text-slate-600 hover:text-slate-800 hover:bg-slate-200',
                tabWrap: 'bg-slate-100 border-slate-200',
                tabSearchActive: 'bg-white text-slate-700 border border-slate-300',
                tabLayersActive: 'bg-white text-slate-700 border border-slate-300',
                tabIdle: 'text-slate-500 hover:bg-slate-200',
                field: 'bg-white border-slate-300 text-slate-800 focus:border-slate-500',
                actionBtn: 'bg-slate-700 hover:bg-slate-600 text-white',
                divider: 'border-slate-200',
                countPill: 'text-slate-600 bg-slate-100 border-slate-300',
                listWrap: 'border-slate-300 bg-slate-50/80',
                cardActive: 'border-slate-500 bg-white shadow-sm',
                cardIdle: 'border-slate-300 bg-white hover:border-slate-400',
                subText: 'text-slate-500',
                typeInteractive: 'border-slate-400 text-slate-600',
                typeRaster: 'border-slate-400 text-slate-600',
                statusOn: 'border-slate-400 text-slate-700 bg-slate-100',
                statusOff: 'border-slate-300 text-slate-500 bg-slate-100/70',
                activePill: 'border-slate-400 text-slate-700 bg-slate-100',
                eyeOn: 'bg-slate-700 text-white hover:bg-slate-600',
                eyeOff: 'bg-slate-200 text-slate-700 hover:bg-slate-300',
                activeBox: 'border-slate-300 bg-white',
                activeBoxTitle: 'text-slate-700',
                zoomBtn: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                note: 'text-slate-500',
                suggestBox: 'border-slate-300 bg-white',
                suggestItem: 'text-slate-700 hover:bg-slate-100',
                emptyBox: 'text-slate-500 border-slate-300'
            };
        }
        return {
            triggerButton: 'bg-white/85 text-blue-700 border-blue-100',
            triggerBadge: 'bg-blue-600 text-white border-white',
            panelShell: 'bg-white/78 border-blue-100 text-slate-800',
            headingText: 'text-blue-700',
            closeButton: 'bg-white/80 text-slate-500 hover:text-slate-700 hover:bg-white',
            tabWrap: 'bg-blue-50/80 border-blue-100',
            tabSearchActive: 'bg-blue-600 text-white',
            tabLayersActive: 'bg-teal-600 text-white',
            tabIdle: 'text-slate-600 hover:bg-white/80',
            field: 'bg-white/85 border-blue-100 text-slate-800 focus:border-blue-400',
            actionBtn: 'bg-blue-600 hover:bg-blue-500 text-white',
            divider: 'border-blue-100',
            countPill: 'text-slate-600 bg-white/70 border-blue-100',
            listWrap: 'border-blue-100 bg-white/55',
            cardActive: 'border-blue-300 bg-blue-50/70 shadow-[0_6px_18px_rgba(59,130,246,0.18)]',
            cardIdle: 'border-blue-100 bg-white/80 hover:border-blue-200',
            subText: 'text-slate-500',
            typeInteractive: 'border-blue-200 text-blue-700',
            typeRaster: 'border-amber-300 text-amber-700',
            statusOn: 'border-emerald-300 text-emerald-700 bg-emerald-50',
            statusOff: 'border-slate-300 text-slate-600 bg-slate-50',
            activePill: 'border-blue-300 text-blue-700 bg-blue-100/70',
            eyeOn: 'bg-rose-500 text-white hover:bg-rose-400',
            eyeOff: 'bg-blue-600 text-white hover:bg-blue-500',
            activeBox: 'border-blue-100 bg-white/85',
            activeBoxTitle: 'text-blue-700',
            zoomBtn: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
            note: 'text-slate-500',
            suggestBox: 'border-blue-100 bg-white/95',
            suggestItem: 'text-slate-700 hover:bg-blue-50',
            emptyBox: 'text-slate-500 border-blue-100'
        };
    }, [panelStyle]);

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

            {!isAdminPanelOpen && (
                <button
                    onClick={() => setIsAdminPanelOpen(true)}
                    className={`absolute top-16 right-3 md:top-4 md:right-4 z-[460] min-h-11 min-w-11 p-3 backdrop-blur-md rounded-2xl shadow-xl border active:scale-95 transition-all duration-200 ${panelTheme.triggerButton}`}
                    title="Mở bảng điều khiển hành chính"
                >
                    <div className="relative">
                        <SlidersHorizontal size={20} />
                        {thematicLayers.length > 0 && (
                            <span className={`absolute -top-2 -right-2 min-w-4 h-4 px-1 text-[8px] font-black rounded-full flex items-center justify-center border ${panelTheme.triggerBadge}`}>
                                {thematicLayers.length}
                            </span>
                        )}
                    </div>
                </button>
            )}

            <div className={`absolute top-16 left-3 right-3 sm:left-auto sm:w-[min(92vw,420px)] lg:w-[440px] md:top-4 md:right-4 z-[460] border rounded-xl p-2 shadow-xl backdrop-blur-md max-h-[72vh] md:max-h-[78vh] overflow-y-auto transition-all duration-300 ease-out origin-top-right ${panelTheme.panelShell} ${
                isAdminPanelOpen ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
            }`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                    <p className={`text-[10px] uppercase tracking-widest font-black ${panelTheme.headingText}`}>Bảng điều khiển hành chính</p>
                    <button
                        onClick={() => setIsAdminPanelOpen(false)}
                        className={`min-h-11 min-w-11 p-2.5 rounded-md transition-colors ${panelTheme.closeButton}`}
                        title="Ẩn bảng điều khiển"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className={`mb-2 p-1 rounded-lg border flex items-center gap-1 ${panelTheme.tabWrap}`}>
                    <button
                        type="button"
                        onClick={() => setPanelStyle('LIGHT')}
                        className={`min-h-9 px-2.5 rounded-md text-[9px] uppercase tracking-wider font-black transition-colors ${panelStyle === 'LIGHT' ? panelTheme.tabSearchActive : panelTheme.tabIdle}`}
                    >
                        Light Glass
                    </button>
                    <button
                        type="button"
                        onClick={() => setPanelStyle('DARK')}
                        className={`min-h-9 px-2.5 rounded-md text-[9px] uppercase tracking-wider font-black transition-colors ${panelStyle === 'DARK' ? panelTheme.tabSearchActive : panelTheme.tabIdle}`}
                    >
                        Dark Pro
                    </button>
                    <button
                        type="button"
                        onClick={() => setPanelStyle('MINIMAL')}
                        className={`min-h-9 px-2.5 rounded-md text-[9px] uppercase tracking-wider font-black transition-colors ${panelStyle === 'MINIMAL' ? panelTheme.tabSearchActive : panelTheme.tabIdle}`}
                    >
                        Minimal
                    </button>
                </div>

                <div className={`hidden md:flex lg:hidden mb-2 p-1 rounded-lg border ${panelTheme.tabWrap}`}>
                    <button
                        type="button"
                        onClick={() => setAdminPanelTab('SEARCH')}
                        className={`flex-1 min-h-11 px-3 rounded-md text-[10px] uppercase tracking-wider font-black flex items-center justify-center gap-1.5 transition-colors ${
                            adminPanelTab === 'SEARCH' ? panelTheme.tabSearchActive : panelTheme.tabIdle
                        }`}
                    >
                        <Search size={14} />
                        Tìm kiếm
                    </button>
                    <button
                        type="button"
                        onClick={() => setAdminPanelTab('LAYERS')}
                        className={`flex-1 min-h-11 px-3 rounded-md text-[10px] uppercase tracking-wider font-black flex items-center justify-center gap-1.5 transition-colors ${
                            adminPanelTab === 'LAYERS' ? panelTheme.tabLayersActive : panelTheme.tabIdle
                        }`}
                    >
                        <Layers size={14} />
                        Quản lý lớp
                    </button>
                </div>

                {showSearchSection && (
                <div className="animate-in fade-in duration-200">
                <p className={`text-[10px] uppercase tracking-widest font-black mb-2 ${panelTheme.headingText}`}>Tìm nhanh theo tên tỉnh</p>
                <div className="flex items-center gap-2">
                    <input
                        value={provinceKeyword}
                        onChange={(e) => {
                            setProvinceKeyword(e.target.value);
                            setShowProvinceSuggestions(true);
                        }}
                        onFocus={() => setShowProvinceSuggestions(true)}
                        onBlur={() => {
                            window.setTimeout(() => setShowProvinceSuggestions(false), 150);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleSearchProvinceByName();
                            }
                        }}
                        placeholder="Nhập tên tỉnh/thành..."
                        className={`flex-1 min-h-11 border rounded-lg px-3 py-2.5 text-xs outline-none ${panelTheme.field}`}
                    />
                    <button
                        onClick={() => void handleSearchProvinceByName()}
                        disabled={isProvinceSearching || !provinceKeyword.trim()}
                        className={`min-h-11 px-4 py-2.5 rounded-lg text-[10px] uppercase tracking-wider font-black disabled:opacity-50 ${panelTheme.actionBtn}`}
                    >
                        {isProvinceSearching ? 'Đang tìm...' : 'Tìm'}
                    </button>
                </div>

                <div className={`mt-2.5 border-t pt-2.5 ${panelTheme.divider}`}>
                    <label className={`text-[10px] uppercase tracking-widest font-black ${panelTheme.headingText}`}>Lớp bản đồ nền</label>
                    <select
                        value={activeBasemapId}
                        onChange={(e) => setActiveBasemapId(e.target.value)}
                        className={`mt-1.5 w-full border rounded-lg px-2.5 py-2 text-xs outline-none ${panelTheme.field}`}
                    >
                        {thematicBasemapOptions.map((bm) => (
                            <option key={bm.id} value={bm.id}>{bm.name}</option>
                        ))}
                    </select>
                </div>
                </div>
                )}

                {showLayerSection && (
                <div className="animate-in fade-in duration-200">
                <div className={`mt-2.5 border-t pt-2.5 ${panelTheme.divider}`}>
                    <div className="flex items-center justify-between mb-2">
                        <p className={`text-[10px] uppercase tracking-widest font-black ${panelTheme.headingText}`}>Bảng quản lý lớp hành chính</p>
                        <span className={`text-[10px] border rounded-full px-2 py-0.5 ${panelTheme.countPill}`}>{thematicLayers.length} lớp</span>
                    </div>

                    <div className={`max-h-[28vh] md:max-h-[34vh] overflow-y-auto rounded-xl border p-2 space-y-2 ${panelTheme.listWrap}`}>
                        {thematicLayers.map((layer) => {
                            const isVisible = visibleLayerIds.includes(layer.id);
                            const isActive = activeLayerId === layer.id;
                            const isInteractive = isInteractiveAdministrativeLayer(layer);

                            return (
                                <div
                                    key={layer.id}
                                    className={`rounded-lg border transition-all cursor-pointer ${
                                        isActive
                                            ? panelTheme.cardActive
                                            : panelTheme.cardIdle
                                    }`}
                                    onClick={() => handleActivateLayer(layer.id)}
                                    title="Bấm để chọn lớp và tự bật hiển thị"
                                >
                                    <div className="px-3 py-2.5 flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-[11px] leading-tight truncate">{layer.name}</p>
                                            <p className={`text-[10px] truncate hidden sm:block mt-0.5 ${panelTheme.subText}`}>{layer.layers}</p>
                                            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${isInteractive ? panelTheme.typeInteractive : panelTheme.typeRaster}`}>
                                                    {getLayerTypeLabel(layer)}
                                                </span>
                                                <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${isVisible ? panelTheme.statusOn : panelTheme.statusOff}`}>
                                                    {isVisible ? 'Đang bật' : 'Đang tắt'}
                                                </span>
                                                {isActive && (
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${panelTheme.activePill}`}>
                                                        Đang chọn
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleWMS(layer.id);
                                            }}
                                            className={`min-h-11 min-w-11 rounded-lg inline-flex items-center justify-center transition-colors ${isVisible ? panelTheme.eyeOn : panelTheme.eyeOff}`}
                                            title={isVisible ? 'Tắt lớp' : 'Bật lớp'}
                                        >
                                            {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {thematicLayers.length === 0 && (
                            <div className={`px-3 py-4 text-center text-[10px] border border-dashed rounded-lg ${panelTheme.emptyBox}`}>
                                Không có lớp hành chính khả dụng.
                            </div>
                        )}
                    </div>

                    {activeLayerId && thematicLayers.some((layer) => layer.id === activeLayerId) && (() => {
                        const activeLayer = thematicLayers.find((layer) => layer.id === activeLayerId)!;
                        const activeOpacity = Number(activeLayer.opacity ?? 1);
                        return (
                            <div className={`mt-2 rounded-lg border p-2.5 ${panelTheme.activeBox}`}>
                                <p className={`text-[10px] uppercase tracking-wider font-black ${panelTheme.activeBoxTitle}`}>Tùy chỉnh lớp đang chọn</p>
                                <p className="mt-1 text-[11px] font-semibold truncate">{activeLayer.name}</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void zoomToLayerExtent(activeLayer.id)}
                                        className={`px-2.5 py-1.5 rounded text-[10px] font-bold ${panelTheme.zoomBtn}`}
                                    >
                                        Zoom lớp
                                    </button>
                                    <span className={`text-[10px] min-w-9 ${panelTheme.subText}`}>{Math.round(activeOpacity * 100)}%</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={activeOpacity}
                                        onChange={(e) => handleLayerOpacityChange(activeLayer.id, parseFloat(e.target.value))}
                                        className="flex-1 h-1 accent-cyan-500"
                                    />
                                </div>
                            </div>
                        );
                    })()}
                    <p className={`mt-1.5 text-[10px] ${panelTheme.note}`}>Lớp WMS TIFF là lớp ảnh nền chuyên đề: vẫn bật/tắt, chỉnh độ mờ và zoom được, nhưng không truy vấn thuộc tính.</p>
                </div>
                </div>
                )}

                {showSearchSection && showProvinceSuggestions && provinceSuggestions.length > 0 && (
                    <div className={`mt-2 max-h-44 overflow-y-auto rounded-lg border ${panelTheme.suggestBox}`}>
                        {provinceSuggestions.map((item, idx) => (
                            <button
                                key={`${item.layerId}-${item.name}-${idx}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={async () => {
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
                                }}
                                className={`block w-full text-left px-3 py-2 text-xs ${panelTheme.suggestItem}`}
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            
            <div ref={mapElement} className="flex-1 w-full relative" />
            
            <MapControls 
                mapInstance={mapInstance.current} 
                mapRotation={mapRotation} 
                isLocating={false} 
                onLocate={handleLocateUser} 
            />

            <MapDialog 
                isOpen={dialog.isOpen} 
                type={dialog.type} 
                title={dialog.title} 
                message={dialog.message} 
                onClose={() => setDialog({ ...dialog, isOpen: false })} 
            />

            {selectedAdminInfo && (
                <div className="absolute left-4 bottom-4 z-[650] w-[340px] max-w-[calc(100vw-2rem)] bg-slate-950/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800 flex items-start justify-between gap-2">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-black">Thông tin lớp hành chính</p>
                            <p className="text-sm text-white font-bold mt-1">{selectedAdminInfo.properties.ten_tinh || selectedAdminInfo.properties.name || selectedAdminInfo.layerName}</p>
                        </div>
                        <button
                            onClick={() => setSelectedAdminInfo(null)}
                            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-slate-800"
                        >
                            Đóng
                        </button>
                    </div>
                    <div className="p-4 text-xs text-slate-200 space-y-1.5">
                        <p><span className="text-slate-400">Mã tỉnh:</span> {selectedAdminInfo.properties.ma_tinh || '--'}</p>
                        <p><span className="text-slate-400">Tên tỉnh:</span> {selectedAdminInfo.properties.ten_tinh || '--'}</p>
                        <p><span className="text-slate-400">Sáp nhập:</span> {selectedAdminInfo.properties.sap_nhap || '--'}</p>
                        <p><span className="text-slate-400">Quy mô:</span> {selectedAdminInfo.properties.quy_mo || '--'}</p>
                        <p><span className="text-slate-400">Trụ sở:</span> {selectedAdminInfo.properties.tru_so || '--'}</p>
                        <p><span className="text-slate-400">Loại:</span> {selectedAdminInfo.properties.loai || '--'}</p>
                        <p><span className="text-slate-400">Cấp:</span> {selectedAdminInfo.properties.cap ?? '--'}</p>
                        <p><span className="text-slate-400">Diện tích (km²):</span> {selectedAdminInfo.properties.dtich_km2 ?? '--'}</p>
                        <p><span className="text-slate-400">Dân số:</span> {selectedAdminInfo.properties.dan_so ?? '--'}</p>
                        <p><span className="text-slate-400">Mật độ (ng/km²):</span> {selectedAdminInfo.properties.matdo_km2 ?? '--'}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThematicMapPage;
