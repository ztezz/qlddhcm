import React from 'react';
import { Navigation, X, CheckCircle2, AlertTriangle, Scissors, Combine, ArrowRight, Check } from 'lucide-react';

interface FeatureInfo {
    sodoto: string;
    sothua: string;
    area: number;
}

interface EditorModalsProps {
    searchModal: {
        isOpen: boolean;
        setOpen: (val: boolean) => void;
        coords: { x: string, y: string };
        setCoords: (val: { x: string, y: string }) => void;
        onGoTo: () => void;
    };
    manualModal: {
        isOpen: boolean;
        setOpen: (val: boolean) => void;
        text: string;
        setText: (val: string) => void;
        onProcess: (text: string) => void;
    };
    dialog: {
        isOpen: boolean;
        type: 'success' | 'error' | 'info';
        title: string;
        message: string;
        onClose: () => void;
    };
    // Split modal
    splitModal: {
        isOpen: boolean;
        onClose: () => void;
        originalFeature: FeatureInfo | null;
        onSplit: (soTo: string, soThuaStart: number) => void;
    };
    // Merge modal
    mergeModal: {
        isOpen: boolean;
        onClose: () => void;
        selectedFeatures: FeatureInfo[];
        onMerge: (soTo: string, soThua: string) => void;
    };
    // Result modal
    splitMergeResultModal: {
        isOpen: boolean;
        type: 'split' | 'merge';
        originalFeatures: FeatureInfo[];
        newFeatures: FeatureInfo[];
        onClose: () => void;
        onConfirm: () => void;
    };
}

