import React, { useState } from 'react';
import { ClipboardList, Download, Plus, FileDigit, Tag, Save, RefreshCw, Hash, Trash2, FileUp, FileDown, CloudUpload, List, Edit3, AlertCircle, FileJson, Search, History, Sparkles } from 'lucide-react';
import * as proj from 'ol/proj';
import proj4 from 'proj4';
import ParcelHistoryPanel from './ParcelHistoryPanel';
import { UserRole } from '../../types';

interface EditorSidebarProps {
    coordSystem: 'WGS84' | 'VN2000';
    setCoordSystem: (val: 'WGS84' | 'VN2000') => void;
    onExportTxt: () => void;
    onAddVertex: () => void;
    soTo: string;
    setSoTo: (val: string) => void;
    soThua: string;
    setSoThua: (val: string) => void;
    loaiDat: string;
    setLoaiDat: (val: string) => void;
    spatialTables: any[];
    targetTable: string;
    setTargetTable: (val: string) => void;
    onSaveToDB: () => void;
    canSaveToDb: boolean;
    loading: boolean;
    vertices: {x: number, y: number}[];
    onUpdateVertex: (index: number, axis: 'x' | 'y', val: string) => void;
    onDeleteVertex: (index: number) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onExportGeoJSON: () => void;
    onExportShpZip: () => void;
    onExportDXF: () => void;
    onOpenDxfImport: () => void;
    onOpenParcelModal: () => void;
    area: number;
    hasSelected: boolean;

    // New props for dynamic list
    featuresList: { uid: string, soTo: string, soThua: string, area: number, isValid: boolean }[];
    onDeleteFeature: (uid: string) => void;
    onSelectFeature: (uid: string, isMultiSelect?: boolean) => void;
    onSaveFeature: (uid: string) => void;
    selectedFeatureUid: string | null;
    selectedFeatureUids: string[];

    // Batch save props
    onBatchSave: () => void;
    batchProgress: { current: number; total: number; isActive: boolean };
    batchResult: { success: number; failed: number; errors: string[] };

    // Advanced GIS features
    centralMeridian: number;
    setCentralMeridian: (val: number) => void;
    projectionZone: '3' | '6';
    setProjectionZone: (val: '3' | '6') => void;
    showVertexNumbers: boolean;
    setShowVertexNumbers: (val: boolean) => void;
    showSegmentLengths: boolean;
    setShowSegmentLengths: (val: boolean) => void;
    showParcelInfo: boolean;
    setShowParcelInfo: (val: boolean) => void;
    onTopologyCheck: () => void;
    onAiTopologyCheck: () => void;
    aiTopologyLoading?: boolean;

    // Lịch sử biến động
    /** gid của thửa đang chọn trong CSDL (null nếu chưa lưu) */
    selectedGid:     number | null;
    userRole:        UserRole | string;
    /** Callback khi người dùng phục hồi một thửa từ lịch sử */
    onHistoryRestored: (snapshot: Record<string, any>) => void;
}

