import { Dispatch, RefObject, SetStateAction, useRef, useState } from 'react';
import Feature from 'ol/Feature';
import { LineString, MultiPolygon, Polygon } from 'ol/geom';
import Select from 'ol/interaction/Select';
import { Vector as VectorSource } from 'ol/source';
import { getArea } from 'ol/sphere';
import { mergePolygons, createFeatureFromPolygon } from '../utils/geometryUtils';

type DialogState = { isOpen: boolean; type: 'success' | 'error' | 'info'; title: string; message: string; };
type ActiveInteraction = 'SELECT' | 'AREA_SELECT' | 'DRAW' | 'MODIFY';

type UseEditorSplitMergeArgs = {
    editSource: RefObject<VectorSource>;
    selectInteraction: RefObject<Select | null>;
    selectedFeature: Feature | null;
    selectedFeatureUids: string[];
    featuresList: any[];
    pushHistorySnapshot: () => void;
    updateVerticesFromFeature: (feature: Feature | null) => void;
    updateFeatureListState: () => void;
    setSelectedFeature: Dispatch<SetStateAction<Feature | null>>;
    setDialog: Dispatch<SetStateAction<DialogState>>;
    setActiveInteraction: Dispatch<SetStateAction<ActiveInteraction>>;
};

export const useEditorSplitMerge = ({
    editSource,
    selectInteraction,
    selectedFeature,
    selectedFeatureUids,
    featuresList,
    pushHistorySnapshot,
    updateVerticesFromFeature,
    updateFeatureListState,
    setSelectedFeature,
    setDialog,
    setActiveInteraction
}: UseEditorSplitMergeArgs) => {
// Split/Merge States
const [splitModal, setSplitModal] = useState({ isOpen: false });
const [mergeModal, setMergeModal] = useState({ isOpen: false, selectedFeatures: [] as any[] });
const [splitMergeResultModal, setSplitMergeResultModal] = useState({
    isOpen: false,
    type: 'split' as 'split' | 'merge',
    originalFeatures: [] as any[],
    newFeatures: [] as any[]
});
// For split mode - store the split config
const splitConfigRef = useRef<{ soTo: string; soThuaStart: number } | null>(null);
const [isSplitMode, setIsSplitMode] = useState(false);
// CRITICAL: Store the feature to split in a ref BEFORE mode switch
// This prevents React state batching from clearing it when interaction changes
const featureToSplitRef = useRef<Feature | null>(null);

// ==================== SPLIT / MERGE HANDLERS ====================

const handleSplitFeature = () => {
    if (!selectedFeature) {
        setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Vui lòng chọn một thửa đất để tách.' });
        return;
    }
    const soToVal = selectedFeature.get('sodoto') || '';
    const soThuaVal = selectedFeature.get('sothua') || '';
    if (!soToVal || !soThuaVal) {
        setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Thửa đất cần có số tờ và số thửa trước khi tách.' });
        return;
    }
    setSplitModal({ isOpen: true });
};

const handleOpenSplitModal = (soTo: string, soThuaStart: number) => {
    setSplitModal({ isOpen: false });
    splitConfigRef.current = { soTo, soThuaStart };
    featureToSplitRef.current = selectedFeature;
    setIsSplitMode(true);
    setActiveInteraction('DRAW');
};

const handleMergeFeatures = () => {
    const selectedFeatures = selectInteraction.current?.getFeatures().getArray() || [];
    if (selectedFeatures.length < 2) {
        setDialog({
            isOpen: true,
            type: 'info',
            title: 'Hướng dẫn gộp thửa',
            message: 'Vui lòng chọn ít nhất 2 thửa đất trên bản đồ để gộp.\n\nMẹo: Nhấn giữ phím SHIFT hoặc CTRL và click chuột vào các thửa đất (hoặc click trên danh sách thửa bên phải) để chọn nhiều thửa.'
        });
        return;
    }
    // Check all selected features have sodoto and sothua
    const featuresWithAttr = selectedFeatures.filter((f: any) => f.get('sodoto') && f.get('sothua'));
    if (featuresWithAttr.length < selectedFeatures.length) {
        setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Tất cả các thửa đất được chọn cần có số tờ và số thửa trước khi gộp.' });
        return;
    }
    const selectedFeats = featuresWithAttr.map((f: any) => ({
        sodoto: f.get('sodoto'),
        sothua: f.get('sothua'),
        area: getArea(f.getGeometry() as any),
        feature: f
    }));
    setMergeModal({ isOpen: true, selectedFeatures: selectedFeats });
};

const executeMerge = (soTo: string, soThua: string) => {
    setMergeModal({ isOpen: false, selectedFeatures: [] });
    const originalFeatures = mergeModal.selectedFeatures;
    if (originalFeatures.length < 2) return;

    try {
        const polygons = originalFeatures.map(f => f.feature.getGeometry()).filter(g => g instanceof Polygon) as Polygon[];
        if (polygons.length < 2) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Không đủ polygon hợp lệ để gộp.' });
            return;
        }

        pushHistorySnapshot();

        const mergedPolygon = mergePolygons(polygons);
        if (!mergedPolygon) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Không thể gộp các thửa đất.' });
            return;
        }

        // Create new feature
        const newFeature = new Feature({ geometry: mergedPolygon });
        newFeature.set('sodoto', soTo);
        newFeature.set('sothua', soThua);
        newFeature.set('loaidat', originalFeatures[0].feature.get('loaidat') || '');
        newFeature.set('is_primary', true);

        // Remove original features
        originalFeatures.forEach(f => editSource.current.removeFeature(f.feature));

        // Add merged feature
        editSource.current.addFeature(newFeature);
        setSelectedFeature(newFeature);
        updateVerticesFromFeature(newFeature);
        updateFeatureListState();

        const originalInfo = originalFeatures.map(f => ({ sodoto: f.sodoto, sothua: f.sothua, area: f.area }));
        const mergedInfo = [{ sodoto: soTo, sothua: soThua, area: getArea(mergedPolygon) }];

        setSplitMergeResultModal({
            isOpen: true,
            type: 'merge',
            originalFeatures: originalInfo,
            newFeatures: mergedInfo
        });
    } catch (err: any) {
        setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: err.message || 'Không thể gộp thửa đất.' });
    }
};

