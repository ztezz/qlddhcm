import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { User, WMSLayerConfig } from '../types';
import { API_URL } from '../services/mockBackend';
import Seo from '../components/Seo';

// Hooks
import { useMap } from '../hooks/useMap';

// Components
import ParcelPopup from '../components/map/ParcelPopup';
import SearchPanel from '../components/map/SearchPanel';
import LayerControl from '../components/map/LayerControl';
import PrintTemplate from '../components/map/PrintTemplate';
import MeasureTools from '../components/map/MeasureTools';
import ParcelForm from '../components/admin/parcel/ParcelForm';
import MapLegend from '../components/map/MapLegend';

// Extracted Components
import MapStatusIndicators from '../components/map/MapStatusIndicators';
import MapInfoOverlay from '../components/map/MapInfoOverlay';
import MapControls from '../components/map/MapControls';
import MapDialog from '../components/map/MapDialog';

// Utilities
import { highlightStyle, locationStyle, measureStyle } from '../components/map/mapUtils';
import { MAP_CONFIG } from '../utils/mapConstants';
import { filterLayersByMap, isLayerVisibleInMap } from '../utils/layerScope';

// OpenLayers
import Map from 'ol/Map';
import View from 'ol/View';
import Overlay from 'ol/Overlay';
import Feature from 'ol/Feature';
import { Tile as TileLayer, Vector as VectorLayer, Group as LayerGroup } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import * as proj from 'ol/proj';
import { Point } from 'ol/geom';
import { defaults as defaultControls } from 'ol/control/defaults';
import proj4 from "proj4";
import { register } from 'ol/proj/proj4';

// Đăng ký VN-2000 (Kinh tuyến trục 105.75 cho Bình Dương/HCM)
proj4.defs("EPSG:9210", "+proj=tmerc +lat_0=0 +lon_0=105.75 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.904,-39.303,-111.450,0,0,0,0 +units=m +no_defs");
register(proj4);

