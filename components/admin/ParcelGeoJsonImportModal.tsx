import React, { useMemo, useState, useEffect } from 'react';
import { X, Upload, FileJson, CheckCircle2, AlertTriangle } from 'lucide-react';
import { parcelApi } from '../../services/parcelApi';

interface ParcelGeoJsonImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type MappingKey = 'sodoto' | 'sothua' | 'tenchu' | 'diachi' | 'kyhieumucd' | 'dientich' | 'geom';

const ALIAS_MAP: Record<MappingKey, string[]> = {
    sodoto: ['sodoto', 'so_to', 'shbando', 'sh_ban_do', 'to_ban_do', 'tobando'],
    sothua: ['sothua', 'so_thua', 'shthua', 'sh_thua', 'thua_dat', 'parcel_no'],
    tenchu: ['tenchu', 'ten_chu', 'owner', 'owner_name', 'chusudung'],
    diachi: ['diachi', 'dia_chi', 'address', 'vitri', 'vi_tri'],
    kyhieumucd: ['kyhieumucd', 'ky_hieu_muc_dich', 'loaidat', 'loai_dat', 'mucdich', 'mdsd'],
    dientich: ['dientich', 'dien_tich', 'area', 'shape_area', 'st_area'],
    geom: ['geometry', 'geom', 'the_geom', 'shape', 'geojson']
};

const FIELD_LABELS: Record<MappingKey, string> = {
    sodoto: 'Số tờ (bắt buộc)',
    sothua: 'Số thửa (bắt buộc)',
    tenchu: 'Tên chủ',
    diachi: 'Địa chỉ',
    kyhieumucd: 'Ký hiệu mục đích (kyhieumucd)',
    dientich: 'Diện tích',
    geom: 'Geometry (geom)'
};

