
import React, { useState, useEffect, useRef } from 'react';
import { adminService } from '../../services/mockBackend';
import { parcelApi } from '../../services/parcelApi';
import { WMSLayerConfig, BasemapConfig } from '../../types';
import { Layers, Database, Plus, Edit2, Trash2, X, Eye, EyeOff, Save, Table, Link2Off, RefreshCw, Map as MapIcon, CheckCircle2, Globe, AlertCircle, Check, ShieldAlert, Lock, Tags, Info, Sun, DatabaseZap, Search, Shield, Wrench, GripVertical } from 'lucide-react';
import { getLayerScope, MapScope } from '../../utils/layerScope';

interface LayerManagerProps {
    dbStatus: any;
}

const LayerManager: React.FC<LayerManagerProps> = ({ dbStatus }) => {
    const TIFF_MARKER = '#TIFF';
    const ACTIVE_TAB_STORAGE_KEY = 'admin.layerManager.activeTab';

    const parseIsTiffLayer = (description: string): boolean => {
        const text = (description || '').toLowerCase();
        return text.includes('#tiff') || text.includes('[tiff]') || text.includes('raster:tiff') || text.includes('layer:tiff') || text.includes('format:tiff');
    };

    const applyTiffMarkerToDescription = (description: string, isTiff: boolean): string => {
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

    const stripScopeMarker = (description: string): string => {
        return (description || '')
            .replace(/\[map:(main|admin|shared|all)\]/gi, '')
            .replace(/#map-(main|admin|shared)/gi, '')
            .replace(/scope:(main|admin|shared)/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    };

    const applyScopeMarkerToDescription = (description: string, mapScope: MapScope): string => {
        const cleaned = stripScopeMarker(description);
        const marker = mapScope === 'SHARED' ? '[map:shared]' : mapScope === 'ADMIN' ? '[map:admin]' : '[map:main]';
        return cleaned ? `${cleaned} ${marker}` : marker;
    };

    const getScopeMeta = (scope: MapScope) => {
        if (scope === 'ADMIN') return { label: 'Map hành chính', badge: 'bg-indigo-900/40 text-indigo-300 border-indigo-700/60' };
        if (scope === 'SHARED') return { label: 'Dùng chung', badge: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/60' };
        return { label: 'Map chính', badge: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/60' };
    };

    const [wmsLayers, setWmsLayers] = useState<WMSLayerConfig[]>([]);
    const [basemaps, setBasemaps] = useState<BasemapConfig[]>([]);
    const [spatialTables, setSpatialTables] = useState<any[]>([]);
    const [globalQuery, setGlobalQuery] = useState('');
    const [layerFilter, setLayerFilter] = useState<'ALL' | 'VISIBLE' | 'HIDDEN' | 'PLANNING' | 'STANDARD' | 'ADMINISTRATIVE'>('ALL');
    const [activeTab, setActiveTab] = useState<'TABLES' | 'LAYERS' | 'BASEMAPS'>('LAYERS');
    const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
    const [draggingBasemapId, setDraggingBasemapId] = useState<string | null>(null);
    const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
    const [dragOverBasemapId, setDragOverBasemapId] = useState<string | null>(null);
    const [layerSaveState, setLayerSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [basemapSaveState, setBasemapSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const layerSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const basemapSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const layerSavedHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const basemapSavedHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSyncedLayersRef = useRef<WMSLayerConfig[]>([]);
    const lastSyncedBasemapsRef = useRef<BasemapConfig[]>([]);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'LAYER' | 'TABLE' | 'BASEMAP' | null>(null);
    const [formData, setFormData] = useState<any>({});
    const [isEditMode, setIsEditMode] = useState(false);

    // Custom Confirmation Dialog State
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        actionType: 'UNLINK' | 'DROP_TABLE' | 'DELETE_WMS' | 'DELETE_BASEMAP' | 'SYNC' | 'REPAIR';
        targetId: string;
        targetName: string;
        isDangerous?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        actionType: 'UNLINK',
        targetId: '',
        targetName: ''
    });

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        try {
            const savedTab = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
            if (savedTab === 'TABLES' || savedTab === 'LAYERS' || savedTab === 'BASEMAPS') {
                setActiveTab(savedTab);
            }
        } catch (_) {
            // Ignore localStorage errors (private mode / blocked storage).
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
        } catch (_) {
            // Ignore localStorage errors (private mode / blocked storage).
        }
    }, [activeTab]);

    useEffect(() => {
        return () => {
            if (layerSaveTimerRef.current) clearTimeout(layerSaveTimerRef.current);
            if (basemapSaveTimerRef.current) clearTimeout(basemapSaveTimerRef.current);
            if (layerSavedHintTimerRef.current) clearTimeout(layerSavedHintTimerRef.current);
            if (basemapSavedHintTimerRef.current) clearTimeout(basemapSavedHintTimerRef.current);
        };
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [layers, tables, maps] = await Promise.all([
                adminService.getWmsLayers().catch(() => []),
                parcelApi.manageTables.getAll().catch(() => []),
                adminService.getBasemaps().catch(() => [])
            ]);
            setWmsLayers(layers || []);
            setSpatialTables(tables || []);
            setBasemaps(maps || []);
            lastSyncedLayersRef.current = layers || [];
            lastSyncedBasemapsRef.current = maps || [];
        } catch (e: any) {
            setError("Không thể tải toàn bộ dữ liệu cấu hình.");
        } finally { setLoading(false); }
    };

    const reindexSortOrder = <T extends { sortOrder?: number }>(items: T[]): T[] => {
        return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
    };

    const reorderById = <T extends { id: string }>(items: T[], fromId: string, toId: string): T[] => {
        const fromIndex = items.findIndex((item) => item.id === fromId);
        const toIndex = items.findIndex((item) => item.id === toId);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
        const next = [...items];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
    };

    const openModal = (type: 'LAYER' | 'TABLE' | 'BASEMAP', item?: any) => {
        setModalType(type);
        setIsEditMode(!!item);
        
        if (type === 'LAYER') {
            setFormData(item 
                ? { ...item, type: item.type || 'WMS', category: item.category || 'STANDARD', opacity: item.opacity ?? 1, description: stripScopeMarker(item.description || ''), sortOrder: item.sortOrder ?? 0, isTiff: parseIsTiffLayer(item.description || ''), mapScope: item.mapScope || getLayerScope(item) } 
                : { name: '', url: '', layers: '', visible: true, opacity: 1, type: 'WMS', category: 'STANDARD', description: '', sortOrder: 0, isTiff: false, mapScope: 'MAIN' }
            );
        } else if (type === 'TABLE') {
            if (item) {
                setFormData({
                    tableName: item.table_name,
                    originalName: item.table_name, 
                    displayName: item.display_name || item.table_name,
                    description: item.description || '',
                    renamePhysical: false // Mặc định không đổi tên vật lý khi sửa Registry
                });
            } else {
                setFormData({
                    tableName: '',
                    displayName: '',
                    description: '',
                    isExisting: false
                });
            }
        } else if (type === 'BASEMAP') {
            setFormData(item ? { ...item, description: item.description || '', sortOrder: item.sortOrder ?? 0 } : { name: '', url: '', type: 'XYZ', isDefault: false, visible: true, useProxy: false, description: '', sortOrder: 0 });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            let finalData = { ...formData };

            if (modalType === 'LAYER') {
                if (finalData.type === 'XYZ' && finalData.url) {
                    finalData.url = finalData.url.replace(/\${z}/g, '{z}').replace(/\${x}/g, '{x}').replace(/\${y}/g, '{y}');
                    if (!finalData.layers) finalData.layers = 'planning_tiles';
                }

                finalData.sortOrder = Number.isFinite(Number(finalData.sortOrder)) ? Number(finalData.sortOrder) : 0;
                finalData.mapScope = (finalData.mapScope || 'MAIN') as MapScope;
                finalData.description = applyScopeMarkerToDescription(
                    applyTiffMarkerToDescription((finalData.description || '').trim(), !!finalData.isTiff),
                    finalData.mapScope
                );
                delete finalData.isTiff;

                if (!finalData.name || !finalData.url) {
                    throw new Error("Vui lòng nhập Tên và URL cho lớp bản đồ.");
                }

                isEditMode ? await adminService.updateWmsLayer(finalData) : await adminService.addWmsLayer(finalData);
            } else if (modalType === 'BASEMAP') {
                finalData.sortOrder = Number.isFinite(Number(finalData.sortOrder)) ? Number(finalData.sortOrder) : 0;
                finalData.description = (finalData.description || '').trim();
                isEditMode ? await adminService.updateBasemap(finalData) : await adminService.addBasemap(finalData);
            } else if (modalType === 'TABLE') {
                if (!finalData.tableName || !finalData.displayName) {
                    throw new Error("Vui lòng nhập đầy đủ Tên bảng vật lý và Tên hiển thị.");
                }
                if (isEditMode) {
                    await parcelApi.manageTables.rename(finalData.originalName, finalData.tableName, finalData.displayName, finalData.description, finalData.renamePhysical);
                } else {
                    if (finalData.isExisting) {
                        await parcelApi.manageTables.link(finalData.tableName, finalData.displayName, finalData.description);
                    } else {
                        await parcelApi.manageTables.create(finalData.tableName, finalData.displayName, finalData.description);
                    }
                }
            }
            setIsModalOpen(false);
            await loadData();
        } catch (e: any) { 
            setError(e.message);
        } finally { setLoading(false); }
    };

    const toggleWmsVisibility = async (layer: WMSLayerConfig) => {
        try {
            setLoading(true);
            await adminService.updateWmsLayer({ ...layer, visible: !layer.visible });
            await loadData();
        } catch (e: any) {
            setError(e.message);
        } finally { setLoading(false); }
    };

    const triggerConfirm = (type: typeof confirmDialog['actionType'], id: string, name: string) => {
        let title = '';
        let message = '';
        let isDangerous = false;

        switch(type) {
            case 'UNLINK':
                title = 'Hủy liên kết Registry';
                message = `Bạn có chắc chắn muốn hủy liên kết bảng "${name}"? Thao tác này chỉ xóa thông tin quản lý trong phần mềm, dữ liệu trong Database của bạn vẫn được giữ nguyên.`;
                break;
            case 'DROP_TABLE':
                title = 'XÓA VĨNH VIỄN BẢNG';
                message = `CẢNH BÁO NGUY HIỂM: Bạn đang yêu cầu xóa vĩnh viễn bảng "${name}" khỏi Database. Hành động này sẽ XÓA TOÀN BỘ DỮ LIỆU và không thể khôi phục.`;
                isDangerous = true;
                break;
            case 'DELETE_WMS':
                title = 'Xóa lớp chuyên đề';
                message = `Xóa cấu hình lớp bản đồ chuyên đề "${name}"?`;
                break;
            case 'DELETE_BASEMAP':
                title = 'Xóa bản đồ nền';
                message = `Xóa cấu hình bản đồ nền "${name}"?`;
                break;
            case 'SYNC':
                title = 'Đồng bộ cấu trúc';
                message = `Làm mới thông tin các cột (To, Thua, LoaiDat...) và SRID cho bảng "${name}" từ Database?`;
                break;
            case 'REPAIR':
                title = 'Sửa lỗi cấu trúc (Repair)';
                message = `Bạn có chắc chắn muốn sửa lỗi cấu trúc cho bảng "${name}"? Thao tác này sẽ tự động thêm các cột còn thiếu (như image_url) vào bảng trong Database.`;
                isDangerous = true;
                break;
        }

        setConfirmDialog({
            isOpen: true,
            title,
            message,
            actionType: type,
            targetId: id,
            targetName: name,
            isDangerous
        });
    };

    const executeAction = async () => {
        const { actionType, targetId } = confirmDialog;
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setLoading(true);

        try {
            switch(actionType) {
                case 'UNLINK': await parcelApi.manageTables.unlink(targetId); break;
                case 'DROP_TABLE': await parcelApi.manageTables.delete(targetId); break;
                case 'DELETE_WMS': await adminService.deleteWmsLayer(targetId); break;
                case 'DELETE_BASEMAP': await adminService.deleteBasemap(targetId); break;
                case 'SYNC': await parcelApi.manageTables.syncTable(targetId); break;
                case 'REPAIR': await parcelApi.manageTables.repairTable(targetId); break;
            }
            await loadData();
        } catch (e: any) {
            setError("Lỗi thực thi: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const persistLayerOrder = async (orderedItems: WMSLayerConfig[]) => {
        const payload = orderedItems.map((l, idx) => ({ id: l.id, sortOrder: Number.isFinite(Number(l.sortOrder)) ? Number(l.sortOrder) : idx + 1 }));
        await adminService.reorderWmsLayers(payload);
    };

    const persistBasemapOrder = async (orderedItems: BasemapConfig[]) => {
        const payload = orderedItems.map((bm, idx) => ({ id: bm.id, sortOrder: Number.isFinite(Number(bm.sortOrder)) ? Number(bm.sortOrder) : idx + 1 }));
        await adminService.reorderBasemaps(payload);
    };

    const scheduleLayerAutoSave = (orderedItems: WMSLayerConfig[]) => {
        if (layerSaveTimerRef.current) clearTimeout(layerSaveTimerRef.current);
        if (layerSavedHintTimerRef.current) clearTimeout(layerSavedHintTimerRef.current);
        setLayerSaveState('saving');
        layerSaveTimerRef.current = setTimeout(async () => {
            try {
                await persistLayerOrder(orderedItems);
                lastSyncedLayersRef.current = orderedItems;
                setLayerSaveState('saved');
                layerSavedHintTimerRef.current = setTimeout(() => setLayerSaveState('idle'), 1800);
            } catch (e: any) {
                setWmsLayers(lastSyncedLayersRef.current);
                setLayerSaveState('error');
                setError(e.message || 'Không thể lưu thứ tự lớp bản đồ.');
            }
        }, 450);
    };

    const scheduleBasemapAutoSave = (orderedItems: BasemapConfig[]) => {
        if (basemapSaveTimerRef.current) clearTimeout(basemapSaveTimerRef.current);
        if (basemapSavedHintTimerRef.current) clearTimeout(basemapSavedHintTimerRef.current);
        setBasemapSaveState('saving');
        basemapSaveTimerRef.current = setTimeout(async () => {
            try {
                await persistBasemapOrder(orderedItems);
                lastSyncedBasemapsRef.current = orderedItems;
                setBasemapSaveState('saved');
                basemapSavedHintTimerRef.current = setTimeout(() => setBasemapSaveState('idle'), 1800);
            } catch (e: any) {
                setBasemaps(lastSyncedBasemapsRef.current);
                setBasemapSaveState('error');
                setError(e.message || 'Không thể lưu thứ tự bản đồ nền.');
            }
        }, 450);
    };

    const handleLayerDrop = (targetId: string) => {
        if (!draggingLayerId || draggingLayerId === targetId || loading) return;
        const next = reindexSortOrder(reorderById(wmsLayers, draggingLayerId, targetId));
        setWmsLayers(next);
        setDraggingLayerId(null);
        setDragOverLayerId(null);
        scheduleLayerAutoSave(next);
    };

    const handleBasemapDrop = (targetId: string) => {
        if (!draggingBasemapId || draggingBasemapId === targetId || loading) return;
        const next = reindexSortOrder(reorderById(basemaps, draggingBasemapId, targetId));
        setBasemaps(next);
        setDraggingBasemapId(null);
        setDragOverBasemapId(null);
        scheduleBasemapAutoSave(next);
    };

    const normalizedQuery = globalQuery.trim().toLowerCase();
    const canReorderLayers = !loading;
    const canReorderBasemaps = !loading;
    const filteredSpatialTables = spatialTables.filter((t) => {
        if (!normalizedQuery) return true;
        return [t.table_name, t.display_name, t.description].some((v) => (v || '').toLowerCase().includes(normalizedQuery));
    });

    const filteredWmsLayers = wmsLayers.filter((l) => {
        const matchQuery = !normalizedQuery || [l.name, l.layers, l.description, l.url].some((v) => (v || '').toLowerCase().includes(normalizedQuery));
        if (!matchQuery) return false;
        if (layerFilter === 'VISIBLE') return !!l.visible;
        if (layerFilter === 'HIDDEN') return !l.visible;
        if (layerFilter === 'PLANNING') return l.category === 'PLANNING';
        if (layerFilter === 'STANDARD') return (l.category || 'STANDARD') === 'STANDARD';
        if (layerFilter === 'ADMINISTRATIVE') return l.category === 'ADMINISTRATIVE';
        return true;
    });

    const filteredBasemaps = basemaps.filter((bm) => {
        if (!normalizedQuery) return true;
        return [bm.name, bm.type, bm.description, bm.url].some((v) => (v || '').toLowerCase().includes(normalizedQuery));
    });

    const stats = {
        totalLayers: wmsLayers.length,
        visibleLayers: wmsLayers.filter((l) => l.visible).length,
        planningLayers: wmsLayers.filter((l) => l.category === 'PLANNING').length,
        administrativeLayers: wmsLayers.filter((l) => l.category === 'ADMINISTRATIVE').length,
        totalTables: spatialTables.length,
        totalBasemaps: basemaps.length
    };

    const searchPlaceholder = activeTab === 'TABLES'
        ? 'Tìm theo tên bảng, tên hiển thị, mô tả...'
        : activeTab === 'LAYERS'
            ? 'Tìm theo tên lớp, layer, mô tả, URL...'
            : 'Tìm theo tên bản đồ nền, mô tả, URL...';

    return (
        <div className="p-8 space-y-10 pb-24 max-w-7xl mx-auto font-sans">
            {error && (
                <div className="bg-red-900/20 border border-red-800 text-red-400 p-4 rounded-lg flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <AlertCircle size={20} />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                    <button onClick={() => setError(null)} className="hover:text-white transition-colors"><X size={16}/></button>
                </div>
            )}

            {/* 1. DATABASE STATUS */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-white uppercase tracking-tighter">
                        <Database className="text-blue-400" /> Kết nối Database PostGIS
                    </h3>
                    <button onClick={loadData} disabled={loading} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors disabled:opacity-50 font-black uppercase tracking-widest">
                        <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Làm mới dữ liệu
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono text-gray-300 bg-gray-900 p-4 rounded border border-gray-700 shadow-inner">
                    <p><span className="text-gray-500">Trạng thái:</span> <span className="text-green-400 font-bold">ĐANG KẾT NỐI</span></p>
                    <p><span className="text-gray-500">Database:</span> <span className="text-blue-400">{dbStatus.dbName || 'dulieu_geogis'}</span></p>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Lớp dữ liệu</p>
                    <p className="text-2xl font-black text-cyan-400 mt-1">{stats.totalLayers}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Đang hiển thị</p>
                    <p className="text-2xl font-black text-emerald-400 mt-1">{stats.visibleLayers}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Lớp quy hoạch</p>
                    <p className="text-2xl font-black text-purple-400 mt-1">{stats.planningLayers}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Lớp hành chính</p>
                    <p className="text-2xl font-black text-indigo-400 mt-1">{stats.administrativeLayers}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Bảng registry</p>
                    <p className="text-2xl font-black text-green-400 mt-1">{stats.totalTables}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Bản đồ nền</p>
                    <p className="text-2xl font-black text-orange-400 mt-1">{stats.totalBasemaps}</p>
                </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        value={globalQuery}
                        onChange={(e) => setGlobalQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
                    />
                </div>
                <div className="bg-gray-900 p-1 rounded-xl flex gap-1">
                    <button onClick={() => setActiveTab('TABLES')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase ${activeTab === 'TABLES' ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Bảng dữ liệu</button>
                    <button onClick={() => setActiveTab('LAYERS')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase ${activeTab === 'LAYERS' ? 'bg-cyan-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Lớp</button>
                    <button onClick={() => setActiveTab('BASEMAPS')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase ${activeTab === 'BASEMAPS' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Base map</button>
                </div>
            </div>

            {activeTab === 'LAYERS' && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap gap-2">
                    <button onClick={() => setLayerFilter('ALL')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase ${layerFilter === 'ALL' ? 'bg-cyan-600 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>Tất cả</button>
                    <button onClick={() => setLayerFilter('VISIBLE')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase ${layerFilter === 'VISIBLE' ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>Đang hiện</button>
                    <button onClick={() => setLayerFilter('HIDDEN')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase ${layerFilter === 'HIDDEN' ? 'bg-slate-600 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>Đang ẩn</button>
                    <button onClick={() => setLayerFilter('PLANNING')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase ${layerFilter === 'PLANNING' ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>Quy hoạch</button>
                    <button onClick={() => setLayerFilter('ADMINISTRATIVE')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase ${layerFilter === 'ADMINISTRATIVE' ? 'bg-indigo-600 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>Hành chính</button>
                </div>
            )}

            {/* 2. SPATIAL TABLES REGISTRY */}
            {activeTab === 'TABLES' && <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
                <div className="p-4 flex justify-between border-b border-gray-700 bg-gray-800/50">
                    <span className="font-semibold text-gray-100 flex items-center gap-2">
                        <Table size={18} className="text-green-400"/> Quản lý Bảng Dữ liệu (Registry)
                    </span>
                    <button onClick={() => openModal('TABLE')} className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-1 transition-all">
                        <Plus size={16}/> Thêm / Liên kết
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-900 text-gray-400 uppercase text-[10px] tracking-widest font-black">
                            <tr><th className="p-4 w-1/4">Tên bảng (DB)</th><th className="p-4 w-1/4">Tên hiển thị</th><th className="p-4 w-1/3">Mô tả</th><th className="p-4 text-right">Quản trị</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700 text-gray-300">
                            {filteredSpatialTables.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-gray-600 italic">Không có bảng nào khớp bộ lọc tìm kiếm</td></tr>
                            ) : filteredSpatialTables.map(t => (
                                <tr key={t.table_name} className="hover:bg-gray-700/30 transition-colors">
                                    <td className="p-4 font-mono text-blue-300 text-xs">{t.table_name}</td>
                                    <td className="p-4 font-medium text-white">{t.display_name || t.table_name}</td>
                                    <td className="p-4 text-xs text-gray-500 truncate max-w-[200px]">{t.description || '--'}</td>
                                    <td className="p-4 flex justify-end gap-1">
                                        <button onClick={() => triggerConfirm('SYNC', t.table_name, t.display_name || t.table_name)} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded" title="Đồng bộ cấu trúc"><DatabaseZap size={16}/></button>
                                        <button onClick={() => triggerConfirm('REPAIR', t.table_name, t.display_name || t.table_name)} className="p-2 text-orange-400 hover:bg-orange-400/10 rounded" title="Sửa lỗi cấu trúc (Thêm cột image_url)"><Wrench size={16}/></button>
                                        <button onClick={() => openModal('TABLE', t)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded" title="Sửa thông số"><Edit2 size={16}/></button>
                                        <button onClick={() => triggerConfirm('UNLINK', t.table_name, t.display_name || t.table_name)} className="p-2 text-orange-400 hover:bg-orange-400/10 rounded" title="Hủy liên kết"><Link2Off size={16}/></button>
                                        <button onClick={() => triggerConfirm('DROP_TABLE', t.table_name, t.table_name)} className="p-2 text-red-500 hover:bg-red-500/10 rounded" title="Xóa vĩnh viễn"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>}

            {/* 3. WMS LAYERS SECTION */}
            {activeTab === 'LAYERS' && <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
                <div className="p-4 flex justify-between border-b border-gray-700 bg-gray-800/50">
                    <div>
                        <span className="font-semibold text-gray-100 flex items-center gap-2">
                            <Globe size={18} className="text-cyan-400"/> Lớp bản đồ & Quy hoạch (WMS/XYZ)
                        </span>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Kéo-thả sẽ tự lưu thứ tự ngay sau khi thả</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {layerSaveState === 'saving' && <span className="text-[10px] uppercase font-black tracking-wider text-amber-400">Đang tự lưu...</span>}
                        {layerSaveState === 'saved' && <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400">Đã lưu thứ tự</span>}
                        {layerSaveState === 'error' && <span className="text-[10px] uppercase font-black tracking-wider text-red-400">Lưu thất bại</span>}
                        <button onClick={() => openModal('LAYER')} className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-1 transition-all shadow-lg shadow-cyan-950/20">
                            <Plus size={16}/> Thêm Lớp Dữ liệu
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-900 text-gray-400 uppercase text-[10px] tracking-widest font-black">
                            <tr><th className="p-4">Kéo</th><th className="p-4">Thứ tự</th><th className="p-4">Tên hiển thị</th><th className="p-4">Loại</th><th className="p-4">Scope</th><th className="p-4">Mô tả</th><th className="p-4">Độ mờ</th><th className="p-4">Trạng thái</th><th className="p-4 text-right">Thao tác</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700 text-gray-300">
                            {filteredWmsLayers.length === 0 ? (
                                <tr><td colSpan={9} className="p-10 text-center text-gray-600 italic">Không có lớp dữ liệu nào khớp điều kiện lọc</td></tr>
                            ) : filteredWmsLayers.map(l => {
                                const scopeMeta = getScopeMeta((l.mapScope || getLayerScope(l)) as MapScope);
                                return (
                                <tr
                                    key={l.id}
                                    draggable={canReorderLayers}
                                    onDragStart={() => setDraggingLayerId(l.id)}
                                    onDragOver={(e) => { if (canReorderLayers) { e.preventDefault(); setDragOverLayerId(l.id); } }}
                                    onDrop={() => handleLayerDrop(l.id)}
                                    onDragEnd={() => { setDraggingLayerId(null); setDragOverLayerId(null); }}
                                    className={`hover:bg-gray-700/30 transition-colors ${canReorderLayers ? 'cursor-move' : ''} ${draggingLayerId === l.id ? 'opacity-40' : ''} ${dragOverLayerId === l.id ? 'bg-cyan-900/20' : ''}`}
                                >
                                    <td className="p-4 text-gray-500">
                                        <GripVertical size={14} />
                                    </td>
                                    <td className="p-4">
                                        <span className="font-mono text-[11px] px-2 py-1 rounded bg-gray-900 border border-gray-700 text-cyan-300">#{l.sortOrder ?? 0}</span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-white">{l.name}</span>
                                            <span className={`text-[8px] font-black uppercase w-fit px-1.5 rounded mt-1 border ${l.category === 'PLANNING' ? 'bg-purple-900/40 text-purple-400 border-purple-800' : l.category === 'ADMINISTRATIVE' ? 'bg-indigo-900/40 text-indigo-400 border-indigo-800' : 'bg-gray-900 text-gray-500 border-gray-800'}`}>
                                                {l.category === 'PLANNING' ? 'Lớp Quy hoạch' : l.category === 'ADMINISTRATIVE' ? 'Lớp Hành chính' : 'Lớp Chuyên đề'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${l.type === 'XYZ' ? 'bg-orange-900/30 text-orange-400 border-orange-800/40' : 'bg-cyan-900/30 text-cyan-400 border-cyan-800/40'}`}>
                                            {l.type || 'WMS'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${scopeMeta.badge}`}>
                                            {scopeMeta.label}
                                        </span>
                                    </td>
                                    <td className="p-4 text-xs text-gray-400 max-w-[260px] truncate">{stripScopeMarker(l.description || '') || '--'}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Sun size={12} className="text-gray-500" />
                                            <span className="text-[11px] font-mono font-bold text-gray-400">{Math.round((l.opacity ?? 1) * 100)}%</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <button onClick={() => toggleWmsVisibility(l)} className="flex items-center gap-2">
                                            {l.visible ? (
                                                <span className="flex items-center gap-1.5 text-green-400 text-[10px] uppercase font-black bg-green-900/20 px-2 py-1 rounded-full border border-green-800/40">
                                                    <Eye size={12}/> Đang hiện
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-gray-500 text-[10px] uppercase font-black bg-gray-900 px-2 py-1 rounded-full border border-gray-700">
                                                    <EyeOff size={12}/> Đang ẩn
                                                </span>
                                            )}
                                        </button>
                                    </td>
                                    <td className="p-4 flex justify-end gap-1">
                                        <button onClick={() => openModal('LAYER', l)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded transition-all"><Edit2 size={16}/></button>
                                        <button onClick={() => triggerConfirm('DELETE_WMS', l.id, l.name)} className="p-2 text-red-500 hover:bg-red-500/10 rounded transition-all"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>}

            {/* 4. BASEMAPS SECTION */}
            {activeTab === 'BASEMAPS' && <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
                <div className="p-4 flex justify-between border-b border-gray-700 bg-gray-800/50">
                    <div>
                        <span className="font-semibold text-gray-100 flex items-center gap-2">
                            <MapIcon size={18} className="text-orange-400"/> Quản lý Bản đồ nền (Basemaps)
                        </span>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">Kéo-thả sẽ tự lưu thứ tự ngay sau khi thả</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {basemapSaveState === 'saving' && <span className="text-[10px] uppercase font-black tracking-wider text-amber-400">Đang tự lưu...</span>}
                        {basemapSaveState === 'saved' && <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400">Đã lưu thứ tự</span>}
                        {basemapSaveState === 'error' && <span className="text-[10px] uppercase font-black tracking-wider text-red-400">Lưu thất bại</span>}
                        <button onClick={() => openModal('BASEMAP')} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-1 shadow-lg transition-all">
                            <Plus size={16}/> Thêm Bản đồ nền
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-900 text-gray-400 uppercase text-[10px] tracking-widest font-black">
                            <tr><th className="p-4">Kéo</th><th className="p-4">Thứ tự</th><th className="p-4">Tên bản đồ</th><th className="p-4">Mô tả</th><th className="p-4">Loại</th><th className="p-4">Proxy</th><th className="p-4">Mặc định</th><th className="p-4">Trạng thái</th><th className="p-4 text-right">Thao tác</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700 text-gray-300">
                            {filteredBasemaps.length === 0 ? (
                                <tr><td colSpan={9} className="p-8 text-center text-gray-600 italic">Không có bản đồ nền nào khớp điều kiện lọc</td></tr>
                            ) : filteredBasemaps.map(bm => (
                                <tr
                                    key={bm.id}
                                    draggable={canReorderBasemaps}
                                    onDragStart={() => setDraggingBasemapId(bm.id)}
                                    onDragOver={(e) => { if (canReorderBasemaps) { e.preventDefault(); setDragOverBasemapId(bm.id); } }}
                                    onDrop={() => handleBasemapDrop(bm.id)}
                                    onDragEnd={() => { setDraggingBasemapId(null); setDragOverBasemapId(null); }}
                                    className={`hover:bg-gray-700/30 transition-colors ${canReorderBasemaps ? 'cursor-move' : ''} ${draggingBasemapId === bm.id ? 'opacity-40' : ''} ${dragOverBasemapId === bm.id ? 'bg-orange-900/20' : ''}`}
                                >
                                    <td className="p-4 text-gray-500">
                                        <GripVertical size={14} />
                                    </td>
                                    <td className="p-4">
                                        <span className="font-mono text-[11px] px-2 py-1 rounded bg-gray-900 border border-gray-700 text-orange-300">#{bm.sortOrder ?? 0}</span>
                                    </td>
                                    <td className="p-4 font-bold text-white">{bm.name}</td>
                                    <td className="p-4 text-xs text-gray-500 max-w-[220px] truncate">{bm.description || '--'}</td>
                                    <td className="p-4 text-xs font-mono text-gray-400">{bm.type}</td>
                                    <td className="p-4">
                                        {bm.useProxy ? (
                                            <span className="flex items-center gap-1 text-[9px] text-indigo-400 bg-indigo-900/20 px-2 py-0.5 rounded border border-indigo-800/50 font-black uppercase"><Shield size={10}/> Proxy</span>
                                        ) : (
                                            <span className="text-[9px] text-gray-600 font-bold uppercase">Direct</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        {bm.isDefault ? (
                                            <span className="bg-orange-900/40 text-orange-400 text-[9px] px-2 py-0.5 rounded-full border border-orange-800 font-black uppercase">Mặc định</span>
                                        ) : '--'}
                                    </td>
                                    <td className="p-4">{bm.visible ? <span className="text-green-400 text-[10px] uppercase font-bold">Hiện</span> : <span className="text-gray-500 text-[10px] uppercase font-bold">Ẩn</span>}</td>
                                    <td className="p-4 flex justify-end gap-1">
                                        <button onClick={() => openModal('BASEMAP', bm)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded transition-all"><Edit2 size={16}/></button>
                                        <button onClick={() => triggerConfirm('DELETE_BASEMAP', bm.id, bm.name)} className="p-2 text-red-500 hover:bg-red-500/10 rounded transition-all"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>}

            {/* --- CONFIRMATION MODAL & MAIN FORM MODAL --- */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[600] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-800 rounded-2xl w-full max-w-sm border border-gray-700 shadow-2xl overflow-hidden">
                        <div className={`p-6 flex flex-col items-center text-center ${confirmDialog.isDangerous ? 'bg-red-950/20' : 'bg-orange-950/20'}`}>
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${confirmDialog.isDangerous ? 'bg-red-500 text-white' : (confirmDialog.actionType === 'SYNC' ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white')}`}>
                                {confirmDialog.actionType === 'SYNC' ? <DatabaseZap size={32}/> : <ShieldAlert size={32} />}
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">{confirmDialog.title}</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">{confirmDialog.message}</p>
                        </div>
                        <div className="p-4 bg-gray-900/50 flex gap-3">
                            <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-white uppercase">Hủy bỏ</button>
                            <button onClick={executeAction} className={`flex-1 py-3 text-sm font-black rounded-xl uppercase shadow-lg ${confirmDialog.isDangerous ? 'bg-red-600 hover:bg-red-500 text-white' : (confirmDialog.actionType === 'SYNC' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white')}`}>Xác nhận</button>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-[500] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-800 rounded-xl w-full max-w-2xl p-6 border border-gray-700 shadow-2xl animate-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-3">
                            <h3 className="text-xl font-bold text-white uppercase tracking-tighter flex items-center gap-2">
                                {modalType === 'TABLE' && <Table className="text-green-400"/>}
                                {modalType === 'LAYER' && <Globe className="text-cyan-400"/>}
                                {modalType === 'BASEMAP' && <MapIcon className="text-orange-400"/>}
                                {isEditMode ? "Chỉnh sửa" : "Thêm mới"}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors"><X size={24}/></button>
                        </div>
                        
                        <div className="space-y-5">
                            {modalType === 'LAYER' && (
                                <>
                                    <div className="bg-gray-950 p-1 rounded flex gap-1 shadow-inner mb-4">
                                        <button onClick={() => setFormData({...formData, type: 'WMS'})} className={`flex-1 py-2 text-[10px] font-black rounded uppercase transition-all ${formData.type === 'WMS' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Chuẩn WMS</button>
                                        <button onClick={() => setFormData({...formData, type: 'XYZ'})} className={`flex-1 py-2 text-[10px] font-black rounded uppercase transition-all ${formData.type === 'XYZ' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Chuẩn XYZ Tiles</button>
                                    </div>

                                    <div>
                                        <label className="text-[10px] text-gray-500 font-black uppercase mb-3 block tracking-[0.15em]">Phân loại lớp bản đồ</label>
                                        <div className="grid grid-cols-3 gap-2 bg-gray-900 p-1 rounded-xl">
                                            <button onClick={() => setFormData({...formData, category: 'STANDARD'})} className={`py-2 text-[10px] font-black rounded-lg uppercase transition-all ${formData.category === 'STANDARD' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Chuyên đề</button>
                                            <button onClick={() => setFormData({...formData, category: 'PLANNING'})} className={`py-2 text-[10px] font-black rounded-lg uppercase transition-all ${formData.category === 'PLANNING' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Quy hoạch</button>
                                            <button onClick={() => setFormData({...formData, category: 'ADMINISTRATIVE'})} className={`py-2 text-[10px] font-black rounded-lg uppercase transition-all ${formData.category === 'ADMINISTRATIVE' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Hành chính</button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] text-gray-500 font-black uppercase block mb-1.5 ml-1">Tên hiển thị (VD: Quy hoạch TDM)</label>
                                        <input className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white outline-none focus:border-cyan-500 font-bold" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}/>
                                    </div>

                                    <div>
                                        <label className="text-[10px] text-gray-500 font-black uppercase mb-3 block tracking-[0.15em]">Phạm vi hiển thị map</label>
                                        <div className="grid grid-cols-3 gap-2 bg-gray-900 p-1 rounded-xl">
                                            <button onClick={() => setFormData({...formData, mapScope: 'MAIN'})} className={`py-2 text-[10px] font-black rounded-lg uppercase transition-all ${formData.mapScope === 'MAIN' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Map chính</button>
                                            <button onClick={() => setFormData({...formData, mapScope: 'ADMIN'})} className={`py-2 text-[10px] font-black rounded-lg uppercase transition-all ${formData.mapScope === 'ADMIN' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Hành chính</button>
                                            <button onClick={() => setFormData({...formData, mapScope: 'SHARED'})} className={`py-2 text-[10px] font-black rounded-lg uppercase transition-all ${formData.mapScope === 'SHARED' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Dùng chung</button>
                                        </div>
                                        <p className="mt-1 text-[10px] text-gray-500">Chọn trực tiếp nơi lớp này được phép xuất hiện, không cần gõ nhãn tay nữa.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] text-gray-500 font-black uppercase block mb-1.5 ml-1">Thứ tự hiển thị</label>
                                            <input type="number" min={0} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white font-mono text-sm outline-none" value={formData.sortOrder ?? 0} onChange={e => setFormData({...formData, sortOrder: Number(e.target.value)})}/>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 font-black uppercase block mb-1.5 ml-1">Mô tả ngắn</label>
                                            <input className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white text-sm outline-none" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})}/>
                                            <p className="mt-1 text-[10px] text-gray-500">Mẹo: thêm #TIFF (hoặc raster:tiff) để đánh dấu lớp WMS hiển thị ảnh TIFF.</p>
                                        </div>

                                        <div className="bg-gray-900/50 p-3 rounded-xl border border-gray-700/50">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className={`w-9 h-5 rounded-full relative transition-colors ${formData.isTiff ? 'bg-amber-600' : 'bg-gray-700'}`} onClick={() => setFormData({...formData, isTiff: !formData.isTiff})}>
                                                    <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${formData.isTiff ? 'translate-x-4' : ''}`}></div>
                                                </div>
                                                <div className="flex-1">
                                                    <span className="text-xs font-bold text-amber-300 block uppercase tracking-wide">Lớp TIFF (Raster qua WMS)</span>
                                                    <span className="text-[9px] text-gray-500">Bật để xem lớp này như ảnh TIFF: vẫn hiển thị/zoom/opacity, nhưng không truy vấn thuộc tính.</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    {formData.type === 'WMS' && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] text-gray-500 font-black uppercase block mb-1.5 ml-1">Lớp (Workspace:Layer)</label>
                                                <input className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white font-mono text-xs outline-none focus:border-cyan-500" placeholder="vd: hcm:binh_thanh_parcels" value={formData.layers || ''} onChange={e => setFormData({...formData, layers: e.target.value})}/>
                                            </div>
                                            {/* HELPER CHỌN BẢNG TỪ REGISTRY */}
                                            <div className="bg-gray-900/50 p-3 rounded-xl border border-gray-700/50 space-y-2">
                                                <label className="text-[9px] text-blue-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                                                    <Search size={10}/> Trợ lý liên kết Registry
                                                </label>
                                                <select 
                                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-[11px] text-gray-300 outline-none cursor-pointer"
                                                    value=""
                                                    onChange={e => {
                                                        if (e.target.value) {
                                                            setFormData({ ...formData, layers: `geoserver:${e.target.value}` });
                                                        }
                                                    }}
                                                >
                                                    <option value="">-- Chọn bảng để nạp thông số --</option>
                                                    {spatialTables.map(t => (
                                                        <option key={t.table_name} value={t.table_name}>{t.display_name} ({t.table_name})</option>
                                                    ))}
                                                </select>
                                                <p className="text-[8px] text-gray-600 italic">* Tự động điền theo chuẩn geoserver:table_name</p>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-[10px] text-gray-500 font-black uppercase block mb-1.5 ml-1">
                                            {formData.type === 'WMS' ? 'URL GeoServer WMS' : 'URL XYZ Template'}
                                        </label>
                                        <textarea className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white font-mono text-xs outline-none focus:border-cyan-500 h-20 resize-none" placeholder="VD: https://geo.gisvn.space/geoserver/wms" value={formData.url || ''} onChange={e => setFormData({...formData, url: e.target.value})}/>
                                    </div>

                                    {/* CÀI ĐẶT ĐỘ MỜ (OPACITY) */}
                                    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] text-gray-400 font-black uppercase tracking-wider flex items-center gap-2">
                                                <Sun size={12} className="text-cyan-500"/> Độ mờ lớp dữ liệu
                                            </label>
                                            <span className="text-[11px] font-mono font-black text-cyan-400">{Math.round((formData.opacity || 1) * 100)}%</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="1" 
                                            step="0.05" 
                                            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" 
                                            value={formData.opacity ?? 1} 
                                            onChange={e => setFormData({...formData, opacity: parseFloat(e.target.value)})}
                                        />
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer group mt-2">
                                            <div className={`w-5 h-5 rounded border border-gray-600 flex items-center justify-center transition-all ${formData.visible ? 'bg-cyan-600 border-cyan-600' : 'bg-gray-900'}`} onClick={() => setFormData({...formData, visible: !formData.visible})}>
                                                {formData.visible && <Check size={14} className="text-white"/>}
                                            </div>
                                            <span className="text-xs text-gray-300 font-bold uppercase tracking-wider">Cho phép hiển thị trên bản đồ</span>
                                        </label>
                                    </div>
                                </>
                            )}
                            
                            {modalType === 'TABLE' && (
                                <>
                                    {!isEditMode && (
                                        <div className="bg-gray-900 p-1 rounded flex gap-1 shadow-inner mb-4">
                                            <button onClick={() => setFormData({...formData, isExisting: false})} className={`flex-1 py-2 text-[10px] font-black rounded uppercase transition-all ${!formData.isExisting ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Tạo bảng mới</button>
                                            <button onClick={() => setFormData({...formData, isExisting: true})} className={`flex-1 py-2 text-[10px] font-black rounded uppercase transition-all ${formData.isExisting ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Liên kết bảng sẵn có</button>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-[10px] text-gray-500 font-black uppercase block mb-1.5 ml-1">Tên bảng vật lý (PostgreSQL)</label>
                                        <input className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white font-mono text-sm outline-none" value={formData.tableName || ''} onChange={e => setFormData({...formData, tableName: e.target.value.toLowerCase().trim()})}/>
                                    </div>
                                    
                                    {isEditMode && (
                                        <label className="flex items-center gap-2 p-3 bg-red-950/20 rounded-xl border border-red-900/30 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded border border-red-700 flex items-center justify-center transition-all ${formData.renamePhysical ? 'bg-red-600 border-red-600' : 'bg-gray-900'}`} onClick={() => setFormData({...formData, renamePhysical: !formData.renamePhysical})}>
                                                {formData.renamePhysical && <Check size={14} className="text-white"/>}
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-[10px] text-red-400 font-black uppercase tracking-widest block">Đổi tên vật lý (Rename Table)</span>
                                                <span className="text-[8px] text-gray-500 block">Nếu tắt, chỉ cập nhật đường dẫn liên kết trong Registry.</span>
                                            </div>
                                        </label>
                                    )}

                                    <div>
                                        <label className="text-[10px] text-orange-400 font-black uppercase block mb-1.5 ml-1">Tên hiển thị</label>
                                        <input className="w-full bg-gray-900 border border-orange-900/30 rounded-lg p-2.5 text-white outline-none focus:border-orange-500 font-bold" value={formData.displayName || ''} onChange={e => setFormData({...formData, displayName: e.target.value})}/>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 font-black uppercase block mb-1.5 ml-1">Mô tả</label>
                                        <textarea className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white text-xs h-20" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})}/>
                                    </div>
                                </>
                            )}
                            {modalType === 'BASEMAP' && (
                                <>
                                    <div>
                                        <label className="text-[10px] text-gray-500 font-black uppercase block mb-1.5 ml-1">Tên bản đồ nền</label>
                                        <input className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white font-bold" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}/>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] text-gray-500 font-black uppercase block mb-1.5 ml-1">Thứ tự hiển thị</label>
                                            <input type="number" min={0} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white font-mono text-sm" value={formData.sortOrder ?? 0} onChange={e => setFormData({...formData, sortOrder: Number(e.target.value)})}/>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 font-black uppercase block mb-1.5 ml-1">Mô tả ngắn</label>
                                            <input className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white text-sm" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})}/>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 font-black uppercase block mb-1.5 ml-1">Loại</label>
                                        <select className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white" value={formData.type || 'XYZ'} onChange={e => setFormData({...formData, type: e.target.value})}>
                                            <option value="XYZ">XYZ Tiles</option>
                                            <option value="OSM">OpenStreetMap</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 font-black uppercase block mb-1.5 ml-1">URL (XYZ Template)</label>
                                        <input className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-white font-mono text-xs" value={formData.url || ''} onChange={e => setFormData({...formData, url: e.target.value})} disabled={formData.type === 'OSM'}/>
                                    </div>
                                    
                                    <div className="bg-gray-950/50 p-4 rounded-xl border border-gray-800 space-y-3">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-9 h-5 rounded-full relative transition-colors ${formData.useProxy ? 'bg-indigo-600' : 'bg-gray-700'}`} onClick={() => setFormData({...formData, useProxy: !formData.useProxy})}>
                                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${formData.useProxy ? 'translate-x-4' : ''}`}></div>
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-xs font-bold text-indigo-300 block uppercase tracking-wide">Sử dụng Proxy Server</span>
                                                <span className="text-[9px] text-gray-500">Bật nếu bản đồ bị chặn CORS hoặc cần ẩn URL gốc (VD: Vietbando)</span>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded border border-gray-600 flex items-center justify-center ${formData.isDefault ? 'bg-orange-600 border-orange-600' : 'bg-gray-900'}`} onClick={() => setFormData({...formData, isDefault: !formData.isDefault})}>
                                                {formData.isDefault && <Check size={14} className="text-white"/>}
                                            </div>
                                            <span className="text-xs text-gray-300">Mặc định</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded border border-gray-600 flex items-center justify-center ${formData.visible ? 'bg-green-600 border-green-600' : 'bg-gray-900'}`} onClick={() => setFormData({...formData, visible: !formData.visible})}>
                                                {formData.visible && <Check size={14} className="text-white"/>}
                                            </div>
                                            <span className="text-xs text-gray-300">Hiển thị</span>
                                        </label>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-700">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white font-bold text-sm uppercase">Hủy bỏ</button>
                            <button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-lg font-black text-sm shadow-lg flex items-center gap-2 active:scale-95 disabled:opacity-50 transition-all uppercase tracking-widest">
                                {loading ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>}
                                {isEditMode ? "LƯU THAY ĐỔI" : "XÁC NHẬN"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LayerManager;
