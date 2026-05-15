
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, FileDown, FileArchive, FileJson } from 'lucide-react';
import { ParcelExportFormat } from '../../../utils/parcelExport';

interface QuickViewProps {
    parcel: any;
    onClose: () => void;
    onDownload: (p: any, format: ParcelExportFormat) => void;
    getFieldValue: (obj: any, aliases: string[]) => any;
}

const QuickView: React.FC<QuickViewProps> = ({ parcel, onClose, onDownload, getFieldValue }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [viewState, setViewState] = useState({ scale: 1, offset: { x: 0, y: 0 } });
    const isDragging = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const getLandType = (p: any) => getFieldValue(p, ['loaidat', 'kyhieumucd', 'mucdich']) || 'N/A';
    const getOwner = (p: any) => getFieldValue(p, ['tenchu', 'owner']) || '--';
    const getAreaVal = (p: any) => parseFloat(getFieldValue(p, ['dientich', 'dien_tich', 'area']) || 0);
    const getSheetNo = (p: any) => getFieldValue(p, ['sodoto', 'so_to', 'shbando']) || '--';
    const getParcelNo = (p: any) => getFieldValue(p, ['sothua', 'so_thua', 'shthua']) || '--';

    const drawParcel = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
        if (!parcel?.geometry) return;

        let rawCoords: any[] = [];
        if (parcel.geometry.type === 'Polygon') rawCoords = parcel.geometry.coordinates[0];
        else if (parcel.geometry.type === 'MultiPolygon') rawCoords = parcel.geometry.coordinates[0][0];

        if (rawCoords.length === 0) return;

        const points = rawCoords.map((c: any, i: number) => ({ id: i + 1, x: c[0], y: c[1] }));
        if (points.length > 1 && points[0].x === points[points.length-1].x && points[0].y === points[points.length-1].y) {
            points.pop();
        }

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const rangeX = maxX - minX || 0.000001;
        const rangeY = maxY - minY || 0.000001;
        
        const padding = 40;
        const baseScale = Math.min((canvas.width - padding * 2) / rangeX, (canvas.height - padding * 2) / rangeY);
        const currentScale = baseScale * viewState.scale;
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const tx = (x: number) => (canvas.width / 2) + (x - midX) * currentScale + viewState.offset.x;
        const ty = (y: number) => (canvas.height / 2) - (y - midY) * currentScale + viewState.offset.y;

        // Grid trang trí
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
        ctx.lineWidth = 0.5;
        const step = 50 * viewState.scale;
        for(let i = viewState.offset.x % step; i < canvas.width; i += step) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        }
        for(let i = viewState.offset.y % step; i < canvas.height; i += step) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
        }

        // Draw Polygon
        ctx.beginPath();
        ctx.lineWidth = 3 / Math.sqrt(viewState.scale); 
        ctx.strokeStyle = '#3b82f6';
        ctx.lineJoin = 'round';
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        points.forEach((pt, idx) => {
            const px = tx(pt.x), py = ty(pt.y);
            if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw Nodes
        if (viewState.scale > 0.3) {
            points.forEach((pt) => {
                const px = tx(pt.x), py = ty(pt.y);
                ctx.beginPath();
                ctx.arc(px, py, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.fill();
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.font = `bold ${Math.max(8, 10 * viewState.scale)}px sans-serif`;
                ctx.fillStyle = '#94a3b8';
                ctx.fillText(pt.id.toString(), px + 8, py + 4);
            });
        }
    }, [parcel, viewState]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) drawParcel(ctx, canvas);
    }, [drawParcel]);

    const handleWheel = (e: React.WheelEvent) => {
        const zoomSpeed = 0.1;
        const delta = e.deltaY > 0 ? 1 - zoomSpeed : 1 + zoomSpeed;
        setViewState(prev => ({ ...prev, scale: Math.min(Math.max(prev.scale * delta, 0.1), 20) }));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        setViewState(prev => ({ ...prev, offset: { x: prev.offset.x + dx, y: prev.offset.y + dy } }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    return (
        <div className="fixed inset-0 z-[1100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
            <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] w-full max-w-3xl shadow-[0_0_100px_rgba(59,130,246,0.2)] overflow-hidden relative">
                <button onClick={onClose} className="absolute top-6 right-6 z-20 bg-gray-800/80 hover:bg-red-600 text-white p-3 rounded-full transition-all shadow-lg"><X size={24}/></button>
                <div className="flex flex-col md:flex-row h-full">
                    <div className="flex-1 bg-gray-950 p-6 relative group">
                        <div className="absolute top-8 left-8 z-10 pointer-events-none">
                            <h3 className="text-2xl font-black text-white tracking-tighter">THỬA {getParcelNo(parcel)} - TỜ {getSheetNo(parcel)}</h3>
                            <p className="text-[9px] text-gray-500 font-bold uppercase mt-1 italic">Dùng chuột để Zoom & Di chuyển</p>
                        </div>
                        <div className="absolute bottom-8 left-8 flex flex-col gap-2 z-10 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setViewState(p => ({ ...p, scale: Math.min(p.scale * 1.2, 20) }))} className="p-3 bg-gray-800 hover:bg-blue-600 rounded-xl text-white shadow-xl transition-all"><ZoomIn size={20}/></button>
                            <button onClick={() => setViewState(p => ({ ...p, scale: Math.max(p.scale / 1.2, 0.1) }))} className="p-3 bg-gray-800 hover:bg-blue-600 rounded-xl text-white shadow-xl transition-all"><ZoomOut size={20}/></button>
                            <button onClick={() => setViewState({ scale: 1, offset: { x: 0, y: 0 } })} className="p-3 bg-gray-800 hover:bg-orange-600 rounded-xl text-white shadow-xl transition-all"><RotateCcw size={20}/></button>
                        </div>
                        <div className="flex items-center justify-center h-[500px] cursor-move overflow-hidden">
                            <canvas 
                                ref={canvasRef} width={600} height={500} className="w-full h-full" 
                                onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} 
                                onMouseUp={() => isDragging.current = false} onMouseLeave={() => isDragging.current = false} 
                            />
                        </div>
                    </div>
                    <div className="w-full md:w-64 bg-gray-900 border-l border-gray-800 p-8 flex flex-col justify-center gap-6">
                        <div><p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Mục đích SD</p><p className="text-xl font-black text-blue-400">{getLandType(parcel)}</p></div>
                        <div><p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Diện tích</p><p className="text-2xl font-black text-emerald-500">{Math.round(getAreaVal(parcel)).toLocaleString()} m²</p></div>
                        <div><p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Chủ sở hữu</p><p className="text-sm font-bold text-gray-200">{getOwner(parcel)}</p></div>
                        <div className="flex flex-col gap-2 pt-4">
                            <button onClick={() => onDownload(parcel, 'geojson')} className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-500 transition-all flex items-center justify-center gap-2"><FileDown size={14}/> Tải GeoJSON</button>
                            <button onClick={() => onDownload(parcel, 'shp')} className="w-full bg-violet-600 text-white py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-violet-500 transition-all flex items-center justify-center gap-2"><FileArchive size={14}/> Tải SHP</button>
                            <button onClick={() => onDownload(parcel, 'dxf')} className="w-full bg-cyan-600 text-white py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-cyan-500 transition-all flex items-center justify-center gap-2"><FileJson size={14}/> Tải DXF</button>
                            <button onClick={onClose} className="w-full bg-white text-black py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-400 hover:text-white transition-all">Đóng xem</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuickView;
