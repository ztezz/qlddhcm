import { Dispatch, MutableRefObject, RefObject, SetStateAction, useCallback } from 'react';
import Feature from 'ol/Feature';
import Map from 'ol/Map';
import View from 'ol/View';
import { LineString } from 'ol/geom';
import { Draw, DragBox, Modify, Select, Snap, DragPan } from 'ol/interaction';
import { Vector as VectorLayer } from 'ol/layer';
import { Graticule, Tile as TileLayer } from 'ol/layer';
import * as proj from 'ol/proj';
import { Vector as VectorSource } from 'ol/source';
import * as style from 'ol/style';
import { getUid } from 'ol/util';
import { click } from 'ol/events/condition';
import { gisService } from '../services/apiClient';
import { getEditStyle, getSelectedStyle } from '../utils/editorStyles';

type ActiveInteraction = 'SELECT' | 'AREA_SELECT' | 'DRAW' | 'MODIFY';
type SplitConfig = { soTo: string; soThuaStart: number };

type UseEditorMapSetupArgs = {
    mapElement: RefObject<HTMLDivElement>;
    mapInstance: MutableRefObject<Map | null>;
    mapInitVersion: MutableRefObject<number>;
    editSource: MutableRefObject<VectorSource>;
    measureSource: MutableRefObject<VectorSource>;
    baseLayerRef: MutableRefObject<TileLayer<any>>;
    gridLayerRef: MutableRefObject<Graticule>;
    selectInteraction: MutableRefObject<Select | null>;
    drawInteraction: MutableRefObject<Draw | null>;
    drawLineInteraction: MutableRefObject<Draw | null>;
    dragBoxInteraction: MutableRefObject<DragBox | null>;
    modifyInteraction: MutableRefObject<Modify | null>;
    snapInteraction: MutableRefObject<Snap | null>;
    splitConfigRef: MutableRefObject<SplitConfig | null>;
    featureToSplitRef: MutableRefObject<Feature | null>;
    activeInteraction: ActiveInteraction;
    isSnapping: boolean;
    setActiveInteraction: Dispatch<SetStateAction<ActiveInteraction>>;
    setIsSplitMode: Dispatch<SetStateAction<boolean>>;
    setSelectedFeature: Dispatch<SetStateAction<Feature | null>>;
    setSelectedFeatureUids: Dispatch<SetStateAction<string[]>>;
    setSpatialTables: Dispatch<SetStateAction<any[]>>;
    setTargetTable: Dispatch<SetStateAction<string>>;
    updateSelectionState: (primary?: Feature | null) => void;
    updateVerticesFromFeature: (feature: Feature | null) => void;
    updateFeatureListState: () => void;
    pushHistorySnapshot: () => void;
    executeSplit: (cutGeom: LineString, featureToSplit?: Feature, config?: SplitConfig) => void;
};

