
import React from 'react';
import { Plus, Minus, Compass, Crosshair, Loader2, Info } from 'lucide-react';
import Map from 'ol/Map';

interface MapControlsProps {
    mapInstance: Map | null;
    mapRotation: number;
    isLocating: boolean;
    isLegendOpen?: boolean;
    onLocate: () => void;
    onToggleLegend?: () => void;
}

const MapControls: React.FC<MapControlsProps> = ({ 
    mapInstance, 
    mapRotation, 
    isLocating, 
    isLegendOpen, 
    onLocate, 
    onToggleLegend 
}) => {
    return (
        <div className="absolute bottom-6 right-6 z-[400] flex flex-col gap-3">
            {onToggleLegend !== undefined && (
                <button 
                    onClick={onToggleLegend}
                    className={`p-3.5 rounded-full shadow-2xl transition-all active:scale-90 border border-slate-200 ${isLegendOpen ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-slate-50'}`}
                    title="Chú giải"
                >
                    <Info size={24} />
                </button>
            )}
            
            {Math.abs(mapRotation) > 0.01 && ( 
                <button 
                    onClick={() => mapInstance?.getView().animate({ rotation: 0, duration: 500 })} 
                    className="p-3 bg-white rounded-full shadow-2xl text-orange-600 hover:bg-orange-50 transition-all"
                >
                    <Compass size={24} style={{ transform: `rotate(${-mapRotation}rad)` }}/>
                </button> 
            )}
            
            <div className="flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"> 
                <button 
                    onClick={() => mapInstance?.getView().animate({ zoom: (mapInstance?.getView().getZoom() || 0) + 1, duration: 250 })} 
                    className="p-3.5 text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors"
                >
                    <Plus size={20}/>
                </button> 
                <button 
                    onClick={() => mapInstance?.getView().animate({ zoom: (mapInstance?.getView().getZoom() || 0) - 1, duration: 250 })} 
                    className="p-3.5 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    <Minus size={20}/>
                </button> 
            </div>
            
            <button 
                onClick={onLocate} 
                disabled={isLocating}
                className={`p-3.5 rounded-full shadow-2xl text-white transition-all active:scale-90 ${isLocating ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {isLocating ? <Loader2 className="animate-spin" size={24}/> : <Crosshair size={24}/>}
            </button>
        </div>
    );
};

export default MapControls;
