
import React, { useEffect, useState, useCallback } from 'react';
import { parcelApi, ParcelDTO, SpatialTable } from '../services/parcelApi';
import { RefreshCw, Database, Layers, CheckCircle2, AlertTriangle, Info, Plus, FileSpreadsheet } from 'lucide-react';
import { removeAccents } from '../utils/helpers';

// Sub-components
import TableFilter from '../components/admin/parcel/TableFilter';
import ParcelList from '../components/admin/parcel/ParcelList';
import QuickView from '../components/admin/parcel/QuickView';
import ParcelForm from '../components/admin/parcel/ParcelForm';
import BulkImportModal from '../components/admin/parcel/BulkImportModal';

const ParcelManager: React.FC = () => {
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
    const [searchFilters, setSearchFilters] = useState({ sodoto: '', sothua: '', tenchu: '', diachi: '' });
    
    // Modal Management
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [formData, setFormData] = useState<ParcelDTO>({ sothua: '', sodoto: '', tenchu: '', diachi: '', loaidat: '', file: null });

    // System Dialog
    const [dialog, setDialog] = useState<{ isOpen: boolean; type: 'alert' | 'confirm' | 'success' | 'error'; title: string; message: string; onConfirm?: () => void; }>({ isOpen: false, type: 'alert', title: '', message: '' });

    const showDialog = (type: any, title: string, message: string, onConfirm?: () => void) => {
        setDialog({ isOpen: true, type, title, message, onConfirm });
    };

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

    // --- ACTIONS ---
    const handleDownload = (p: any) => {
        try {
            const geojson = { type: "Feature", geometry: p.geometry, properties: { gid: p.gid, to: getFieldValue(p, ['sodoto', 'so_to']), thua: getFieldValue(p, ['sothua', 'so_thua']), source: layer } };
            const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `Parcel_${p.gid}.geojson`; a.click();
        } catch (err) { showDialog('error', 'Lỗi', 'Không thể xuất file.'); }
    };

    const handleDelete = (gid: number) => {
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
        setEditingId(p.gid);
        const rawSoTo = getFieldValue(p, ['sodoto', 'so_to']);
        const rawSoThua = getFieldValue(p, ['sothua', 'so_thua']);
        setFormData({ 
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
        setEditingId(null);
        setFormData({ sothua: '', sodoto: '', tenchu: '', diachi: '', loaidat: '', file: null });
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
                        onClick={() => setIsBulkOpen(true)} 
                        disabled={!layer} 
                        className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        <FileSpreadsheet size={18} /> NHẬP TỆP
                    </button>
                    <button onClick={openAdd} disabled={!layer} className="w-full md:w-auto justify-center flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={18} /> THÊM THỬA ĐẤT</button>
                </div>
            </div>

            <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col flex-1">
                <TableFilter layer={layer} setLayer={setLayer} availableTables={availableTables} searchFilters={searchFilters} setSearchFilters={setSearchFilters} handleSearch={() => handleSearch(1)} loading={loading} />
                <ParcelList parcels={parcels} hasSearched={hasSearched} error={error} loading={loading} onQuickView={(p)=>{setSelectedItem(p); setIsPreviewOpen(true);}} onDownload={handleDownload} onEdit={openEdit} onDelete={handleDelete} getFieldValue={getFieldValue} page={page} pages={pages} total={total} limit={limit} onPageChange={(nextPage) => handleSearch(nextPage)} onLimitChange={async (nextLimit) => { setLimit(nextLimit); await handleSearch(1); }} />
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
