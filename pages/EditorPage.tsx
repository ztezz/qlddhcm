
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { User, UserRole } from '../types';
import { gisService, adminService, DEFAULT_ROLE_PERMISSIONS, hasAnyPermission } from '../services/mockBackend';
import { parcelApi } from '../services/parcelApi';
import { getUid } from 'ol/util';
import proj4 from "proj4";
import { register } from 'ol/proj/proj4';

// Components
import EditorToolbar from '../components/editor/EditorToolbar';
import EditorSidebar from '../components/editor/EditorSidebar';
import EditorModals from '../components/editor/EditorModals';
import CADConverter from '../components/tools/CADConverter';

// Hooks
import { useEditorHistory } from '../hooks/useEditorHistory';
import { useEditorDraft } from '../hooks/useEditorDraft';

// Utils
import { validateGeometry } from '../utils/editorValidation';
import { getEditStyle, getSelectedStyle } from '../utils/editorStyles';

// OpenLayers
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer, Graticule } from 'ol/layer';
import { Vector as VectorSource, XYZ } from 'ol/source';
import * as proj from 'ol/proj';
import * as style from 'ol/style';
import { Polygon, Point, MultiPolygon } from 'ol/geom';
import GeoJSON from 'ol/format/GeoJSON';
import Feature from 'ol/Feature';
import { Draw, Modify, Snap, Select } from 'ol/interaction';
import { getArea } from 'ol/sphere';
import shpwrite from '@mapbox/shp-write';
import { isEmpty as isExtentEmpty } from 'ol/extent';
import { click } from 'ol/events/condition';

// Register VN-2000 (EPSG:9210 - Kinh tuyến trục 105.75 cho khu vực miền Nam)
proj4.defs("EPSG:9210", "+proj=tmerc +lat_0=0 +lon_0=105.75 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.904,-39.303,-111.450,0,0,0,0 +units=m +no_defs");
register(proj4);

