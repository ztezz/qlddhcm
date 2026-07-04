import React from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import EditorSidebar from './EditorSidebar';

interface EditorLayoutShellProps {
    mapElementRef: React.RefObject<HTMLDivElement>;
    isSidebarVisible: boolean;
    onToggleSidebar: () => void;
    sidebarProps: React.ComponentProps<typeof EditorSidebar>;
    isMapLoading?: boolean;
    onMapContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const EditorLayoutShell: React.FC<EditorLayoutShellProps> = ({
    mapElementRef,
    isSidebarVisible,
    onToggleSidebar,
    sidebarProps,
    isMapLoading,
    onMapContextMenu,
}) => {
    return (
        <>
            <div className="flex-1 relative bg-[#05070a]">
                <div
                    ref={mapElementRef}
                    className="w-full h-full"
                    onContextMenu={onMapContextMenu}
                />

                {isMapLoading && (
                    <div className="absolute inset-0 bg-[#05070a]/60 backdrop-blur-sm z-40 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                            <div className="absolute inset-0 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                            <div className="w-8 h-8 bg-emerald-500/20 rounded-full animate-ping animate-duration-1000" />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-black text-white uppercase tracking-widest animate-pulse">Đang tải thửa đất...</p>
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Hệ thống đang xử lý hình học bản đồ</p>
                        </div>
                    </div>
                )}

                <button
                    type="button"
                    onClick={onToggleSidebar}
                    title={isSidebarVisible ? 'Ẩn bảng điều khiển' : 'Hiện bảng điều khiển'}
                    className="absolute top-4 right-4 z-30 h-10 w-10 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 shadow-xl flex items-center justify-center transition-all duration-300 ease-out hover:scale-105 active:scale-95"
                >
                    <span className="transition-transform duration-300 ease-out">
                        {isSidebarVisible ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                    </span>
                </button>
            </div>

            <div className={`shrink-0 h-full overflow-hidden transition-[width,opacity,transform] duration-300 ease-out ${isSidebarVisible ? 'w-[400px] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-6 pointer-events-none'}`}>
                <EditorSidebar {...sidebarProps} />
            </div>
        </>
    );
};

export default EditorLayoutShell;
