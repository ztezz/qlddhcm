
import React, { useEffect, useState, useCallback } from 'react';
import { parcelApi, ParcelDTO, SpatialTable } from '../services/parcelApi';
import { hasAnyPermission } from '../services/mockBackend';
import { RefreshCw, Database, Layers, CheckCircle2, AlertTriangle, Info, Plus, FileSpreadsheet } from 'lucide-react';
import { removeAccents, toSafeFilename } from '../utils/helpers';
import { ParcelExportFormat, exportDxfFile, exportGeoJsonFile, exportShpZipFile } from '../utils/parcelExport';

// Sub-components
import TableFilter from '../components/admin/parcel/TableFilter';
import ParcelList from '../components/admin/parcel/ParcelList';
import QuickView from '../components/admin/parcel/QuickView';
import ParcelForm from '../components/admin/parcel/ParcelForm';
import BulkImportModal from '../components/admin/parcel/BulkImportModal';

interface ParcelManagerProps {
    permissions?: string[];
}

const ParcelManager: React.FC<ParcelManagerProps> = ({ permissions = [] }) => {
    const [layer, setLayer] = useState('');
    const [availableTables, setAvailableTables] = useState<SpatialTable[]>([]);
    const [parcels, setParcels] = useState<ParcelDTO[]>([]);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(100);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchFilters, setSearchFilters] = useState({ madinhdanh: '', sodoto: '', sothua: '', tenchu: '', diachi: '' });
    
    // Modal Management
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [formData, setFormData] = useState<ParcelDTO>({ madinhdanh: '', sothua: '', sodoto: '', tenchu: '', diachi: '', loaidat: '', file: null });

    // System Dialog
    const [dialog, setDialog] = useState<{ isOpen: boolean; type: 'alert' | 'confirm' | 'success' | 'error'; title: string; message: string; onConfirm?: () => void; }>({ isOpen: false, type: 'alert', title: '', message: '' });

    const showDialog = (type: any, title: string, message: string, onConfirm?: () => void) => {
        setDialog({ isOpen: true, type, title, message, onConfirm });
    };

    const canCreateParcel = hasAnyPermission(permissions, ['CREATE_PARCELS', 'MANAGE_PARCELS', 'EDIT_MAP']);
    const canEditParcel = hasAnyPermission(permissions, ['EDIT_PARCELS', 'MANAGE_PARCELS', 'EDIT_MAP']);
    const canDeleteParcel = hasAnyPermission(permissions, ['DELETE_PARCELS', 'DELETE_MAP', 'MANAGE_PARCELS']);
    const canImportParcel = hasAnyPermission(permissions, ['IMPORT_PARCELS', 'MANAGE_PARCELS']);

    const isAdministrativeTable = useCallback((table: SpatialTable) => {
        const haystack = removeAccents(`${table.table_name || ''} ${table.display_name || ''} ${table.description || ''}`.toLowerCase());
        const blockedKeywords = [
            'donvihanhchinh',
            'don vi hanh chinh',
            'hanh chinh',
            'administrative',
            'ranh gioi',
            'dia gioi',
            'boundary'
        ];

        return blockedKeywords.some((keyword) => haystack.includes(removeAccents(keyword)));
    }, []);

    // --- LOGIC: FETCHING ---
    const loadTables = async () => {
        setLoading(true);
        try {
            const tables = await parcelApi.manageTables.getAll();
            const parcelTables = tables.filter((table) => !isAdministrativeTable(table));
            setAvailableTables(parcelTables);

            if (parcelTables.length > 0 && !parcelTables.some((table) => table.table_name === layer)) {
                setLayer(parcelTables[0].table_name);
            }

            setError(null);
        } catch (e: any) { setError("Không thể tải danh sách lớp dữ liệu."); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadTables(); }, []);
    useEffect(() => { if (layer) { setParcels([]); setHasSearched(false); setError(null); setPage(1); setTotal(0); setPages(1); } }, [layer]);

    const handleSearch = async (targetPage = 1) => {
        if (!layer) return showDialog('error', 'Lỗi', 'Vui lòng chọn lớp dữ liệu.');
        setLoading(true);
        setError(null);
        setHasSearched(true);
        try {
            const result = await parcelApi.getAll(layer, searchFilters, { page: targetPage, limit });
            setParcels(result.data || []);
            setTotal(result.total || 0);
            setPages(result.pages || 1);
            setPage(result.page || targetPage);
        } catch (err: any) { setError(err.message); setParcels([]); setTotal(0); }
        finally { setLoading(false); }
    };

    // --- HELPERS: DATA MAPPING ---
    const getFieldValue = (obj: any, aliases: string[]) => {
        for (const alias of aliases) {
            if (obj[alias] !== undefined && obj[alias] !== null && obj[alias] !== '') return obj[alias];
            const lower = alias.toLowerCase();
            const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lower);
            if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null) return obj[foundKey];
        }
        return null;
    };

    const buildParcelFeature = (p: any) => ({
        type: 'Feature' as const,
        geometry: p.geometry,
        properties: {
            gid: p.gid,
            madinhdanh: getFieldValue(p, ['madinhdanh', 'ma_dinh_danh', 'ma_thua', 'parcel_code', 'parcel_id', 'land_id', 'identifier']) || '',
            sodoto: getFieldValue(p, ['sodoto', 'so_to', 'shbando']) || '',
            sothua: getFieldValue(p, ['sothua', 'so_thua', 'shthua']) || '',
            tenchu: getFieldValue(p, ['tenchu', 'owner', 'chusudung']) || '',
            diachi: getFieldValue(p, ['diachi', 'address']) || '',
            loaidat: getFieldValue(p, ['loaidat', 'kyhieumucd', 'mucdich']) || '',
            dientich: parseFloat(getFieldValue(p, ['dientich', 'dien_tich', 'area']) || 0),
            source: layer
        }
    });

    const buildParcelFilename = (p: any, ext: string) => {
        const parcelCode = getFieldValue(p, ['madinhdanh', 'ma_dinh_danh', 'ma_thua', 'parcel_code', 'parcel_id', 'land_id', 'identifier']) || 'unknown';
        const soTo = getFieldValue(p, ['sodoto', 'so_to', 'shbando']) || 'unknown';
        const soThua = getFieldValue(p, ['sothua', 'so_thua', 'shthua']) || 'unknown';
        return `${toSafeFilename(`Parcel_${layer}_${parcelCode}_${soTo}_${soThua}_${p.gid || 'na'}`)}.${ext}`;
    };

    // --- ACTIONS ---
    const handleDownload = async (p: any, format: ParcelExportFormat) => {
        try {
            if (!p?.geometry) {
                showDialog('error', 'Lỗi', 'Thửa đất này chưa có dữ liệu hình học để tải xuống.');
                return;
            }

            const featureCollection = { type: 'FeatureCollection' as const, features: [buildParcelFeature(p)] };

            if (format === 'geojson') {
                exportGeoJsonFile(featureCollection, buildParcelFilename(p, 'geojson'));
                return;
            }

            if (format === 'shp') {
                await exportShpZipFile(featureCollection, buildParcelFilename(p, 'zip'));
                return;
            }

            exportDxfFile(featureCollection, buildParcelFilename(p, 'dxf'));
        } catch (err) {
            showDialog('error', 'Lỗi', 'Không thể xuất file.');
        }
    };

    const handleDelete = (gid: number) => {
        if (!canDeleteParcel) return showDialog('error', 'Không đủ quyền', 'Bạn không có quyền xóa thửa đất.');
        showDialog('confirm', 'Xác nhận xóa', 'Bạn có chắc muốn xóa thửa đất này khỏi hệ thống?', async () => {
            setLoading(true);
            try {
                await parcelApi.delete(layer, gid);
                await handleSearch(page);
                showDialog('success', 'Thành công', 'Đã xóa thửa đất.');
            } catch (err: any) { showDialog('error', 'Lỗi', err.message); }
            finally { setLoading(false); }
        });
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId ? !canEditParcel : !canCreateParcel) {
            showDialog('error', 'Không đủ quyền', editingId ? 'Bạn không có quyền cập nhật thửa đất.' : 'Bạn không có quyền thêm thửa đất mới.');
            return;
        }
        setLoading(true);
        try {
            if (editingId) {
                if (formData.file) await parcelApi.createWithUpload(layer, { ...formData, gid: editingId });
                else await parcelApi.update(layer, editingId, formData);
            } else {
                if (formData.file) await parcelApi.createWithUpload(layer, formData);
                else await parcelApi.create(layer, formData);
            }
            setIsFormOpen(false);
            await handleSearch(page);
            showDialog('success', 'Thành công', 'Dữ liệu đã được lưu trữ.');
        } catch (err: any) { showDialog('error', 'Lỗi', err.message); }
        finally { setLoading(false); }
    };

    const openEdit = (p: any) => {
        if (!canEditParcel) return showDialog('error', 'Không đủ quyền', 'Bạn không có quyền sửa thửa đất.');
        setEditingId(p.gid);
        const rawParcelCode = getFieldValue(p, ['madinhdanh', 'ma_dinh_danh', 'ma_thua', 'parcel_code', 'parcel_id', 'land_id', 'identifier']);
        const rawSoTo = getFieldValue(p, ['sodoto', 'so_to']);
        const rawSoThua = getFieldValue(p, ['sothua', 'so_thua']);
        setFormData({
            madinhdanh: rawParcelCode !== null && rawParcelCode !== undefined ? String(rawParcelCode) : '',
            sodoto: rawSoTo !== null && rawSoTo !== undefined ? String(rawSoTo) : '',
            sothua: rawSoThua !== null && rawSoThua !== undefined ? String(rawSoThua) : '',
            tenchu: getFieldValue(p, ['tenchu', 'owner']),
            diachi: getFieldValue(p, ['diachi', 'address']),
            loaidat: getFieldValue(p, ['loaidat', 'kyhieumucd']),
            dientich: parseFloat(getFieldValue(p, ['dientich', 'area']) || 0),
            geometry: p.geometry, file: null
        });
        setIsFormOpen(true);
    };

    const openAdd = () => {
        if (!canCreateParcel) return showDialog('error', 'Không đủ quyền', 'Bạn không có quyền thêm thửa đất mới.');
        setEditingId(null);
        setFormData({ madinhdanh: '', sothua: '', sodoto: '', tenchu: '', diachi: '', loaidat: '', file: null });
        setIsFormOpen(true);
    };

    return (
        <div className="p-6 bg-gray-950 text-white min-h-full space-y-6 flex flex-col font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-6 gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30">
                        <Database className="text-blue-500" size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight uppercase">Quản trị Thửa đất</h2>
                        <div className="flex items-center gap-2 text-gray-500 text-xs mt-0.5 font-bold uppercase tracking-widest">
                            <Layers size={14} className="text-blue-400" />
                            <span>Database: {layer || 'Chờ nạp...'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <button onClick={loadTables} className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2.5 rounded-xl text-xs font-black transition-all border border-gray-700"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> TẢI LẠI</button>
                    <button 
                        onClick={() => canImportParcel ? setIsBulkOpen(true) : showDialog('error', 'Không đủ quyền', 'Bạn không có quyền nhập dữ liệu thửa đất.')}
                        disabled={!layer || !canImportParcel} 
                        className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        <FileSpreadsheet size={18} /> NHẬP TỆP
                    </button>
                    <button onClick={openAdd} disabled={!layer || !canCreateParcel} className="w-full md:w-auto justify-center flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={18} /> THÊM THỬA ĐẤT</button>
                </div>
            </div>

            <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col flex-1">
                <TableFilter layer={layer} setLayer={setLayer} availableTables={availableTables} searchFilters={searchFilters} setSearchFilters={setSearchFilters} handleSearch={() => handleSearch(1)} loading={loading} />
                <ParcelList parcels={parcels} hasSearched={hasSearched} error={error} loading={loading} onQuickView={(p)=>{setSelectedItem(p); setIsPreviewOpen(true);}} onDownload={handleDownload} onEdit={openEdit} onDelete={handleDelete} canEdit={canEditParcel} canDelete={canDeleteParcel} getFieldValue={getFieldValue} page={page} pages={pages} total={total} limit={limit} onPageChange={(nextPage) => handleSearch(nextPage)} onLimitChange={async (nextLimit) => { setLimit(nextLimit); await handleSearch(1); }} />
            </div>

            {/* Modals */}
            <ParcelForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} editingId={editingId} formData={formData} setFormData={setFormData} handleSubmit={handleFormSubmit} loading={loading} />
            <BulkImportModal isOpen={isBulkOpen} onClose={() => setIsBulkOpen(false)} targetTable={layer} onSuccess={() => { handleSearch(1); showDialog('success', 'Thành công', 'Đã nạp toàn bộ dữ liệu từ tệp tin.'); }} />
            {isPreviewOpen && selectedItem && <QuickView parcel={selectedItem} onClose={() => setIsPreviewOpen(false)} onDownload={handleDownload} getFieldValue={getFieldValue} />}

            {/* Dialog System */}
            {dialog.isOpen && (
                <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-900 rounded-[2.5rem] w-full max-w-md border border-gray-800 shadow-2xl overflow-hidden">
                        <div className="p-8 text-center flex flex-col items-center">
                            {dialog.type === 'success' && <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-4"><CheckCircle2 size={32}/></div>}
                            {dialog.type === 'error' && <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4"><AlertTriangle size={32}/></div>}
                            {dialog.type === 'confirm' && <div className="w-16 h-16 bg-orange-500/20 text-orange-500 rounded-full flex items-center justify-center mb-4"><Info size={32}/></div>}
                            {dialog.type === 'alert' && <div className="w-16 h-16 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mb-4"><Info size={32}/></div>}
                            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">{dialog.title}</h3>
                            <p className="text-gray-400 text-sm leading-relaxed mb-8">{dialog.message}</p>
                            <div className="flex gap-3 w-full">
                                {dialog.type === 'confirm' ? (
                                    <><button onClick={() => setDialog({ ...dialog, isOpen: false })} className="flex-1 py-3.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-2xl font-black text-xs uppercase tracking-widest">HỦY</button><button onClick={() => { setDialog({ ...dialog, isOpen: false }); dialog.onConfirm?.(); }} className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black text-xs uppercase shadow-lg">ĐỒNG Ý</button></>
                                ) : (
                                    <button onClick={() => setDialog({ ...dialog, isOpen: false })} className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase shadow-lg">ĐÓNG</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ParcelManager;