const ParcelGeoJsonImportModal: React.FC<ParcelGeoJsonImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [tableName, setTableName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [description, setDescription] = useState('');
    const [availableColumns, setAvailableColumns] = useState<string[]>([]);
    const [sourceSrid, setSourceSrid] = useState<number>(9210);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successResult, setSuccessResult] = useState<{ inserted: number; totalFeatures: number; tableName: string } | null>(null);

    useEffect(() => {
        if (!successResult) return;
        const timer = setTimeout(() => {
            setSuccessResult(null);
            onClose();
        }, 4000);
        return () => clearTimeout(timer);
    }, [successResult, onClose]);

    const [mapping, setMapping] = useState<Record<MappingKey, string>>({
        sodoto: '',
        sothua: '',
        tenchu: '',
        diachi: '',
        kyhieumucd: '',
        dientich: '',
        geom: '__feature_geometry__'
    });

    const sampleColumnsText = useMemo(() => {
        if (availableColumns.length === 0) return 'Chưa đọc cột từ file';
        return availableColumns.slice(0, 10).join(', ') + (availableColumns.length > 10 ? '...' : '');
    }, [availableColumns]);

    const autoMapColumns = (columns: string[]) => {
        const lowerMap = new Map(columns.map((col) => [col.toLowerCase(), col]));
        const nextMapping = { ...mapping };

        (Object.keys(ALIAS_MAP) as MappingKey[]).forEach((key) => {
            if (key === 'geom') {
                nextMapping.geom = '__feature_geometry__';
                return;
            }
            const matchedAlias = ALIAS_MAP[key].find((alias) => lowerMap.has(alias.toLowerCase()));
            nextMapping[key] = matchedAlias ? String(lowerMap.get(matchedAlias.toLowerCase()) || '') : '';
        });

        setMapping(nextMapping);
    };

    const handleFileChange = async (selectedFile: File | null) => {
        setFile(selectedFile);
        setError(null);
        setAvailableColumns([]);

        if (!selectedFile) return;

        try {
            const text = await selectedFile.text();
            const parsed = JSON.parse(text);
            let features: any[] = [];

            if (parsed?.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
                features = parsed.features;
            } else if (parsed?.type === 'Feature') {
                features = [parsed];
            } else {
                throw new Error('GeoJSON phải là FeatureCollection hoặc Feature.');
            }

            if (features.length === 0) {
                throw new Error('File không có feature dữ liệu.');
            }

            const columns = new Set<string>();
            features.slice(0, 300).forEach((feature) => {
                const props = feature?.properties || {};
                Object.keys(props).forEach((k) => columns.add(k));
            });

            const sortedCols = Array.from(columns).sort((a, b) => a.localeCompare(b));
            setAvailableColumns(sortedCols);
            autoMapColumns(sortedCols);
        } catch (e: any) {
            setError(e.message || 'Không thể đọc file GeoJSON.');
        }
    };

    const handleSubmit = async () => {
        if (!file) {
            setError('Vui lòng chọn file GeoJSON.');
            return;
        }

        if (!tableName.trim()) {
            setError('Vui lòng nhập tên bảng mới.');
            return;
        }

        if (!displayName.trim()) {
            setError('Vui lòng nhập tên hiển thị.');
            return;
        }

        if (!mapping.sodoto || !mapping.sothua) {
            setError('Bắt buộc ánh xạ cột Số tờ và Số thửa.');
            return;
        }

        setLoading(true);
        setUploadProgress(0);
        setError(null);

        try {
            const result = await parcelApi.manageTables.importGeoJsonParcels({
                file,
                tableName,
                displayName,
                description,
                sourceSrid,
                mapping,
                onProgress: (percent) => setUploadProgress(percent)
            }) as { inserted?: number; totalFeatures?: number; tableName?: string };
            onSuccess();
            setSuccessResult({
                inserted: result?.inserted ?? 0,
                totalFeatures: result?.totalFeatures ?? 0,
                tableName: result?.tableName || tableName
            });
        } catch (e: any) {
            setError(e.message || 'Import GeoJSON thất bại.');
        } finally {
            setLoading(false);
            setUploadProgress(null);
        }
    };

    if (!isOpen) return null;

    if (successResult) {
        return (
            <div className="fixed inset-0 z-[650] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-gray-800 border border-green-700/60 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-8 flex flex-col items-center text-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-green-600/20 border-2 border-green-500 flex items-center justify-center">
                            <CheckCircle2 className="text-green-400" size={36} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Import thành công!</h3>
                            <p className="text-sm text-gray-400 mt-1">Bảng <span className="font-mono text-cyan-300">{successResult.tableName}</span> đã được tạo.</p>
                        </div>
                        <div className="flex gap-6 text-center">
                            <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-5 py-3">
                                <div className="text-2xl font-black text-green-400">{successResult.inserted.toLocaleString()}</div>
                                <div className="text-[11px] text-gray-500 uppercase font-bold mt-0.5">Bản ghi đã nạp</div>
                            </div>
                            <div className="bg-gray-900/60 border border-gray-700 rounded-xl px-5 py-3">
                                <div className="text-2xl font-black text-cyan-400">{successResult.totalFeatures.toLocaleString()}</div>
                                <div className="text-[11px] text-gray-500 uppercase font-bold mt-0.5">Feature hợp lệ</div>
                            </div>
                        </div>
                        <p className="text-[11px] text-gray-500">Tự động đóng sau 4 giây...</p>
                        <button
                            onClick={() => { setSuccessResult(null); onClose(); }}
                            className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-black uppercase tracking-widest"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[650] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-600/20 border border-green-600/40 flex items-center justify-center">
                            <FileJson className="text-green-400" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Import GeoJSON thửa đất</h3>
                            <p className="text-xs text-gray-400">Tạo bảng mới và nạp dữ liệu theo ánh xạ cột.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
                    {error && (
                        <div className="bg-red-900/20 border border-red-700 text-red-300 rounded-lg p-3 text-sm flex items-start gap-2">
                            <AlertTriangle size={16} className="mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-1">Tên bảng mới</label>
                            <input
                                value={tableName}
                                onChange={(e) => setTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-sm text-white font-mono"
                                placeholder="vd: thua_dat_phuong_12"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-1">Tên hiển thị</label>
                            <input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-sm text-white"
                                placeholder="VD: Thửa đất Phường 12"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-1">Hệ tọa độ nguồn (SRID)</label>
                        <select
                            value={sourceSrid}
                            onChange={(e) => setSourceSrid(Number(e.target.value) || 4326)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-sm text-white"
                        >
                            <option value={9210}>EPSG:9210 (VN-2000)</option>
                            <option value={4326}>EPSG:4326 (WGS84)</option>
                            <option value={3857}>EPSG:3857 (Web Mercator)</option>
                        </select>
                        <p className="text-[10px] text-gray-500 mt-1">Hệ thống sẽ giữ nguyên SRID gốc của file, không chuyển đổi tọa độ khi import.</p>
                    </div>

                    <div>
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-1">Mô tả</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-sm text-white h-20"
                            placeholder="Mô tả nguồn dữ liệu hoặc phạm vi khu vực..."
                        />
                    </div>

                    <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 space-y-3">
                        <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest block">File GeoJSON</label>
                        <input
                            type="file"
                            accept=".geojson,.json,application/geo+json,application/json"
                            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                            className="w-full text-sm text-gray-300"
                        />
                        <p className="text-[11px] text-gray-500">Cột nhận diện: {sampleColumnsText}</p>
                        {loading && uploadProgress !== null && (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-cyan-300 font-bold">Tiến trình tải lên</span>
                                    <span className="text-cyan-400 font-mono font-black">{uploadProgress}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-gray-800 overflow-hidden border border-gray-700">
                                    <div
                                        className="h-full bg-cyan-500 transition-all duration-200"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-black uppercase tracking-widest text-cyan-300">Ánh xạ cột từ file sang hệ thống</h4>
                            {availableColumns.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => autoMapColumns(availableColumns)}
                                    className="text-[10px] uppercase font-black px-2 py-1 rounded bg-cyan-600 text-white hover:bg-cyan-500"
                                >
                                    Tự gợi ý
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(Object.keys(FIELD_LABELS) as MappingKey[]).map((key) => (
                                <div key={key}>
                                    <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest block mb-1">{FIELD_LABELS[key]}</label>
                                    <select
                                        value={mapping[key]}
                                        onChange={(e) => setMapping((prev) => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-xs text-white"
                                    >
                                        {key === 'geom' ? <option value="__feature_geometry__">geometry của Feature (mặc định)</option> : <option value="">-- Không chọn --</option>}
                                        {availableColumns.map((col) => (
                                            <option key={col} value={col}>{col}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-green-900/10 border border-green-700/30 rounded-xl p-3 text-[11px] text-green-300 flex items-start gap-2">
                        <CheckCircle2 size={14} className="mt-0.5" />
                        <span>Chức năng này chỉ tạo bảng thửa đất mới và nạp dữ liệu từ GeoJSON Polygon/MultiPolygon.</span>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-700 bg-gray-900/40 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white">Hủy</button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-black uppercase tracking-widest flex items-center gap-2"
                    >
                        <Upload size={16} />
                        {loading ? `Đang import ${uploadProgress ?? 0}%` : 'Import vào CSDL'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ParcelGeoJsonImportModal;
