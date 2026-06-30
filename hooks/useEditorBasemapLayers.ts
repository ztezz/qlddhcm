import { useEffect, useRef, useState } from 'react';
import { Graticule, Tile as TileLayer } from 'ol/layer';
import { XYZ } from 'ol/source';
import * as style from 'ol/style';

export const EDITOR_BASEMAP_OPTIONS = {
    'google-satellite': {
        name: 'Google Satellite',
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
    },
    'google-roadmap': {
        name: 'Google Roadmap',
        url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
    },
    'google-terrain': {
        name: 'Google Terrain',
        url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'
    },
    'osm': {
        name: 'OpenStreetMap',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    },
    'google-hybrid': {
        name: 'Google Satellite Hybrid',
        url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
    },
    'esri-satellite': {
        name: 'ESRI Satellite',
        url: 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    }
};

export const useEditorBasemapLayers = (showBasemap: boolean, showGrid: boolean) => {
    const [currentBasemap, setCurrentBasemap] = useState('google-satellite');

    const baseLayerRef = useRef<TileLayer<any>>(new TileLayer({
        zIndex: 0,
        visible: false,
        source: new XYZ({
            url: EDITOR_BASEMAP_OPTIONS['google-satellite'].url,
            crossOrigin: 'anonymous'
        })
    }));

    const gridLayerRef = useRef<Graticule>(new Graticule({
        strokeStyle: new style.Stroke({
            color: 'rgba(255, 255, 255, 0.1)',
            width: 1,
            lineDash: [4, 4]
        }),
        showLabels: false,
        wrapX: false,
        zIndex: 5
    }));

    const handleChangeBasemap = (basemapKey: string) => {
        const basemap = EDITOR_BASEMAP_OPTIONS[basemapKey as keyof typeof EDITOR_BASEMAP_OPTIONS];
        if (basemap && baseLayerRef.current) {
            baseLayerRef.current.setSource(new XYZ({
                url: basemap.url,
                crossOrigin: 'anonymous'
            }));
            setCurrentBasemap(basemapKey);
        }
    };

    useEffect(() => {
        baseLayerRef.current.setVisible(showBasemap);
        gridLayerRef.current.setVisible(showGrid);
    }, [showBasemap, showGrid]);

    return {
        baseLayerRef,
        gridLayerRef,
        currentBasemap,
        handleChangeBasemap
    };
};