
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { X, Save, RefreshCw, Edit, Plus, FileUp, MapPin, Calculator, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ParcelDTO } from '../../../services/parcelApi';
import shp from 'shpjs';
import { getArea } from 'ol/sphere';
import GeoJSON from 'ol/format/GeoJSON';
import { Polygon, MultiPolygon } from 'ol/geom';

interface ParcelFormProps {
    isOpen: boolean;
    onClose: () => void;
    editingId: number | null;
    formData: ParcelDTO;
    setFormData: (val: any) => void;
    handleSubmit: (e: React.FormEvent) => void;
    loading: boolean;
}

const ParcelForm: React.FC<ParcelFormProps> = ({ 
    isOpen, onClose, editingId, formData, setFormData, handleSubmit, loading 
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);

    // Hàm vẽ xem trước hình học
    const drawPreview = useCallback(() => {
        if (!canvasRef.current || !formData.geometry) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let rawCoords: any[] = [];
        if (formData.geometry.type === 'Polygon') {
            rawCoords = formData.geometry.coordinates[0];
        } else if (formData.geometry.type === 'MultiPolygon') {
            rawCoords = formData.geometry.coordinates[0][0];
        }

        if (!rawCoords || rawCoords.length === 0) return;

        // Làm sạch dữ liệu tọa độ (loại bỏ điểm trùng cuối nếu có)
        const points = rawCoords.map(c => ({ x: c[0], y: c[1] }));
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const rangeX = maxX - minX || 0.000001;
        const rangeY = maxY - minY || 0.000001;
        
        const padding = 30;
        const scale = Math.min((canvas.width - padding * 2) / rangeX, (canvas.height - padding * 2) / rangeY);
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Vẽ lưới mờ trang trí
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 0.5;
        for(let i=0; i<canvas.width; i+=20) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
        for(let i=0; i<canvas.height; i+=20) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }

        const tx = (x: number) => (canvas.width / 2) + (x - centerX) * scale;
        const ty = (y: number) => (canvas.height / 2) - (y - centerY) * scale;

        // Vẽ vùng thửa đất
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#3b82f6';
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        
        points.forEach((pt, i) => {
            const px = tx(pt.x);
            const py = ty(pt.y);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Vẽ các đỉnh (Nodes)
        points.forEach((pt) => {
            ctx.beginPath();
            ctx.arc(tx(pt.x), ty(pt.y), 3, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = '#3b82f6';
            ctx.stroke();
        });
    }, [formData.geometry]);

    useEffect(() => {
        if (isOpen && formData.geometry) {
            drawPreview();
        }
    }, [isOpen, formData.geometry, drawPreview]);

    // Xử lý nạp file (Hỗ trợ ZIP-SHP và GeoJSON)
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsParsing(true);
        setParseError(null);

        try {
            const reader = new FileReader();
            
            if (file.name.toLowerCase().endsWith('.zip')) {
                // Xử lý Shapefile trong file Zip
                reader.onload = async (event) => {
                    try {
                        const buffer = event.target?.result as ArrayBuffer;
                        const geojson: any = await shp(buffer);
                        
                        let geometry = null;
                        let properties = {};

                        // shpjs có thể trả về 1 FeatureCollection hoặc mảng các FeatureCollection
                        const collection = Array.isArray(geojson) ? geojson[0] : geojson;
                        if (collection.features && collection.features.length > 0) {
                            const feature = collection.features[0];
                            geometry = feature.geometry;
                            properties = feature.properties;
                        }

                        if (geometry) {
                            processExtractedData(geometry, properties, file);
                        } else {
                            throw new Error("Không tìm thấy dữ liệu bản đồ trong file Zip.");
                        }
                    } catch (err: any) {
                        setParseError(err.message || "Lỗi giải mã Shapefile.");
                    } finally {
                        setIsParsing(false);
                    }
                };
                reader.readAsArrayBuffer(file);
            } else {
                // Xử lý GeoJSON / JSON
                reader.onload = (event) => {
                    try {
                        const content = JSON.parse(event.target?.result as string);
                        let geometry = null;
                        let properties = {};

                        if (content.type === 'FeatureCollection') {
                            geometry = content.features[0]?.geometry;
                            properties = content.features[0]?.properties;
                        } else if (content.type === 'Feature') {
                            geometry = content.geometry;
                            properties = content.properties;
                        } else {
                            geometry = content;
                        }

                        if (geometry) {
                            processExtractedData(geometry, properties, file);
                        } else {
                            throw new Error("Định dạng dữ liệu không hợp lệ.");
                        }
                    } catch (err: any) {
                        setParseError("File JSON không đúng định dạng GeoJSON.");
                    } finally {
                        setIsParsing(false);
                    }
                };
                reader.readAsText(file);
            }
        } catch (err) {
            setParseError("Lỗi hệ thống khi đọc file.");
            setIsParsing(false);
        }
    };

    // Hàm trích xuất thông tin từ hình học (Diện tích, Thuộc tính)
    const processExtractedData = (geometry: any, props: any, file: File) => {
        // 1. Tính diện tích tự động
        const format = new GeoJSON();
        const olGeom = format.readGeometry(geometry);
        let area = 0;
        
        // Tính diện tích dựa trên tọa độ mặt cầu (Geodesic) để có kết quả m2 chính xác nhất
        if (olGeom instanceof Polygon || olGeom instanceof MultiPolygon) {
            area = getArea(olGeom);
        }

        // 2. Map các thuộc tính phổ biến từ file nếu có
        const findVal = (keys: string[]) => {
            for (const k of keys) {
                const foundKey = Object.keys(props).find(pk => pk.toLowerCase() === k.toLowerCase());
                if (foundKey && props[foundKey]) return props[foundKey];
            }
            return null;
        };

        const extractedParcelCode = findVal(['madinhdanh', 'ma_dinh_danh', 'ma_thua', 'parcel_code', 'parcel_id', 'land_id', 'identifier']);
        const extractedSoTo = findVal(['sodoto', 'so_to', 'shbando', 'map_sheet', 'tobando']);
        const extractedSoThua = findVal(['sothua', 'so_thua', 'shthua', 'parcel_no', 'shparcel']);
        const extractedOwner = findVal(['tenchu', 'ten_chu', 'chu_so_huu', 'owner']);
        const extractedLoaiDat = findVal(['loaidat', 'kyhieumucd', 'mucdich', 'mdsd']);
        const extractedDiaChi = findVal(['diachi', 'dia_chi', 'address', 'location']);

        setFormData({
            ...formData,
            madinhdanh: extractedParcelCode ? extractedParcelCode.toString() : formData.madinhdanh,
            geometry: geometry,
            dientich: area > 0 ? Math.round(area * 100) / 100 : formData.dientich,
            sodoto: extractedSoTo ? extractedSoTo.toString() : formData.sodoto,
            sothua: extractedSoThua ? extractedSoThua.toString() : formData.sothua,
            tenchu: extractedOwner || formData.tenchu,
            loaidat: extractedLoaiDat || formData.loaidat,
            diachi: extractedDiaChi || formData.diachi,
            file: file
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
                {/* CỘT TRÁI: FORM NHẬP LIỆU */}
                <div className="flex-1 p-8 overflow-y-auto max-h-[90vh] custom-scrollbar">
                    <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-2xl ${editingId ? 'bg-orange-500/20 text-orange-500' : 'bg-blue-500/20 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'}`}>
                                {editingId ? <Edit size={28} /> : <Plus size={28} />}
                            </div>
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight text-white leading-none mb-1">
                                    {editingId ? "Cập nhật dữ liệu" : "Đăng ký thửa đất mới"}
                                </h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">PostGIS Spatial Engine</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-all"><X size={28}/></button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Mã định danh</label>
                            <input className="w-full bg-gray-950 border border-amber-500/20 rounded-2xl p-4 text-sm outline-none font-mono font-black text-amber-300 transition-all shadow-inner disabled:opacity-100" placeholder="Sẽ tự sinh sau khi lưu" value={formData.madinhdanh || ''} readOnly disabled />
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Số tờ bản đồ *</label>
                                <input className="w-full bg-gray-950 border border-gray-700 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none font-bold text-white transition-all shadow-inner" placeholder="VD: 12" value={formData.sodoto} onChange={e=>setFormData({...formData, sodoto: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Số thứ tự thửa *</label>
                                <input className="w-full bg-gray-950 border border-gray-700 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none font-bold text-white transition-all shadow-inner" placeholder="VD: 450" value={formData.sothua} onChange={e=>setFormData({...formData, sothua: e.target.value})} required />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Chủ sở hữu / Người sử dụng</label>
                            <input className="w-full bg-gray-950 border border-gray-700 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none font-bold text-white transition-all shadow-inner" placeholder="Nhập tên chủ hộ..." value={formData.tenchu||''} onChange={e=>setFormData({...formData, tenchu: e.target.value})} />
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Mục đích (Loại đất)</label>
                                <input className="w-full bg-gray-950 border border-gray-700 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none font-black uppercase text-blue-400 transition-all shadow-inner" placeholder="VD: ODT, LNK..." value={formData.loaidat||''} onChange={e=>setFormData({...formData, loaidat: e.target.value.toUpperCase()})} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                    <Calculator size={12}/> Diện tích (m²)
                                </label>
                                <div className="relative">
                                    <input type="number" step="0.01" className="w-full bg-gray-950 border border-gray-700 rounded-2xl p-4 text-sm focus:border-orange-500 outline-none font-mono font-bold text-emerald-500 transition-all shadow-inner" placeholder="0.00" value={formData.dientich||''} onChange={e=>setFormData({...formData, dientich: parseFloat(e.target.value)})} />
                                    {formData.geometry && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-emerald-600 uppercase bg-emerald-900/20 px-2 py-1 rounded">Tự động</span>}
                                </div>
                            </div>
                        </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Địa chỉ chi tiết</label>
                                <textarea className="w-full bg-gray-950 border border-gray-700 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none h-24 resize-none text-white transition-all shadow-inner" placeholder="Phường/Xã, Quận/Huyện..." value={formData.diachi||''} onChange={e=>setFormData({...formData, diachi: e.target.value})} />
                            </div>

                        <div className="pt-6 flex gap-4">
                            <button type="button" onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all">HỦY BỎ</button>
                            <button type="submit" disabled={loading} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex justify-center items-center gap-2 shadow-xl shadow-blue-900/30 active:scale-95 disabled:opacity-50 transition-all">
                                {loading ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>} LƯU DỮ LIỆU
                            </button>
                        </div>
                    </form>
                </div>

                {/* CỘT PHẢI: XỬ LÝ FILE & PREVIEW */}
                <div className="w-full md:w-[400px] bg-gray-950 border-l border-gray-800 p-8 flex flex-col">
                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 text-center">Bản đồ & Tệp tin</h4>
                    
                    {/* KHU VỰC CANVAS XEM TRƯỚC */}
                    <div className="flex-1 bg-gray-900 rounded-[2rem] border border-gray-800 relative flex items-center justify-center overflow-hidden shadow-inner group">
                        {isParsing ? (
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="animate-spin text-blue-500" size={40} />
                                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Đang giải mã file...</p>
                            </div>
                        ) : formData.geometry ? (
                            <>
                                <canvas ref={canvasRef} width={340} height={340} className="w-full h-full cursor-crosshair transition-transform group-hover:scale-105" />
                                <div className="absolute top-4 right-4 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 animate-in fade-in duration-500">
                                    <CheckCircle2 size={12} className="text-emerald-500" />
                                    <span className="text-[9px] font-black text-emerald-500 uppercase">Hình học OK</span>
                                </div>
                            </>
                        ) : (
                            <div className="text-center p-8 flex flex-col items-center gap-4 opacity-30 group-hover:opacity-50 transition-opacity">
                                <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center border-2 border-gray-700 border-dashed">
                                    <MapPin size={32} className="text-gray-600" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[11px] text-gray-400 font-black uppercase tracking-tighter">Chưa có dữ liệu</p>
                                    <p className="text-[9px] text-gray-600 font-bold uppercase">Vui lòng tải file để xem sơ đồ</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* KHU VỰC TẢI FILE */}
                    <div className="mt-8 space-y-4">
                        {parseError && (
                            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-start gap-3 animate-in shake duration-300">
                                <AlertCircle className="text-red-500 shrink-0" size={16} />
                                <p className="text-[10px] text-red-400 font-bold leading-tight">{parseError}</p>
                            </div>
                        )}

                        <div 
                            className={`p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer group flex flex-col items-center gap-3 ${formData.file ? 'border-blue-500/50 bg-blue-500/5' : 'border-gray-800 hover:border-blue-500/50 hover:bg-gray-900'}`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className={`p-3 rounded-xl transition-colors ${formData.file ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 group-hover:text-blue-400'}`}>
                                <FileUp size={24} />
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] text-white font-black uppercase tracking-widest mb-1">
                                    {formData.file ? "Thay đổi tệp tin" : "Tải lên bản vẽ"}
                                </p>
                                <p className="text-[9px] text-gray-500 font-bold uppercase">
                                    Hỗ trợ: .ZIP (SHP) | .GEOJSON | .JSON
                                </p>
                            </div>
                            
                            {formData.file && (
                                <div className="mt-2 px-3 py-1 bg-gray-900 rounded-lg border border-gray-700 flex items-center gap-2">
                                    <span className="text-[9px] font-mono text-blue-400 truncate max-w-[200px]">{formData.file.name}</span>
                                    <span className="text-[8px] text-gray-600">({(formData.file.size / 1024).toFixed(1)} KB)</span>
                                </div>
                            )}

                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept=".zip,.geojson,.json,application/json,application/x-zip-compressed" 
                                onChange={handleFileChange} 
                            />
                        </div>
                    </div>
                    
                    <p className="mt-6 text-[9px] text-gray-600 font-bold uppercase tracking-widest text-center leading-relaxed">
                        Dữ liệu không gian được xử lý theo <br/> hệ tọa độ VN-2000 / WGS84
                    </p>
                </div>
            </div>
        </div>
    );
};

const Loader2 = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);

export default ParcelForm;