const EditorPage: React.FC<{ user: User | null }> = ({ user }) => {
    const mapElement = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<Map | null>(null);
    const mapInitVersion = useRef(0);
    const editSource = useRef<VectorSource>(new VectorSource());
    const selectInteraction = useRef<Select | null>(null);
    const drawInteraction = useRef<Draw | null>(null);
    const modifyInteraction = useRef<Modify | null>(null);
    const snapInteraction = useRef<Snap | null>(null);
    
    // States
    const [activeInteraction, setActiveInteraction] = useState<'SELECT' | 'DRAW' | 'MODIFY'>('SELECT');
    const [isSnapping, setIsSnapping] = useState(true);
    const [showBasemap, setShowBasemap] = useState(false);
    const [showGrid, setShowGrid] = useState(true);
    const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
    const [featuresList, setFeaturesList] = useState<any[]>([]);
    
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
    const [showCADConverter, setShowCADConverter] = useState(false);
    const [currentBasemap, setCurrentBasemap] = useState('google-satellite');
    const [dialog, setDialog] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string; }>({ isOpen: false, type: 'info', title: '', message: '' });

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
        'bing-satellite': {
            name: 'Bing Satellite',
            url: 'https://ecn.t3.tiles.virtualearth.net/tiles/a{q}.jpeg?g=13'
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
            setSoTo(selectedFeature.get('sodoto') || '');
            setSoThua(selectedFeature.get('sothua') || '');
            setLoaiDat(selectedFeature.get('loaidat') || '');
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
            const feature = e.selected[0] || null;
            setSelectedFeature(feature);
        });
        selectInteraction.current = select;

        const draw = new Draw({ source: editSource.current, type: 'Polygon' });
        draw.setActive(activeInteraction === 'DRAW');
        draw.on('drawend', (e) => {
            setSelectedFeature(e.feature);
            updateVerticesFromFeature(e.feature);
            updateFeatureListState();
            setTimeout(() => setActiveInteraction('SELECT'), 50);
        });
        map.addInteraction(draw);
        drawInteraction.current = draw;

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
            const currentVn = proj.transform([vertices[index].x, vertices[index].y], 'EPSG:3857', 'EPSG:9210');
            const newVn = axis === 'x' ? [num, currentVn[1]] : [currentVn[0], num];
            const backToMap = proj.transform(newVn, 'EPSG:9210', 'EPSG:3857');
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
        vertices.forEach((v, i) => {
            let displayX, displayY;
            if (coordSystem === 'VN2000') {
                const p = proj.transform([v.x, v.y], 'EPSG:3857', 'EPSG:9210');
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
                const p = proj.transform([vFirst.x, vFirst.y], 'EPSG:3857', 'EPSG:9210');
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
            if (Math.abs(x) > 100000) center = proj.transform([x, y], 'EPSG:9210', 'EPSG:3857');
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
            }
        }
        if (drawInteraction.current) {
            drawInteraction.current.setActive(activeInteraction === 'DRAW');
        }
        if (modifyInteraction.current) {
            modifyInteraction.current.setActive(activeInteraction === 'MODIFY');
        }
        if (snapInteraction.current) {
            snapInteraction.current.setActive(isSnapping);
        }
    }, [activeInteraction, isSnapping, updateVerticesFromFeature, updateFeatureListState]);

    const handleProcessManualInput = (inputText: string) => {
        try {
            const lines = inputText.trim().split(/[\n;]+/);
            const coords = lines.map(line => {
                const parts = line.split(/[,\s\t]+/).filter(Boolean);
                if (parts.length < 2) return null;
                const x = parseFloat(parts[0]);
                const y = parseFloat(parts[1]);
                if (x > 300000 && x < 900000) return proj.transform([x, y], 'EPSG:9210', 'EPSG:3857');
                return proj.fromLonLat([x, y]);
            }).filter(Boolean) as [number, number][];
            
            if (coords.length < 3) throw new Error("Cần ít nhất 3 điểm.");
            if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) coords.push([...coords[0]] as [number, number]);
            
            const polygon = new Polygon([coords]);
            const feature = new Feature({ geometry: polygon });
            editSource.current.addFeature(feature);
            setSelectedFeature(feature);
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
                
                const guessedDataProj = detectProjection(content);
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
                    editSource.current.clear();
                    // Map attributes if available
                    features.forEach(f => {
                        const props = f.getProperties();
                        // Try to map common fields
                        if (props.sodoto) f.set('sodoto', props.sodoto);
                        if (props.sothua) f.set('sothua', props.sothua);
                        if (props.loaidat) f.set('loaidat', props.loaidat);
                    });

                    editSource.current.addFeatures(features);
                    
                    const lastFeature = features[features.length - 1];
                    setSelectedFeature(lastFeature);
                    updateVerticesFromFeature(lastFeature); 
                    updateFeatureListState();
                    
                    const extent = editSource.current.getExtent();
                    if (!isExtentEmpty(extent)) {
                        mapInstance.current?.getView().fit(extent, { padding: [100, 100, 100, 100], duration: 800 });
                    }
                    setDialog({ isOpen: true, type: 'success', title: 'Thành công', message: `Đã nạp ${features.length} đối tượng (Hệ tọa độ phát hiện: ${guessedDataProj === 'EPSG:9210' ? 'VN-2000' : 'WGS84'}).` });
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
                    dataProjection: 'EPSG:9210', 
                    featureProjection: 'EPSG:3857' 
                });
            }

            if (geometryObject && geometryObject.type === 'Polygon') {
                geometryObject = {
                    type: 'MultiPolygon',
                    coordinates: [geometryObject.coordinates]
                };
            }

            await parcelApi.create(targetTable, { 
                sodoto: fSoTo, 
                sothua: fSoThua, 
                loaidat: fLoaiDat || 'Chưa xác định',
                dientich: Math.round(fArea * 100) / 100,
                geometry: geometryObject 
            });

            setDialog({ isOpen: true, type: 'success', title: 'Đã lưu', message: `Thửa đất ${fSoThua}/${fSoTo} (${Math.round(fArea)}m2) đã được upload thành công.` });
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
                    const fSoTo = feature.get('sodoto');
                    const fSoThua = feature.get('sothua');
                    const fLoaiDat = feature.get('loaidat');
                    const fArea = getArea(feature.getGeometry() as any);
                    const geom = feature.getGeometry();

                    let geometryObject = format.writeGeometryObject(geom, { dataProjection: 'EPSG:9210', featureProjection: 'EPSG:3857' });
                    if (geometryObject.type === 'Polygon') {
                        geometryObject = { type: 'MultiPolygon', coordinates: [geometryObject.coordinates] };
                    }

                    await parcelApi.create(targetTable, {
                        sodoto: fSoTo,
                        sothua: fSoThua,
                        loaidat: fLoaiDat || 'Chưa xác định',
                        dientich: Math.round(fArea * 100) / 100,
                        geometry: geometryObject
                    });

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
        if (editSource.current.getFeatures().length === 0) return;
        const json = new GeoJSON().writeFeatures(editSource.current.getFeatures(), { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `GeoMaster_${Date.now()}.geojson`; a.click();
    };

    const handleExportShpZip = async () => {
        const features = editSource.current.getFeatures();
        if (features.length === 0) return;

        try {
            const geojson = new GeoJSON().writeFeaturesObject(features, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            }) as any;

            if (!Array.isArray(geojson.features) || geojson.features.length === 0) {
                setDialog({ isOpen: true, type: 'error', title: 'Lỗi export', message: 'Không có dữ liệu hợp lệ để xuất SHP.' });
                return;
            }

            const normalizedFeatures = geojson.features.map((f: any) => {
                const props = f?.properties || {};
                return {
                    ...f,
                    properties: {
                        sodoto: props.sodoto || '',
                        sothua: props.sothua || '',
                        loaidat: props.loaidat || '',
                        dientich: Number.isFinite(Number(props.dientich)) ? Number(props.dientich) : 0
                    }
                };
            });

            const zipped = await shpwrite.zip(
                { type: 'FeatureCollection', features: normalizedFeatures },
                { outputType: 'arraybuffer', compression: 'STORE' }
            );
            const blob = new Blob([zipped], { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `GeoMaster_${Date.now()}.zip`;
            a.click();
            URL.revokeObjectURL(url);
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
            let dxfContent = `  0
SECTION
  2
HEADER
  9
$ACADVER
  1
AC1021
  0
ENDSEC
  0
SECTION
  2
BLOCKS
  0
ENDSEC
  0
SECTION
  2
ENTITIES
`;

            let entityId = 0;
            features.forEach((f: any, idx: number) => {
                const geom = f.getGeometry();
                let coords = geom?.getCoordinates?.();
                const sodoto = f.get('sodoto') || '';
                const sothua = f.get('sothua') || '';

                if (coords && coords.length > 0) {
                    let ring = coords[0];

                    // Chuyển đổi tọa độ nếu cần
                    if (coordSystem === 'VN2000') {
                        ring = ring.map((c: any) => {
                            const transformed = proj.transform(c, 'EPSG:3857', 'EPSG:9210');
                            return transformed;
                        });
                    }

                    if (ring.length >= 3) {
                        // LWPOLYLINE
                        dxfContent += `  0
LWPOLYLINE
  5
${entityId.toString(16).toUpperCase()}
  8
Thua_${sothua || idx}
 70
1
 90
${ring.length}
`;
                        ring.forEach((c: any) => {
                            dxfContent += ` 10
${c[0]}
 20
${c[1]}
`;
                        });
                        entityId++;

                        // TEXT label
                        if (sodoto && sothua) {
                            const centroid = [
                                ring.reduce((sum: number, p: any) => sum + p[0], 0) / ring.length,
                                ring.reduce((sum: number, p: any) => sum + p[1], 0) / ring.length
                            ];
                            dxfContent += `  0
TEXT
  5
${entityId.toString(16).toUpperCase()}
  8
Labels
 10
${centroid[0]}
 20
${centroid[1]}
 40
10
  1
${sodoto}/${sothua}
`;
                            entityId++;
                        }
                    }
                }
            });

            dxfContent += `  0
ENDSEC
  0
EOF
`;

            const blob = new Blob([dxfContent], { type: 'application/dxf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `GeoMaster_${coordSystem}_${Date.now()}.dxf`;
            a.click();
            URL.revokeObjectURL(url);

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
            if (selectedFeature === feature) setSelectedFeature(null);
            updateFeatureListState();
        }
    };

    const handleSelectFeatureFromList = (uid: string) => {
        const feature = editSource.current.getFeatures().find(f => getUid(f) === uid);
        if (feature) {
            // Select logic
            selectInteraction.current?.getFeatures().clear();
            selectInteraction.current?.getFeatures().push(feature);
            setSelectedFeature(feature);
            
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
                onClearAll={() => { editSource.current.clear(); setSelectedFeature(null); setVertices([]); updateFeatureListState(); clearDraft(); }}
                currentBasemap={currentBasemap}
                onChangeBasemap={handleChangeBasemap}
            />

            <div className="flex-1 relative bg-[#05070a]">
                <div ref={mapElement} className="w-full h-full" />
            </div>

            <EditorSidebar 
                coordSystem={coordSystem} setCoordSystem={setCoordSystem}
                onExportTxt={handleExportCoordsTxt}
                onAddVertex={handleAddVertex}
                soTo={soTo} setSoTo={handleSoToChange}
                soThua={soThua} setSoThua={handleSoThuaChange}
                loaiDat={loaiDat} setLoaiDat={handleLoaiDatChange}
                spatialTables={spatialTables}
                targetTable={targetTable} setTargetTable={setTargetTable}
                onSaveToDB={handleSaveToDB}
                canSaveToDb={canSaveToDb}
                loading={loading}
                vertices={vertices}
                onUpdateVertex={handleUpdateVertex}
                onDeleteVertex={handleDeleteVertex}
                onFileUpload={handleFileUpload}
                onExportGeoJSON={handleExportGeoJSON}
                onExportShpZip={handleExportShpZip}
                onExportDXF={handleExportDXF}
                onOpenCADConverter={() => setShowCADConverter(true)}
                area={area}
                hasSelected={!!selectedFeature}
                
                // New props for List Management
                featuresList={featuresList}
                selectedFeatureUid={selectedFeature ? getUid(selectedFeature) : null}
                onDeleteFeature={handleDeleteFeature}
                onSelectFeature={handleSelectFeatureFromList}
                onSaveFeature={handleSaveFeatureFromList}
                
                // Batch save props
                onBatchSave={handleBatchSaveAll}
                batchProgress={batchSaveProgress}
                batchResult={batchSaveResult}
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
            />

            {showCADConverter && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-slate-700 sticky top-0 bg-slate-800">
                            <h2 className="text-lg font-bold text-white">Chuyển đổi DWG/DGN sang GeoJSON</h2>
                            <button
                                onClick={() => setShowCADConverter(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4">
                            <CADConverter compact={true} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditorPage;