const executeSplit = (cutGeom: LineString | Polygon, featureToSplit?: Feature, config?: { soTo: string; soThuaStart: number }) => {
    const feature = featureToSplit || featureToSplitRef.current || selectedFeature;
    const splitConfig = config || splitConfigRef.current;

    if (!feature || !splitConfig) {
        return;
    }

    const { soTo, soThuaStart } = splitConfig;

    try {
        pushHistorySnapshot();

        const featureGeometry = feature.getGeometry();
        let originalPolygon: Polygon | null = null;
        if (featureGeometry instanceof Polygon) {
            originalPolygon = featureGeometry;
        } else if (featureGeometry instanceof MultiPolygon) {
            const polygons = featureGeometry.getPolygons();
            originalPolygon = polygons[0] || null;
        }

        if (!originalPolygon) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Thửa đất cần tách phải là vùng polygon hợp lệ.' });
            setIsSplitMode(false);
            setActiveInteraction('SELECT');
            return;
        }

        const originalArea = getArea(originalPolygon);
        const originalInfo = {
            sodoto: feature.get('sodoto'),
            sothua: feature.get('sothua'),
            area: originalArea
        };

        let newPolygons: Polygon[] = [];

        {
            const ring = originalPolygon.getCoordinates()[0] as [number, number][];
            const lineCoords = (cutGeom instanceof Polygon ? cutGeom.getCoordinates()[0] : cutGeom.getCoordinates()) as [number, number][];

            type SplitIntersection = {
                point: [number, number];
                lineIndex: number;
                lineT: number;
                lineDistance: number;
                ringIndex: number;
                ringT: number;
                ringPosition: number;
            };

            const segmentIntersections = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) => {
                const r = [b[0] - a[0], b[1] - a[1]];
                const s = [d[0] - c[0], d[1] - c[1]];
                const denom = r[0] * s[1] - r[1] * s[0];
                const cross = (p: [number, number], q: [number, number], origin: [number, number]) => (p[0] - origin[0]) * (q[1] - origin[1]) - (p[1] - origin[1]) * (q[0] - origin[0]);
                const lineLengthSq = r[0] * r[0] + r[1] * r[1];
                const ringLengthSq = s[0] * s[0] + s[1] * s[1];
                if (lineLengthSq === 0 || ringLengthSq === 0) return [];

                if (Math.abs(denom) < 1e-9) {
                    if (Math.abs(cross(c, b, a)) > 0.001 || Math.abs(cross(d, b, a)) > 0.001) return [];

                    const projected = [
                        { point: c, lineT: ((c[0] - a[0]) * r[0] + (c[1] - a[1]) * r[1]) / lineLengthSq, ringT: 0 },
                        { point: d, lineT: ((d[0] - a[0]) * r[0] + (d[1] - a[1]) * r[1]) / lineLengthSq, ringT: 1 },
                    ].filter(({ lineT }) => lineT >= -1e-9 && lineT <= 1 + 1e-9);

                    return projected.map(({ point, lineT, ringT }) => ({
                        point: [...point] as [number, number],
                        lineIndex: 0,
                        lineT,
                        lineDistance: 0,
                        ringIndex: 0,
                        ringT,
                        ringPosition: 0
                    }));
                }

                const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / denom;
                const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / denom;
                if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return [];
                return [{
                    point: [a[0] + t * r[0], a[1] + t * r[1]] as [number, number],
                    lineIndex: 0,
                    lineT: t,
                    lineDistance: 0,
                    ringIndex: 0,
                    ringT: u,
                    ringPosition: 0
                }];
            };

            const lineLengths: number[] = [0];
            for (let i = 0; i < lineCoords.length - 1; i++) {
                const a = lineCoords[i];
                const b = lineCoords[i + 1];
                lineLengths.push(lineLengths[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
            }

            const intersections: SplitIntersection[] = [];
            for (let li = 0; li < lineCoords.length - 1; li++) {
                for (let ri = 0; ri < ring.length - 1; ri++) {
                    const hits = segmentIntersections(lineCoords[li], lineCoords[li + 1], ring[ri], ring[ri + 1]);
                    hits.forEach((hit) => {
                        hit.lineIndex = li;
                        hit.ringIndex = ri;
                        hit.lineDistance = lineLengths[li] + hit.lineT * Math.hypot(lineCoords[li + 1][0] - lineCoords[li][0], lineCoords[li + 1][1] - lineCoords[li][1]);
                        hit.ringPosition = ri + hit.ringT;
                        if (!intersections.some(existing => Math.hypot(existing.point[0] - hit.point[0], existing.point[1] - hit.point[1]) < 0.001)) {
                            intersections.push(hit);
                        }
                    });
                }
            }

            intersections.sort((a, b) => a.lineDistance - b.lineDistance);
            if (intersections.length < 2) {
                setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Đường cắt phải đi xuyên qua thửa đất.' });
                setIsSplitMode(false);
                setActiveInteraction('SELECT');
                return;
            }

            const startHit = intersections[0];
            const endHit = intersections[intersections.length - 1];
            const ringStart = startHit.ringPosition <= endHit.ringPosition ? startHit : endHit;
            const ringEnd = startHit.ringPosition <= endHit.ringPosition ? endHit : startHit;

            const cutPath = [startHit.point];
            for (let i = startHit.lineIndex + 1; i <= endHit.lineIndex; i++) {
                cutPath.push(lineCoords[i]);
            }
            cutPath.push(endHit.point);

            const ringPathForward = [ringStart.point];
            for (let i = ringStart.ringIndex + 1; i <= ringEnd.ringIndex; i++) {
                ringPathForward.push(ring[i]);
            }
            ringPathForward.push(ringEnd.point);

            const ringPathBackward = [ringEnd.point];
            for (let i = ringEnd.ringIndex + 1; i < ring.length - 1; i++) {
                ringPathBackward.push(ring[i]);
            }
            for (let i = 0; i <= ringStart.ringIndex; i++) {
                ringPathBackward.push(ring[i]);
            }
            ringPathBackward.push(ringStart.point);

            const cutFromRingStartToEnd = ringStart === startHit ? cutPath : [...cutPath].reverse();
            const cutFromRingEndToStart = [...cutFromRingStartToEnd].reverse();

            const closeRing = (coords: [number, number][]) => {
                const cleaned = coords.filter((coord, index) => index === 0 || Math.hypot(coord[0] - coords[index - 1][0], coord[1] - coords[index - 1][1]) > 0.001);
                const first = cleaned[0];
                const last = cleaned[cleaned.length - 1];
                if (first && last && Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.001) {
                    cleaned.push([...first] as [number, number]);
                }
                return cleaned;
            };

            [
                closeRing([...ringPathForward, ...cutFromRingEndToStart.slice(1)]),
                closeRing([...ringPathBackward, ...cutFromRingStartToEnd.slice(1)])
            ].forEach((coords) => {
                if (coords.length >= 4) {
                    const poly = new Polygon([coords]);
                    if (getArea(poly) > 0.01) {
                        newPolygons.push(poly);
                    }
                }
            });
        }

        if (newPolygons.length < 2) {
            setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: 'Không thể tách thửa với hình cắt này.' });
            setIsSplitMode(false);
            setActiveInteraction('SELECT');
            return;
        }

        // Remove original feature
        editSource.current.removeFeature(feature);

        // Create features with sequential numbers
        const newFeatures: Feature[] = newPolygons.map((poly, idx) => {
            const f = createFeatureFromPolygon(poly, feature, soTo, String(soThuaStart + idx));
            return f;
        });

        editSource.current.addFeatures(newFeatures);
        setSelectedFeature(newFeatures[0]);
        updateVerticesFromFeature(newFeatures[0]);
        updateFeatureListState();

        setSplitMergeResultModal({
            isOpen: true,
            type: 'split',
            originalFeatures: [originalInfo],
            newFeatures: newFeatures.map((f, i) => ({
                sodoto: f.get('sodoto'),
                sothua: f.get('sothua'),
                area: getArea(f.getGeometry() as any)
            }))
        });
    } catch (err: any) {
        setDialog({ isOpen: true, type: 'error', title: 'Lỗi', message: err.message || 'Không thể tách thửa đất.' });
    }

    setIsSplitMode(false);
    setActiveInteraction('SELECT');
};

const handleConfirmSplitMergeResult = () => {
    setSplitMergeResultModal({ isOpen: false, type: 'split', originalFeatures: [], newFeatures: [] });
};

const handleCancelSplitMode = () => {
    setIsSplitMode(false);
    setActiveInteraction('SELECT');
    splitConfigRef.current = null;
    featureToSplitRef.current = null;
};

const canSplit = !!selectedFeature && featuresList.length === 1 && !!selectedFeature.get('sodoto') && !!selectedFeature.get('sothua');
const canMerge = selectedFeatureUids.length >= 2;

    return {
        splitModal,
        setSplitModal,
        mergeModal,
        setMergeModal,
        splitMergeResultModal,
        setSplitMergeResultModal,
        splitConfigRef,
        featureToSplitRef,
        isSplitMode,
        setIsSplitMode,
        handleSplitFeature,
        handleOpenSplitModal,
        handleMergeFeatures,
        executeMerge,
        executeSplit,
        handleConfirmSplitMergeResult,
        handleCancelSplitMode,
        canSplit,
        canMerge
    };
};
