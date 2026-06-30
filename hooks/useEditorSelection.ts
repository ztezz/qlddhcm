import { RefObject, useCallback, useEffect, useState } from 'react';
import Feature from 'ol/Feature';
import { MultiPolygon, Polygon } from 'ol/geom';
import Select from 'ol/interaction/Select';
import { Vector as VectorSource } from 'ol/source';
import { getUid } from 'ol/util';
import { getArea } from 'ol/sphere';

export const useEditorSelection = (
    editSource: RefObject<VectorSource>,
    selectInteraction: RefObject<Select | null>
) => {
    const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
    const [selectedFeatureUids, setSelectedFeatureUids] = useState<string[]>([]);
    const [featuresList, setFeaturesList] = useState<any[]>([]);
    const [soTo, setSoTo] = useState('');
    const [soThua, setSoThua] = useState('');
    const [loaiDat, setLoaiDat] = useState('');
    const [vertices, setVertices] = useState<{x: number, y: number}[]>([]);
    const [area, setArea] = useState(0);

    const updateFeatureListState = useCallback(() => {
        const feats = editSource.current.getFeatures().map(f => ({
            uid: getUid(f),
            soTo: f.get('sodoto') || '',
            soThua: f.get('sothua') || '',
            area: getArea(f.getGeometry() as any),
            isValid: !!(f.get('sodoto') && f.get('sothua'))
        }));
        setFeaturesList(feats);
    }, [editSource]);

    const updateVerticesFromFeature = useCallback((feature: Feature | null) => {
        if (!feature) {
            setVertices([]);
            setArea(0);
            return;
        }
        const geom = feature.getGeometry();
        let coords: any[] = [];
        if (geom instanceof Polygon) {
            coords = geom.getCoordinates()[0];
            setArea(getArea(geom));
        } else if (geom instanceof MultiPolygon) {
            const polyCoords = geom.getCoordinates();
            if (polyCoords.length > 0 && polyCoords[0].length > 0) {
                coords = polyCoords[0][0];
            }
            setArea(getArea(geom));
        }

        if (coords.length > 0) {
            const displayCoords = coords.slice(0, -1);
            setVertices(displayCoords.map(c => ({ x: c[0], y: c[1] })));
        }
    }, []);

    useEffect(() => {
        if (selectedFeature) {
            setSoTo(String(selectedFeature.get('sodoto') ?? ''));
            setSoThua(String(selectedFeature.get('sothua') ?? ''));
            setLoaiDat(String(selectedFeature.get('loaidat') ?? ''));
            updateVerticesFromFeature(selectedFeature);
        } else {
            setSoTo('');
            setSoThua('');
            setLoaiDat('');
            updateVerticesFromFeature(null);
        }
    }, [selectedFeature, updateVerticesFromFeature]);

    const updateSelectionState = useCallback((primary?: Feature | null) => {
        const selected = selectInteraction.current?.getFeatures().getArray() || [];
        const nextUids = selected.map((feature) => getUid(feature));
        setSelectedFeatureUids(nextUids);
        if (primary !== undefined) {
            setSelectedFeature(primary);
            return;
        }
        if (selectedFeature && nextUids.includes(getUid(selectedFeature))) {
            return;
        }
        setSelectedFeature(selected[0] || null);
    }, [selectInteraction, selectedFeature]);

    const handleClearSelection = useCallback(() => {
        selectInteraction.current?.getFeatures().clear();
        setSelectedFeature(null);
        setSelectedFeatureUids([]);
    }, [selectInteraction]);

    const handleSoToChange = (val: string) => {
        setSoTo(val);
        if (selectedFeature) {
            selectedFeature.set('sodoto', val);
            updateFeatureListState();
        }
    };

    const handleSoThuaChange = (val: string) => {
        setSoThua(val);
        if (selectedFeature) {
            selectedFeature.set('sothua', val);
            updateFeatureListState();
        }
    };

    const handleLoaiDatChange = (val: string) => {
        setLoaiDat(val);
        if (selectedFeature) {
            selectedFeature.set('loaidat', val);
        }
    };

    return {
        selectedFeature,
        setSelectedFeature,
        selectedFeatureUids,
        setSelectedFeatureUids,
        featuresList,
        setFeaturesList,
        soTo,
        setSoTo,
        soThua,
        setSoThua,
        loaiDat,
        setLoaiDat,
        vertices,
        setVertices,
        area,
        setArea,
        updateFeatureListState,
        updateVerticesFromFeature,
        updateSelectionState,
        handleClearSelection,
        handleSoToChange,
        handleSoThuaChange,
        handleLoaiDatChange
    };
};