import React from 'react';
import { SlidersHorizontal, X, Search, Layers, Eye, EyeOff } from 'lucide-react';
import { BasemapConfig, WMSLayerConfig } from '../../../types';
import { AdminPanelStyle, AdminPanelTheme } from './adminPanelTheme';

export interface ProvinceSuggestion {
    name: string;
    layerId: string;
}

interface AdminMapPanelProps {
    isOpen: boolean;
    isTabletViewport: boolean;
    panelStyle: AdminPanelStyle;
    panelTheme: AdminPanelTheme;
    adminPanelTab: 'SEARCH' | 'LAYERS';
    thematicLayers: WMSLayerConfig[];
    visibleLayerIds: string[];
    activeLayerId: string | null;
    thematicBasemapOptions: BasemapConfig[];
    activeBasemapId: string;
    provinceKeyword: string;
    provinceSuggestions: ProvinceSuggestion[];
    showProvinceSuggestions: boolean;
    isProvinceSearching: boolean;
    isInteractiveAdministrativeLayer: (layer: WMSLayerConfig) => boolean;
    getLayerTypeLabel: (layer: WMSLayerConfig) => string;
    onOpenPanel: () => void;
    onClosePanel: () => void;
    onPanelStyleChange: (style: AdminPanelStyle) => void;
    onPanelTabChange: (tab: 'SEARCH' | 'LAYERS') => void;
    onProvinceKeywordChange: (value: string) => void;
    onShowProvinceSuggestions: (show: boolean) => void;
    onSearch: () => void | Promise<void>;
    onBasemapChange: (id: string) => void;
    onActivateLayer: (id: string) => void;
    onToggleWMS: (id: string) => void;
    onLayerOpacityChange: (id: string, opacity: number) => void;
    onZoomToLayerExtent: (id: string) => void | Promise<void>;
    onSelectSuggestion: (item: ProvinceSuggestion) => void | Promise<void>;
}

