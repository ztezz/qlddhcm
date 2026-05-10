import React from 'react';
import { MousePointer2, Plus, Move, Maximize, Search, Map as MapIcon, Grid, Keyboard, Magnet, Trash2, Undo2, Redo2, ChevronDown } from 'lucide-react';

interface EditorToolbarProps {
    activeInteraction: 'SELECT' | 'DRAW' | 'MODIFY';
    setActiveInteraction: (val: 'SELECT' | 'DRAW' | 'MODIFY') => void;
    isSnapping: boolean;
    setIsSnapping: (val: boolean) => void;
    showBasemap: boolean;
    setShowBasemap: (val: boolean) => void;
    showGrid: boolean;
    setShowGrid: (val: boolean) => void;
    onFitView: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onOpenSearch: () => void;
    onOpenManual: () => void;
    onClearAll: () => void;
    currentBasemap?: string;
    onChangeBasemap?: (basemap: string) => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
    activeInteraction, setActiveInteraction,
    isSnapping, setIsSnapping,
    showBasemap, setShowBasemap,
    showGrid, setShowGrid,
    onFitView, onUndo, onRedo, canUndo, canRedo, onOpenSearch, onOpenManual, onClearAll,
    currentBasemap = 'google-satellite',
    onChangeBasemap
}) => {
    const [showBasemapMenu, setShowBasemapMenu] = React.useState(false);

    const basemaps = [
        { key: 'google-satellite', name: 'Google Satellite' },
        { key: 'google-roadmap', name: 'Google Roadmap' },
        { key: 'google-terrain', name: 'Google Terrain' },
        { key: 'osm', name: 'OpenStreetMap' },
        { key: 'google-hybrid', name: 'Google Satellite Hybrid' },
        { key: 'esri-satellite', name: 'ESRI Satellite' }
    ];
    return (
        <div className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-6 gap-3 z-20 shadow-2xl">
            <button onClick={() => setActiveInteraction('SELECT')} className={`p-3 rounded-xl transition-all ${activeInteraction === 'SELECT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`} title="Chọn đối tượng (V)"><MousePointer2 size={20}/></button>
            <button onClick={() => setActiveInteraction('DRAW')} className={`p-3 rounded-xl transition-all ${activeInteraction === 'DRAW' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`} title="Vẽ vùng mới (P)"><Plus size={20}/></button>
            <button onClick={() => setActiveInteraction('MODIFY')} className={`p-3 rounded-xl transition-all ${activeInteraction === 'MODIFY' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`} title="Chỉnh sửa đỉnh (M)"><Move size={20}/></button>
            <div className="w-8 h-px bg-slate-800 my-2" />
            <button onClick={onFitView} className="p-3 rounded-xl text-slate-500 hover:bg-slate-800 hover:text-emerald-400" title="Xem toàn bộ hình vẽ (Fit View)"><Maximize size={20}/></button>
            <button disabled={!canUndo} onClick={onUndo} className={`p-3 rounded-xl transition-all ${canUndo ? 'text-slate-400 hover:bg-slate-800 hover:text-amber-300' : 'text-slate-700 cursor-not-allowed'}`} title="Hoàn tác (Ctrl+Z)"><Undo2 size={20}/></button>
            <button disabled={!canRedo} onClick={onRedo} className={`p-3 rounded-xl transition-all ${canRedo ? 'text-slate-400 hover:bg-slate-800 hover:text-amber-300' : 'text-slate-700 cursor-not-allowed'}`} title="Làm lại (Ctrl+Y)"><Redo2 size={20}/></button>
            <button onClick={onOpenSearch} className="p-3 rounded-xl text-slate-500 hover:bg-slate-800 hover:text-blue-400" title="Tìm tọa độ (Go to)"><Search size={20}/></button>
            <div className="w-8 h-px bg-slate-800 my-2" />
            <button onClick={() => setShowBasemap(!showBasemap)} className={`p-3 rounded-xl transition-all relative ${showBasemap ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`} title="Bật/Tắt bản đồ nền vệ tinh"><MapIcon size={20}/></button>
            {showBasemap && (
                <div className="absolute left-20 top-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                    {basemaps.map(bm => (
                        <button
                            key={bm.key}
                            onClick={() => {
                                onChangeBasemap?.(bm.key);
                                setShowBasemapMenu(false);
                            }}
                            className={`block w-full text-left px-4 py-2 text-sm transition-all ${
                                currentBasemap === bm.key
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                            {bm.name}
                        </button>
                    ))}
                </div>
            )}
            <button onClick={() => setShowGrid(!showGrid)} className={`p-3 rounded-xl transition-all ${showGrid ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:bg-slate-800'}`} title="Bật/Tắt Lưới tọa độ"><Grid size={20}/></button>
            <button onClick={onOpenManual} className="p-3 rounded-xl text-slate-500 hover:bg-slate-800 hover:text-blue-400" title="Nhập tọa độ tay"><Keyboard size={20}/></button>
            <button onClick={() => setIsSnapping(!isSnapping)} className={`p-3 rounded-xl transition-all ${isSnapping ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:bg-slate-800'}`} title="Chế độ bắt điểm (Snap)"><Magnet size={20}/></button>
            <button onClick={onClearAll} className="p-3 rounded-xl text-slate-500 hover:bg-red-600/20 hover:text-red-500 mt-auto" title="Xóa toàn bộ"><Trash2 size={20}/></button>
        </div>
    );
};

export default EditorToolbar;