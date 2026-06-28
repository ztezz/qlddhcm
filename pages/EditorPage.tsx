
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { User, UserRole } from '../types';
import { gisService, adminService, DEFAULT_ROLE_PERMISSIONS, hasAnyPermission } from '../services/mockBackend';
import { parcelApi } from '../services/parcelApi';
import { getUid } from 'ol/util';
import proj4 from "proj4";
import { register } from 'ol/proj/proj4';
import { exportDxfFile, exportGeoJsonFile, exportShpZipFile } from '../utils/parcelExport';
import { importDxfAsPolygonFeatures } from '../utils/dxfImport';

// Icons
import { Search, X, RefreshCw } from 'lucide-react';

// Components
import EditorToolbar from '../components/editor/EditorToolbar';
import EditorSidebar from '../components/editor/EditorSidebar';
import EditorLayoutShell from '../components/editor/EditorLayoutShell';
import EditorModals from '../components/editor/EditorModals';
import { ParcelSearchDialog, ParcelResultDialog } from '../components/editor/ParcelLookupDialogs';

// Hooks
import { useEditorHistory } from '../hooks/useEditorHistory';
import { useEditorDraft } from '../hooks/useEditorDraft';

// Utils
import { validateGeometry } from '../utils/editorValidation';
import { getEditStyle, getSelectedStyle } from '../utils/editorStyles';
import {
    olCoordsToTurfPolygon,
    turfPolygonToOlPolygon,
    mergePolygons,
    createFeatureFromPolygon,
    calculateArea
} from '../utils/geometryUtils';

// Turf.js for geometry operations
import * as turf from '@turf/turf';

// OpenLayers
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer, Graticule } from 'ol/layer';
import { Vector as VectorSource, XYZ } from 'ol/source';
import * as proj from 'ol/proj';
import * as style from 'ol/style';
import { Polygon, Point, MultiPolygon, LineString } from 'ol/geom';
import GeoJSON from 'ol/format/GeoJSON';
import Feature from 'ol/Feature';
import { Draw, Modify, Snap, Select, DragBox } from 'ol/interaction';
import { createBox } from 'ol/interaction/Draw';
import { getArea, getLength } from 'ol/sphere';
import { isEmpty as isExtentEmpty } from 'ol/extent';
import { click } from 'ol/events/condition';

// Register VN-2000 (EPSG:9210 - Kinh tuyến trục 105.75 cho khu vực miền Nam)
proj4.defs("EPSG:9210", "+proj=tmerc +lat_0=0 +lon_0=105.75 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.904,-39.303,-111.450,0,0,0,0 +units=m +no_defs");
register(proj4);

// Helper functions for dynamic VN-2000 projections by province
const getVn2000ProjName = (centralMeridian: number, zone: '3' | '6') => {
    return `VN2000_DYNAMIC_${centralMeridian.toString().replace('.', '_')}_${zone}`;
};

const registerDynamicVn2000 = (centralMeridian: number, zone: '3' | '6') => {
    const name = getVn2000ProjName(centralMeridian, zone);
    if (!proj.get(name)) {
        const scaleFactor = zone === '3' ? 0.9999 : 0.9996;
        const def = `+proj=tmerc +lat_0=0 +lon_0=${centralMeridian} +k=${scaleFactor} +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.904,-39.303,-111.450,0,0,0,0 +units=m +no_defs`;
        proj4.defs(name, def);
        register(proj4);
    }
    return name;
};