const AdminMapPanel: React.FC<AdminMapPanelProps> = ({
    isOpen,
    isTabletViewport,
    panelStyle,
    panelTheme,
    adminPanelTab,
    thematicLayers,
    visibleLayerIds,
    activeLayerId,
    thematicBasemapOptions,
    activeBasemapId,
    provinceKeyword,
    provinceSuggestions,
    showProvinceSuggestions,
    isProvinceSearching,
    isInteractiveAdministrativeLayer,
    getLayerTypeLabel,
    onOpenPanel,
    onClosePanel,
    onPanelStyleChange,
    onPanelTabChange,
    onProvinceKeywordChange,
    onShowProvinceSuggestions,
    onSearch,
    onBasemapChange,
    onActivateLayer,
    onToggleWMS,
    onLayerOpacityChange,
    onZoomToLayerExtent,
    onSelectSuggestion
}) => {
    const showSearchSection = !isTabletViewport || adminPanelTab === 'SEARCH';
    const showLayerSection = !isTabletViewport || adminPanelTab === 'LAYERS';
    const activeLayer = thematicLayers.find((layer) => layer.id === activeLayerId) || null;

    return (
        <>
            {!isOpen && (
                <button
                    onClick={onOpenPanel}
                    className={`absolute top-16 right-3 md:top-4 md:right-4 z-[460] min-h-11 min-w-11 p-3 backdrop-blur-md rounded-2xl shadow-xl border active:scale-95 transition-all duration-200 ${panelTheme.triggerButton}`}
                    title="Mở bảng điều khiển hành chính"
                >
                    <div className="relative">
                        <SlidersHorizontal size={20} />
                        {thematicLayers.length > 0 && (
                            <span className={`absolute -top-2 -right-2 min-w-4 h-4 px-1 text-[8px] font-black rounded-full flex items-center justify-center border ${panelTheme.triggerBadge}`}>
                                {thematicLayers.length}
                            </span>
                        )}
                    </div>
                </button>
            )}

            <div className={`absolute top-16 left-3 right-3 sm:left-auto sm:w-[min(92vw,420px)] lg:w-[440px] md:top-4 md:right-4 z-[460] border rounded-xl p-2 shadow-xl backdrop-blur-md max-h-[72vh] md:max-h-[78vh] overflow-y-auto transition-all duration-300 ease-out origin-top-right ${panelTheme.panelShell} ${
                isOpen ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
            }`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                    <p className={`text-[10px] uppercase tracking-widest font-black ${panelTheme.headingText}`}>Bảng điều khiển hành chính</p>
                    <button
                        onClick={onClosePanel}
                        className={`min-h-11 min-w-11 p-2.5 rounded-md transition-colors ${panelTheme.closeButton}`}
                        title="Ẩn bảng điều khiển"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className={`mb-2 p-1 rounded-lg border flex items-center gap-1 ${panelTheme.tabWrap}`}>
                    <button
                        type="button"
                        onClick={() => onPanelStyleChange('LIGHT')}
                        className={`min-h-9 px-2.5 rounded-md text-[9px] uppercase tracking-wider font-black transition-colors ${panelStyle === 'LIGHT' ? panelTheme.tabSearchActive : panelTheme.tabIdle}`}
                    >
                        Light Glass
                    </button>
                    <button
                        type="button"
                        onClick={() => onPanelStyleChange('DARK')}
                        className={`min-h-9 px-2.5 rounded-md text-[9px] uppercase tracking-wider font-black transition-colors ${panelStyle === 'DARK' ? panelTheme.tabSearchActive : panelTheme.tabIdle}`}
                    >
                        Dark Pro
                    </button>
                    <button
                        type="button"
                        onClick={() => onPanelStyleChange('MINIMAL')}
                        className={`min-h-9 px-2.5 rounded-md text-[9px] uppercase tracking-wider font-black transition-colors ${panelStyle === 'MINIMAL' ? panelTheme.tabSearchActive : panelTheme.tabIdle}`}
                    >
                        Minimal
                    </button>
                </div>

                <div className={`hidden md:flex lg:hidden mb-2 p-1 rounded-lg border ${panelTheme.tabWrap}`}>
                    <button
                        type="button"
                        onClick={() => onPanelTabChange('SEARCH')}
                        className={`flex-1 min-h-11 px-3 rounded-md text-[10px] uppercase tracking-wider font-black flex items-center justify-center gap-1.5 transition-colors ${
                            adminPanelTab === 'SEARCH' ? panelTheme.tabSearchActive : panelTheme.tabIdle
                        }`}
                    >
                        <Search size={14} />
                        Tìm kiếm
                    </button>
                    <button
                        type="button"
                        onClick={() => onPanelTabChange('LAYERS')}
                        className={`flex-1 min-h-11 px-3 rounded-md text-[10px] uppercase tracking-wider font-black flex items-center justify-center gap-1.5 transition-colors ${
                            adminPanelTab === 'LAYERS' ? panelTheme.tabLayersActive : panelTheme.tabIdle
                        }`}
                    >
                        <Layers size={14} />
                        Quản lý lớp
                    </button>
                </div>

                {showSearchSection && (
                    <div className="animate-in fade-in duration-200">
                        <p className={`text-[10px] uppercase tracking-widest font-black mb-2 ${panelTheme.headingText}`}>Tìm nhanh theo tên tỉnh</p>
                        <div className="flex items-center gap-2">
                            <input
                                value={provinceKeyword}
                                onChange={(e) => {
                                    onProvinceKeywordChange(e.target.value);
                                    onShowProvinceSuggestions(true);
                                }}
                                onFocus={() => onShowProvinceSuggestions(true)}
                                onBlur={() => {
                                    window.setTimeout(() => onShowProvinceSuggestions(false), 150);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        void onSearch();
                                    }
                                }}
                                placeholder="Nhập tên tỉnh/thành..."
                                className={`flex-1 min-h-11 border rounded-lg px-3 py-2.5 text-xs outline-none ${panelTheme.field}`}
                            />
                            <button
                                onClick={() => void onSearch()}
                                disabled={isProvinceSearching || !provinceKeyword.trim()}
                                className={`min-h-11 px-4 py-2.5 rounded-lg text-[10px] uppercase tracking-wider font-black disabled:opacity-50 ${panelTheme.actionBtn}`}
                            >
                                {isProvinceSearching ? 'Đang tìm...' : 'Tìm'}
                            </button>
                        </div>

                        <div className={`mt-2.5 border-t pt-2.5 ${panelTheme.divider}`}>
                            <label className={`text-[10px] uppercase tracking-widest font-black ${panelTheme.headingText}`}>Lớp bản đồ nền</label>
                            <select
                                value={activeBasemapId}
                                onChange={(e) => onBasemapChange(e.target.value)}
                                className={`mt-1.5 w-full border rounded-lg px-2.5 py-2 text-xs outline-none ${panelTheme.field}`}
                            >
                                {thematicBasemapOptions.map((bm) => (
                                    <option key={bm.id} value={bm.id}>{bm.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {showLayerSection && (
                    <div className="animate-in fade-in duration-200">
                        <div className={`mt-2.5 border-t pt-2.5 ${panelTheme.divider}`}>
                            <div className="flex items-center justify-between mb-2">
                                <p className={`text-[10px] uppercase tracking-widest font-black ${panelTheme.headingText}`}>Bảng quản lý lớp hành chính</p>
                                <span className={`text-[10px] border rounded-full px-2 py-0.5 ${panelTheme.countPill}`}>{thematicLayers.length} lớp</span>
                            </div>

                            <div className={`max-h-[28vh] md:max-h-[34vh] overflow-y-auto rounded-xl border p-2 space-y-2 ${panelTheme.listWrap}`}>
                                {thematicLayers.map((layer) => {
                                    const isVisible = visibleLayerIds.includes(layer.id);
                                    const isActive = activeLayerId === layer.id;
                                    const isInteractive = isInteractiveAdministrativeLayer(layer);

                                    return (
                                        <div
                                            key={layer.id}
                                            className={`rounded-lg border transition-all cursor-pointer ${isActive ? panelTheme.cardActive : panelTheme.cardIdle}`}
                                            onClick={() => onActivateLayer(layer.id)}
                                            title="Bấm để chọn lớp và tự bật hiển thị"
                                        >
                                            <div className="px-3 py-2.5 flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-[11px] leading-tight truncate">{layer.name}</p>
                                                    <p className={`text-[10px] truncate hidden sm:block mt-0.5 ${panelTheme.subText}`}>{layer.layers}</p>
                                                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${isInteractive ? panelTheme.typeInteractive : panelTheme.typeRaster}`}>
                                                            {getLayerTypeLabel(layer)}
                                                        </span>
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${isVisible ? panelTheme.statusOn : panelTheme.statusOff}`}>
                                                            {isVisible ? 'Đang bật' : 'Đang tắt'}
                                                        </span>
                                                        {isActive && (
                                                            <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${panelTheme.activePill}`}>
                                                                Đang chọn
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggleWMS(layer.id);
                                                    }}
                                                    className={`min-h-11 min-w-11 rounded-lg inline-flex items-center justify-center transition-colors ${isVisible ? panelTheme.eyeOn : panelTheme.eyeOff}`}
                                                    title={isVisible ? 'Tắt lớp' : 'Bật lớp'}
                                                >
                                                    {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {thematicLayers.length === 0 && (
                                    <div className={`px-3 py-4 text-center text-[10px] border border-dashed rounded-lg ${panelTheme.emptyBox}`}>
                                        Không có lớp hành chính khả dụng.
                                    </div>
                                )}
                            </div>

                            {activeLayer && (
                                <div className={`mt-2 rounded-lg border p-2.5 ${panelTheme.activeBox}`}>
                                    <p className={`text-[10px] uppercase tracking-wider font-black ${panelTheme.activeBoxTitle}`}>Tùy chỉnh lớp đang chọn</p>
                                    <p className="mt-1 text-[11px] font-semibold truncate">{activeLayer.name}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void onZoomToLayerExtent(activeLayer.id)}
                                            className={`px-2.5 py-1.5 rounded text-[10px] font-bold ${panelTheme.zoomBtn}`}
                                        >
                                            Zoom lớp
                                        </button>
                                        <span className={`text-[10px] min-w-9 ${panelTheme.subText}`}>{Math.round(Number(activeLayer.opacity ?? 1) * 100)}%</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={Number(activeLayer.opacity ?? 1)}
                                            onChange={(e) => onLayerOpacityChange(activeLayer.id, parseFloat(e.target.value))}
                                            className="flex-1 h-1 accent-cyan-500"
                                        />
                                    </div>
                                </div>
                            )}
                            <p className={`mt-1.5 text-[10px] ${panelTheme.note}`}>Lớp WMS TIFF là lớp ảnh nền chuyên đề: vẫn bật/tắt, chỉnh độ mờ và zoom được, nhưng không truy vấn thuộc tính.</p>
                        </div>
                    </div>
                )}

                {showSearchSection && showProvinceSuggestions && provinceSuggestions.length > 0 && (
                    <div className={`mt-2 max-h-44 overflow-y-auto rounded-lg border ${panelTheme.suggestBox}`}>
                        {provinceSuggestions.map((item, idx) => (
                            <button
                                key={`${item.layerId}-${item.name}-${idx}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => void onSelectSuggestion(item)}
                                className={`block w-full text-left px-3 py-2 text-xs ${panelTheme.suggestItem}`}
                            >
                                {item.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

export default AdminMapPanel;