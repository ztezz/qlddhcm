import React from 'react';
import { MousePointer2, Plus, Move, Maximize, Search, Map as MapIcon, Grid, Keyboard, Magnet, Trash2, Undo2, Redo2, ChevronDown, Scissors, Combine, X, SquareDashedMousePointer } from 'lucide-react';

interface EditorToolbarProps {
    activeInteraction: 'SELECT' | 'AREA_SELECT' | 'DRAW' | 'MODIFY';
    setActiveInteraction: (val: 'SELECT' | 'AREA_SELECT' | 'DRAW' | 'MODIFY') => void;
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
    onClearSelection: () => void;
    onClearAll: () => void;
    currentBasemap?: string;
    onChangeBasemap?: (basemap: string) => void;
    // Split/Merge props
    onSplitFeature: () => void;
    onMergeFeatures: () => void;
    canSplit: boolean;
    canMerge: boolean;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
    activeInteraction, setActiveInteraction,
    isSnapping, setIsSnapping,
    showBasemap, setShowBasemap,
    showGrid, setShowGrid,
    onFitView, onUndo, onRedo, canUndo, canRedo, onOpenSearch, onOpenManual, onClearSelection, onClearAll,
    currentBasemap = 'google-satellite',
    onChangeBasemap,
    onSplitFeature, onMergeFeatures, canSplit, canMerge
}) => {
    const [openGroup, setOpenGroup] = React.useState<'edit' | 'parcel' | 'view' | 'tools' | null>('edit');

    const basemaps = [
        { key: 'google-satellite', name: 'Google Satellite' },
        { key: 'google-roadmap', name: 'Google Roadmap' },
        { key: 'google-terrain', name: 'Google Terrain' },
        { key: 'osm', name: 'OpenStreetMap' },
        { key: 'google-hybrid', name: 'Google Satellite Hybrid' },
        { key: 'esri-satellite', name: 'ESRI Satellite' }
    ];

    const buttonBase = 'p-3 rounded-xl transition-all flex items-center justify-center';
    const groupButtonBase = 'w-11 h-11 rounded-xl transition-all flex items-center justify-center relative';

    const ToolbarButton = ({
        children,
        onClick,
        disabled,
        className,
        title
    }: {
        children: React.ReactNode;
        onClick: () => void;
        disabled?: boolean;
        className: string;
        title: string;
    }) => (
        <button onClick={onClick} disabled={disabled} className={`${buttonBase} ${className}`} title={title}>
            {children}
        </button>
    );

    const ToolbarGroup = ({
        id,
        icon,
        title,
        children,
        accentClass = 'text-slate-400'
    }: {
        id: 'edit' | 'parcel' | 'view' | 'tools';
        icon: React.ReactNode;
        title: string;
        children: React.ReactNode;
        accentClass?: string;
    }) => {
        const isOpen = openGroup === id;
        return (
            <div className="relative">
                <button
                    onClick={() => setOpenGroup(isOpen ? null : id)}
                    className={`${groupButtonBase} ${isOpen ? 'bg-slate-800 text-white shadow-lg' : `${accentClass} hover:bg-slate-800`}`}
                    title={title}
                >
                    {icon}
                    <ChevronDown size={12} className={`absolute -bottom-0.5 right-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="absolute left-full top-0 z-[1000] ml-2 flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-md">
                        {children}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-16 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 gap-3 z-50 shadow-2xl overflow-visible">
            <ToolbarGroup id="edit" icon={<MousePointer2 size={20}/>} title="Vẽ / chỉnh sửa" accentClass="text-blue-400">
                <ToolbarButton onClick={() => setActiveInteraction('SELECT')} className={activeInteraction === 'SELECT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'} title="Chọn đối tượng (V)"><MousePointer2 size={20}/></ToolbarButton>
                <ToolbarButton onClick={() => setActiveInteraction('AREA_SELECT')} className={activeInteraction === 'AREA_SELECT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'} title="Chọn theo vùng (kéo chuột)"><SquareDashedMousePointer size={20}/></ToolbarButton>
                <ToolbarButton onClick={() => setActiveInteraction('DRAW')} className={activeInteraction === 'DRAW' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'} title="Vẽ vùng mới (P)"><Plus size={20}/></ToolbarButton>
                <ToolbarButton onClick={() => setActiveInteraction('MODIFY')} className={activeInteraction === 'MODIFY' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'} title="Chỉnh sửa đỉnh (M)"><Move size={20}/></ToolbarButton>
            </ToolbarGroup>

            <ToolbarGroup id="parcel" icon={<Scissors size={20}/>} title="Tách / gộp thửa" accentClass="text-orange-400">
                <ToolbarButton onClick={onSplitFeature} disabled={!canSplit} className={canSplit ? 'text-orange-400 hover:bg-orange-600/20' : 'text-slate-700 cursor-not-allowed'} title="Tách thửa - Cắt thửa đất thành nhiều phần"><Scissors size={20}/></ToolbarButton>
                <ToolbarButton onClick={onMergeFeatures} disabled={!canMerge} className={canMerge ? 'text-violet-400 hover:bg-violet-600/20' : 'text-slate-700 cursor-not-allowed'} title="Gộp thửa - Ghép nhiều thửa thành một"><Combine size={20}/></ToolbarButton>
            </ToolbarGroup>

            <ToolbarGroup id="view" icon={<MapIcon size={20}/>} title="Bản đồ / hiển thị" accentClass="text-indigo-400">
                <ToolbarButton onClick={onFitView} className="text-slate-500 hover:bg-slate-800 hover:text-emerald-400" title="Xem toàn bộ hình vẽ (Fit View)"><Maximize size={20}/></ToolbarButton>
                <ToolbarButton onClick={() => setShowBasemap(!showBasemap)} className={showBasemap ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'} title="Bật/Tắt bản đồ nền vệ tinh"><MapIcon size={20}/></ToolbarButton>
                {showBasemap && (
                    <div className="w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
                        {basemaps.map((bm) => (
                            <button
                                key={bm.key}
                                onClick={() => onChangeBasemap?.(bm.key)}
                                className={`block w-full text-left px-3 py-2 text-xs transition-all ${currentBasemap === bm.key ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                            >
                                {bm.name}
                            </button>
                        ))}
                    </div>
                )}
                <ToolbarButton onClick={() => setShowGrid(!showGrid)} className={showGrid ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:bg-slate-800'} title="Bật/Tắt Lưới tọa độ"><Grid size={20}/></ToolbarButton>
            </ToolbarGroup>

            <ToolbarGroup id="tools" icon={<Keyboard size={20}/>} title="Công cụ khác" accentClass="text-emerald-400">
                <ToolbarButton onClick={onOpenSearch} className="text-slate-500 hover:bg-slate-800 hover:text-blue-400" title="Tìm tọa độ (Go to)"><Search size={20}/></ToolbarButton>
                <ToolbarButton onClick={onOpenManual} className="text-slate-500 hover:bg-slate-800 hover:text-blue-400" title="Nhập tọa độ tay"><Keyboard size={20}/></ToolbarButton>
                <ToolbarButton onClick={onClearSelection} className="text-slate-500 hover:bg-slate-800 hover:text-rose-300" title="Hủy chọn"><X size={20}/></ToolbarButton>
                <ToolbarButton onClick={() => setIsSnapping(!isSnapping)} className={isSnapping ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:bg-slate-800'} title="Chế độ bắt điểm (Snap)"><Magnet size={20}/></ToolbarButton>
                <ToolbarButton disabled={!canUndo} onClick={onUndo} className={canUndo ? 'text-slate-400 hover:bg-slate-800 hover:text-amber-300' : 'text-slate-700 cursor-not-allowed'} title="Hoàn tác (Ctrl+Z)"><Undo2 size={20}/></ToolbarButton>
                <ToolbarButton disabled={!canRedo} onClick={onRedo} className={canRedo ? 'text-slate-400 hover:bg-slate-800 hover:text-amber-300' : 'text-slate-700 cursor-not-allowed'} title="Làm lại (Ctrl+Y)"><Redo2 size={20}/></ToolbarButton>
            </ToolbarGroup>

            <button onClick={onClearAll} className="p-3 rounded-xl text-slate-500 hover:bg-red-600/20 hover:text-red-500 mt-auto transition-all" title="Xóa toàn bộ"><Trash2 size={20}/></button>
        </div>
    );
};

export default EditorToolbar;