
import { useState, useRef, useEffect, useCallback } from 'react';
import { User, LandParcel, WMSLayerConfig, BasemapConfig } from '../types';
import { gisService, API_URL } from '../services/mockBackend';
import { parcelApi, ParcelDTO } from '../services/parcelApi';
import { Coordinate } from 'ol/coordinate';
import Map from 'ol/Map';
import { Group as LayerGroup, Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource, TileWMS, XYZ, OSM } from 'ol/source';
import Overlay from 'ol/Overlay';
import * as proj from 'ol/proj';
import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import { isEmpty as isExtentEmpty, getCenter as getExtentCenter } from 'ol/extent';
import { Point, Circle as GeomCircle, Polygon, LineString } from 'ol/geom';
import Draw from 'ol/interaction/Draw';
import { getArea, getLength } from 'ol/sphere';
import { unByKey } from 'ol/Observable';
import Collection from 'ol/Collection';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { smartMapProperties, measureStyle } from '../components/map/mapUtils';
import { formatParcelIdentifier, toSafeFilename } from '../utils/helpers';

const MAP_UI_STATE_STORAGE_PREFIX = 'qlddhcm.map.ui.';

const safeReadStorage = <T,>(key: string): T | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) as T : null;
    } catch {
        return null;
    }
};

