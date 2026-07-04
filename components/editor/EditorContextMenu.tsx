import React, { useEffect, useRef } from 'react';
import {
    MousePointer2,
    Pencil,
    Scissors,
    Merge,
    Trash2,
    CloudUpload,
    Copy,
    Maximize2,
    Undo2,
    Redo2,
    ScanSearch,
} from 'lucide-react';

export interface EditorContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    /** uid của feature được click phải (nếu có) */
    featureUid: string | null;
}

interface EditorContextMenuProps {
    state: EditorContextMenuState;
    onClose: () => void;

    // feature context
    hasSelectedFeature: boolean;
    canSplit: boolean;
    canMerge: boolean;
    canSaveToDb: boolean;
    canUndo: boolean;
    canRedo: boolean;
    soTo: string;
    soThua: string;

    // actions
    onSelectMode: () => void;
    onModifyMode: () => void;
    onSplit: () => void;
    onMerge: () => void;
    onDelete: () => void;
    onSave: () => void;
    onFitView: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onTopologyCheck: () => void;
    onClearAll: () => void;
}

interface MenuItemProps {
    icon: React.ReactNode;
    label: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, shortcut, onClick, disabled, danger }) => (
    <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`
            w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs rounded
            transition-colors duration-100
            ${disabled
                ? 'text-slate-600 cursor-not-allowed'
                : danger
                    ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300'
                    : 'text-slate-200 hover:bg-slate-600/60 hover:text-white'
            }
        `}
    >
        <span className={`shrink-0 ${disabled ? 'opacity-30' : ''}`}>{icon}</span>
        <span className="flex-1 leading-none">{label}</span>
        {shortcut && !disabled && (
            <span className="text-[10px] text-slate-500 font-mono">{shortcut}</span>
        )}
    </button>
);

const Divider = () => <div className="my-1 border-t border-slate-700/60" />;

const EditorContextMenu: React.FC<EditorContextMenuProps> = ({
    state,
    onClose,
    hasSelectedFeature,
    canSplit,
    canMerge,
    canSaveToDb,
    canUndo,
    canRedo,
    soTo,
    soThua,
    onSelectMode,
    onModifyMode,
    onSplit,
    onMerge,
    onDelete,
    onSave,
    onFitView,
    onUndo,
    onRedo,
    onTopologyCheck,
    onClearAll,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // Đóng khi click ngoài
    useEffect(() => {
        if (!state.visible) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        // Đóng khi Escape
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('keydown', onKey);
        };
    }, [state.visible, onClose]);

    // Điều chỉnh vị trí để menu không bị tràn ra ngoài viewport
    const menuWidth = 220;
    const menuEstimatedHeight = 300;
    const left = state.x + menuWidth > window.innerWidth ? state.x - menuWidth : state.x;
    const top = state.y + menuEstimatedHeight > window.innerHeight ? state.y - menuEstimatedHeight : state.y;

    if (!state.visible) return null;

    const featureLabel = soTo && soThua ? `Thửa ${soThua}/Tờ ${soTo}` : 'Thửa đất';

    const wrap = (fn: () => void) => () => { fn(); onClose(); };

    return (
        <div
            ref={menuRef}
            style={{ left, top, width: menuWidth }}
            className="fixed z-[9999] py-1.5 px-1 rounded-lg shadow-2xl border border-slate-700/80 bg-slate-800/95 backdrop-blur-md select-none"
        >
            {/* Header — chỉ hiện khi đang chọn feature */}
            {hasSelectedFeature && (
                <>
                    <div className="px-3 py-1 mb-0.5">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest leading-none">
                            {featureLabel}
                        </p>
                    </div>
                    <Divider />
                </>
            )}

            {/* Chế độ tương tác */}
            <MenuItem
                icon={<MousePointer2 size={13} />}
                label="Chế độ chọn"
                onClick={wrap(onSelectMode)}
            />
            <MenuItem
                icon={<Pencil size={13} />}
                label="Chỉnh sửa đỉnh"
                disabled={!hasSelectedFeature}
                onClick={wrap(onModifyMode)}
            />

            <Divider />

            {/* Thao tác với feature */}
            <MenuItem
                icon={<Maximize2 size={13} />}
                label="Phóng to thửa đất"
                disabled={!hasSelectedFeature}
                onClick={wrap(onFitView)}
            />
            <MenuItem
                icon={<CloudUpload size={13} />}
                label="Lưu lên cơ sở dữ liệu"
                disabled={!hasSelectedFeature || !canSaveToDb}
                onClick={wrap(onSave)}
            />

            <Divider />

            {/* Split / Merge */}
            <MenuItem
                icon={<Scissors size={13} />}
                label="Tách thửa"
                disabled={!canSplit}
                onClick={wrap(onSplit)}
            />
            <MenuItem
                icon={<Merge size={13} />}
                label="Gộp thửa"
                disabled={!canMerge}
                onClick={wrap(onMerge)}
            />

            <Divider />

            {/* Undo / Redo */}
            <MenuItem
                icon={<Undo2 size={13} />}
                label="Hoàn tác"
                shortcut="Ctrl+Z"
                disabled={!canUndo}
                onClick={wrap(onUndo)}
            />
            <MenuItem
                icon={<Redo2 size={13} />}
                label="Làm lại"
                shortcut="Ctrl+Y"
                disabled={!canRedo}
                onClick={wrap(onRedo)}
            />

            <Divider />

            {/* Kiểm tra & xóa */}
            <MenuItem
                icon={<ScanSearch size={13} />}
                label="Kiểm tra chồng lấn"
                onClick={wrap(onTopologyCheck)}
            />
            <MenuItem
                icon={<Trash2 size={13} />}
                label="Xóa thửa đang chọn"
                disabled={!hasSelectedFeature}
                danger
                onClick={wrap(onDelete)}
            />
            <MenuItem
                icon={<Trash2 size={13} />}
                label="Xóa tất cả thửa đất"
                danger
                onClick={wrap(onClearAll)}
            />
        </div>
    );
};

export default EditorContextMenu;
