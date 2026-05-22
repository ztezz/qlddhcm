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
                    className="absolute top-4 right-4 z-30 bg-slate-900/90 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl px-3 py-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                    {isSidebarVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                    {isSidebarVisible ? 'Ẩn bảng điều khiển' : 'Hiện bảng điều khiển'}
                </button>
            </div>

            {isSidebarVisible && <EditorSidebar {...sidebarProps} />}
        </>
    );
};

export default EditorLayoutShell;