export const useMap = (
    user: User | null,
    systemSettings?: Record<string, string>,
    layerVisibilityFilter?: (layer: WMSLayerConfig) => boolean,
    stateStorageKey?: string
) => {
    // Refs for Map Instance and Layers
    const mapInstance = useRef<Map | null>(null);
    const highlightLayer = useRef<VectorLayer<VectorSource> | null>(null);
    const locationLayer = useRef<VectorLayer<VectorSource> | null>(null);
    const wmsLayerGroup = useRef<LayerGroup | null>(null);
    const baseLayerRef = useRef<TileLayer<any> | null>(null);
    const overlayInstance = useRef<Overlay | null>(null);
    const measureSource = useRef<VectorSource>(new VectorSource());
    const drawInteraction = useRef<Draw | null>(null);

    // Refs for Map Events (to avoid stale closures)
    const activeLayerIdRef = useRef<string | null>(null);
    const availableLayersRef = useRef<WMSLayerConfig[]>([]);
    const visibleLayerIdsRef = useRef<string[]>([]);
    const measureModeRef = useRef<'LineString' | 'Polygon' | null>(null);

    // State
    const [availableLayers, setAvailableLayers] = useState<WMSLayerConfig[]>([]);
    const [visibleLayerIds, setVisibleLayerIds] = useState<string[]>([]);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
    const [basemaps, setBasemaps] = useState<BasemapConfig[]>([]);
    const [activeBasemapId, setActiveBasemapId] = useState<string>('');
    const [spatialTables, setSpatialTables] = useState<any[]>([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
    const [isLegendOpen, setIsLegendOpen] = useState(false);
    const [selectedParcel, setSelectedParcel] = useState<LandParcel | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isQuerying, setIsQuerying] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [printingParcel, setPrintingParcel] = useState<LandParcel | null>(null);
    const [mapRotation, setMapRotation] = useState(0);
    const [mapZoom, setMapZoom] = useState(0);
    const [mouseCoord, setMouseCoord] = useState<Coordinate | null>(null);
    const [wmsCacheBust, setWmsCacheBust] = useState(Date.now());
    const [measureMode, setMeasureMode] = useState<'LineString' | 'Polygon' | null>(null);

    // Edit State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editFormData, setEditFormData] = useState<ParcelDTO>({ sothua: '', sodoto: '' });
    const [editLoading, setEditLoading] = useState(false);
    const [dialog, setDialog] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string; }>({ isOpen: false, type: 'info', title: '', message: '' });

    // Sync state to refs
    useEffect(() => { availableLayersRef.current = availableLayers; }, [availableLayers]);
    useEffect(() => { activeLayerIdRef.current = activeLayerId; }, [activeLayerId]);
    useEffect(() => { visibleLayerIdsRef.current = visibleLayerIds; }, [visibleLayerIds]);
    useEffect(() => { measureModeRef.current = measureMode; }, [measureMode]);

    const handleLocateUser = () => {
        if (!navigator.geolocation) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi hệ thống', message: 'Trình duyệt của bạn không hỗ trợ chức năng định vị GPS.' });
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                const coords = proj.fromLonLat([longitude, latitude]);

                if (mapInstance.current && locationLayer.current) {
                    const source = locationLayer.current.getSource();
                    source?.clear();

                    const accuracyFeature = new Feature(new GeomCircle(coords, accuracy));
                    accuracyFeature.set('type', 'accuracy');
                    source?.addFeature(accuracyFeature);

                    const positionFeature = new Feature(new Point(coords));
                    positionFeature.set('type', 'user_location');
                    source?.addFeature(positionFeature);

                    mapInstance.current.getView().animate({
                        center: coords,
                        zoom: 18,
                        duration: 1000
                    });
                }
                setIsLocating(false);
            },
            (error) => {
                let msg = 'Không thể lấy được vị trí của bạn.';
                if (error.code === 1) msg = 'Vui lòng cho phép ứng dụng truy cập vị trí của bạn trong cài đặt trình duyệt.';
                else if (error.code === 3) msg = 'Thời gian phản hồi định vị quá lâu. Vui lòng kiểm tra lại GPS.';
                
                setDialog({ isOpen: true, type: 'error', title: 'Lỗi định vị', message: msg });
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const isValidGid = (gid: any) => Number.isFinite(Number(gid)) && Number(gid) > 0;

    const resolveParcelGid = useCallback(async (parcel: LandParcel): Promise<number | null> => {
        if (isValidGid(parcel.gid)) {
            return Number(parcel.gid);
        }

        const props = smartMapProperties(parcel.properties || {});
        const tableName = props.tableName || props.table_name;
        const soTo = props.so_to || props.sodoto;
        const soThua = props.so_thua || props.sothua;

        if (!tableName) {
            return null;
        }

        try {
            let rows: any[] = [];
            if (soTo && soThua) {
                rows = (await parcelApi.getAll(String(tableName), {
                    sodoto: String(soTo),
                    sothua: String(soThua)
                })).data;
            }

            if (!Array.isArray(rows) || rows.length === 0) {
                rows = (await parcelApi.getAll(String(tableName))).data;
            }

            if (!Array.isArray(rows) || rows.length === 0) {
                return null;
            }

            const matched = rows.find((r: any) => {
                const rowSoTo = (r?.sodoto || r?.so_to || '').toString().trim();
                const rowSoThua = (r?.sothua || r?.so_thua || '').toString().trim();
                return soTo && soThua && rowSoTo === String(soTo).trim() && rowSoThua === String(soThua).trim();
            }) || rows.find((r: any) => isValidGid(r?.gid));

            return matched && isValidGid(matched.gid) ? Number(matched.gid) : null;
        } catch (error) {
            console.error('Resolve parcel gid failed:', error);
            return null;
        }
    }, []);

    const handleSelectResult = useCallback((parcel: LandParcel, fallbackCoord?: Coordinate) => {
        if (!mapInstance.current || !highlightLayer.current) return;
        const normalizedParcel = { ...parcel, properties: smartMapProperties(parcel.properties) };
        setSelectedParcel(normalizedParcel);

        // Ensure selected parcel has a valid gid so later updates target the correct record.
        void resolveParcelGid(normalizedParcel).then((resolvedGid) => {
            if (!resolvedGid) return;
            setSelectedParcel((prev) => {
                if (!prev) return prev;
                if (isValidGid(prev.gid)) return prev;
                return { ...prev, gid: resolvedGid };
            });
        });

        const source = highlightLayer.current.getSource();
        source?.clear();
        let popupPos = fallbackCoord;
        if (parcel.geometry) {
            try {
                const format = new GeoJSON();
                let dataProj = 'EPSG:4326';
                let rawCoords: any = null;
                if (parcel.geometry.type === 'Polygon') rawCoords = parcel.geometry.coordinates[0][0];
                else if (parcel.geometry.type === 'MultiPolygon') rawCoords = parcel.geometry.coordinates[0][0][0];
                else if (parcel.geometry.type === 'Point') rawCoords = parcel.geometry.coordinates;

                if (rawCoords) {
                    const x = Math.abs(rawCoords[0]);
                    const y = Math.abs(rawCoords[1]);
                    if (x > 2000000 || y > 2000000) dataProj = 'EPSG:3857';
                    else if ((x > 300000 && x < 900000) || (y > 1000000 && y < 2000000)) dataProj = 'EPSG:9210';
                }

                const geometry = format.readGeometry(parcel.geometry, { dataProjection: dataProj, featureProjection: 'EPSG:3857' });
                if (geometry) {
                    source?.addFeature(new Feature({ geometry }));
                    const extent = geometry.getExtent();
                    if (extent && !isExtentEmpty(extent)) {
                        popupPos = getExtentCenter(extent);
                        mapInstance.current.getView().fit(extent, { padding: [120, 120, 120, 120], duration: 800, maxZoom: 21 });
                    }
                }
            } catch (err) { console.error("Geom error:", err); }
        }
        if (popupPos) overlayInstance.current?.setPosition(popupPos);
    }, [resolveParcelGid]);

    const handleOpenEdit = (parcel: LandParcel) => {
        const p = parcel.properties;
        setEditFormData({
            gid: parcel.gid,
            sodoto: (p.so_to || '').toString(),
            sothua: (p.so_thua || '').toString(),
            tenchu: p.ownerName || '',
            diachi: p.address || '',
            loaidat: p.landType || '',
            dientich: p.area || 0,
            geometry: parcel.geometry,
            tableName: p.tableName || p.table_name,
            file: null
        });
        setIsEditOpen(true);
    };

    const handlePrintParcel = async (parcel: LandParcel) => {
        setIsPrinting(true);
        setPrintingParcel(parcel);

        setTimeout(async () => {
            const element = document.getElementById('print-template');
            if (!element) {
                setIsPrinting(false);
                setDialog({ isOpen: true, type: 'error', title: 'Lỗi kết xuất', message: 'Không tìm thấy mẫu in trong hệ thống.' });
                return;
            }

            try {
                const printCanvas = element.querySelector('canvas');

                if (printCanvas instanceof HTMLCanvasElement) {
                    const isCanvasReady = () => {
                        const ctx = printCanvas.getContext('2d');
                        if (!ctx || printCanvas.width === 0 || printCanvas.height === 0) return false;
                        const sample = ctx.getImageData(
                            0,
                            0,
                            Math.min(20, printCanvas.width),
                            Math.min(20, printCanvas.height)
                        ).data;
                        for (let i = 3; i < sample.length; i += 4) {
                            if (sample[i] > 0) return true;
                        }
                        return false;
                    };

                    let attempts = 0;
                    while (!isCanvasReady() && attempts < 10) {
                        await new Promise(resolve => setTimeout(resolve, 180));
                        attempts += 1;
                    }
                }

                const images = Array.from(element.querySelectorAll('img')) as HTMLImageElement[];
                await Promise.all(
                    images.map((img) => {
                        if (img.complete && img.naturalWidth > 0) {
                            return Promise.resolve();
                        }
                        return new Promise<void>((resolve) => {
                            const done = () => resolve();
                            img.addEventListener('load', done, { once: true });
                            img.addEventListener('error', done, { once: true });
                        });
                    })
                );

                const pdf = new jsPDF('p', 'mm', 'a4');
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const marginX = 8;
                const marginTop = 8;
                const marginBottom = 12;
                const printableWidthMm = pageWidth - marginX * 2;
                const printableHeightMm = pageHeight - marginTop - marginBottom;

                const pages = Array.from(element.querySelectorAll('.print-page')) as HTMLElement[];
                const targetPages = pages.length > 0 ? pages : [element as HTMLElement];

                for (let i = 0; i < targetPages.length; i++) {
                    const pageElement = targetPages[i];
                    const canvas = await html2canvas(pageElement, {
                        scale: 3.6,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                        windowWidth: pageElement.scrollWidth,
                        windowHeight: pageElement.scrollHeight,
                        onclone: (clonedDoc) => {
                            const textEls = clonedDoc.querySelectorAll('*');
                            textEls.forEach(el => {
                                (el as HTMLElement).style.color = '#000000';
                                (el as HTMLElement).style.textShadow = 'none';
                            });
                        }
                    });

                    const imgData = canvas.toDataURL('image/png', 1.0);
                    const renderedHeightMm = (canvas.height * printableWidthMm) / canvas.width;
                    const isTooTall = renderedHeightMm > printableHeightMm;
                    const drawHeightMm = isTooTall ? printableHeightMm : renderedHeightMm;
                    const drawWidthMm = isTooTall ? (canvas.width * printableHeightMm) / canvas.height : printableWidthMm;
                    const drawX = marginX + (printableWidthMm - drawWidthMm) / 2;

                    if (i > 0) {
                        pdf.addPage();
                    }

                    pdf.addImage(imgData, 'PNG', drawX, marginTop, drawWidthMm, drawHeightMm, undefined, 'FAST');
                }

                const totalPages = pdf.getNumberOfPages();
                for (let page = 1; page <= totalPages; page++) {
                    pdf.setPage(page);
                    pdf.setFont('times', 'normal');
                    pdf.setFontSize(9);
                    pdf.text(`Trang ${page}/${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
                }

                const parcelIdentifier = formatParcelIdentifier(parcel.properties, systemSettings?.parcel_identifier_format);
                pdf.save(`TrichLuc_${toSafeFilename(parcelIdentifier, 'parcel')}.pdf`);
            } catch (err) {
                console.error("PDF Export Error:", err);
                setDialog({ isOpen: true, type: 'error', title: 'Lỗi PDF', message: 'Có lỗi xảy ra khi tạo tệp trích lục.' });
            } finally {
                setIsPrinting(false);
                setPrintingParcel(null);
            }
        }, 1500); 
    };

    const handleUpdateParcel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editFormData.tableName) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Không xác định được bảng dữ liệu.' });
            return;
        }
        setEditLoading(true);
        try {
            // Force a valid gid for update to avoid accidental insert of a new row.
            let effectiveGid = isValidGid(editFormData.gid) ? Number(editFormData.gid) : null;
            if (!effectiveGid && selectedParcel) {
                const probeParcel: LandParcel = {
                    ...selectedParcel,
                    gid: selectedParcel.gid,
                    properties: {
                        ...selectedParcel.properties,
                        tableName: editFormData.tableName || selectedParcel.properties.tableName || selectedParcel.properties.table_name,
                        so_to: editFormData.sodoto || selectedParcel.properties.so_to,
                        so_thua: editFormData.sothua || selectedParcel.properties.so_thua,
                        sodoto: editFormData.sodoto || selectedParcel.properties.sodoto,
                        sothua: editFormData.sothua || selectedParcel.properties.sothua
                    }
                };
                effectiveGid = await resolveParcelGid(probeParcel);
            }

            if (!effectiveGid) {
                throw new Error('Không xác định được GID của thửa đất. Vui lòng bấm lại đúng thửa rồi thử cập nhật lại.');
            }

            let response;
            if (editFormData.file) {
                const dataToSend: any = { ...editFormData };
                dataToSend.gid = effectiveGid;
                response = await parcelApi.createWithUpload(editFormData.tableName, dataToSend);
            } else {
                const { geometry, ...dataOnlyAttrs } = editFormData;
                response = await parcelApi.update(editFormData.tableName, effectiveGid, dataOnlyAttrs);
            }
            
            if (selectedParcel) {
                const updatedProperties = {
                    ...selectedParcel.properties,
                    so_to: editFormData.sodoto || selectedParcel.properties.so_to,
                    so_thua: editFormData.sothua || selectedParcel.properties.so_thua,
                    ownerName: editFormData.tenchu || selectedParcel.properties.ownerName || '',
                    address: editFormData.diachi || selectedParcel.properties.address,
                    landType: editFormData.loaidat || selectedParcel.properties.landType || '',
                    area: Number(editFormData.dientich ?? selectedParcel.properties.area ?? 0),
                };
                setSelectedParcel({ ...selectedParcel, properties: updatedProperties });
            }

            setDialog({ isOpen: true, type: 'success', title: 'Thành công', message: 'Thông tin thửa đất đã được lưu.' });
            setIsEditOpen(false);
            setWmsCacheBust(Date.now());
        } catch (err: any) {
            setDialog({ isOpen: true, type: 'error', title: 'Thất bại', message: err.message });
        } finally {
            setEditLoading(false);
        }
    };

    const handleToggleWMS = (id: string) => {
        const targetLayer = availableLayers.find(l => l.id === id);
        if (!targetLayer) return;

        const category = targetLayer.category || 'STANDARD';

        setVisibleLayerIds(prev => {
            if (prev.includes(id)) return prev.filter(i => i !== id);

            const layersToKeep = prev.filter(pid => {
                const pLayer = availableLayers.find(l => l.id === pid);
                return pLayer && (pLayer.category || 'STANDARD') !== category;
            });
            
            return [...layersToKeep, id];
        });
        
        setActiveLayerId(id);
    };

    const handleFitLayerView = useCallback(async (id: string) => {
        const config = availableLayersRef.current.find((l) => l.id === id);
        if (!config || !mapInstance.current) return;

        const tableName = config.layers.includes(':') ? config.layers.split(':').pop() : config.layers;
        if (!tableName) return;

        try {
            const extentData = await gisService.getExtent(tableName);
            if (extentData && extentData.xmin !== null && extentData.xmin !== undefined) {
                const xmin = parseFloat(extentData.xmin);
                const ymin = parseFloat(extentData.ymin);
                const xmax = parseFloat(extentData.xmax);
                const ymax = parseFloat(extentData.ymax);

                if (!isNaN(xmin) && !isNaN(ymin) && !isNaN(xmax) && !isNaN(ymax)) {
                    const extent = [xmin, ymin, xmax, ymax];

                    let sourceProj = 'EPSG:4326';
                    if (Math.abs(xmin) > 300000 && Math.abs(xmin) < 900000) {
                        sourceProj = 'EPSG:9210';
                    } else if (Math.abs(xmin) > 1000000) {
                        sourceProj = 'EPSG:3857';
                    }

                    const transformedExtent = proj.transformExtent(extent, sourceProj, 'EPSG:3857');

                    if (!transformedExtent.some((val) => isNaN(val))) {
                        mapInstance.current.getView().fit(transformedExtent, {
                            padding: [100, 100, 100, 100],
                            duration: 1000,
                            maxZoom: 20
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Zoom to layer failed:', e);
        }
    }, [availableLayersRef, mapInstance]);

    const handleActivateLayer = async (id: string) => {
        if (!visibleLayerIds.includes(id)) {
            handleToggleWMS(id);
        } else {
            setActiveLayerId(id);
        }

        await handleFitLayerView(id);
    };

    const initData = useCallback(async () => {
        try {
            const [layers, tables, maps] = await Promise.all([
                gisService.getLayers().catch(() => []),
                gisService.getSpatialTables().catch(() => []),
                gisService.getBasemaps().catch(() => [])
            ]);

            const canRenderLayer = layerVisibilityFilter || (() => true);
            const eligibleLayers = layers.filter(canRenderLayer);
            const storageId = stateStorageKey ? `${MAP_UI_STATE_STORAGE_PREFIX}${stateStorageKey}` : '';
            const savedUiState = storageId
                ? safeReadStorage<{ visibleLayerIds?: string[]; activeLayerId?: string | null; activeBasemapId?: string | null }>(storageId)
                : null;

            setAvailableLayers(eligibleLayers);

            const eligibleLayerIdSet = new Set(eligibleLayers.map((layer) => layer.id));
            const persistedVisibleIds = Array.isArray(savedUiState?.visibleLayerIds)
                ? savedUiState.visibleLayerIds.filter((id) => eligibleLayerIdSet.has(id))
                : [];
            const defaultVisibleIds = eligibleLayers.filter((l) => l.visible).map((l) => l.id);
            const nextVisibleIds = persistedVisibleIds.length > 0
                ? persistedVisibleIds
                : defaultVisibleIds.length > 0
                    ? defaultVisibleIds
                    : (eligibleLayers[0] ? [eligibleLayers[0].id] : []);

            setVisibleLayerIds(nextVisibleIds);

            const preferredActiveLayerId = typeof savedUiState?.activeLayerId === 'string' && eligibleLayerIdSet.has(savedUiState.activeLayerId)
                ? savedUiState.activeLayerId
                : null;
            setActiveLayerId(preferredActiveLayerId || nextVisibleIds[0] || eligibleLayers[0]?.id || null);

            setSpatialTables(Array.isArray(tables) ? tables : []);

            const nextBasemaps = Array.isArray(maps) ? maps : [];
            setBasemaps(nextBasemaps);
            const persistedBasemap = nextBasemaps.find((m) => m.id === savedUiState?.activeBasemapId);
            const defMap = persistedBasemap || nextBasemaps.find((m) => m.isDefault) || nextBasemaps[0];
            if (defMap) {
                setActiveBasemapId(defMap.id);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsInitialLoading(false);
        }
    }, [layerVisibilityFilter]);

    useEffect(() => {
        if (!stateStorageKey || isInitialLoading || typeof window === 'undefined') return;

        try {
            window.localStorage.setItem(
                `${MAP_UI_STATE_STORAGE_PREFIX}${stateStorageKey}`,
                JSON.stringify({
                    visibleLayerIds,
                    activeLayerId,
                    activeBasemapId
                })
            );
        } catch {
            // Ignore browser storage errors.
        }
    }, [stateStorageKey, isInitialLoading, visibleLayerIds, activeLayerId, activeBasemapId]);

    const handleClearAllLayers = () => {
        setVisibleLayerIds([]);
        setActiveLayerId(null);
    };

    useEffect(() => {
        if (!mapInstance.current || !measureMode) { if (drawInteraction.current) mapInstance.current?.removeInteraction(drawInteraction.current); return; }
        const map = mapInstance.current;
        drawInteraction.current = new Draw({ source: measureSource.current, type: measureMode, style: measureStyle });
        map.addInteraction(drawInteraction.current);
        let listener: any;
        drawInteraction.current.on('drawstart', (evt) => {
            const feature = evt.feature;
            const tooltipElement = document.createElement('div');
            tooltipElement.className = 'bg-black/80 text-white px-2 py-1 rounded text-[10px] font-bold shadow-xl backdrop-blur-sm border border-white/20 pointer-events-none whitespace-nowrap';
            const tooltip = new Overlay({ element: tooltipElement, offset: [0, -15], positioning: 'bottom-center', stopEvent: false, insertFirst: false });
            map.addOverlay(tooltip);
            listener = feature.getGeometry()?.on('change', (evt: any) => {
                const geom = evt.target;
                let output = ''; let tooltipCoord: Coordinate | undefined;
                if (geom instanceof Polygon) { output = (getArea(geom) > 10000 ? (getArea(geom)/10000).toFixed(2) + ' ha' : getArea(geom).toFixed(2) + ' m²'); tooltipCoord = geom.getInteriorPoint().getCoordinates(); }
                else if (geom instanceof LineString) { output = (getLength(geom) > 1000 ? (getLength(geom)/1000).toFixed(2) + ' km' : getLength(geom).toFixed(2) + ' m'); tooltipCoord = geom.getLastCoordinate(); }
                tooltipElement.innerHTML = output; if (tooltipCoord) tooltip.setPosition(tooltipCoord);
            });
        });
        drawInteraction.current.on('drawend', () => { if (listener) unByKey(listener); setMeasureMode(null); });
        return () => { if (drawInteraction.current) map.removeInteraction(drawInteraction.current); };
    }, [measureMode]);

    useEffect(() => {
        if (!baseLayerRef.current) return;

        const config = basemaps.find((m) => m.id === activeBasemapId);

        try {
            if (!config || !config.url || config.type === 'OSM') {
                baseLayerRef.current.setSource(new OSM({ crossOrigin: 'anonymous' }));
                return;
            }

            let finalUrl = config.url;
            if (config.useProxy) {
                const rawUrl = config.url.startsWith('/') ? `${API_URL}${config.url}` : config.url;
                finalUrl = `${API_URL}/api/proxy/forward?url=${encodeURIComponent(rawUrl)}`
                    .split('%7Bz%7D').join('{z}')
                    .split('%7Bx%7D').join('{x}')
                    .split('%7By%7D').join('{y}');
            }

            baseLayerRef.current.setSource(new XYZ({ url: finalUrl, crossOrigin: 'anonymous' }));
        } catch (error) {
            console.error('Basemap fallback activated:', error);
            baseLayerRef.current.setSource(new OSM({ crossOrigin: 'anonymous' }));
        }
    }, [activeBasemapId, basemaps]);

    useEffect(() => {
        if (!wmsLayerGroup.current) return;
        const canRenderLayer = layerVisibilityFilter || (() => true);
        const olLayers = availableLayers.filter(l => visibleLayerIds.includes(l.id) && canRenderLayer(l)).map(config => {
            let source;
            if (config.type === 'XYZ') {
                const proxiedUrl = `${API_URL}/api/proxy/forward?url=${encodeURIComponent(config.url)}`.split('%7Bz%7D').join('{z}').split('%7Bx%7D').join('{x}').split('%7By%7D').join('{y}');
                source = new XYZ({ url: proxiedUrl, crossOrigin: 'anonymous' });
            } else {
                source = new TileWMS({ 
                    url: `${API_URL}/api/proxy/forward?url=${encodeURIComponent(config.url)}`, 
                    params: { 'LAYERS': config.layers, 'TILED': true, 'TRANSPARENT': true, 'FORMAT': 'image/png', 't': wmsCacheBust }, 
                    crossOrigin: 'anonymous' 
                });
            }
            let zIndex = config.category === 'PLANNING' ? 0 : 10;
            if (activeLayerId === config.id) zIndex += 1; 
            const layer = new TileLayer({ 
                source: source, 
                opacity: Number(config.opacity ?? 1), 
                zIndex: zIndex 
            });
            layer.set('layerId', config.id);
            return layer;
        });
        wmsLayerGroup.current.setLayers(new Collection(olLayers));
    }, [availableLayers, visibleLayerIds, activeLayerId, wmsCacheBust, layerVisibilityFilter]);

    return {
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
        handleFitLayerView,
        initData,
        handleClearAllLayers
    };
};