const MapPage: React.FC<{ user: User | null; systemSettings?: Record<string, string> }> = ({ user, systemSettings }) => {
    const mapElement = useRef<HTMLDivElement>(null);
    const popupElement = useRef<HTMLDivElement>(null);
    const mapPageLayerFilter = useCallback((layer: WMSLayerConfig) => isLayerVisibleInMap(layer, 'MAIN'), []);

    const {
        // Refs
        mapInstance,
        highlightLayer,
        locationLayer,
        wmsLayerGroup,
        baseLayerRef,
        overlayInstance,
        measureSource,
        activeLayerIdRef,
        availableLayersRef,
        visibleLayerIdsRef,
        measureModeRef,

        // State
        availableLayers, setAvailableLayers,
        visibleLayerIds, setVisibleLayerIds,
        activeLayerId, setActiveLayerId,
        basemaps, setBasemaps,
        activeBasemapId, setActiveBasemapId,
        spatialTables, setSpatialTables,
        isSearchOpen, setIsSearchOpen,
        isLayerMenuOpen, setIsLayerMenuOpen,
        isLegendOpen, setIsLegendOpen,
        selectedParcel, setSelectedParcel,
        isInitialLoading, setIsInitialLoading,
        isQuerying, setIsQuerying,
        isLocating, setIsLocating,
        isPrinting, setIsPrinting,
        printingParcel, setPrintingParcel,
        mapRotation, setMapRotation,
        mapZoom, setMapZoom,
        mouseCoord, setMouseCoord,
        wmsCacheBust, setWmsCacheBust,
        measureMode, setMeasureMode,
        isEditOpen, setIsEditOpen,
        editFormData, setEditFormData,
        editLoading, setEditLoading,
        dialog, setDialog,

        // Actions
        handleLocateUser,
        handleSelectResult,
        handleOpenEdit,
        handlePrintParcel,
        handleUpdateParcel,
        handleToggleWMS,
        handleActivateLayer,
        initData,
        handleClearAllLayers
    } = useMap(user, systemSettings, mapPageLayerFilter);

    const mapPageLayers = useMemo(
        () => filterLayersByMap(availableLayers, 'MAIN'),
        [availableLayers]
    );

    const mapPageLayerIdSet = useMemo(
        () => new Set(mapPageLayers.map((layer) => layer.id)),
        [mapPageLayers]
    );

    const mapPageSearchTableSet = useMemo(() => {
        const set = new Set<string>();
        mapPageLayers.forEach((layer) => {
            const layerNames = String(layer.layers || '')
                .split(',')
                .map((name) => name.trim())
                .filter(Boolean);

            layerNames.forEach((name) => {
                const tableName = name.includes(':') ? name.split(':').pop() : name;
                if (tableName) {
                    set.add(tableName.toLowerCase());
                }
            });
        });
        return set;
    }, [mapPageLayers]);

    const mapPageSpatialTables = useMemo(
        () => {
            return spatialTables.filter((table) => mapPageSearchTableSet.has(String(table.table_name || '').toLowerCase()));
        },
        [spatialTables, mapPageSearchTableSet]
    );

    // Loại bỏ lớp hành chính khỏi MapPage để đảm bảo chỉ hiển thị ở trang riêng.
    useEffect(() => {
        setVisibleLayerIds((prev) => {
            const next = prev.filter((id) => mapPageLayerIdSet.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [mapPageLayerIdSet, setVisibleLayerIds]);

    useEffect(() => {
        if (activeLayerId && !mapPageLayerIdSet.has(activeLayerId)) {
            const fallback = visibleLayerIds.find((id) => mapPageLayerIdSet.has(id)) || mapPageLayers[0]?.id || null;
            setActiveLayerId(fallback);
        }
    }, [activeLayerId, visibleLayerIds, mapPageLayerIdSet, mapPageLayers, setActiveLayerId]);

    // Handle search coordinate result
    const handleSearchCoordinate = useCallback((lat: number, lon: number) => {
        if (mapInstance.current && locationLayer.current) {
            const coords = proj.fromLonLat([lon, lat]);
            const source = locationLayer.current.getSource();
            source?.clear();
            const feature = new Feature(new Point(coords));
            feature.set('type', 'search_result');
            source?.addFeature(feature);
            mapInstance.current.getView().animate({ 
                center: coords, 
                zoom: MAP_CONFIG.SEARCH_ZOOM, 
                duration: MAP_CONFIG.ANIMATION_DURATION 
            });
        }
    }, [mapInstance, locationLayer]);

    useEffect(() => {
        if (!mapElement.current || mapInstance.current) return;
        const initLng = parseFloat(systemSettings?.map_center_lng ?? '') || MAP_CONFIG.DEFAULT_CENTER[0];
        const initLat = parseFloat(systemSettings?.map_center_lat ?? '') || MAP_CONFIG.DEFAULT_CENTER[1];
        const initZoom = parseFloat(systemSettings?.default_zoom ?? '') || MAP_CONFIG.DEFAULT_ZOOM;
        const initMinZoom = parseFloat(systemSettings?.map_min_zoom ?? '') || MAP_CONFIG.MIN_ZOOM;
        const initMaxZoom = parseFloat(systemSettings?.map_max_zoom ?? '') || MAP_CONFIG.MAX_ZOOM;

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
        locationLayer.current = map.getLayers().getArray()[3] as VectorLayer<VectorSource>;
        const popupHostElement = popupElement.current || document.createElement('div');
        overlayInstance.current = new Overlay({ 
            element: popupHostElement, 
            autoPan: { animation: { duration: MAP_CONFIG.POPUP_ANIMATION_DURATION } }, 
            positioning: 'bottom-center' 
        });
        map.addOverlay(overlayInstance.current);

        map.on('singleclick', async (evt) => {
            if (measureModeRef.current) return;

            const view = map.getView();
            const resolution = view.getResolution();
            const projection = view.getProjection();
            const currentOlLayers = wmsLayerGroup.current?.getLayers().getArray() || [];
            if (currentOlLayers.length === 0) return;

            const targetLayerIds: string[] = [];
            if (activeLayerIdRef.current) {
                targetLayerIds.push(activeLayerIdRef.current);
            }
            visibleLayerIdsRef.current.forEach(id => {
                if (id !== activeLayerIdRef.current) {
                    targetLayerIds.push(id);
                }
            });

            setIsQuerying(true);
            overlayInstance.current?.setPosition(undefined);
            setSelectedParcel(null);
            highlightLayer.current?.getSource()?.clear();

            try {
                for (const lid of targetLayerIds) {
                    const config = availableLayersRef.current.find(c => c.id === lid);

                    // Only query STANDARD WMS layers.
                    if (!config || config.type === 'XYZ' || config.category === 'PLANNING') continue;

                    const olLayer = currentOlLayers.find(l => l.get('layerId') === lid) as TileLayer<any>;
                    if (!olLayer || !olLayer.getSource()?.getFeatureInfoUrl) continue;

                    const url = olLayer.getSource().getFeatureInfoUrl(evt.coordinate, resolution!, projection, {
                        'INFO_FORMAT': 'application/json',
                        'FEATURE_COUNT': 1
                    });
                    if (!url) continue;

                    const res = await fetch(url);
                    const data = await res.json();
                    if (data.features?.length > 0) {
                        const f = data.features[0];
                        const tableName = config.layers.includes(':') ? config.layers.split(':').pop() : config.layers;
                        handleSelectResult({
                            id: f.id,
                            gid: f.properties.gid || parseInt(f.id.split('.').pop() || '0'),
                            geometry: f.geometry,
                            properties: { ...f.properties, tableName }
                        } as any, evt.coordinate);
                        break;
                    }
                }
            } catch (error) {
                console.error('Map click query failed:', error);
            } finally {
                setIsQuerying(false);
            }
        });

        map.on('pointermove', (evt) => {
            if (!evt.dragging) {
                setMouseCoord(proj.toLonLat(evt.coordinate));
            }
        });

        map.getView().on('change:rotation', () => setMapRotation(map.getView().getRotation()));
        map.getView().on('change:resolution', () => setMapZoom(map.getView().getZoom() || 0));

        mapInstance.current = map;
        initData();
        
        const resizeObserver = new ResizeObserver(() => map.updateSize());
        resizeObserver.observe(mapElement.current);
        return () => resizeObserver.disconnect();
    }, [handleSelectResult, initData]);

    return (
        <div className="relative w-full h-full bg-slate-950 flex flex-col min-h-0 overflow-hidden font-sans">
            <Seo 
                title="Bản Đồ Quy Hoạch Trực Tuyến" 
                description="Xem bản đồ quy hoạch, thông tin thửa đất và hiện trạng sử dụng đất mới nhất." 
            />

            <MapStatusIndicators 
                isInitialLoading={isInitialLoading} 
                isQuerying={isQuerying} 
                isPrinting={isPrinting} 
            />

            <MapInfoOverlay 
                mouseCoord={mouseCoord} 
                mapZoom={mapZoom} 
            />
            <div ref={popupElement} className="hidden" />
            
            <div ref={mapElement} className="flex-1 w-full relative" />
            <MeasureTools activeMode={measureMode} onModeChange={setMeasureMode} onClear={() => measureSource.current.clear()} />
            
            {selectedParcel && (
                <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[50]">
                    <div className="pointer-events-auto">
                        <ParcelPopup 
                            parcel={selectedParcel} 
                            user={user} 
                            onClose={() => { overlayInstance.current?.setPosition(undefined); setSelectedParcel(null); highlightLayer.current?.getSource()?.clear(); }} 
                            onPrint={handlePrintParcel} 
                            onEdit={handleOpenEdit} 
                        />
                    </div>
                </div>
            )}

            <div className="fixed -left-[4000px] top-0 opacity-0 pointer-events-none overflow-hidden">
                {printingParcel && <PrintTemplate parcel={printingParcel} user={user} systemSettings={systemSettings} />}
            </div>

            <MapControls 
                mapInstance={mapInstance.current} 
                mapRotation={mapRotation} 
                isLocating={isLocating} 
                isLegendOpen={isLegendOpen} 
                onLocate={handleLocateUser} 
                onToggleLegend={() => setIsLegendOpen(!isLegendOpen)} 
            />

            <SearchPanel 
                isOpen={isSearchOpen} 
                onToggle={() => setIsSearchOpen(!isSearchOpen)} 
                spatialTables={mapPageSpatialTables} 
                onSelectResult={handleSelectResult} 
                onSearchCoordinate={handleSearchCoordinate} 
            />
            
            <LayerControl 
                isOpen={isLayerMenuOpen} 
                onToggleMenu={() => setIsLayerMenuOpen(!isLayerMenuOpen)} 
                basemaps={basemaps} 
                activeBasemapId={activeBasemapId} 
                onBaseLayerChange={setActiveBasemapId} 
                availableLayers={mapPageLayers} 
                visibleLayerIds={visibleLayerIds.filter((id) => mapPageLayerIdSet.has(id))} 
                activeLayerId={activeLayerId} 
                onToggleWMS={handleToggleWMS} 
                onSetActiveWMS={handleActivateLayer} 
                onOpacityChange={(id, opacity) => setAvailableLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l))} 
                onClearAll={handleClearAllLayers}
            />

            <MapLegend isOpen={isLegendOpen} onClose={() => setIsLegendOpen(false)} />

            <ParcelForm isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} editingId={editFormData.gid || null} formData={editFormData} setFormData={setEditFormData} handleSubmit={handleUpdateParcel} loading={editLoading} />

            <MapDialog 
                isOpen={dialog.isOpen} 
                type={dialog.type} 
                title={dialog.title} 
                message={dialog.message} 
                onClose={() => setDialog({ ...dialog, isOpen: false })} 
            />
        </div>
    );
};

export default MapPage;
