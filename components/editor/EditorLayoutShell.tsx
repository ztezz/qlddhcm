import React from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import EditorSidebar from './EditorSidebar';

interface EditorLayoutShellProps {
    mapElementRef: React.RefObject<HTMLDivElement>;
    isSidebarVisible: boolean;
    onToggleSidebar: () => void;
    sidebarProps: React.ComponentProps<typeof EditorSidebar>;
}

const EditorLayoutShell: React.FC<EditorLayoutShellProps> = ({
    mapElementRef,
    isSidebarVisible,
    onToggleSidebar,
    sidebarProps
}) => {
    return (
        <>
            <div className="flex-1 relative bg-[#05070a]">
                <div ref={mapElementRef} className="w-full h-full" />

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

            <div className={`shrink-0 overflow-hidden transition-[width,opacity,transform] duration-300 ease-out ${isSidebarVisible ? 'w-[400px] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-6 pointer-events-none'}`}>
                <EditorSidebar {...sidebarProps} />
            </div>
        </>
    );
};

export default EditorLayoutShell;