const EditorSidebar: React.FC<EditorSidebarProps> = (props) => {
    const [activeTab, setActiveTab] = useState<'ATTR' | 'LIST' | 'HISTORY'>('ATTR');

    const progressPercent = props.batchProgress.total > 0
        ? Math.round((props.batchProgress.current / props.batchProgress.total) * 100)
        : 0;
    const soToText = String(props.soTo ?? '');
    const soThuaText = String(props.soThua ?? '');

    return (
        <div className="w-[400px] h-full bg-[#0d1117] border-l border-slate-800 flex flex-col z-20 shadow-2xl">
            {/* Batch Save Progress */}
            {props.batchProgress.isActive && (
                <div className="bg-slate-900 border-b border-amber-500/30 p-4">
                    <div className="text-xs font-semibold text-amber-400 mb-2">Lưu lô: {props.batchProgress.current}/{props.batchProgress.total}</div>
                    <div className="w-full bg-slate-800 rounded h-2 overflow-hidden">
                        <div className="bg-amber-500 h-full transition-all" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    {props.batchResult.success > 0 && <div className="text-xs text-green-400 mt-1">✓ {props.batchResult.success} thành công</div>}
                    {props.batchResult.failed > 0 && <div className="text-xs text-red-400 mt-1">✗ {props.batchResult.failed} thất bại</div>}
                </div>
            )}
            {/* Header Tabs */}
            <div className="flex bg-[#05070a] border-b border-slate-800">
                <button 
                    onClick={() => setActiveTab('ATTR')}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'ATTR' ? 'text-blue-400 border-blue-500 bg-slate-900/50' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                >
                    <Edit3 size={14}/> Biên tập
                </button>
                <button 
                    onClick={() => setActiveTab('LIST')}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'LIST' ? 'text-emerald-400 border-emerald-500 bg-slate-900/50' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                >
                    <List size={14}/> Danh sách ({props.featuresList.length})
                </button>
                <button
                    onClick={() => setActiveTab('HISTORY')}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'HISTORY' ? 'text-purple-400 border-purple-500 bg-slate-900/50' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                    title="Lịch sử biến động thửa đất"
                >
                    <History size={14}/> Lịch sử
                </button>
            </div>

            {/* TAB CONTENT: ATTRIBUTES (Original Editor) */}
            {activeTab === 'ATTR' && (
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    <div className="space-y-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><FileDigit size={12}/> Thông tin định danh</h4>
                            <button
                                onClick={props.onOpenParcelModal}
                                className="flex items-center gap-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border border-emerald-500/20"
                                title="Tra cứu thửa đất từ số tờ/số thửa"
                            >
                                <Search size={10}/> Tra cứu thửa
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Số tờ *</label>
                                <input className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-blue-500 font-black" placeholder="..." value={props.soTo} onChange={e => props.setSoTo(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-gray-500 uppercase ml-1">Số thửa *</label>
                                <input className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-blue-500 font-black" placeholder="..." value={props.soThua} onChange={e => props.setSoThua(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-gray-500 uppercase ml-1 flex items-center gap-1">
                                <Tag size={10}/> Loại đất
                            </label>
                            <select 
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-blue-300 outline-none focus:border-blue-500 font-bold"
                                value={['ODT', 'ONT', 'CLN', 'HNK', 'LUC', 'RSX', 'TMD', 'SKC', 'SON', 'DGT', 'DGD'].includes(props.loaiDat.toUpperCase()) ? props.loaiDat.toUpperCase() : 'CUSTOM'}
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val === 'CUSTOM') {
                                        props.setLoaiDat('');
                                    } else {
                                        props.setLoaiDat(val);
                                    }
                                }}
                            >
                                <option value="" className="text-gray-500">-- Chọn loại đất --</option>
                                <option value="ODT">ODT - Đất ở tại đô thị</option>
                                <option value="ONT">ONT - Đất ở tại nông thôn</option>
                                <option value="CLN">CLN - Đất trồng cây lâu năm</option>
                                <option value="HNK">HNK - Đất trồng cây hàng năm khác</option>
                                <option value="LUC">LUC - Đất chuyên trồng lúa nước</option>
                                <option value="RSX">RSX - Đất rừng sản xuất</option>
                                <option value="TMD">TMD - Đất thương mại, dịch vụ</option>
                                <option value="SKC">SKC - Đất sản xuất phi nông nghiệp</option>
                                <option value="SON">SON - Đất sông, ngòi, kênh, rạch</option>
                                <option value="DGT">DGT - Đất giao thông</option>
                                <option value="DGD">DGD - Đất giáo dục và đào tạo</option>
                                <option value="CUSTOM">Khác (Nhập tay)...</option>
                            </select>
                            
                            {(!['ODT', 'ONT', 'CLN', 'HNK', 'LUC', 'RSX', 'TMD', 'SKC', 'SON', 'DGT', 'DGD'].includes(props.loaiDat.toUpperCase()) || props.loaiDat === '') && (
                                <input 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-blue-300 outline-none focus:border-blue-500 font-bold uppercase mt-2 animate-in fade-in slide-in-from-top-1 duration-200" 
                                    placeholder="Nhập mã loại đất khác..." 
                                    value={props.loaiDat} 
                                    onChange={e => props.setLoaiDat(e.target.value.toUpperCase())} 
                                />
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Lớp đích PostGIS</label>
                        <select className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none" value={props.targetTable} onChange={e => props.setTargetTable(e.target.value)}>
                            {props.spatialTables.map(t => <option key={t.table_name} value={t.table_name}>{t.display_name || t.table_name}</option>)}
                        </select>
                        {props.canSaveToDb && (
                            <div className="flex gap-2">
                                <button
                                    onClick={props.onSaveToDB}
                                    disabled={props.loading || !props.hasSelected || !soToText.trim() || !soThuaText.trim()}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-30 shadow-xl"
                                    title="Lưu thửa được chọn"
                                >
                                    {props.loading ? <RefreshCw className="animate-spin" size={14}/> : <Save size={14}/>} Lưu đơn
                                </button>
                                <button
                                    onClick={props.onBatchSave}
                                    disabled={props.loading || props.featuresList.length === 0}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-30 shadow-xl"
                                    title={`Lưu ${props.featuresList.length} thửa cùng lúc`}
                                >
                                    {props.batchProgress.isActive ? <RefreshCw className="animate-spin" size={14}/> : <Save size={14}/>} Lưu lô ({props.featuresList.length})
                                </button>
                            </div>
                        )}
                    </div>

                    {/* VN-2000 Config & Topology & Label Options */}
                    <div className="space-y-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80">
                        {props.coordSystem === 'VN2000' && (
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">🌐 Cấu hình địa phương (VN-2000)</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-500 uppercase ml-1">Kinh tuyến trục</label>
                                        <select 
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-[10px] font-bold text-white outline-none"
                                            value={props.centralMeridian}
                                            onChange={e => props.setCentralMeridian(parseFloat(e.target.value))}
                                        >
                                            <option value={105.75}>TP.HCM (105.75)</option>
                                            <option value={105.00}>Hà Nội / Cần Thơ (105.00)</option>
                                            <option value={108.00}>Đà Nẵng / Quảng Nam (108.00)</option>
                                            <option value={107.00}>Đồng Nai / Huế (107.00)</option>
                                            <option value={107.75}>Lâm Đồng / Vũng Tàu (107.75)</option>
                                            <option value={105.50}>Hải Dương / Tây Ninh (105.50)</option>
                                            <option value={106.00}>Bắc Giang / Quảng Bình (106.00)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-gray-500 uppercase ml-1">Múi chiếu</label>
                                        <select 
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-[10px] font-bold text-white outline-none"
                                            value={props.projectionZone}
                                            onChange={e => props.setProjectionZone(e.target.value as '3' | '6')}
                                        >
                                            <option value="3">Múi 3° (k=0.9999)</option>
                                            <option value="6">Múi 6° (k=0.9996)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">🏷️ Hiển thị nhãn bản đồ</h4>
                            <div className="grid grid-cols-3 gap-2">
                                <label className="flex items-center gap-1.5 cursor-pointer text-[9px] font-bold text-slate-300 hover:text-white">
                                    <input type="checkbox" checked={props.showVertexNumbers} onChange={e => props.setShowVertexNumbers(e.target.checked)} className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 focus:ring-offset-0"/>
                                    Đỉnh
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-[9px] font-bold text-slate-300 hover:text-white">
                                    <input type="checkbox" checked={props.showSegmentLengths} onChange={e => props.setShowSegmentLengths(e.target.checked)} className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 focus:ring-offset-0"/>
                                    Cạnh
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-[9px] font-bold text-slate-300 hover:text-white">
                                    <input type="checkbox" checked={props.showParcelInfo} onChange={e => props.setShowParcelInfo(e.target.checked)} className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 focus:ring-offset-0"/>
                                    Thông tin
                                </label>
                            </div>
                        </div>

                        <button
                            onClick={props.onTopologyCheck}
                            className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                        >
                            🔍 Kiểm tra chồng lấn ranh giới
                        </button>
                        <button
                            onClick={props.onAiTopologyCheck}
                            disabled={props.aiTopologyLoading || props.featuresList.length === 0}
                            className="w-full bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                        >
                            {props.aiTopologyLoading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            AI kiểm tra dữ liệu / topology
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Hash size={12}/> Danh sách tọa độ ({props.vertices.length})</h4>
                            <div className="flex gap-2 items-center">
                                <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                                    <button onClick={() => props.setCoordSystem('VN2000')} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all ${props.coordSystem === 'VN2000' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>VN2k</button>
                                    <button onClick={() => props.setCoordSystem('WGS84')} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all ${props.coordSystem === 'WGS84' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>WGS84</button>
                                </div>
                                <button onClick={props.onExportTxt} className="p-1 text-indigo-400 hover:text-indigo-300" title="Xuất TXT"><Download size={14}/></button>
                                <button onClick={props.onAddVertex} className="p-1 text-emerald-400 hover:text-emerald-300" title="Thêm đỉnh"><Plus size={14}/></button>
                            </div>
                        </div>
                        
                        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                            <table className="w-full text-[10px] font-mono border-collapse">
                                <thead className="bg-slate-900 text-slate-500">
                                    <tr><th className="p-3 text-center w-8">#</th><th className="p-3 text-left">X (m)</th><th className="p-3 text-left">Y (m)</th><th className="p-3 text-center w-8"></th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 text-slate-400">
                                    {props.vertices.length === 0 ? (
                                        <tr><td colSpan={4} className="p-12 text-center italic text-slate-600 uppercase text-[9px] font-bold">Chọn thửa đất để sửa</td></tr>
                                    ) : props.vertices.map((v, i) => {
                                        let dx, dy;
                                        if (props.coordSystem === 'VN2000') {
                                            const scaleFactor = props.projectionZone === '3' ? 0.9999 : 0.9996;
                                            const vnDef = `+proj=tmerc +lat_0=0 +lon_0=${props.centralMeridian} +k=${scaleFactor} +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.904,-39.303,-111.450,0,0,0,0 +units=m +no_defs`;
                                            const wgs84 = proj.transform([v.x, v.y], 'EPSG:3857', 'EPSG:4326');
                                            const p = proj4('EPSG:4326', vnDef, wgs84);
                                            dx = p[0]; dy = p[1];
                                        } else {
                                            const p = proj.transform([v.x, v.y], 'EPSG:3857', 'EPSG:4326'); dx = p[0]; dy = p[1];
                                        }
                                        return (
                                            <tr key={i} className="hover:bg-slate-900/50 transition-colors group">
                                                <td className="p-3 text-center text-slate-600 font-bold">{i + 1}</td>
                                                <td className="p-1"><input type="text" value={dx.toFixed(props.coordSystem === 'VN2000' ? 3 : 8)} onChange={(e) => props.onUpdateVertex(i, 'x', e.target.value)} className="w-full bg-transparent border-none px-2 py-1 text-blue-400 font-bold outline-none"/></td>
                                                <td className="p-1"><input type="text" value={dy.toFixed(props.coordSystem === 'VN2000' ? 3 : 8)} onChange={(e) => props.onUpdateVertex(i, 'y', e.target.value)} className="w-full bg-transparent border-none px-2 py-1 text-emerald-400 font-bold outline-none"/></td>
                                                <td className="p-1 text-center"><button onClick={() => props.onDeleteVertex(i)} className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12}/></button></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <label className="flex flex-col items-center justify-center p-4 bg-slate-800/30 hover:bg-slate-800 rounded-2xl border border-slate-800 cursor-pointer transition-all">
                            <FileUp size={20} className="text-slate-500 mb-2" />
                            <span className="text-[9px] font-black uppercase text-slate-500">Import GeoJSON</span>
                            <input type="file" className="hidden" accept=".geojson,.json" onChange={props.onFileUpload} />
                        </label>
                        <button onClick={props.onOpenDxfImport} className="flex flex-col items-center justify-center p-4 bg-slate-800/30 hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all">
                            <FileJson size={20} className="text-slate-500 mb-2" />
                            <span className="text-[9px] font-black uppercase text-slate-500">Import DXF</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <button onClick={props.onExportGeoJSON} disabled={props.vertices.length === 0} className="flex flex-col items-center justify-center p-4 bg-slate-800/30 hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all disabled:opacity-30">
                            <FileDown size={20} className="text-slate-500 mb-2" />
                            <span className="text-[9px] font-black uppercase text-slate-500">Export JSON</span>
                        </button>
                        <button onClick={props.onExportShpZip} disabled={props.vertices.length === 0} className="flex flex-col items-center justify-center p-4 bg-slate-800/30 hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all disabled:opacity-30">
                            <Download size={20} className="text-slate-500 mb-2" />
                            <span className="text-[9px] font-black uppercase text-slate-500">Export SHP</span>
                        </button>
                        <button onClick={props.onExportDXF} disabled={props.vertices.length === 0} className="flex flex-col items-center justify-center p-4 bg-slate-800/30 hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all disabled:opacity-30">
                            <FileJson size={20} className="text-slate-500 mb-2" />
                            <span className="text-[9px] font-black uppercase text-slate-500">Export DXF</span>
                        </button>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: LIST */}
            {activeTab === 'LIST' && (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {props.featuresList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-600 gap-4">
                            <div className="p-4 rounded-full bg-slate-900 border border-slate-800 border-dashed">
                                <List size={32} />
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest">Danh sách trống</p>
                                <p className="text-[9px] font-medium">Hãy vẽ hoặc Import thửa đất</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {props.featuresList.map((f, idx) => (
                                <div 
                                    key={f.uid} 
                                    onClick={(e) => {
                                        const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
                                        props.onSelectFeature(f.uid, isMulti);
                                        if (!isMulti) setActiveTab('ATTR');
                                    }}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer group flex items-center gap-3 relative ${props.selectedFeatureUids.includes(f.uid) ? 'bg-blue-900/10 border-blue-600 shadow-lg' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center border border-slate-800 shrink-0 font-mono text-[10px] text-gray-500 font-bold">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-black truncate ${f.isValid ? 'text-white' : 'text-orange-400'}`}>
                                                {f.isValid ? `Thửa ${f.soThua} / Tờ ${f.soTo}` : 'Chưa định danh'}
                                            </span>
                                            {!f.isValid && <AlertCircle size={10} className="text-orange-500"/>}
                                        </div>
                                        <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                                            Diện tích: <span className="text-emerald-500 font-bold">{Math.round(f.area).toLocaleString()} m²</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                        {props.canSaveToDb && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); props.onSaveFeature(f.uid); }}
                                                disabled={props.loading}
                                                className="p-2 text-slate-500 hover:text-white hover:bg-blue-600 rounded-lg transition-all"
                                                title="Upload lên Database"
                                            >
                                                <CloudUpload size={14}/>
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); props.onDeleteFeature(f.uid); }}
                                            className="p-2 text-slate-500 hover:text-white hover:bg-red-600 rounded-lg transition-all"
                                            title="Xóa thửa đất"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: HISTORY */}
            {activeTab === 'HISTORY' && (
                <div className="flex-1 overflow-hidden flex flex-col">
                    <ParcelHistoryPanel
                        parcelGid={props.selectedGid}
                        tableName={props.targetTable}
                        soTo={props.soTo}
                        soThua={props.soThua}
                        userRole={props.userRole}
                        onRestored={props.onHistoryRestored}
                    />
                </div>
            )}
        </div>
    );
};

export default EditorSidebar;
