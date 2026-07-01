
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { User, UserRole } from '../types';
import { adminService } from '../services/apiClient';
import { parcelApi } from '../services/parcelApi';
import { getUid } from 'ol/util';
import { importDxfAsPolygonFeatures } from '../utils/dxfImport';
import { registerDynamicVn2000, Vn2000Zone } from '../utils/editorProjection';

// Icons
import { Search, X, RefreshCw } from 'lucide-react';

// Components
import EditorToolbar from '../components/editor/EditorToolbar';
import EditorSidebar from '../components/editor/EditorSidebar';
import EditorLayoutShell from '../components/editor/EditorLayoutShell';
import EditorModals from '../components/editor/EditorModals';
import { ParcelSearchDialog, ParcelResultDialog } from '../components/editor/ParcelLookupDialogs';
import { OcrCoordinateModal } from '../components/editor/OcrCoordinateModal';

// Hooks
import { useEditorHistory } from '../hooks/useEditorHistory';
import { useEditorDraft } from '../hooks/useEditorDraft';
import { useEditorSelection } from '../hooks/useEditorSelection';
import { useEditorBasemapLayers } from '../hooks/useEditorBasemapLayers';
import { useEditorPermissions } from '../hooks/useEditorPermissions';
import { useEditorParcelSearch } from '../hooks/useEditorParcelSearch';
import { useEditorSplitMerge } from '../hooks/useEditorSplitMerge';
import { useEditorMapInteractions } from '../hooks/useEditorMapInteractions';
import { useEditorMeasure } from '../hooks/useEditorMeasure';
import { useEditorMapSetup } from '../hooks/useEditorMapSetup';