export const useEditorMapSetup = ({
    mapElement,
    mapInstance,
    mapInitVersion,
    editSource,
    measureSource,
    baseLayerRef,
    gridLayerRef,
    selectInteraction,
    drawInteraction,
    drawLineInteraction,
    dragBoxInteraction,
    modifyInteraction,
    snapInteraction,
    splitConfigRef,
    featureToSplitRef,
    activeInteraction,
    isSnapping,
    setActiveInteraction,
    setIsSplitMode,
    setSelectedFeature,
    setSelectedFeatureUids,
    setSpatialTables,
    setTargetTable,
    updateSelectionState,
    updateVerticesFromFeature,
    updateFeatureListState,
    pushHistorySnapshot,
    executeSplit
}: UseEditorMapSetupArgs) => {
    const initMap = useCallback(async () => {
        if (!mapElement.current) return;
        const initVersion = ++mapInitVersion.current;

        if (mapInstance.current) {
            mapInstance.current.setTarget(undefined);
            mapInstance.current = null;
        }

        selectInteraction.current = null;
        drawInteraction.current = null;
        modifyInteraction.current = null;
        snapInteraction.current = null;

        const centerLat = 11.284;
        const centerLng = 106.619;
        const zoom = 18;

        const map = new Map({
            target: mapElement.current,
            layers: [
                baseLayerRef.current,
                gridLayerRef.current,
                new VectorLayer({
                    source: editSource.current,
                    style: (feature) => getEditStyle(feature as Feature),
                    zIndex: 100
                }),
                new VectorLayer({
                    source: measureSource.current,
                    style: new style.Style({
                        fill: new style.Fill({ color: 'rgba(244, 63, 94, 0.15)' }),
                        stroke: new style.Stroke({ color: '#f43f5e', width: 2, lineDash: [4, 4] }),
                        image: new style.Circle({
                            radius: 5,
                            stroke: new style.Stroke({ color: '#f43f5e', width: 2 }),
                            fill: new style.Fill({ color: '#fff' })
                        })
                    }),
                    zIndex: 90
                })
            ],
            view: new View({ center: proj.fromLonLat([centerLng, centerLat]), zoom }),
            controls: []
        });

        const select = new Select({
            style: (feature) => getSelectedStyle(feature as Feature),
            condition: click
        });
        map.addInteraction(select);
        select.on('select', (event) => {
            const selected = select.getFeatures().getArray();
            if ((event as any).mapBrowserEvent?.originalEvent?.shiftKey) {
                setSelectedFeature((prev) => prev || selected[0] || null);
                setSelectedFeatureUids(selected.map((feature) => getUid(feature)));
                return;
            }
            const feature = selected[0] || null;
            updateSelectionState(feature);
        });
        selectInteraction.current = select;

        const dragBox = new DragBox();
        dragBox.setActive(activeInteraction === 'SELECT');
        dragBox.on('boxend', (event) => {
            const geometry = dragBox.getGeometry();
            const extent = geometry.getExtent();
            const selectedCollection = select.getFeatures();
            const keepExistingSelection = !!(event as any)?.mapBrowserEvent?.originalEvent?.shiftKey;

            if (!keepExistingSelection) {
                selectedCollection.clear();
            }

            editSource.current.forEachFeatureInExtent(extent, (feature) => {
                if (feature.getGeometry()?.intersectsExtent(extent) && !selectedCollection.getArray().includes(feature)) {
                    selectedCollection.push(feature);
                }
            });
            updateSelectionState();
        });
        map.addInteraction(dragBox);
        dragBoxInteraction.current = dragBox;

        drawInteraction.current = null;

        const drawLine = new Draw({ source: editSource.current, type: 'LineString' });
        drawLine.setActive(false);
        drawLine.on('drawend', (event) => {
            if (splitConfigRef.current && featureToSplitRef.current) {
                const cutGeom = event.feature.getGeometry() as LineString;
                const featureToSplit = featureToSplitRef.current;
                const config = splitConfigRef.current;

                editSource.current.removeFeature(event.feature);
                executeSplit(cutGeom, featureToSplit, config);
                setTimeout(() => editSource.current.removeFeature(event.feature), 0);

                featureToSplitRef.current = null;
                splitConfigRef.current = null;
                setIsSplitMode(false);
                setActiveInteraction('SELECT');
            }
        });
        map.addInteraction(drawLine);
        drawLineInteraction.current = drawLine;

        const modify = new Modify({ source: editSource.current });
        modify.setActive(activeInteraction === 'MODIFY');
        modify.on('modifyend', (event) => {
            const feature = event.features.getArray()[0];
            if (feature) {
                updateVerticesFromFeature(feature);
                updateFeatureListState();
            }
        });
        map.addInteraction(modify);
        modifyInteraction.current = modify;

        const snap = new Snap({ source: editSource.current });
        snap.setActive(isSnapping);
        map.addInteraction(snap);
        snapInteraction.current = snap;

        // Middle-click scroll wheel DragPan interaction
        const middleDragPan = new DragPan({
            condition: (mapBrowserEvent: any) => {
                const originalEvent = mapBrowserEvent.originalEvent;
                // button === 1 is middle click pointerdown; buttons === 4 is middle click dragging
                return originalEvent.button === 1 || originalEvent.buttons === 4;
            }
        });
        map.addInteraction(middleDragPan);

        // Prevent browser autoscroll on middle click inside map viewport
        const viewport = map.getViewport();
        viewport.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button === 1) {
                e.preventDefault();
            }
        });

        editSource.current.on(['addfeature', 'removefeature', 'changefeature'], () => {
            updateFeatureListState();
            pushHistorySnapshot();
        });

        mapInstance.current = map;

        gisService.getSpatialTables()
            .then((tables) => {
                if (initVersion !== mapInitVersion.current) return;
                setSpatialTables(tables || []);
                if (tables && tables.length > 0) {
                    setTargetTable((prev) => prev || tables[0].table_name);
                }
            })
            .catch(() => {
                if (initVersion !== mapInitVersion.current) return;
                setSpatialTables([]);
            });

        pushHistorySnapshot();
    }, [activeInteraction, isSnapping]);

    const cleanupMap = useCallback(() => {
        mapInitVersion.current += 1;
        if (mapInstance.current) {
            mapInstance.current.setTarget(undefined);
            mapInstance.current = null;
        }
    }, []);

    return { initMap, cleanupMap };
};