const EditorPage: React.FC<{ user: User | null }> = ({ user }) => {
    const mapElement = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<Map | null>(null);
    const mapInitVersion = useRef(0);
    const editSource = useRef<VectorSource>(new VectorSource());
    const selectInteraction = useRef<Select | null>(null);
    const drawInteraction = useRef<Draw | null>(null);
    const drawLineInteraction = useRef<Draw | null>(null);
    const dragBoxInteraction = useRef<DragBox | null>(null);
    const modifyInteraction = useRef<Modify | null>(null);
    const snapInteraction = useRef<Snap | null>(null);
    const measureSource = useRef<VectorSource>(new VectorSource());
    const measureDrawInteraction = useRef<Draw | null>(null);
    
    // States
    const [activeInteraction, setActiveInteraction] = useState<'SELECT' | 'AREA_SELECT' | 'DRAW' | 'MODIFY'>('SELECT');
    const [isSnapping, setIsSnapping] = useState(true);
    const [showBasemap, setShowBasemap] = useState(false);
    const [showGrid, setShowGrid] = useState(true);
    const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
    const [selectedFeatureUids, setSelectedFeatureUids] = useState<string[]>([]);
    const [featuresList, setFeaturesList] = useState<any[]>([]);

    // Advanced GIS features states
    const [centralMeridian, setCentralMeridian] = useState<number>(105.75);
    const [projectionZone, setProjectionZone] = useState<'3' | '6'>('3');
    const [drawShape, setDrawShape] = useState<'Polygon' | 'Rectangle' | 'Circle'>('Polygon');
    const [showVertexNumbers, setShowVertexNumbers] = useState<boolean>(true);
    const [showSegmentLengths, setShowSegmentLengths] = useState<boolean>(false);
    const [showParcelInfo, setShowParcelInfo] = useState<boolean>(false);
    const [measureType, setMeasureType] = useState<'length' | 'area' | null>(null);
    const [measureValue, setMeasureValue] = useState<string | null>(null);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    
    // Attributes
    const [soTo, setSoTo] = useState('');
    const [soThua, setSoThua] = useState('');
    const [loaiDat, setLoaiDat] = useState(''); 
    
    // Vertices luôn lưu ở EPSG:3857 để đồng bộ với Map
    const [vertices, setVertices] = useState<{x: number, y: number}[]>([]);
    const [coordSystem, setCoordSystem] = useState<'WGS84' | 'VN2000'>('VN2000');
    
    // Data States
    const [area, setArea] = useState(0);
    const [targetTable, setTargetTable] = useState('');
    const [spatialTables, setSpatialTables] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [batchSaveProgress, setBatchSaveProgress] = useState({ current: 0, total: 0, isActive: false });
    const [batchSaveResult, setBatchSaveResult] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });
    const [rolePermissions, setRolePermissions] = useState<any[]>([]);
    const [permissionLoading, setPermissionLoading] = useState(true);

    // Modal States
    const [searchModal, setSearchModal] = useState({ isOpen: false, coords: { x: '', y: '' } });
    const [manualModal, setManualModal] = useState({ isOpen: false, text: '' });
    const [parcelModal, setParcelModal] = useState({ isOpen: false, soTo: '', soThua: '', phuongXa: '', searchTable: '', includeNearby: false, nearbyRadiusMeters: '50' });
    const dxfInputRef = useRef<HTMLInputElement | null>(null);
    const [currentBasemap, setCurrentBasemap] = useState('google-satellite');
    const [dialog, setDialog] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string; }>({ isOpen: false, type: 'info', title: '', message: '' });
    const [loadingParcel, setLoadingParcel] = useState(false);
    const [parcelList, setParcelList] = useState<any[]>([]);
    const [wardList, setWardList] = useState<string[]>([]);
    const [loadingWards, setLoadingWards] = useState(false);

    // Split/Merge States
    const [splitModal, setSplitModal] = useState({ isOpen: false });
    const [mergeModal, setMergeModal] = useState({ isOpen: false, selectedFeatures: [] as any[] });
    const [splitMergeResultModal, setSplitMergeResultModal] = useState({
        isOpen: false,
        type: 'split' as 'split' | 'merge',
        originalFeatures: [] as any[],
        newFeatures: [] as any[]
    });
    // For split mode - store the split config
    const splitConfigRef = useRef<{ soTo: string; soThuaStart: number } | null>(null);
    const [isSplitMode, setIsSplitMode] = useState(false);
    // CRITICAL: Store the feature to split in a ref BEFORE mode switch
    // This prevents React state batching from clearing it when interaction changes
    const featureToSplitRef = useRef<Feature | null>(null);

    // Custom Hooks for History and Draft Management
    const updateFeatureListState = useCallback(() => {
        const feats = editSource.current.getFeatures().map(f => ({
            uid: getUid(f),
            soTo: f.get('sodoto') || '',
            soThua: f.get('sothua') || '',
            area: getArea(f.getGeometry() as any),
            isValid: !!(f.get('sodoto') && f.get('sothua'))
        }));
        setFeaturesList(feats);
    }, []);

    const {
        historyStackRef,
        historyIndexRef,
        isRestoringHistoryRef,
        canUndo,
        canRedo,
        updateHistoryFlags,
        pushHistorySnapshot,
        restoreHistorySnapshot,
        handleUndo,
        handleRedo
    } = useEditorHistory(editSource, selectedFeature);

    const {
        DRAFT_KEY,
        autoSaveTimerRef,
        saveDraft,
        clearDraft,
        loadDraft,
        startAutoSave,
        stopAutoSave
    } = useEditorDraft(editSource, mapInstance, updateFeatureListState);

    const currentPermissions = user?.role === UserRole.ADMIN
        ? DEFAULT_ROLE_PERMISSIONS[UserRole.ADMIN]
        : rolePermissions.find((rp) => rp.role === user?.role)?.permissions || (user?.role ? DEFAULT_ROLE_PERMISSIONS[user.role] || [] : []);
    const canSaveToDb = !permissionLoading && hasAnyPermission(currentPermissions, ['SAVE_MAP_TO_DB']);

    const basemapOptions = {
        'google-satellite': {
            name: 'Google Satellite',
            url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
        },
        'google-roadmap': {
            name: 'Google Roadmap',
            url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
        },
        'google-terrain': {
            name: 'Google Terrain',
            url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'
        },
        'osm': {
            name: 'OpenStreetMap',
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        },
        'google-hybrid': {
            name: 'Google Satellite Hybrid',
            url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        },
        'esri-satellite': {
            name: 'ESRI Satellite',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        }
    };

    const handleChangeBasemap = (basemapKey: string) => {
        const basemap = basemapOptions[basemapKey as keyof typeof basemapOptions];
        if (basemap && baseLayerRef.current) {
            baseLayerRef.current.setSource(new XYZ({
                url: basemap.url,
                crossOrigin: 'anonymous'
            }));
            setCurrentBasemap(basemapKey);
        }
    };

    // Layers Refs
    const baseLayerRef = useRef<TileLayer<any>>(new TileLayer({
        zIndex: 0,
        visible: false,
        source: new XYZ({
            url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            crossOrigin: 'anonymous'
        })
    }));

    const gridLayerRef = useRef<Graticule>(new Graticule({
        strokeStyle: new style.Stroke({ 
            color: 'rgba(255, 255, 255, 0.1)', 
            width: 1,
            lineDash: [4, 4] 
        }),
        showLabels: false, 
        wrapX: false,
        zIndex: 5
    }));

    const getEditStyleCallback = useCallback((feature: Feature) => getEditStyle(feature), []);
    const getSelectedStyleCallback = useCallback((feature: Feature) => getSelectedStyle(feature), []);

    const updateVerticesFromFeature = useCallback((feature: Feature | null) => {
        if (!feature) { 
            setVertices([]); 
            setArea(0);
            return; 
        }
        const geom = feature.getGeometry();
        let coords: any[] = [];
        if (geom instanceof Polygon) {
            coords = geom.getCoordinates()[0];
            setArea(getArea(geom));
        } else if (geom instanceof MultiPolygon) {
            const polyCoords = geom.getCoordinates();
            if (polyCoords.length > 0 && polyCoords[0].length > 0) {
                coords = polyCoords[0][0];
            }
            setArea(getArea(geom));
        }
        
        if (coords.length > 0) {
            const displayCoords = coords.slice(0, -1);
            setVertices(displayCoords.map(c => ({ x: c[0], y: c[1] })));
        }
    }, []);

    // Sync Inputs with Selected Feature
    useEffect(() => {
        if (selectedFeature) {
            setSoTo(String(selectedFeature.get('sodoto') ?? ''));
            setSoThua(String(selectedFeature.get('sothua') ?? ''));
            setLoaiDat(String(selectedFeature.get('loaidat') ?? ''));
            updateVerticesFromFeature(selectedFeature);
        } else {
            setSoTo(''); setSoThua(''); setLoaiDat('');
            updateVerticesFromFeature(null);
        }
    }, [selectedFeature, updateVerticesFromFeature]);

    // Handle Input Changes & Sync to Feature
    const handleSoToChange = (val: string) => {
        setSoTo(val);
        if (selectedFeature) {
            selectedFeature.set('sodoto', val);
            updateFeatureListState();
        }
    };
    const updateSelectionState = useCallback((primary?: Feature | null) => {
        const selected = selectInteraction.current?.getFeatures().getArray() || [];
        const nextUids = selected.map((f) => getUid(f));
        setSelectedFeatureUids(nextUids);
        if (primary !== undefined) {
            setSelectedFeature(primary);
            return;
        }
        if (selectedFeature && nextUids.includes(getUid(selectedFeature))) {
            return;
        }
        setSelectedFeature(selected[0] || null);
    }, [selectedFeature]);

    const handleClearSelection = useCallback(() => {
        selectInteraction.current?.getFeatures().clear();
        setSelectedFeature(null);
        setSelectedFeatureUids([]);
    }, []);
    const handleSoThuaChange = (val: string) => {
        setSoThua(val);
        if (selectedFeature) {
            selectedFeature.set('sothua', val);
            updateFeatureListState();
        }
    };
    const handleLoaiDatChange = (val: string) => {
        setLoaiDat(val);
        if (selectedFeature) {
            selectedFeature.set('loaidat', val);
        }
    };

    const initMap = async () => {
        if (!mapElement.current) return;
        const initVersion = ++mapInitVersion.current;

        // Always clean old map instance before creating a new one.
        if (mapInstance.current) {
            mapInstance.current.setTarget(undefined);
            mapInstance.current = null;
        }

        selectInteraction.current = null;
        drawInteraction.current = null;
        modifyInteraction.current = null;
        snapInteraction.current = null;

        // Editor always uses fixed startup center/zoom.
        const centerLat = 11.284;
        const centerLng = 106.619;
        const zoom = 18;

        const map = new Map({
            target: mapElement.current,
            layers: [
                baseLayerRef.current,
                gridLayerRef.current,
                new VectorLayer({ 
                    source: editSource.current, 
                    style: (feature) => getEditStyle(feature as Feature), 
                    zIndex: 100 
                }),
                new VectorLayer({
                    source: measureSource.current,
                    style: new style.Style({
                        fill: new style.Fill({ color: 'rgba(244, 63, 94, 0.15)' }),
                        stroke: new style.Stroke({ color: '#f43f5e', width: 2, lineDash: [4, 4] }),
                        image: new style.Circle({ 
                            radius: 5, 
                            stroke: new style.Stroke({ color: '#f43f5e', width: 2 }), 
                            fill: new style.Fill({ color: '#fff' }) 
                        })
                    }),
                    zIndex: 90
                })
            ],
            view: new View({ center: proj.fromLonLat([centerLng, centerLat]), zoom: zoom }),
            controls: []
        });

        const select = new Select({
            style: (feature) => getSelectedStyle(feature as Feature),
            condition: click
        });
        map.addInteraction(select);
        select.on('select', (e) => {
            const selected = select.getFeatures().getArray();
            if ((e as any).mapBrowserEvent?.originalEvent?.shiftKey) {
                setSelectedFeature((prev) => prev || selected[0] || null);
                setSelectedFeatureUids(selected.map((f) => getUid(f)));
                return;
            }
            const feature = selected[0] || null;
            updateSelectionState(feature);
        });
        selectInteraction.current = select;

        const dragBox = new DragBox();
        dragBox.setActive(activeInteraction === 'SELECT');
        dragBox.on('boxend', (e) => {
            const geometry = dragBox.getGeometry();
            const extent = geometry.getExtent();
            const selectedCollection = select.getFeatures();
            const keepExistingSelection = !!(e as any)?.mapBrowserEvent?.originalEvent?.shiftKey;

            if (!keepExistingSelection) {
                selectedCollection.clear();
            }

            editSource.current.forEachFeatureInExtent(extent, (feature) => {
                if (feature.getGeometry()?.intersectsExtent(extent) && !selectedCollection.getArray().includes(feature)) {
                    selectedCollection.push(feature);
                }
            });
            updateSelectionState();
        });
        map.addInteraction(dragBox);
        dragBoxInteraction.current = dragBox;

        // Draw interaction is handled dynamically by useEffect to support shapes (Polygon, Rectangle, Circle)
        drawInteraction.current = null;

        // Line draw interaction for split by line mode
        const drawLine = new Draw({ source: editSource.current, type: 'LineString' });
        drawLine.setActive(false); // Only active when splitting with line
        drawLine.on('drawend', (e) => {
            if (splitConfigRef.current && featureToSplitRef.current) {
                const cutGeom = e.feature.getGeometry() as LineString;
                const featureToSplit = featureToSplitRef.current;
                const config = splitConfigRef.current;

                editSource.current.removeFeature(e.feature);
                executeSplit(cutGeom as LineString, featureToSplit, config);
                setTimeout(() => editSource.current.removeFeature(e.feature), 0);

                featureToSplitRef.current = null;
                splitConfigRef.current = null;
                setIsSplitMode(false);
                setActiveInteraction('SELECT');
            }
        });
        map.addInteraction(drawLine);
        drawLineInteraction.current = drawLine;

        const modify = new Modify({ source: editSource.current });
        modify.setActive(activeInteraction === 'MODIFY');
        modify.on('modifyend', (e) => {
            const feature = e.features.getArray()[0];
            if (feature) {
                updateVerticesFromFeature(feature);
                updateFeatureListState();
            }
        });
        map.addInteraction(modify);
        modifyInteraction.current = modify;

        const snap = new Snap({ source: editSource.current });
        snap.setActive(isSnapping);
        map.addInteraction(snap);
        snapInteraction.current = snap;

        // Listen to source changes
        editSource.current.on(['addfeature', 'removefeature', 'changefeature'], () => {
            updateFeatureListState();
            pushHistorySnapshot();
        });

        mapInstance.current = map;

        // Load optional metadata asynchronously so map interactions are usable immediately.
        gisService.getSpatialTables()
            .then((tables) => {
                if (initVersion !== mapInitVersion.current) return;
                setSpatialTables(tables || []);
                if (tables && tables.length > 0) {
                    setTargetTable((prev) => prev || tables[0].table_name);
                }
            })
            .catch(() => {
                if (initVersion !== mapInitVersion.current) return;
                setSpatialTables([]);
            });

        pushHistorySnapshot();
    };

    // Draft management now handled by useEditorDraft hook

    const updateGeometryFromVertices = (newVertices: {x: number, y: number}[]) => {
        if (!selectedFeature) return;
        const coords = newVertices.map(v => [v.x, v.y]);
        if (coords.length >= 3) {
            coords.push([...coords[0]]);
            const geom = selectedFeature.getGeometry();
            if (geom instanceof Polygon) {
                geom.setCoordinates([coords]);
            } else if (geom instanceof MultiPolygon) {
                geom.setCoordinates([[coords]]);
            }
            // Update Area
            if (geom) setArea(getArea(geom as any));
            selectedFeature.changed();
            updateFeatureListState();
        }
    };

    const handleDeleteVertex = (index: number) => {
        if (vertices.length <= 3) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Vùng phải có ít nhất 3 đỉnh để hình thành đa giác.' });
            return;
        }
        const nextVertices = vertices.filter((_, i) => i !== index);
        setVertices(nextVertices);
        updateGeometryFromVertices(nextVertices);
    };

    const handleAddVertex = () => {
        if (vertices.length === 0) return;
        const last = vertices[vertices.length - 1];
        const nextVertices = [...vertices, { x: last.x + 2, y: last.y + 2 }];
        setVertices(nextVertices);
        updateGeometryFromVertices(nextVertices);
    };

    const handleUpdateVertex = (index: number, axis: 'x' | 'y', value: string) => {
        const num = parseFloat(value);
        if (isNaN(num)) return;

        let finalX = vertices[index].x;
        let finalY = vertices[index].y;

        if (coordSystem === 'VN2000') {
            const vnProj = registerDynamicVn2000(centralMeridian, projectionZone);
            const currentVn = proj.transform([vertices[index].x, vertices[index].y], 'EPSG:3857', vnProj);
            const newVn = axis === 'x' ? [num, currentVn[1]] : [currentVn[0], num];
            const backToMap = proj.transform(newVn, vnProj, 'EPSG:3857');
            finalX = backToMap[0];
            finalY = backToMap[1];
        } else {
            const currentWgs = proj.transform([vertices[index].x, vertices[index].y], 'EPSG:3857', 'EPSG:4326');
            const newWgs = axis === 'x' ? [num, currentWgs[1]] : [currentWgs[0], num];
            const backToMap = proj.transform(newWgs, 'EPSG:4326', 'EPSG:3857');
            finalX = backToMap[0];
            finalY = backToMap[1];
        }

        const nextVertices = [...vertices];
        nextVertices[index] = { x: finalX, y: finalY };
        setVertices(nextVertices);
        updateGeometryFromVertices(nextVertices);
    };

    const handleExportCoordsTxt = () => {
        if (vertices.length === 0) return;
        let content = `DANH SÁCH TỌA ĐỘ THỬA ĐẤT - HỆ: ${coordSystem}\n`;
        content += `STT\tX (m)\tY (m)\n`;
        content += `------------------------------------\n`;
        const vnProj = registerDynamicVn2000(centralMeridian, projectionZone);
        vertices.forEach((v, i) => {
            let displayX, displayY;
            if (coordSystem === 'VN2000') {
                const p = proj.transform([v.x, v.y], 'EPSG:3857', vnProj);
                displayX = p[0].toFixed(3); displayY = p[1].toFixed(3);
            } else {
                const p = proj.transform([v.x, v.y], 'EPSG:3857', 'EPSG:4326');
                displayX = p[0].toFixed(8); displayY = p[1].toFixed(8);
            }
            content += `${i + 1}\t${displayX}\t${displayY}\n`;
        });
        // Add closing point
        if (vertices.length > 0) {
            const vFirst = vertices[0];
            let fx, fy;
            if (coordSystem === 'VN2000') {
                const p = proj.transform([vFirst.x, vFirst.y], 'EPSG:3857', vnProj);
                fx = p[0].toFixed(3); fy = p[1].toFixed(3);
            } else {
                const p = proj.transform([vFirst.x, vFirst.y], 'EPSG:3857', 'EPSG:4326');
                fx = p[0].toFixed(8); fy = p[1].toFixed(8);
            }
            content += `${vertices.length + 1}\t${fx}\t${fy}\n`;
        }
        
        const blob = new Blob([content], { type: 'text/plain' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ToaDo_${coordSystem}_${Date.now()}.txt`; a.click();
    };

    const handleFitView = () => {
        if (!mapInstance.current || !editSource.current) return;
        const extent = editSource.current.getExtent();
        if (!isExtentEmpty(extent)) {
            mapInstance.current.getView().fit(extent, { padding: [100, 100, 100, 100], duration: 800, maxZoom: 20 });
        } else {
            setDialog({ isOpen: true, type: 'info', title: 'Thông báo', message: 'Chưa có hình vẽ nào để thu phóng.' });
        }
    };

    const handleGoToCoordinate = () => {
        const x = parseFloat(searchModal.coords.x);
        const y = parseFloat(searchModal.coords.y);
        if (isNaN(x) || isNaN(y)) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Tọa độ nhập vào không hợp lệ.' });
            return;
        }
        if (mapInstance.current) {
            let center;
            if (Math.abs(x) > 100000) {
                const vnProj = registerDynamicVn2000(centralMeridian, projectionZone);
                center = proj.transform([x, y], vnProj, 'EPSG:3857');
            }
            else center = proj.fromLonLat([x, y]);
            mapInstance.current.getView().animate({ center: center, zoom: 19, duration: 1000 });
            setSearchModal({ ...searchModal, isOpen: false });
        }
    };

    useEffect(() => {
        const loadPermissions = async () => {
            try {
                const data = await adminService.getRolePermissions();
                setRolePermissions(Array.isArray(data) ? data : []);
            } catch {
                setRolePermissions([]);
            } finally {
                setPermissionLoading(false);
            }
        };
        loadPermissions();
    }, []);

    // Sync label properties to all features
    useEffect(() => {
        const features = editSource.current.getFeatures();
        features.forEach(f => {
            f.set('showVertexNumbers', showVertexNumbers);
            f.set('showSegmentLengths', showSegmentLengths);
            f.set('showParcelInfo', showParcelInfo);
        });
        editSource.current.changed();
    }, [showVertexNumbers, showSegmentLengths, showParcelInfo, featuresList]);

    // Handle measurement tool interaction
    useEffect(() => {
        if (!mapInstance.current) return;
        
        if (measureDrawInteraction.current) {
            mapInstance.current.removeInteraction(measureDrawInteraction.current);
            measureDrawInteraction.current = null;
        }

        if (measureType) {
            // Deactivate other edit interactions
            setActiveInteraction('SELECT');
            
            const drawType = measureType === 'length' ? 'LineString' : 'Polygon';
            const draw = new Draw({
                source: measureSource.current,
                type: drawType,
                style: new style.Style({
                    fill: new style.Fill({ color: 'rgba(244, 63, 94, 0.15)' }),
                    stroke: new style.Stroke({ color: '#f43f5e', width: 2, lineDash: [4, 4] }),
                    image: new style.Circle({ 
                        radius: 5, 
                        stroke: new style.Stroke({ color: '#f43f5e', width: 2 }), 
                        fill: new style.Fill({ color: '#fff' }) 
                    })
                })
            });

            draw.on('drawstart', (e) => {
                measureSource.current.clear();
                const geom = e.feature.getGeometry();
                setMeasureValue(measureType === 'length' ? '0.00 m' : '0.00 m²');
                
                geom?.on('change', (evt) => {
                    const g = evt.target;
                    let result = '';
                    if (g instanceof LineString) {
                        const length = getLength(g);
                        result = `${length.toFixed(2)} m`;
                    } else if (g instanceof Polygon) {
                        const area = getArea(g);
                        result = `${area.toFixed(2)} m²`;
                    }
                    setMeasureValue(result);
                });
            });

            mapInstance.current.addInteraction(draw);
            measureDrawInteraction.current = draw;
        } else {
            measureSource.current.clear();
            setMeasureValue(null);
        }
    }, [measureType]);

    // Handle dynamic draw interaction for shapes (Polygon, Rectangle, Circle)
    useEffect(() => {
        if (!mapInstance.current) return;

        if (drawInteraction.current) {
            mapInstance.current.removeInteraction(drawInteraction.current);
            drawInteraction.current = null;
        }

        if (activeInteraction === 'DRAW') {
            let drawOptions: any = {
                source: editSource.current
            };

            if (isSplitMode) {
                drawOptions.type = 'Polygon';
            } else {
                if (drawShape === 'Polygon') {
                    drawOptions.type = 'Polygon';
                } else if (drawShape === 'Rectangle') {
                    drawOptions.type = 'Circle';
                    drawOptions.geometryFunction = createBox();
                } else if (drawShape === 'Circle') {
                    drawOptions.type = 'Circle';
                }
            }

            const draw = new Draw(drawOptions);
            draw.on('drawend', (e) => {
                if (isSplitMode && splitConfigRef.current) {
                    const cutGeom = e.feature.getGeometry();
                    if (cutGeom && featureToSplitRef.current) {
                        const featureToSplit = featureToSplitRef.current;
                        const config = splitConfigRef.current;
                        executeSplit(cutGeom as Polygon, featureToSplit, config);
                        editSource.current.removeFeature(e.feature);
                        featureToSplitRef.current = null;
                        splitConfigRef.current = null;
                        setIsSplitMode(false);
                        setActiveInteraction('SELECT');
                    }
                } else {
                    let feature = e.feature;
                    const geom = feature.getGeometry();
                    
                    if (geom && geom.getType() === 'Circle') {
                        const circleGeom = geom as any;
                        const center3857 = circleGeom.getCenter();
                        const radius = circleGeom.getRadius(); 
                        
                        const edgePoint3857 = [center3857[0] + radius, center3857[1]];
                        const centerLonLat = proj.toLonLat(center3857);
                        const edgeLonLat = proj.toLonLat(edgePoint3857);
                        const turfCenter = turf.point(centerLonLat);
                        const turfEdge = turf.point(edgeLonLat);
                        const radiusMeters = turf.distance(turfCenter, turfEdge, { units: 'kilometers' }) * 1000;
                        
                        const turfCircle = turf.circle(centerLonLat, radiusMeters / 1000, { steps: 64, units: 'kilometers' });
                        const olCoords = turfCircle.geometry.coordinates[0].map(coord => proj.fromLonLat(coord));
                        const polyGeom = new Polygon([olCoords]);
                        feature.setGeometry(polyGeom);
                    }

                    // Apply current label settings
                    feature.set('showVertexNumbers', showVertexNumbers);
                    feature.set('showSegmentLengths', showSegmentLengths);
                    feature.set('showParcelInfo', showParcelInfo);

                    setSelectedFeature(feature);
                    updateSelectionState(feature);
                    updateVerticesFromFeature(feature);
                    updateFeatureListState();
                    setTimeout(() => setActiveInteraction('SELECT'), 50);
                }
            });

            mapInstance.current.addInteraction(draw);
            drawInteraction.current = draw;
        }
    }, [activeInteraction, drawShape, isSplitMode, showVertexNumbers, showSegmentLengths, showParcelInfo]);

    // Handle topology validation check
    const handleTopologyCheck = () => {
        const features = editSource.current.getFeatures();
        if (features.length < 2) {
            setDialog({
                isOpen: true,
                type: 'info',
                title: 'Kiểm tra hình học',
                message: 'Cần ít nhất 2 thửa đất trên bản đồ để thực hiện kiểm tra chồng lấn ranh giới.'
            });
            return;
        }

        let overlaps: string[] = [];

        for (let i = 0; i < features.length; i++) {
            const f1 = features[i];
            const g1 = f1.getGeometry();
            if (!(g1 instanceof Polygon)) continue;
            
            const p1SoTo = f1.get('sodoto') || '?';
            const p1SoThua = f1.get('sothua') || '?';
            
            const turfPoly1 = turf.polygon(g1.getCoordinates());

            for (let j = i + 1; j < features.length; j++) {
                const f2 = features[j];
                const g2 = f2.getGeometry();
                if (!(g2 instanceof Polygon)) continue;

                const p2SoTo = f2.get('sodoto') || '?';
                const p2SoThua = f2.get('sothua') || '?';

                const turfPoly2 = turf.polygon(g2.getCoordinates());

                try {
                    const intersection = turf.intersect(turf.featureCollection([turfPoly1, turfPoly2]));
                    if (intersection) {
                        const area = turf.area(intersection);
                        if (area > 0.05) { // ignore small errors
                            overlaps.push(`- Thửa ${p1SoThua}/Tờ ${p1SoTo} với Thửa ${p2SoThua}/Tờ ${p2SoTo} (Diện tích chồng lấn: ${area.toFixed(2)} m²)`);
                        }
                    }
                } catch (e) {
                    console.error("Turf intersection error", e);
                }
            }
        }

        if (overlaps.length > 0) {
            setDialog({
                isOpen: true,
                type: 'error',
                title: 'Lỗi Chồng Lấn Ranh Giới',
                message: `Phát hiện ${overlaps.length} lỗi ranh giới chồng đè:\n\n` + overlaps.join('\n')
            });
        } else {
            setDialog({
                isOpen: true,
                type: 'success',
                title: 'Kết Quả Kiểm Tra',
                message: 'Tuyệt vời! Không phát hiện lỗi chồng lấn ranh giới giữa các thửa đất trên bản đồ.'
            });
        }
    };

    // Load danh sách phường/xã từ các bảng thửa đất đã đăng ký
    useEffect(() => {
        const loadWards = async () => {
            try {
                setLoadingWards(true);
                const wards = await gisService.getWardsFromParcels();
                setWardList(wards || []);
            } catch {
                setWardList([]);
            } finally {
                setLoadingWards(false);
            }
        };
        loadWards();
    }, []);

    useEffect(() => {
        initMap();
        return () => {
            mapInitVersion.current += 1;
            if (mapInstance.current) {
                mapInstance.current.setTarget(undefined);
                mapInstance.current = null;
            }
        };
    }, []);

    // Auto-save draft every 5 seconds
    useEffect(() => {
        autoSaveTimerRef.current = setInterval(saveDraft, 5000);
        return () => {
            if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
        };
    }, [saveDraft]);

    // Restore draft after map is ready (slight delay to ensure editSource is ready)
    useEffect(() => {
        const t = setTimeout(() => {
            if (loadDraft()) {
                setDialog({
                    isOpen: true,
                    type: 'info',
                    title: 'Khôi phục bản nháp',
                    message: 'Đã khôi phục dữ liệu từ phiên làm việc trước.'
                });
            }
        }, 800);
        return () => clearTimeout(t);
    }, [loadDraft]);

    useEffect(() => {
        if (baseLayerRef.current) baseLayerRef.current.setVisible(showBasemap);
        if (gridLayerRef.current) gridLayerRef.current.setVisible(showGrid);
    }, [showBasemap, showGrid]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
                e.preventDefault();
                handleRedo();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleUndo, handleRedo]);

    useEffect(() => {
        if (!mapInstance.current) return;
        if (selectInteraction.current) {
            const selectMode = activeInteraction === 'SELECT';
            selectInteraction.current.setActive(selectMode);
            if (!selectMode) {
                selectInteraction.current.getFeatures().clear();
                setSelectedFeature(null);
                setSelectedFeatureUids([]);
            }
        }
        if (dragBoxInteraction.current) {
            const areaSelectMode = activeInteraction === 'AREA_SELECT';
            dragBoxInteraction.current.setActive(areaSelectMode);
            if (!areaSelectMode) {
                selectInteraction.current?.getFeatures().clear();
                setSelectedFeature(null);
                setSelectedFeatureUids([]);
            }
        }
        if (drawInteraction.current) {
            // Only activate polygon draw when NOT in split mode
            // OR when in split mode but using polygon cut (not line)
            const usePolygonDraw = activeInteraction === 'DRAW' && !isSplitMode;
            drawInteraction.current.setActive(usePolygonDraw);
        }
        if (drawLineInteraction.current) {
            // Activate line draw only when in split mode with line cut
            const useLineDraw = activeInteraction === 'DRAW' && isSplitMode;
            drawLineInteraction.current.setActive(useLineDraw);
        }
        if (modifyInteraction.current) {
            modifyInteraction.current.setActive(activeInteraction === 'MODIFY');
        }
        if (snapInteraction.current) {
            snapInteraction.current.setActive(isSnapping);
        }
    }, [activeInteraction, isSnapping, isSplitMode, updateVerticesFromFeature, updateFeatureListState]);

    // Xử lý tra cứu thông tin thửa đất
    const handleSearchParcel = async () => {
        const soTo = parcelModal.soTo.trim();
        const soThua = parcelModal.soThua.trim();
        const targetTable = parcelModal.searchTable.trim();

        if (!targetTable) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Vui lòng chọn bảng dữ liệu để tra cứu.' });
            return;
        }

        if (!soTo && !soThua) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Vui lòng nhập số tờ hoặc số thửa.' });
            return;
        }

        setLoadingParcel(true);
        setParcelList([]);
        try {
            const filters: any = {};
            if (soTo) filters.sodoto = soTo;
            if (soThua) filters.sothua = soThua;

            const parcels = await gisService.searchParcels(targetTable, filters);

            if (!parcels || parcels.length === 0) {
                let msg = 'Không tìm thấy thửa đất với điều kiện:';
                if (soTo) msg += ` Tờ ${soTo}`;
                if (soThua) msg += ` Thửa ${soThua}`;
                throw new Error(msg);
            }

            setParcelList(parcels);
            setParcelModal({ ...parcelModal, isOpen: true });

        } catch (e: any) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: e.message || 'Không thể tra cứu thông tin thửa.' });
        } finally {
            setLoadingParcel(false);
        }
    };

    // Chọn thửa từ danh sách kết quả
    const handleSelectParcel = async (parcel: any) => {
        try {
            const props = parcel.properties || {};
            const soTo = props.so_to || props.sodoto || '';
            const soThua = props.so_thua || props.sothua || '';
            const loaiDat = props.loai_dat || props.loaidat || '';
            const sourceGid = Number(props.gid ?? props.id);
            const sourceTableName = String(props.tableName || props.table_name || '').trim();
            const geometry = parcel.geometry;

            if (!geometry) {
                throw new Error('Không có dữ liệu hình học cho thửa đất này.');
            }

            const format = new GeoJSON();
            const olFeature = format.readFeature(geometry, {
                dataProjection: 'EPSG:9210',
                featureProjection: 'EPSG:3857'
            }) as Feature;

            if (!olFeature) {
                throw new Error('Không thể đọc hình học từ dữ liệu thửa đất.');
            }

            olFeature.set('sodoto', soTo);
            olFeature.set('sothua', soThua);
            olFeature.set('loaidat', loaiDat);
            if (Number.isFinite(sourceGid) && sourceGid > 0) {
                olFeature.set('gid', sourceGid);
            }
            if (sourceTableName) {
                olFeature.set('source_table', sourceTableName);
            }
            olFeature.set('is_primary', true);
            olFeature.set('is_nearby', false);

            editSource.current.clear();
            editSource.current.addFeature(olFeature);
            selectInteraction.current?.getFeatures().clear();
            selectInteraction.current?.getFeatures().push(olFeature);
            updateSelectionState(olFeature);
            updateVerticesFromFeature(olFeature);
            updateFeatureListState();

            setSoTo(soTo);
            setSoThua(soThua);
            setLoaiDat(loaiDat);
            if (sourceTableName) {
                setTargetTable(sourceTableName);
            }

            if (parcelModal.includeNearby && Number.isFinite(sourceGid) && sourceGid > 0) {
                const radius = Number(parcelModal.nearbyRadiusMeters || '50');
                if (!Number.isFinite(radius) || radius <= 0) {
                    throw new Error('Bán kính lân cận không hợp lệ.');
                }
                const nearbyParcels = await gisService.searchNearbyParcels(sourceTableName || targetTable || parcelModal.searchTable, {
                    gid: sourceGid,
                    radius,
                    includeSelf: true
                });
                if (nearbyParcels.length > 0) {
                    const nearbyFeatures = nearbyParcels
                        .map((p: any) => {
                            const pProps = p.properties || {};
                            const pSoTo = pProps.so_to || pProps.sodoto || '';
                            const pSoThua = pProps.so_thua || pProps.sothua || '';
                            const pLoaiDat = pProps.loai_dat || pProps.loaidat || pProps.landType || '';
                            const pSourceGid = Number(pProps.gid ?? pProps.id);
                            const pGeometry = p.geometry;
                            const pSourceTableName = String(pProps.tableName || pProps.table_name || sourceTableName || targetTable || parcelModal.searchTable || '').trim();

                            if (!pGeometry) return null;
                            const f = format.readFeature(pGeometry, {
                                dataProjection: 'EPSG:9210',
                                featureProjection: 'EPSG:3857'
                            }) as Feature;
                            if (!f) return null;

                            f.set('sodoto', pSoTo);
                            f.set('sothua', pSoThua);
                            f.set('loaidat', pLoaiDat);
                            if (Number.isFinite(pSourceGid) && pSourceGid > 0) {
                                f.set('gid', pSourceGid);
                            }
                            if (pSourceTableName) {
                                f.set('source_table', pSourceTableName);
                            }
                            const isPrimary = Number.isFinite(pSourceGid) && pSourceGid > 0 && pSourceGid === sourceGid;
                            f.set('is_primary', isPrimary);
                            f.set('is_nearby', !isPrimary);
                            return f;
                        })
                        .filter(Boolean) as Feature[];

                    if (nearbyFeatures.length > 0) {
                        editSource.current.clear();
                        editSource.current.addFeatures(nearbyFeatures);
                        const selectedByGid = nearbyFeatures.find((f) => Number(f.get('gid')) === sourceGid) || nearbyFeatures[0];
                        if (selectedByGid) {
                            selectInteraction.current?.getFeatures().clear();
                            selectInteraction.current?.getFeatures().push(selectedByGid);
                            updateSelectionState(selectedByGid);
                            updateVerticesFromFeature(selectedByGid);
                        }
                        updateFeatureListState();
                    }
                }
            }

            const extent = editSource.current.getExtent();
            if (!isExtentEmpty(extent)) {
                mapInstance.current?.getView().fit(extent, { padding: [100, 100, 100, 100], duration: 800, maxZoom: 20 });
            }

            setParcelModal({ ...parcelModal, isOpen: false, soTo: '', soThua: '', searchTable: '' });
            setParcelList([]);
        } catch (e: any) {
            console.error('Lỗi khi chọn thửa đất:', e);
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: e.message || 'Không thể chọn thửa đất. Vui lòng thử lại.' });
        }
    };

    const handleProcessManualInput = (inputText: string) => {
        try {
            const lines = inputText.trim().split(/[\n;]+/);
            const coords = lines.map(line => {
                const parts = line.split(/[,\s\t]+/).filter(Boolean);
                if (parts.length < 2) return null;
                const x = parseFloat(parts[0]);
                const y = parseFloat(parts[1]);
                if (x > 300000 && x < 900000) {
                    const vnProj = registerDynamicVn2000(centralMeridian, projectionZone);
                    return proj.transform([x, y], vnProj, 'EPSG:3857');
                }
                return proj.fromLonLat([x, y]);
            }).filter(Boolean) as [number, number][];

            if (coords.length < 3) throw new Error("Cần ít nhất 3 điểm.");
            if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) coords.push([...coords[0]] as [number, number]);

            const polygon = new Polygon([coords]);
            const feature = new Feature({ geometry: polygon });
            editSource.current.addFeature(feature);
            selectInteraction.current?.getFeatures().clear();
            selectInteraction.current?.getFeatures().push(feature);
            updateSelectionState(feature);
            updateVerticesFromFeature(feature);
            updateFeatureListState();
            mapInstance.current?.getView().fit(polygon.getExtent(), { padding: [100, 100, 100, 100], duration: 800 });
            setManualModal({ ...manualModal, isOpen: false, text: '' });
        } catch (e: any) { setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: e.message }); }
    };

    const detectProjection = (geoJson: any): string => {
        let coord: number[] | null = null;
        const findCoord = (arr: any[]): number[] | null => {
            if (arr.length >= 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') return arr as number[];
            if (Array.isArray(arr[0])) return findCoord(arr[0]);
            return null;
        };

        if (geoJson.type === 'FeatureCollection' && geoJson.features?.length > 0) {
            const geom = geoJson.features[0].geometry;
            if (geom && geom.coordinates) coord = findCoord(geom.coordinates);
        } else if (geoJson.type === 'Feature' && geoJson.geometry) {
             const geom = geoJson.geometry;
             if (geom && geom.coordinates) coord = findCoord(geom.coordinates);
        } else if (geoJson.coordinates) {
            coord = findCoord(geoJson.coordinates);
        }

        if (coord) {
            const [x, y] = coord;
            if (Math.abs(x) > 180 || Math.abs(y) > 90) return 'EPSG:9210';
        }
        return 'EPSG:4326';
    };

    const validateGeometry = (geometry: any): string | null => {
        if (!geometry) return 'Hình vẽ không hợp lệ';
        
        let coords: any[] = [];
        let coordsArray = []
        
        if (geometry instanceof Polygon) {
            coords = geometry.getCoordinates()[0];
        } else if (geometry instanceof MultiPolygon) {
            const polyCoords = geometry.getCoordinates();
            if (polyCoords.length > 0 && polyCoords[0].length > 0) {
                coords = polyCoords[0][0];
            }
        } else {
            return 'Loại hình học không hỗ trợ';
        }
        
        if (coords.length < 4) return 'Polygon cần tối thiểu 3 đỉnh (≥4 khi tính điểm khóp)';
        
        const area = getArea(geometry);
        if (area === 0) return 'Polygon có diện tích bằng 0';
        if (area < 1) return `Diện tích quá nhỏ (${area.toFixed(2)}m²). Kiểm tra lại tọa độ.`;
        
        for (let i = 0; i < coords.length - 2; i++) {
            for (let j = i + 2; j < coords.length - 1; j++) {
                const [x1, y1] = coords[i];
                const [x2, y2] = coords[i + 1];
                const [x3, y3] = coords[j];
                const [x4, y4] = coords[j + 1];
                
                const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
                if (Math.abs(denom) < 0.0001) continue;
                
                const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
                const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
                
                if (t > 0.0001 && t < 0.9999 && u > 0.0001 && u < 0.9999) {
                    return 'Polygon tự giao nhau (self-intersection). Kiểm tra lại đỉnh.';
                }
            }
        }
        
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (Math.abs(first[0] - last[0]) > 0.01 || Math.abs(first[1] - last[1]) > 0.01) {
            return 'Polygon chưa khép lại (đỉnh đầu≠đỉnh cuối).';
        }
        
        return null;
    };

    const applyImportedFeatures = (features: Feature[], projectionLabel: string, sourceLabel: string, skippedMessage?: string) => {
        if (features.length === 0) {
            throw new Error(`Không tìm thấy đối tượng hợp lệ từ ${sourceLabel}.`);
        }

        editSource.current.clear();
        features.forEach(f => {
            const props = f.getProperties();
            if (props.sodoto) f.set('sodoto', props.sodoto);
            if (props.sothua) f.set('sothua', props.sothua);
            if (props.loaidat) f.set('loaidat', props.loaidat);
        });

        editSource.current.addFeatures(features);
        const lastFeature = features[features.length - 1];
        selectInteraction.current?.getFeatures().clear();
        selectInteraction.current?.getFeatures().push(lastFeature);
        updateSelectionState(lastFeature);
        updateVerticesFromFeature(lastFeature);
        updateFeatureListState();

        const extent = editSource.current.getExtent();
        if (!isExtentEmpty(extent)) {
            mapInstance.current?.getView().fit(extent, { padding: [100, 100, 100, 100], duration: 800 });
        }

        setDialog({
            isOpen: true,
            type: 'success',
            title: 'Thành công',
            message: `Đã nạp ${features.length} đối tượng từ ${sourceLabel} (Hệ tọa độ phát hiện: ${projectionLabel}).${skippedMessage ? ` ${skippedMessage}` : ''}`
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = (event.target?.result as string).trim();
                if (!text) throw new Error("File rỗng");
                
                const content = JSON.parse(text);
                const format = new GeoJSON();
                
                const guessed = detectProjection(content);
                const guessedDataProj = guessed === 'EPSG:9210' ? registerDynamicVn2000(centralMeridian, projectionZone) : guessed;
                console.log("Detected Projection:", guessedDataProj);

                let features: Feature[] = [];
                if (content.type === 'FeatureCollection') {
                    features = format.readFeatures(content, { 
                        dataProjection: guessedDataProj, 
                        featureProjection: 'EPSG:3857' 
                    }) as Feature[];
                } else if (content.type === 'Feature') {
                    features = [format.readFeature(content, { 
                        dataProjection: guessedDataProj, 
                        featureProjection: 'EPSG:3857' 
                    }) as Feature];
                } else if (content.type === 'Polygon' || content.type === 'MultiPolygon') {
                     const geom = format.readGeometry(content, {
                         dataProjection: guessedDataProj, 
                         featureProjection: 'EPSG:3857'
                     });
                     features = [new Feature({ geometry: geom })];
                 }

                if (features.length > 0) {
                    applyImportedFeatures(features, guessed === 'EPSG:9210' ? 'VN-2000' : 'WGS84', 'GeoJSON');
                } else {
                    throw new Error("Không tìm thấy đối tượng không gian hợp lệ.");
                }
            } catch (err: any) { 
                console.error(err);
                setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: `Lỗi đọc nội dung: ${err.message}` }); 
            } finally { 
                e.target.value = ''; 
            }
        };
        reader.readAsText(file);
    };

    const handleDxfImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = String(event.target?.result || '').trim();
                if (!text) throw new Error('File rỗng');

                const vnProj = registerDynamicVn2000(centralMeridian, projectionZone);
                const { features, summary } = importDxfAsPolygonFeatures(text, vnProj);
                const skippedParts = Object.entries(summary.skippedByType)
                    .map(([type, count]) => `${type} (${count})`)
                    .join(', ');

                applyImportedFeatures(
                    features,
                    summary.projection.includes('VN2000') ? 'VN-2000' : 'WGS84',
                    'DXF',
                    summary.skipped > 0 ? `Đã bỏ qua ${summary.skipped} entity không phù hợp: ${skippedParts}.` : undefined
                );
            } catch (err: any) {
                console.error(err);
                setDialog({ isOpen: true, type: 'error', title: 'Lỗi import DXF', message: err.message || 'Không thể đọc file DXF.' });
            } finally {
                e.target.value = '';
            }
        };

        reader.readAsText(file);
    };

    const handleSaveFeature = async (feature: Feature) => {
        if (permissionLoading) {
            setDialog({ isOpen: true, type: 'info', title: 'Đang tải phân quyền', message: 'Vui lòng thử lại sau khi hệ thống tải xong quyền truy cập.' });
            return;
        }
        if (!canSaveToDb) {
            setDialog({ isOpen: true, type: 'error', title: 'Không có quyền', message: 'Bạn không có quyền lưu bản vẽ vào cơ sở dữ liệu.' });
            return;
        }
        if (!targetTable || !feature) return;
        const fSoTo = feature.get('sodoto');
        const fSoThua = feature.get('sothua');
        const fLoaiDat = feature.get('loaidat');
        const sourceGidRaw = Number(feature.get('gid'));
        const sourceGid = Number.isFinite(sourceGidRaw) && sourceGidRaw > 0 ? sourceGidRaw : null;
        const geom = feature.getGeometry();
        const fArea = getArea(geom as any);

        if (!fSoTo || !fSoThua) {
            setDialog({ isOpen: true, type: 'error', title: 'Thiếu dữ liệu', message: 'Vui lòng nhập Số tờ và Số thửa cho đối tượng trước khi lưu.' });
            return;
        }

        const validationError = validateGeometry(geom);
        if (validationError) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi hình học', message: validationError });
            return;
        }

        setLoading(true);
        try {
            const format = new GeoJSON();
            const geom = feature.getGeometry();
            let geometryObject;
            
            if (geom) {
                 geometryObject = format.writeGeometryObject(geom, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
            }

            if (geometryObject && geometryObject.type === 'Polygon') {
                geometryObject = {
                    type: 'MultiPolygon',
                    coordinates: [geometryObject.coordinates]
                };
            }

            const payload = {
                sodoto: fSoTo,
                sothua: fSoThua,
                loaidat: fLoaiDat || 'Chưa xác định',
                dientich: Math.round(fArea * 100) / 100,
                geometry: geometryObject
            };

            if (sourceGid) {
                await parcelApi.update(targetTable, sourceGid, payload);
                setDialog({ isOpen: true, type: 'success', title: 'Đã cập nhật', message: `Thửa đất ${fSoThua}/${fSoTo} đã được cập nhật thành công.` });
            } else {
                await parcelApi.create(targetTable, payload);
                setDialog({ isOpen: true, type: 'success', title: 'Đã lưu', message: `Thửa đất ${fSoThua}/${fSoTo} (${Math.round(fArea)}m2) đã được upload thành công.` });
            }
        } catch (e: any) { setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: e.message }); }
        finally { setLoading(false); }
    };

    // Save CURRENT selected feature
    const handleSaveToDB = () => {
        if (permissionLoading) {
            setDialog({ isOpen: true, type: 'info', title: 'Đang tải phân quyền', message: 'Vui lòng thử lại sau khi hệ thống tải xong quyền truy cập.' });
            return;
        }
        if (!canSaveToDb) {
            setDialog({ isOpen: true, type: 'error', title: 'Không có quyền', message: 'Bạn không có quyền lưu bản vẽ vào cơ sở dữ liệu.' });
            return;
        }
        if (selectedFeature) handleSaveFeature(selectedFeature);
    };

    // Batch save all features with retry logic
    const handleBatchSaveAll = async () => {
        if (permissionLoading) {
            setDialog({ isOpen: true, type: 'info', title: 'Đang tải phân quyền', message: 'Vui lòng thử lại sau khi hệ thống tải xong quyền truy cập.' });
            return;
        }
        if (!canSaveToDb) {
            setDialog({ isOpen: true, type: 'error', title: 'Không có quyền', message: 'Bạn không có quyền lưu bản vẽ vào cơ sở dữ liệu.' });
            return;
        }
        const features = editSource.current.getFeatures();
        if (features.length === 0) {
            setDialog({ isOpen: true, type: 'info', title: 'Thông báo', message: 'Không có đối tượng nào để lưu.' });
            return;
        }

        const invalidFeatures = features.filter(f => !f.get('sodoto') || !f.get('sothua'));
        if (invalidFeatures.length > 0) {
            setDialog({ isOpen: true, type: 'error', title: 'Thiếu dữ liệu', message: `${invalidFeatures.length} đối tượng chưa có Số tờ hoặc Số thửa.` });
            return;
        }

        const invalidGeoms = features.filter(f => validateGeometry(f.getGeometry()));
        if (invalidGeoms.length > 0) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi hình học', message: `${invalidGeoms.length} đối tượng có lỗi topology.` });
            return;
        }

        setBatchSaveProgress({ current: 0, total: features.length, isActive: true });
        setBatchSaveResult({ success: 0, failed: 0, errors: [] });
        setLoading(true);

        const format = new GeoJSON();
        const results = { success: 0, failed: 0, errors: [] as string[] };
        const maxRetries = 2;

        for (let featureIndex = 0; featureIndex < features.length; featureIndex++) {
            const feature = features[featureIndex];
            let retries = 0;
            let saved = false;

            while (retries <= maxRetries && !saved) {
                try {
                    const sourceGidRaw = Number(feature.get('gid'));
                    const sourceGid = Number.isFinite(sourceGidRaw) && sourceGidRaw > 0 ? sourceGidRaw : null;
                    const fSoTo = feature.get('sodoto');
                    const fSoThua = feature.get('sothua');
                    const fLoaiDat = feature.get('loaidat');
                    const fArea = getArea(feature.getGeometry() as any);
                    const geom = feature.getGeometry();

                    let geometryObject = format.writeGeometryObject(geom, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
                    if (geometryObject.type === 'Polygon') {
                        geometryObject = { type: 'MultiPolygon', coordinates: [geometryObject.coordinates] };
                    }

                    const payload = {
                        sodoto: fSoTo,
                        sothua: fSoThua,
                        loaidat: fLoaiDat || 'Chưa xác định',
                        dientich: Math.round(fArea * 100) / 100,
                        geometry: geometryObject
                    };

                    if (sourceGid) {
                        await parcelApi.update(targetTable, sourceGid, payload);
                    } else {
                        await parcelApi.create(targetTable, payload);
                    }

                    results.success += 1;
                    saved = true;
                } catch (err: any) {
                    retries += 1;
                    if (retries > maxRetries) {
                        results.failed += 1;
                        results.errors.push(`${feature.get('sothua')}/${feature.get('sodoto')}: ${err.message}`);
                    } else {
                        await new Promise(r => setTimeout(r, 500 * retries));
                    }
                }
            }

            setBatchSaveProgress({ current: featureIndex + 1, total: features.length, isActive: true });
            setBatchSaveResult(results);
        }

        setBatchSaveProgress({ current: 0, total: 0, isActive: false });
        setLoading(false);

        const msg = `Lưu xong: ${results.success} thành công${results.failed > 0 ? `, ${results.failed} thất bại` : ''}.${results.errors.length > 0 ? `\n${results.errors.slice(0, 3).join('\n')}${results.errors.length > 3 ? `\n...và ${results.errors.length - 3} lỗi khác` : ''}` : ''}`;
        setDialog({
            isOpen: true,
            type: results.failed === 0 ? 'success' : 'error',
            title: 'Batch Save',
            message: msg
        });

        if (results.success > 0) {
            clearDraft();
            editSource.current.clear();
            setSelectedFeature(null);
            setVertices([]);
            updateFeatureListState();
        }
    };

    const handleExportGeoJSON = () => {
        const features = editSource.current.getFeatures();
        if (features.length === 0) return;

        const geojson = new GeoJSON().writeFeaturesObject(features, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        }) as any;

        exportGeoJsonFile(geojson, `GeoMaster_${Date.now()}.geojson`);
    };

    const handleExportShpZip = async () => {
        const features = editSource.current.getFeatures();
        if (features.length === 0) return;

        try {
            const geojson = new GeoJSON().writeFeaturesObject(features, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            }) as any;

            await exportShpZipFile(geojson, `GeoMaster_${Date.now()}.zip`);
        } catch (e: any) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi export', message: e?.message || 'Không thể xuất SHP vào lúc này.' });
        }
    };

    const handleExportDXF = () => {
        const features = editSource.current.getFeatures();
        if (features.length === 0) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi export', message: 'Không có dữ liệu để xuất DXF.' });
            return;
        }

        try {
            const geojson = new GeoJSON().writeFeaturesObject(features, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            }) as any;

            exportDxfFile(geojson, `GeoMaster_${coordSystem}_${Date.now()}.dxf`, coordSystem);
            setDialog({ isOpen: true, type: 'success', title: 'Xuất thành công', message: `File DXF (${coordSystem}) đã được tải xuống. Mở bằng AutoCAD hoặc MicroStation.` });
        } catch (e: any) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi export', message: e?.message || 'Không thể xuất DXF vào lúc này.' });
        }
    };

    // List Management
    const handleDeleteFeature = (uid: string) => {
        const feature = editSource.current.getFeatures().find(f => getUid(f) === uid);
        if (feature) {
            editSource.current.removeFeature(feature);
            const selectedCollection = selectInteraction.current?.getFeatures();
            selectedCollection?.remove(feature);
            if (selectedFeature === feature) {
                updateSelectionState(selectedCollection?.item(0) || null);
            } else {
                updateSelectionState();
            }
            updateFeatureListState();
        }
    };

    const handleSelectFeatureFromList = (uid: string) => {
        const feature = editSource.current.getFeatures().find(f => getUid(f) === uid);
        if (feature) {
            // Select logic
            selectInteraction.current?.getFeatures().clear();
            selectInteraction.current?.getFeatures().push(feature);
            updateSelectionState(feature);

            // Zoom to feature
            const extent = feature.getGeometry()?.getExtent();
            if (extent) {
                mapInstance.current?.getView().fit(extent, { padding: [100, 100, 100, 100], duration: 500 });
            }
        }
    };

    const handleSaveFeatureFromList = (uid: string) => {
        if (permissionLoading) {
            setDialog({ isOpen: true, type: 'info', title: 'Đang tải phân quyền', message: 'Vui lòng thử lại sau khi hệ thống tải xong quyền truy cập.' });
            return;
        }
        if (!canSaveToDb) {
            setDialog({ isOpen: true, type: 'error', title: 'Không có quyền', message: 'Bạn không có quyền lưu bản vẽ vào cơ sở dữ liệu.' });
            return;
        }
        const feature = editSource.current.getFeatures().find(f => getUid(f) === uid);
        if (feature) handleSaveFeature(feature);
    };

    // ==================== SPLIT / MERGE HANDLERS ====================

    const handleSplitFeature = () => {
        if (!selectedFeature) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Vui lòng chọn một thửa đất để tách.' });
            return;
        }
        const soToVal = selectedFeature.get('sodoto') || '';
        const soThuaVal = selectedFeature.get('sothua') || '';
        if (!soToVal || !soThuaVal) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Thửa đất cần có số tờ và số thửa trước khi tách.' });
            return;
        }
        setSplitModal({ isOpen: true });
    };

    const handleOpenSplitModal = (soTo: string, soThuaStart: number) => {
        setSplitModal({ isOpen: false });
        splitConfigRef.current = { soTo, soThuaStart };
        featureToSplitRef.current = selectedFeature;
        setIsSplitMode(true);
        setActiveInteraction('DRAW');
    };

    const handleMergeFeatures = () => {
        const features = editSource.current.getFeatures();
        const featuresArray = Array.from(features);
        if (featuresArray.length < 2) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Cần chọn ít nhất 2 thửa để gộp.' });
            return;
        }
        // Check all features have sodoto and sothua
        const featuresWithAttr = featuresArray.filter((f: any) => f.get('sodoto') && f.get('sothua'));
        if (featuresWithAttr.length < 2) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Tất cả thửa cần có số tờ và số thửa trước khi gộp.' });
            return;
        }
        const selectedFeats = featuresWithAttr.map((f: any) => ({
            sodoto: f.get('sodoto'),
            sothua: f.get('sothua'),
            area: getArea(f.getGeometry() as any),
            feature: f
        }));
        setMergeModal({ isOpen: true, selectedFeatures: selectedFeats });
    };

    const executeMerge = (soTo: string, soThua: string) => {
        setMergeModal({ isOpen: false, selectedFeatures: [] });
        const originalFeatures = mergeModal.selectedFeatures;
        if (originalFeatures.length < 2) return;

        try {
            const polygons = originalFeatures.map(f => f.feature.getGeometry()).filter(g => g instanceof Polygon) as Polygon[];
            if (polygons.length < 2) {
                setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Không đủ polygon hợp lệ để gộp.' });
                return;
            }

            pushHistorySnapshot();

            const mergedPolygon = mergePolygons(polygons);
            if (!mergedPolygon) {
                setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Không thể gộp các thửa đất.' });
                return;
            }

            // Create new feature
            const newFeature = new Feature({ geometry: mergedPolygon });
            newFeature.set('sodoto', soTo);
            newFeature.set('sothua', soThua);
            newFeature.set('loaidat', originalFeatures[0].feature.get('loaidat') || '');
            newFeature.set('is_primary', true);

            // Remove original features
            originalFeatures.forEach(f => editSource.current.removeFeature(f.feature));

            // Add merged feature
            editSource.current.addFeature(newFeature);
            setSelectedFeature(newFeature);
            updateVerticesFromFeature(newFeature);
            updateFeatureListState();

            const originalInfo = originalFeatures.map(f => ({ sodoto: f.sodoto, sothua: f.sothua, area: f.area }));
            const mergedInfo = [{ sodoto: soTo, sothua: soThua, area: getArea(mergedPolygon) }];

            setSplitMergeResultModal({
                isOpen: true,
                type: 'merge',
                originalFeatures: originalInfo,
                newFeatures: mergedInfo
            });
        } catch (err: any) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: err.message || 'Không thể gộp thửa đất.' });
        }
    };

    const executeSplit = (cutGeom: LineString | Polygon, featureToSplit?: Feature, config?: { soTo: string; soThuaStart: number }) => {
        const feature = featureToSplit || featureToSplitRef.current || selectedFeature;
        const splitConfig = config || splitConfigRef.current;

        if (!feature || !splitConfig) {
            return;
        }

        const { soTo, soThuaStart } = splitConfig;

        try {
            pushHistorySnapshot();

            const featureGeometry = feature.getGeometry();
            let originalPolygon: Polygon | null = null;
            if (featureGeometry instanceof Polygon) {
                originalPolygon = featureGeometry;
            } else if (featureGeometry instanceof MultiPolygon) {
                const polygons = featureGeometry.getPolygons();
                originalPolygon = polygons[0] || null;
            }

            if (!originalPolygon) {
                setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Thửa đất cần tách phải là vùng polygon hợp lệ.' });
                setIsSplitMode(false);
                setActiveInteraction('SELECT');
                return;
            }

            const originalArea = getArea(originalPolygon);
            const originalInfo = {
                sodoto: feature.get('sodoto'),
                sothua: feature.get('sothua'),
                area: originalArea
            };

            let newPolygons: Polygon[] = [];

            {
                const ring = originalPolygon.getCoordinates()[0] as [number, number][];
                const lineCoords = (cutGeom instanceof Polygon ? cutGeom.getCoordinates()[0] : cutGeom.getCoordinates()) as [number, number][];

                type SplitIntersection = {
                    point: [number, number];
                    lineIndex: number;
                    lineT: number;
                    lineDistance: number;
                    ringIndex: number;
                    ringT: number;
                    ringPosition: number;
                };

                const segmentIntersections = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) => {
                    const r = [b[0] - a[0], b[1] - a[1]];
                    const s = [d[0] - c[0], d[1] - c[1]];
                    const denom = r[0] * s[1] - r[1] * s[0];
                    const cross = (p: [number, number], q: [number, number], origin: [number, number]) => (p[0] - origin[0]) * (q[1] - origin[1]) - (p[1] - origin[1]) * (q[0] - origin[0]);
                    const lineLengthSq = r[0] * r[0] + r[1] * r[1];
                    const ringLengthSq = s[0] * s[0] + s[1] * s[1];
                    if (lineLengthSq === 0 || ringLengthSq === 0) return [];

                    if (Math.abs(denom) < 1e-9) {
                        if (Math.abs(cross(c, b, a)) > 0.001 || Math.abs(cross(d, b, a)) > 0.001) return [];

                        const projected = [
                            { point: c, lineT: ((c[0] - a[0]) * r[0] + (c[1] - a[1]) * r[1]) / lineLengthSq, ringT: 0 },
                            { point: d, lineT: ((d[0] - a[0]) * r[0] + (d[1] - a[1]) * r[1]) / lineLengthSq, ringT: 1 },
                        ].filter(({ lineT }) => lineT >= -1e-9 && lineT <= 1 + 1e-9);

                        return projected.map(({ point, lineT, ringT }) => ({
                            point: [...point] as [number, number],
                            lineIndex: 0,
                            lineT,
                            lineDistance: 0,
                            ringIndex: 0,
                            ringT,
                            ringPosition: 0
                        }));
                    }

                    const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / denom;
                    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / denom;
                    if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return [];
                    return [{
                        point: [a[0] + t * r[0], a[1] + t * r[1]] as [number, number],
                        lineIndex: 0,
                        lineT: t,
                        lineDistance: 0,
                        ringIndex: 0,
                        ringT: u,
                        ringPosition: 0
                    }];
                };

                const lineLengths: number[] = [0];
                for (let i = 0; i < lineCoords.length - 1; i++) {
                    const a = lineCoords[i];
                    const b = lineCoords[i + 1];
                    lineLengths.push(lineLengths[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
                }

                const intersections: SplitIntersection[] = [];
                for (let li = 0; li < lineCoords.length - 1; li++) {
                    for (let ri = 0; ri < ring.length - 1; ri++) {
                        const hits = segmentIntersections(lineCoords[li], lineCoords[li + 1], ring[ri], ring[ri + 1]);
                        hits.forEach((hit) => {
                            hit.lineIndex = li;
                            hit.ringIndex = ri;
                            hit.lineDistance = lineLengths[li] + hit.lineT * Math.hypot(lineCoords[li + 1][0] - lineCoords[li][0], lineCoords[li + 1][1] - lineCoords[li][1]);
                            hit.ringPosition = ri + hit.ringT;
                            if (!intersections.some(existing => Math.hypot(existing.point[0] - hit.point[0], existing.point[1] - hit.point[1]) < 0.001)) {
                                intersections.push(hit);
                            }
                        });
                    }
                }

                intersections.sort((a, b) => a.lineDistance - b.lineDistance);
                if (intersections.length < 2) {
                    setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Đường cắt phải đi xuyên qua thửa đất.' });
                    setIsSplitMode(false);
                    setActiveInteraction('SELECT');
                    return;
                }

                const startHit = intersections[0];
                const endHit = intersections[intersections.length - 1];
                const ringStart = startHit.ringPosition <= endHit.ringPosition ? startHit : endHit;
                const ringEnd = startHit.ringPosition <= endHit.ringPosition ? endHit : startHit;

                const cutPath = [startHit.point];
                for (let i = startHit.lineIndex + 1; i <= endHit.lineIndex; i++) {
                    cutPath.push(lineCoords[i]);
                }
                cutPath.push(endHit.point);

                const ringPathForward = [ringStart.point];
                for (let i = ringStart.ringIndex + 1; i <= ringEnd.ringIndex; i++) {
                    ringPathForward.push(ring[i]);
                }
                ringPathForward.push(ringEnd.point);

                const ringPathBackward = [ringEnd.point];
                for (let i = ringEnd.ringIndex + 1; i < ring.length - 1; i++) {
                    ringPathBackward.push(ring[i]);
                }
                for (let i = 0; i <= ringStart.ringIndex; i++) {
                    ringPathBackward.push(ring[i]);
                }
                ringPathBackward.push(ringStart.point);

                const cutFromRingStartToEnd = ringStart === startHit ? cutPath : [...cutPath].reverse();
                const cutFromRingEndToStart = [...cutFromRingStartToEnd].reverse();

                const closeRing = (coords: [number, number][]) => {
                    const cleaned = coords.filter((coord, index) => index === 0 || Math.hypot(coord[0] - coords[index - 1][0], coord[1] - coords[index - 1][1]) > 0.001);
                    const first = cleaned[0];
                    const last = cleaned[cleaned.length - 1];
                    if (first && last && Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.001) {
                        cleaned.push([...first] as [number, number]);
                    }
                    return cleaned;
                };

                [
                    closeRing([...ringPathForward, ...cutFromRingEndToStart.slice(1)]),
                    closeRing([...ringPathBackward, ...cutFromRingStartToEnd.slice(1)])
                ].forEach((coords) => {
                    if (coords.length >= 4) {
                        const poly = new Polygon([coords]);
                        if (getArea(poly) > 0.01) {
                            newPolygons.push(poly);
                        }
                    }
                });
            }

            if (newPolygons.length < 2) {
                setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Không thể tách thửa với hình cắt này.' });
                setIsSplitMode(false);
                setActiveInteraction('SELECT');
                return;
            }

            // Remove original feature
            editSource.current.removeFeature(feature);

            // Create features with sequential numbers
            const newFeatures: Feature[] = newPolygons.map((poly, idx) => {
                const f = createFeatureFromPolygon(poly, feature, soTo, String(soThuaStart + idx));
                return f;
            });

            editSource.current.addFeatures(newFeatures);
            setSelectedFeature(newFeatures[0]);
            updateVerticesFromFeature(newFeatures[0]);
            updateFeatureListState();

            setSplitMergeResultModal({
                isOpen: true,
                type: 'split',
                originalFeatures: [originalInfo],
                newFeatures: newFeatures.map((f, i) => ({
                    sodoto: f.get('sodoto'),
                    sothua: f.get('sothua'),
                    area: getArea(f.getGeometry() as any)
                }))
            });
        } catch (err: any) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: err.message || 'Không thể tách thửa đất.' });
        }

        setIsSplitMode(false);
        setActiveInteraction('SELECT');
    };

    const handleConfirmSplitMergeResult = () => {
        setSplitMergeResultModal({ isOpen: false, type: 'split', originalFeatures: [], newFeatures: [] });
    };

    const handleCancelSplitMode = () => {
        setIsSplitMode(false);
        setActiveInteraction('SELECT');
        splitConfigRef.current = null;
        featureToSplitRef.current = null;
    };

    const canSplit = !!selectedFeature && featuresList.length === 1 && !!selectedFeature.get('sodoto') && !!selectedFeature.get('sothua');
    const canMerge = featuresList.length >= 2 && featuresList.filter(f => f.isValid).length >= 2;

    return (
        <div className="flex h-full w-full bg-[#05070a] overflow-hidden font-sans text-white">
            <EditorToolbar
                activeInteraction={activeInteraction}
                setActiveInteraction={setActiveInteraction}
                isSnapping={isSnapping} setIsSnapping={setIsSnapping}
                showBasemap={showBasemap} setShowBasemap={setShowBasemap}
                showGrid={showGrid} setShowGrid={setShowGrid}
                onFitView={handleFitView}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={canUndo}
                canRedo={canRedo}
                onOpenSearch={() => setSearchModal({ ...searchModal, isOpen: true })}
                onOpenManual={() => setManualModal({ ...manualModal, isOpen: true })}
                onClearSelection={handleClearSelection}
                onClearAll={() => { editSource.current.clear(); handleClearSelection(); setVertices([]); updateFeatureListState(); clearDraft(); }}
                currentBasemap={currentBasemap}
                onChangeBasemap={handleChangeBasemap}
                onSplitFeature={handleSplitFeature}
                onMergeFeatures={handleMergeFeatures}
                canSplit={canSplit}
                canMerge={canMerge}
                drawShape={drawShape}
                setDrawShape={setDrawShape}
                measureType={measureType}
                setMeasureType={setMeasureType}
                measureValue={measureValue}
            />

            <EditorLayoutShell
                mapElementRef={mapElement}
                isSidebarVisible={isSidebarVisible}
                onToggleSidebar={() => setIsSidebarVisible((prev) => !prev)}
                sidebarProps={{
                    coordSystem,
                    setCoordSystem,
                    onExportTxt: handleExportCoordsTxt,
                    onAddVertex: handleAddVertex,
                    soTo,
                    setSoTo: handleSoToChange,
                    soThua,
                    setSoThua: handleSoThuaChange,
                    loaiDat,
                    setLoaiDat: handleLoaiDatChange,
                    spatialTables,
                    targetTable,
                    setTargetTable,
                    onSaveToDB: handleSaveToDB,
                    canSaveToDb,
                    loading,
                    vertices,
                    onUpdateVertex: handleUpdateVertex,
                    onDeleteVertex: handleDeleteVertex,
                    onFileUpload: handleFileUpload,
                    onExportGeoJSON: handleExportGeoJSON,
                    onExportShpZip: handleExportShpZip,
                    onExportDXF: handleExportDXF,
                    onOpenDxfImport: () => dxfInputRef.current?.click(),
                    onOpenParcelModal: () => setParcelModal({ ...parcelModal, isOpen: true }),
                    area,
                    hasSelected: !!selectedFeature,
                    featuresList,
                    selectedFeatureUid: selectedFeature ? getUid(selectedFeature) : null,
                    selectedFeatureUids,
                    onDeleteFeature: handleDeleteFeature,
                    onSelectFeature: handleSelectFeatureFromList,
                    onSaveFeature: handleSaveFeatureFromList,
                    onBatchSave: handleBatchSaveAll,
                    batchProgress: batchSaveProgress,
                    batchResult: batchSaveResult,
                    centralMeridian,
                    setCentralMeridian,
                    projectionZone,
                    setProjectionZone,
                    showVertexNumbers,
                    setShowVertexNumbers,
                    showSegmentLengths,
                    setShowSegmentLengths,
                    showParcelInfo,
                    setShowParcelInfo,
                    onTopologyCheck: handleTopologyCheck
                }}
            />

            <input
                ref={dxfInputRef}
                type="file"
                accept=".dxf"
                onChange={handleDxfImport}
                className="hidden"
            />

            <EditorModals
                searchModal={{
                    isOpen: searchModal.isOpen,
                    setOpen: (val) => setSearchModal({...searchModal, isOpen: val}),
                    coords: searchModal.coords,
                    setCoords: (coords) => setSearchModal({...searchModal, coords}),
                    onGoTo: handleGoToCoordinate
                }}
                manualModal={{
                    isOpen: manualModal.isOpen,
                    setOpen: (val) => setManualModal({...manualModal, isOpen: val}),
                    text: manualModal.text,
                    setText: (text) => setManualModal({...manualModal, text}),
                    onProcess: handleProcessManualInput
                }}
                dialog={{
                    ...dialog,
                    onClose: () => setDialog({...dialog, isOpen: false})
                }}
                splitModal={{
                    isOpen: splitModal.isOpen,
                    onClose: () => setSplitModal({ isOpen: false }),
                    originalFeature: selectedFeature ? {
                        sodoto: selectedFeature.get('sodoto') || '',
                        sothua: selectedFeature.get('sothua') || '',
                        area: getArea(selectedFeature.getGeometry() as any)
                    } : null,
                    onSplit: handleOpenSplitModal
                }}
                mergeModal={{
                    isOpen: mergeModal.isOpen,
                    onClose: () => setMergeModal({ isOpen: false, selectedFeatures: [] }),
                    selectedFeatures: mergeModal.selectedFeatures,
                    onMerge: executeMerge
                }}
                splitMergeResultModal={{
                    isOpen: splitMergeResultModal.isOpen,
                    type: splitMergeResultModal.type,
                    originalFeatures: splitMergeResultModal.originalFeatures,
                    newFeatures: splitMergeResultModal.newFeatures,
                    onClose: () => setSplitMergeResultModal({ isOpen: false, type: 'split', originalFeatures: [], newFeatures: [] }),
                    onConfirm: handleConfirmSplitMergeResult
                }}
            />

            <ParcelSearchDialog
                parcelModal={parcelModal}
                setParcelModal={(next) => setParcelModal(prev => ({ ...prev, ...next }))}
                spatialTables={spatialTables}
                loadingParcel={loadingParcel}
                onSearchParcel={handleSearchParcel}
                onClose={() => {
                    setParcelModal(prev => ({...prev, isOpen: false, soTo: '', soThua: '', searchTable: ''}));
                    setParcelList([]);
                }}
            />

            <ParcelResultDialog
                parcelModal={parcelModal}
                parcelList={parcelList}
                onSelectParcel={handleSelectParcel}
                onClose={() => {
                    setParcelModal({...parcelModal, isOpen: false, soTo: '', soThua: '', searchTable: ''});
                    setParcelList([]);
                }}
            />
        </div>
    );
};

export default EditorPage;