const EditorModals: React.FC<EditorModalsProps> = ({ searchModal, manualModal, dialog, splitModal, mergeModal, splitMergeResultModal }) => {
    return (
        <>
            {searchModal.isOpen && (
                <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-[2rem] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2"><Navigation size={20} className="text-blue-500"/> Di chuyển đến điểm</h3>
                            <button onClick={() => searchModal.setOpen(false)} className="text-gray-500 hover:text-white transition-all"><X size={24}/></button>
                        </div>
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">X (VN2000) hoặc Kinh độ</label>
                                <input className="w-full bg-slate-950 border border-gray-700 rounded-2xl p-4 text-white font-mono text-sm outline-none focus:border-blue-500 transition-all" value={searchModal.coords.x} onChange={e => searchModal.setCoords({...searchModal.coords, x: e.target.value})}/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Y (VN2000) hoặc Vĩ độ</label>
                                <input className="w-full bg-slate-950 border border-gray-700 rounded-2xl p-4 text-white font-mono text-sm outline-none focus:border-blue-500 transition-all" value={searchModal.coords.y} onChange={e => searchModal.setCoords({...searchModal.coords, y: e.target.value})}/>
                            </div>
                            <button onClick={searchModal.onGoTo} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95">DI CHUYỂN NGAY</button>
                        </div>
                    </div>
                </div>
            )}

            {manualModal.isOpen && (
                <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Nhập tọa độ thủ công</h3>
                            <button onClick={() => manualModal.setOpen(false)} className="text-gray-500 hover:text-white transition-all"><X size={24}/></button>
                        </div>
                        <div className="space-y-4">
                            <p className="text-[10px] text-gray-400 italic">Hỗ trợ dán tọa độ VN-2000 hoặc WGS84 trực tiếp.</p>
                            <textarea value={manualModal.text} onChange={e => manualModal.setText(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-6 text-sm font-mono text-blue-400 focus:border-blue-500 outline-none h-64 shadow-inner resize-none" placeholder="597937.797, 1229843.202..." />
                            <button onClick={() => manualModal.onProcess(manualModal.text)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all">DỰNG HÌNH</button>
                        </div>
                    </div>
                </div>
            )}
            
            {dialog.isOpen && (
                <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-900 rounded-[2rem] w-full max-sm border border-gray-800 shadow-2xl overflow-hidden p-8 text-center flex flex-col items-center">
                        {dialog.type === 'success' ? <CheckCircle2 size={40} className="text-emerald-500 mb-4"/> : <AlertTriangle size={40} className="text-red-500 mb-4"/>}
                        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">{dialog.title}</h3>
                        <p className="text-gray-400 text-xs leading-relaxed mb-6">{dialog.message}</p>
                        <button onClick={dialog.onClose} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">Đã hiểu</button>
                    </div>
                </div>
            )}

            {/* Split Modal */}
            {splitModal.isOpen && (
                <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-black text-orange-400 uppercase tracking-tighter flex items-center gap-2">
                                <Scissors size={20}/> Tách thửa đất
                            </h3>
                            <button onClick={splitModal.onClose} className="text-gray-500 hover:text-white transition-all"><X size={24}/></button>
                        </div>

                        {splitModal.originalFeature && (
                            <div className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Thửa gốc sẽ bị tách</p>
                                <p className="text-white font-black">
                                    Thửa {splitModal.originalFeature.sothua} / Tờ {splitModal.originalFeature.sodoto}
                                </p>
                                <p className="text-emerald-400 text-sm mt-1">
                                    Diện tích: {Math.round(splitModal.originalFeature.area).toLocaleString()} m²
                                </p>
                            </div>
                        )}

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Số tờ mới</label>
                                <input
                                    id="split-soTo"
                                    className="w-full bg-slate-950 border border-gray-700 rounded-2xl p-4 text-white font-mono text-sm outline-none focus:border-orange-500 transition-all"
                                    defaultValue={splitModal.originalFeature?.sodoto || ''}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Số thửa bắt đầu</label>
                                <input
                                    id="split-soThuaStart"
                                    className="w-full bg-slate-950 border border-gray-700 rounded-2xl p-4 text-white font-mono text-sm outline-none focus:border-orange-500 transition-all"
                                    defaultValue={splitModal.originalFeature ? String(parseInt(splitModal.originalFeature.sothua) + 1) : '1'}
                                />
                            </div>
                            <button
                                onClick={() => {
                                    const soToInput = document.getElementById('split-soTo') as HTMLInputElement;
                                    const soThuaInput = document.getElementById('split-soThuaStart') as HTMLInputElement;
                                    splitModal.onSplit(soToInput?.value || '', parseInt(soThuaInput?.value) || 1);
                                }}
                                className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <Scissors size={16}/> VẼ ĐƯỜNG CẮT
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Merge Modal */}
            {mergeModal.isOpen && (
                <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-black text-violet-400 uppercase tracking-tighter flex items-center gap-2">
                                <Combine size={20}/> Gộp thửa đất
                            </h3>
                            <button onClick={mergeModal.onClose} className="text-gray-500 hover:text-white transition-all"><X size={24}/></button>
                        </div>

                        <div className="mb-6">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">Thửa sẽ gộp ({mergeModal.selectedFeatures.length} thửa)</p>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {mergeModal.selectedFeatures.map((f, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                        <span className="text-white text-sm font-medium">Thửa {f.sothua} / Tờ {f.sodoto}</span>
                                        <span className="text-emerald-400 text-xs">{Math.round(f.area).toLocaleString()} m²</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                                <span className="text-[10px] text-gray-500 uppercase">Tổng diện tích: </span>
                                <span className="text-emerald-400 font-black">
                                    {Math.round(mergeModal.selectedFeatures.reduce((sum, f) => sum + f.area, 0)).toLocaleString()} m²
                                </span>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Số tờ mới</label>
                                    <input
                                        id="merge-soTo"
                                        className="w-full bg-slate-950 border border-gray-700 rounded-2xl p-4 text-white font-mono text-sm outline-none focus:border-violet-500 transition-all"
                                        defaultValue={mergeModal.selectedFeatures[0]?.sodoto || ''}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Số thửa mới</label>
                                    <input
                                        id="merge-soThua"
                                        className="w-full bg-slate-950 border border-gray-700 rounded-2xl p-4 text-white font-mono text-sm outline-none focus:border-violet-500 transition-all"
                                        defaultValue={mergeModal.selectedFeatures[0]?.sothua || '1'}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    const soToInput = document.getElementById('merge-soTo') as HTMLInputElement;
                                    const soThuaInput = document.getElementById('merge-soThua') as HTMLInputElement;
                                    mergeModal.onMerge(soToInput?.value || '', soThuaInput?.value || '1');
                                }}
                                className="w-full bg-violet-600 hover:bg-violet-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <Combine size={16}/> GỘP THỬA
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Split/Merge Result Modal */}
            {splitMergeResultModal.isOpen && (
                <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                            <h3 className="text-xl font-black text-emerald-400 uppercase tracking-tighter flex items-center gap-2">
                                {splitMergeResultModal.type === 'split' ? <Scissors size={20}/> : <Combine size={20}/>}
                                {splitMergeResultModal.type === 'split' ? 'Đã tách thửa' : 'Đã gộp thửa'}
                            </h3>
                            <button onClick={splitMergeResultModal.onClose} className="text-gray-500 hover:text-white transition-all"><X size={24}/></button>
                        </div>

                        <div className="space-y-4 mb-6">
                            {/* Original features removed */}
                            <div className="p-4 bg-red-900/20 rounded-xl border border-red-800/50">
                                <p className="text-[10px] text-red-400 uppercase tracking-widest mb-2">
                                    {splitMergeResultModal.type === 'split' ? 'Thửa gốc bị tách' : 'Thửa gốc bị gộp'}
                                </p>
                                <div className="space-y-1">
                                    {splitMergeResultModal.originalFeatures.map((f, i) => (
                                        <div key={i} className="flex items-center gap-2 text-red-300 text-sm">
                                            <X size={12}/> Thửa {f.sothua} / Tờ {f.sodoto}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Arrow */}
                            <div className="flex justify-center">
                                <ArrowRight size={24} className="text-gray-600"/>
                            </div>

                            {/* New features created */}
                            <div className="p-4 bg-emerald-900/20 rounded-xl border border-emerald-800/50">
                                <p className="text-[10px] text-emerald-400 uppercase tracking-widest mb-2">
                                    {splitMergeResultModal.type === 'split' ? 'Thửa mới được tạo' : 'Thửa mới sau gộp'}
                                </p>
                                <div className="space-y-2">
                                    {splitMergeResultModal.newFeatures.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 bg-emerald-900/30 rounded-lg">
                                            <div className="flex items-center gap-2 text-emerald-300 text-sm">
                                                <Check size={12}/> Thửa {f.sothua} / Tờ {f.sodoto}
                                            </div>
                                            <span className="text-emerald-400 text-xs">{Math.round(f.area).toLocaleString()} m²</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 pt-3 border-t border-emerald-800/50 flex justify-between">
                                    <span className="text-[10px] text-emerald-500 uppercase">Tổng diện tích:</span>
                                    <span className="text-emerald-400 font-black">
                                        {Math.round(splitMergeResultModal.newFeatures.reduce((sum, f) => sum + f.area, 0)).toLocaleString()} m²
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={splitMergeResultModal.onConfirm}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all"
                        >
                            <Check size={16}/> XÁC NHẬN
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default EditorModals;