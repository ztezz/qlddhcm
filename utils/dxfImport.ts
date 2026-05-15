import DxfParser, { ICircleEntity, IEllipseEntity, ILwpolylineEntity, IPolylineEntity } from 'dxf-parser';
import Feature from 'ol/Feature';
import { MultiPolygon, Polygon } from 'ol/geom';
import * as proj from 'ol/proj';
import { validateGeometry } from './editorValidation';

const closeRing = (coords: number[][]) => {
    if (coords.length === 0) return coords;
    const [fx, fy] = coords[0];
    const [lx, ly] = coords[coords.length - 1];
    if (fx !== lx || fy !== ly) {
        return [...coords, [fx, fy]];
    }
    return coords;
};

const transformCoord = (coord: number[], dataProjection: string) => {
    if (dataProjection === 'EPSG:3857') return coord;
    return proj.transform(coord, dataProjection, 'EPSG:3857');
};

const approximateCircle = (entity: ICircleEntity, segments = 48) => {
    const coords: number[][] = [];
    for (let i = 0; i < segments; i++) {
        const angle = (Math.PI * 2 * i) / segments;
        coords.push([
            entity.center.x + Math.cos(angle) * entity.radius,
            entity.center.y + Math.sin(angle) * entity.radius
        ]);
    }
    return closeRing(coords);
};

const approximateEllipse = (entity: IEllipseEntity, segments = 64) => {
    const start = Number.isFinite(entity.startAngle) ? entity.startAngle : 0;
    const end = Number.isFinite(entity.endAngle) ? entity.endAngle : Math.PI * 2;
    const total = Math.abs(end - start) < 0.0001 ? Math.PI * 2 : end - start;
    const major = entity.majorAxisEndPoint;
    const majorLength = Math.sqrt((major.x ** 2) + (major.y ** 2)) || 1;
    const minorLength = majorLength * (entity.axisRatio || 1);
    const rotation = Math.atan2(major.y, major.x);
    const coords: number[][] = [];

    for (let i = 0; i < segments; i++) {
        const angle = start + (total * i) / segments;
        const localX = Math.cos(angle) * majorLength;
        const localY = Math.sin(angle) * minorLength;
        const x = entity.center.x + (localX * Math.cos(rotation) - localY * Math.sin(rotation));
        const y = entity.center.y + (localX * Math.sin(rotation) + localY * Math.cos(rotation));
        coords.push([x, y]);
    }

    return closeRing(coords);
};

const toRingFromPolyline = (entity: ILwpolylineEntity | IPolylineEntity) => {
    const vertices = entity.vertices || [];
    const isClosed = 'shape' in entity ? !!entity.shape : false;
    if (!isClosed || vertices.length < 3) return null;
    const coords = vertices.map((vertex: any) => [vertex.x, vertex.y]);
    return closeRing(coords);
};

const detectProjectionFromCoords = (allCoords: number[][]): 'EPSG:9210' | 'EPSG:4326' => {
    for (const [x, y] of allCoords) {
        if (Math.abs(x) > 180 || Math.abs(y) > 90) return 'EPSG:9210';
    }
    return 'EPSG:4326';
};

export interface DxfImportSummary {
    imported: number;
    skipped: number;
    skippedByType: Record<string, number>;
    projection: 'EPSG:9210' | 'EPSG:4326';
}

export const importDxfAsPolygonFeatures = (text: string) => {
    const parser = new DxfParser();
    const dxf = parser.parseSync(text);
    const entities = Array.isArray((dxf as any).entities) ? (dxf as any).entities : [];
    const candidateCoords: number[][] = [];

    entities.forEach((entity: any) => {
        if (entity?.type === 'LWPOLYLINE' || entity?.type === 'POLYLINE') {
            (entity.vertices || []).forEach((vertex: any) => {
                if (Number.isFinite(vertex?.x) && Number.isFinite(vertex?.y)) {
                    candidateCoords.push([vertex.x, vertex.y]);
                }
            });
        }
        if (entity?.type === 'CIRCLE' && entity.center) {
            candidateCoords.push([entity.center.x + entity.radius, entity.center.y]);
        }
        if (entity?.type === 'ELLIPSE' && entity.center) {
            candidateCoords.push([entity.center.x, entity.center.y]);
        }
    });

    const projection = detectProjectionFromCoords(candidateCoords);
    const skippedByType: Record<string, number> = {};
    const features: Feature[] = [];

    const skip = (type: string) => {
        skippedByType[type] = (skippedByType[type] || 0) + 1;
    };

    entities.forEach((entity: any) => {
        let ring: number[][] | null = null;
        if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
            ring = toRingFromPolyline(entity);
        } else if (entity.type === 'CIRCLE') {
            ring = approximateCircle(entity);
        } else if (entity.type === 'ELLIPSE') {
            const isFullEllipse = !Number.isFinite(entity.startAngle) || !Number.isFinite(entity.endAngle) || Math.abs((entity.endAngle - entity.startAngle) - Math.PI * 2) < 0.01;
            ring = isFullEllipse ? approximateEllipse(entity) : null;
        }

        if (!ring) {
            skip(entity.type || 'UNKNOWN');
            return;
        }

        const transformedRing = ring.map((coord) => transformCoord(coord, projection));
        const geometry = new Polygon([transformedRing]);
        const validationError = validateGeometry(geometry);
        if (validationError) {
            skip(entity.type || 'UNKNOWN');
            return;
        }

        const feature = new Feature({
            geometry,
            sourceType: entity.type,
            layer: entity.layer || '',
            sourceHandle: entity.handle || ''
        });
        features.push(feature);
    });

    return {
        features,
        summary: {
            imported: features.length,
            skipped: Object.values(skippedByType).reduce((sum, count) => sum + count, 0),
            skippedByType,
            projection
        } as DxfImportSummary
    };
};