// Utils
import { validateGeometry } from '../utils/editorValidation';
import { detectGeoJsonProjection, exportCoordsTxt, exportFeaturesDxf, exportFeaturesGeoJson, exportFeaturesShpZip, validateEditorGeometry } from '../utils/editorDataUtils';
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
import { Vector as VectorSource } from 'ol/source';
import * as proj from 'ol/proj';
import { Polygon, Point, MultiPolygon, LineString } from 'ol/geom';
import GeoJSON from 'ol/format/GeoJSON';
import Feature from 'ol/Feature';
import { Draw, Modify, Snap, Select, DragBox } from 'ol/interaction';
import { getArea } from 'ol/sphere';
import { isEmpty as isExtentEmpty } from 'ol/extent';

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
    
    // States
    const [activeInteraction, setActiveInteraction] = useState<'SELECT' | 'AREA_SELECT' | 'DRAW' | 'MODIFY'>('SELECT');
    const [isSnapping, setIsSnapping] = useState(true);
    const [showBasemap, setShowBasemap] = useState(false);
    const [showGrid, setShowGrid] = useState(true);

    // Advanced GIS features states
    const [centralMeridian, setCentralMeridian] = useState<number>(105.75);
    const [projectionZone, setProjectionZone] = useState<Vn2000Zone>('3');
    const [drawShape, setDrawShape] = useState<'Polygon' | 'Rectangle' | 'Circle'>('Polygon');
    const [showVertexNumbers, setShowVertexNumbers] = useState<boolean>(true);
    const [showSegmentLengths, setShowSegmentLengths] = useState<boolean>(false);
    const [showParcelInfo, setShowParcelInfo] = useState<boolean>(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    
    // Attributes and geometry state are managed by useEditorSelection.
    const [coordSystem, setCoordSystem] = useState<'WGS84' | 'VN2000'>('VN2000');
    
    // Data States
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
    const [ocrModalOpen, setOcrModalOpen] = useState(false);
    const dxfInputRef = useRef<HTMLInputElement | null>(null);
    const [dialog, setDialog] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string; }>({ isOpen: false, type: 'info', title: '', message: '' });
    const [isMapLoading, setIsMapLoading] = useState(false);
    const [branchPermissions, setBranchPermissions] = useState<any>(null);

    // Custom Hooks for Selection, History and Draft Management
    const {
        selectedFeature,
        setSelectedFeature,
        selectedFeatureUids,
        setSelectedFeatureUids,
        featuresList,
        soTo,
        setSoTo,
        soThua,
        setSoThua,
        loaiDat,
        setLoaiDat,
        vertices,
        setVertices,
        area,
        setArea,
        updateFeatureListState,
        updateVerticesFromFeature,
        updateSelectionState,
        handleClearSelection,
        handleSoToChange,
        handleSoThuaChange,
        handleLoaiDatChange
    } = useEditorSelection(editSource, selectInteraction);


    const {
        parcelModal,
        setParcelModal,
        loadingParcel,
        parcelList,
        setParcelList,
        wardList,
        loadingWards,
        handleSearchParcel,
        handleSelectParcel
    } = useEditorParcelSearch({
        editSource,
        mapInstance,
        selectInteraction,
        targetTable,
        setTargetTable,
        setDialog,
        setIsMapLoading,
        updateSelectionState,
        updateVerticesFromFeature,
        updateFeatureListState,
        setSoTo,
        setSoThua,
        setLoaiDat
    });

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
        splitModal,
        setSplitModal,
        mergeModal,
        setMergeModal,
        splitMergeResultModal,
        setSplitMergeResultModal,
        splitConfigRef,
        featureToSplitRef,
        isSplitMode,
        setIsSplitMode,
        handleSplitFeature,
        handleOpenSplitModal,
        handleMergeFeatures,
        executeMerge,
        executeSplit,
        handleConfirmSplitMergeResult,
        handleCancelSplitMode,
        canSplit,
        canMerge
    } = useEditorSplitMerge({
        editSource,
        selectInteraction,
        selectedFeature,
        selectedFeatureUids,
        featuresList,
        pushHistorySnapshot,
        updateVerticesFromFeature,
        updateFeatureListState,
        setSelectedFeature,
        setDialog,
        setActiveInteraction
    });


    const {
        measureSource,
        measureDrawInteraction,
        measureType,
        setMeasureType,
        measureValue
    } = useEditorMeasure(mapInstance, setActiveInteraction);


    useEditorMapInteractions({
        mapInstance,
        editSource,
        selectInteraction,
        drawInteraction,
        drawLineInteraction,
        dragBoxInteraction,
        modifyInteraction,
        snapInteraction,
        splitConfigRef,
        featureToSplitRef,
        activeInteraction,
        setActiveInteraction,
        isSnapping,
        isSplitMode,
        setIsSplitMode,
        drawShape,
        showVertexNumbers,
        showSegmentLengths,
        showParcelInfo,
        setSelectedFeature,
        setSelectedFeatureUids,
        updateSelectionState,
        updateVerticesFromFeature,
        updateFeatureListState,
        executeSplit
    });

    const {
        DRAFT_KEY,
        autoSaveTimerRef,
        saveDraft,
        clearDraft,
        loadDraft,
        startAutoSave,
        stopAutoSave
    } = useEditorDraft(editSource, mapInstance, updateFeatureListState);

    const {
        currentPermissions,
        canSaveToDb
    } = useEditorPermissions(user, rolePermissions, branchPermissions, targetTable, permissionLoading);

    const {
        baseLayerRef,
        gridLayerRef,
        currentBasemap,
        handleChangeBasemap
    } = useEditorBasemapLayers(showBasemap, showGrid);

    const { initMap, cleanupMap } = useEditorMapSetup({
        mapElement,
        mapInstance,
        mapInitVersion,
        editSource,
        measureSource,
        baseLayerRef,
        gridLayerRef,
        selectInteraction,
        drawInteraction,
        drawLineInteraction,
        dragBoxInteraction,
        modifyInteraction,
        snapInteraction,
        splitConfigRef,
        featureToSplitRef,
        activeInteraction,
        isSnapping,
        setActiveInteraction,
        setIsSplitMode,
        setSelectedFeature,
        setSelectedFeatureUids,
        setSpatialTables,
        setTargetTable,
        updateSelectionState,
        updateVerticesFromFeature,
        updateFeatureListState,
        pushHistorySnapshot,
        executeSplit
    });



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
        exportCoordsTxt(vertices, coordSystem, centralMeridian, projectionZone);
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
                const [data, settings] = await Promise.all([
                    adminService.getRolePermissions(),
                    adminService.getSettings().catch(() => [])
                ]);
                setRolePermissions(Array.isArray(data) ? data : []);
                const item = settings.find(s => s.key === 'branch_spatial_permissions');
                if (item && item.value) {
                    try {
                        setBranchPermissions(JSON.parse(item.value));
                    } catch {
                        setBranchPermissions(null);
                    }
                }
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

    useEffect(() => {
        initMap();
        return cleanupMap;
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

    const handleDrawOcrShape = (coords: [number, number][]) => {
        try {
            if (coords.length < 3) throw new Error("Cần ít nhất 3 điểm.");
            const polygon = new Polygon([coords]);
            const feature = new Feature({ geometry: polygon });
            
            editSource.current.addFeature(feature);
            selectInteraction.current?.getFeatures().clear();
            selectInteraction.current?.getFeatures().push(feature);
            updateSelectionState(feature);
            updateVerticesFromFeature(feature);
            updateFeatureListState();
            mapInstance.current?.getView().fit(polygon.getExtent(), { padding: [100, 100, 100, 100], duration: 800 });
            
            setDialog({
                isOpen: true,
                type: 'success',
                title: 'Dựng hình thành công',
                message: `Đã dựng xong thửa đất với ${coords.length - 1} đỉnh từ kết quả quét OCR.`
            });
        } catch (e: any) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: e.message });
        }
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
        setIsMapLoading(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = (event.target?.result as string).trim();
                if (!text) throw new Error("File rỗng");
                
                const content = JSON.parse(text);
                const format = new GeoJSON();
                
                const guessed = detectGeoJsonProjection(content);
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
                setIsMapLoading(false);
                e.target.value = ''; 
            }
        };
        reader.onerror = () => {
            setIsMapLoading(false);
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi đọc file', message: 'Không thể đọc file dữ liệu.' });
        };
        reader.readAsText(file);
    };

    const handleDxfImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsMapLoading(true);
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
                setIsMapLoading(false);
                e.target.value = '';
            }
        };
        reader.onerror = () => {
            setIsMapLoading(false);
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi đọc file', message: 'Không thể đọc file DXF.' });
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

        const validationError = validateEditorGeometry(geom);
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

        const invalidGeoms = features.filter(f => validateEditorGeometry(f.getGeometry()));
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
        exportFeaturesGeoJson(editSource.current.getFeatures());
    };

    const handleExportShpZip = async () => {
        try {
            await exportFeaturesShpZip(editSource.current.getFeatures());
        } catch (e: any) {
            setDialog({ isOpen: true, type: 'error', title: 'L?i export', message: e?.message || 'Kh?ng th? xu?t SHP v?o l?c n?y.' });
        }
    };

    const handleExportDXF = () => {
        try {
            const exported = exportFeaturesDxf(editSource.current.getFeatures(), coordSystem);
            if (!exported) {
                setDialog({ isOpen: true, type: 'error', title: 'L?i export', message: 'Kh?ng c? d? li?u ?? xu?t DXF.' });
                return;
            }
            setDialog({ isOpen: true, type: 'success', title: 'Xu?t th?nh c?ng', message: `File DXF (${coordSystem}) ?? ???c t?i xu?ng. M? b?ng AutoCAD ho?c MicroStation.` });
        } catch (e: any) {
            setDialog({ isOpen: true, type: 'error', title: 'L?i export', message: e?.message || 'Kh?ng th? xu?t DXF v?o l?c n?y.' });
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

    const handleSelectFeatureFromList = (uid: string, isMultiSelect?: boolean) => {
        const feature = editSource.current.getFeatures().find(f => getUid(f) === uid);
        if (feature) {
            const selectedFeatures = selectInteraction.current?.getFeatures();
            if (selectedFeatures) {
                if (isMultiSelect) {
                    if (selectedFeatures.getArray().includes(feature)) {
                        selectedFeatures.remove(feature);
                    } else {
                        selectedFeatures.push(feature);
                    }
                } else {
                    selectedFeatures.clear();
                    selectedFeatures.push(feature);
                }
                const array = selectedFeatures.getArray();
                const primary = array.includes(feature) ? feature : (array[0] || null);
                updateSelectionState(primary);

                // Zoom to primary feature if we just selected it single-select
                if (primary && !isMultiSelect) {
                    const extent = primary.getGeometry()?.getExtent();
                    if (extent) {
                        mapInstance.current?.getView().fit(extent, { padding: [100, 100, 100, 100], duration: 500 });
                    }
                }
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
                onOpenOcr={() => setOcrModalOpen(true)}
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
                isMapLoading={isMapLoading}
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

            <OcrCoordinateModal
                isOpen={ocrModalOpen}
                onClose={() => setOcrModalOpen(false)}
                centralMeridian={centralMeridian}
                projectionZone={projectionZone}
                onDrawShape={handleDrawOcrShape}
            />
        </div>
    );
};

export default EditorPage;

