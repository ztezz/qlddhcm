import { Dispatch, MutableRefObject, SetStateAction, useEffect } from 'react';
import Feature from 'ol/Feature';
import Map from 'ol/Map';
import * as proj from 'ol/proj';
import { Draw, DragBox, Modify, Select, Snap } from 'ol/interaction';
import { createBox } from 'ol/interaction/Draw';
import { LineString, Polygon } from 'ol/geom';
import { Vector as VectorSource } from 'ol/source';
import * as turf from '@turf/turf';

type ActiveInteraction = 'SELECT' | 'AREA_SELECT' | 'DRAW' | 'MODIFY';
type DrawShape = 'Polygon' | 'Rectangle' | 'Circle';

type SplitConfig = { soTo: string; soThuaStart: number };

type UseEditorMapInteractionsArgs = {
    mapInstance: MutableRefObject<Map | null>;
    editSource: MutableRefObject<VectorSource>;
    selectInteraction: MutableRefObject<Select | null>;
    drawInteraction: MutableRefObject<Draw | null>;
    drawLineInteraction: MutableRefObject<Draw | null>;
    dragBoxInteraction: MutableRefObject<DragBox | null>;
    modifyInteraction: MutableRefObject<Modify | null>;
    snapInteraction: MutableRefObject<Snap | null>;
    splitConfigRef: MutableRefObject<SplitConfig | null>;
    featureToSplitRef: MutableRefObject<Feature | null>;
    activeInteraction: ActiveInteraction;
    setActiveInteraction: Dispatch<SetStateAction<ActiveInteraction>>;
    isSnapping: boolean;
    isSplitMode: boolean;
    setIsSplitMode: Dispatch<SetStateAction<boolean>>;
    drawShape: DrawShape;
    showVertexNumbers: boolean;
    showSegmentLengths: boolean;
    showParcelInfo: boolean;
    setSelectedFeature: Dispatch<SetStateAction<Feature | null>>;
    setSelectedFeatureUids: Dispatch<SetStateAction<string[]>>;
    updateSelectionState: (primary?: Feature | null) => void;
    updateVerticesFromFeature: (feature: Feature | null) => void;
    updateFeatureListState: () => void;
    executeSplit: (cutGeom: LineString | Polygon, featureToSplit?: Feature, config?: SplitConfig) => void;
};

export const useEditorMapInteractions = ({
    mapInstance,
    editSource,
    selectInteraction,
    drawInteraction,
    drawLineInteraction,
    dragBoxInteraction,
    modifyInteraction,
    snapInteraction,
    splitConfigRef,
    featureToSplitRef,
    activeInteraction,
    setActiveInteraction,
    isSnapping,
    isSplitMode,
    setIsSplitMode,
    drawShape,
    showVertexNumbers,
    showSegmentLengths,
    showParcelInfo,
    setSelectedFeature,
    setSelectedFeatureUids,
    updateSelectionState,
    updateVerticesFromFeature,
    updateFeatureListState,
    executeSplit
}: UseEditorMapInteractionsArgs) => {
    useEffect(() => {
        if (!mapInstance.current) return;

        if (drawInteraction.current) {
            mapInstance.current.removeInteraction(drawInteraction.current);
            drawInteraction.current = null;
        }

        if (activeInteraction === 'DRAW') {
            let drawOptions: any = {
                source: editSource.current
            };

            if (isSplitMode) {
                drawOptions.type = 'Polygon';
            } else {
                if (drawShape === 'Polygon') {
                    drawOptions.type = 'Polygon';
                } else if (drawShape === 'Rectangle') {
                    drawOptions.type = 'Circle';
                    drawOptions.geometryFunction = createBox();
                } else if (drawShape === 'Circle') {
                    drawOptions.type = 'Circle';
                }
            }

            const draw = new Draw(drawOptions);
            draw.on('drawend', (e) => {
                if (isSplitMode && splitConfigRef.current) {
                    const cutGeom = e.feature.getGeometry();
                    if (cutGeom && featureToSplitRef.current) {
                        const featureToSplit = featureToSplitRef.current;
                        const config = splitConfigRef.current;
                        executeSplit(cutGeom as Polygon, featureToSplit, config);
                        editSource.current.removeFeature(e.feature);
                        featureToSplitRef.current = null;
                        splitConfigRef.current = null;
                        setIsSplitMode(false);
                        setActiveInteraction('SELECT');
                    }
                } else {
                    let feature = e.feature;
                    const geom = feature.getGeometry();

                    if (geom && geom.getType() === 'Circle') {
                        const circleGeom = geom as any;
                        const center3857 = circleGeom.getCenter();
                        const radius = circleGeom.getRadius();

                        const edgePoint3857 = [center3857[0] + radius, center3857[1]];
                        const centerLonLat = proj.toLonLat(center3857);
                        const edgeLonLat = proj.toLonLat(edgePoint3857);
                        const turfCenter = turf.point(centerLonLat);
                        const turfEdge = turf.point(edgeLonLat);
                        const radiusMeters = turf.distance(turfCenter, turfEdge, { units: 'kilometers' }) * 1000;

                        const turfCircle = turf.circle(centerLonLat, radiusMeters / 1000, { steps: 64, units: 'kilometers' });
                        const olCoords = turfCircle.geometry.coordinates[0].map(coord => proj.fromLonLat(coord));
                        const polyGeom = new Polygon([olCoords]);
                        feature.setGeometry(polyGeom);
                    }

                    feature.set('showVertexNumbers', showVertexNumbers);
                    feature.set('showSegmentLengths', showSegmentLengths);
                    feature.set('showParcelInfo', showParcelInfo);

                    setSelectedFeature(feature);
                    updateSelectionState(feature);
                    updateVerticesFromFeature(feature);
                    updateFeatureListState();
                    setTimeout(() => setActiveInteraction('SELECT'), 50);
                }
            });

            mapInstance.current.addInteraction(draw);
            drawInteraction.current = draw;
        }
    }, [activeInteraction, drawShape, isSplitMode, showVertexNumbers, showSegmentLengths, showParcelInfo]);

    useEffect(() => {
        if (!mapInstance.current) return;
        if (selectInteraction.current) {
            const selectMode = activeInteraction === 'SELECT';
            selectInteraction.current.setActive(selectMode);
            if (!selectMode) {
                selectInteraction.current.getFeatures().clear();
                setSelectedFeature(null);
                setSelectedFeatureUids([]);
            }
        }
        if (dragBoxInteraction.current) {
            const areaSelectMode = activeInteraction === 'AREA_SELECT';
            dragBoxInteraction.current.setActive(areaSelectMode);
            if (!areaSelectMode) {
                selectInteraction.current?.getFeatures().clear();
                setSelectedFeature(null);
                setSelectedFeatureUids([]);
            }
        }
        if (drawInteraction.current) {
            const usePolygonDraw = activeInteraction === 'DRAW' && !isSplitMode;
            drawInteraction.current.setActive(usePolygonDraw);
        }
        if (drawLineInteraction.current) {
            const useLineDraw = activeInteraction === 'DRAW' && isSplitMode;
            drawLineInteraction.current.setActive(useLineDraw);
        }
        if (modifyInteraction.current) {
            modifyInteraction.current.setActive(activeInteraction === 'MODIFY');
        }
        if (snapInteraction.current) {
            snapInteraction.current.setActive(isSnapping);
        }
    }, [activeInteraction, isSnapping, isSplitMode, updateVerticesFromFeature, updateFeatureListState]);
};