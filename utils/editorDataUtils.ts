import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import { MultiPolygon, Polygon } from 'ol/geom';
import * as proj from 'ol/proj';
import { getArea } from 'ol/sphere';
import { exportDxfFile, exportGeoJsonFile, exportShpZipFile } from './parcelExport';
import { registerDynamicVn2000, Vn2000Zone } from './editorProjection';

export type EditorCoordSystem = 'VN2000' | 'WGS84';
export type EditorVertex = { x: number; y: number };

export const detectGeoJsonProjection = (geoJson: any): string => {
    let coord: number[] | null = null;
    const findCoord = (arr: any[]): number[] | null => {
        if (arr.length >= 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') return arr as number[];
        if (Array.isArray(arr[0])) return findCoord(arr[0]);
        return null;
    };

    if (geoJson.type === 'FeatureCollection' && geoJson.features?.length > 0) {
        const geom = geoJson.features[0].geometry;
        if (geom && geom.coordinates) coord = findCoord(geom.coordinates);
    } else if (geoJson.type === 'Feature' && geoJson.geometry) {
        const geom = geoJson.geometry;
        if (geom && geom.coordinates) coord = findCoord(geom.coordinates);
    } else if (geoJson.coordinates) {
        coord = findCoord(geoJson.coordinates);
    }

    if (coord) {
        const [x, y] = coord;
        if (Math.abs(x) > 180 || Math.abs(y) > 90) return 'EPSG:9210';
    }
    return 'EPSG:4326';
};

export const validateEditorGeometry = (geometry: any): string | null => {
    if (!geometry) return 'Hình v? không h?p l?';

    let coords: any[] = [];

    if (geometry instanceof Polygon) {
        coords = geometry.getCoordinates()[0];
    } else if (geometry instanceof MultiPolygon) {
        const polyCoords = geometry.getCoordinates();
        if (polyCoords.length > 0 && polyCoords[0].length > 0) {
            coords = polyCoords[0][0];
        }
    } else {
        return 'Lo?i hình h?c không h? tr?';
    }

    if (coords.length < 4) return 'Polygon c?n t?i thi?u 3 d?nh (=4 khi tính di?m khép)';

    const area = getArea(geometry);
    if (area === 0) return 'Polygon có di?n tích b?ng 0';
    if (area < 1) return `Di?n tích quá nh? (${area.toFixed(2)}m²). Ki?m tra l?i t?a d?.`;

    for (let i = 0; i < coords.length - 2; i++) {
        for (let j = i + 2; j < coords.length - 1; j++) {
            if (i === 0 && j === coords.length - 2) continue;
            const line1Start = coords[i];
            const line1End = coords[i + 1];
            const line2Start = coords[j];
            const line2End = coords[j + 1];

            const denom = (line2End[1] - line2Start[1]) * (line1End[0] - line1Start[0]) - (line2End[0] - line2Start[0]) * (line1End[1] - line1Start[1]);
            if (Math.abs(denom) > 1e-10) {
                const ua = ((line2End[0] - line2Start[0]) * (line1Start[1] - line2Start[1]) - (line2End[1] - line2Start[1]) * (line1Start[0] - line2Start[0])) / denom;
                const ub = ((line1End[0] - line1Start[0]) * (line1Start[1] - line2Start[1]) - (line1End[1] - line1Start[1]) * (line1Start[0] - line2Start[0])) / denom;
                if (ua > 0.001 && ua < 0.999 && ub > 0.001 && ub < 0.999) {
                    return `Polygon t? c?t t?i do?n ${i + 1}-${i + 2} và ${j + 1}-${j + 2}`;
                }
            }
        }
    }

    return null;
};

export const exportCoordsTxt = (vertices: EditorVertex[], coordSystem: EditorCoordSystem, centralMeridian: number, projectionZone: Vn2000Zone) => {
    if (vertices.length === 0) return;
    let content = `DANH SÁCH T?A Ð? TH?A Ð?T - H?: ${coordSystem}\n`;
    content += `STT\tX (m)\tY (m)\n`;
    content += `------------------------------------\n`;
    const vnProj = registerDynamicVn2000(centralMeridian, projectionZone);
    vertices.forEach((v, i) => {
        let displayX: string;
        let displayY: string;
        if (coordSystem === 'VN2000') {
            const point = proj.transform([v.x, v.y], 'EPSG:3857', vnProj);
            displayX = point[0].toFixed(3);
            displayY = point[1].toFixed(3);
        } else {
            const point = proj.transform([v.x, v.y], 'EPSG:3857', 'EPSG:4326');
            displayX = point[0].toFixed(8);
            displayY = point[1].toFixed(8);
        }
        content += `${i + 1}\t${displayX}\t${displayY}\n`;
    });

    const firstVertex = vertices[0];
    let firstX: string;
    let firstY: string;
    if (coordSystem === 'VN2000') {
        const point = proj.transform([firstVertex.x, firstVertex.y], 'EPSG:3857', vnProj);
        firstX = point[0].toFixed(3);
        firstY = point[1].toFixed(3);
    } else {
        const point = proj.transform([firstVertex.x, firstVertex.y], 'EPSG:3857', 'EPSG:4326');
        firstX = point[0].toFixed(8);
        firstY = point[1].toFixed(8);
    }
    content += `${vertices.length + 1}\t${firstX}\t${firstY}\n`;

    const blob = new Blob([content], { type: 'text/plain' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `ToaDo_${coordSystem}_${Date.now()}.txt`;
    anchor.click();
};

const featuresToGeoJson = (features: Feature[]) => new GeoJSON().writeFeaturesObject(features, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857'
}) as any;

export const exportFeaturesGeoJson = (features: Feature[]) => {
    if (features.length === 0) return;
    exportGeoJsonFile(featuresToGeoJson(features), `GeoMaster_${Date.now()}.geojson`);
};

export const exportFeaturesShpZip = async (features: Feature[]) => {
    if (features.length === 0) return;
    await exportShpZipFile(featuresToGeoJson(features), `GeoMaster_${Date.now()}.zip`);
};

export const exportFeaturesDxf = (features: Feature[], coordSystem: EditorCoordSystem) => {
    if (features.length === 0) return false;
    exportDxfFile(featuresToGeoJson(features), `GeoMaster_${coordSystem}_${Date.now()}.dxf`, coordSystem);
    return true;
};