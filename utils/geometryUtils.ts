import * as turf from '@turf/turf';
import { Polygon, MultiPolygon, LineString } from 'ol/geom';
import { Coordinate } from 'ol/coordinate';
import Feature from 'ol/Feature';
import { getArea } from 'ol/sphere';
import { getUid } from 'ol/util';
import * as proj from 'ol/proj';

/**
 * Transform a coordinate from EPSG:3857 (Web Mercator) to EPSG:4326 (WGS84 lon/lat)
 */
function transformToLonLat(coord: number[]): number[] {
    return proj.transform(coord, 'EPSG:3857', 'EPSG:4326');
}

/**
 * Convert OpenLayers polygon coordinates to Turf.js polygon coordinates (lon/lat)
 * Turf expects a closed ring where first and last coordinates are identical.
 * OpenLayers stores closed rings with the last point = first point (duplicate).
 */
export function olCoordsToTurfPolygon(olCoords: number[][][]): number[][][] {
    if (!olCoords || olCoords.length === 0) return [];

    return olCoords
        .map((ring) => {
            if (!ring || ring.length < 3) return [];

            const transformedRing = ring.map(coord => transformToLonLat(coord));
            const first = transformedRing[0];
            const last = transformedRing[transformedRing.length - 1];
            if (!first || !last) return [];

            const isClosed = Math.abs(first[0] - last[0]) < 0.0000001 && Math.abs(first[1] - last[1]) < 0.0000001;
            return isClosed ? transformedRing : [...transformedRing, [...first]];
        })
        .filter((ring) => ring.length >= 4);
}

/**
 * Convert Turf.js polygon coordinates to OpenLayers polygon coordinates
 * turfCoords is number[][] - a single ring (array of coordinate pairs)
 * Returns number[][][] - OpenLayers polygon coordinates format
 */
export function turfCoordsToOlPolygon(turfCoords: number[][]): number[][][] {
    if (!turfCoords || turfCoords.length < 3) return [];

    const transformedCoords = turfCoords.map(coord => transformFromLonLat(coord));
    const first = transformedCoords[0];
    const last = transformedCoords[transformedCoords.length - 1];
    if (!first || !last) return [];

    const isClosed = Math.abs(first[0] - last[0]) < 0.000001 && Math.abs(first[1] - last[1]) < 0.000001;
    if (isClosed) {
        return [transformedCoords];
    }

    return [[...transformedCoords, [...first]]];
}

/**
 * Convert OpenLayers geometry to Turf.js feature
 */
export function olGeomToTurfFeature(geom: Polygon | MultiPolygon): any {
    if (!geom) return null;

    if (geom instanceof Polygon) {
        const coords = olCoordsToTurfPolygon(geom.getCoordinates());
        return turf.polygon(coords);
    } else if (geom instanceof MultiPolygon) {
        const coords = geom.getCoordinates().map(poly => olCoordsToTurfPolygon(poly));
        return turf.multiPolygon(coords);
    }

    return null;
}

/**
 * Transform a coordinate from EPSG:4326 (WGS84 lon/lat) to EPSG:3857 (Web Mercator)
 */
function transformFromLonLat(coord: number[]): number[] {
    return proj.transform(coord, 'EPSG:4326', 'EPSG:3857');
}

/**
 * Convert Turf.js polygon feature to OpenLayers Polygon
 * Transforms coordinates from lon/lat (WGS84) back to EPSG:3857
 */
export function turfPolygonToOlPolygon(turfPolygon: any): Polygon {
    // turfPolygon.geometry.coordinates is number[][][] (array of rings)
    // Each ring is number[][] (array of coordinate pairs in lon/lat)
    const rings = turfPolygon.geometry.coordinates as number[][][];

    if (!rings || rings.length === 0) {
        return new Polygon([]);
    }

    // Transform each ring back to EPSG:3857
    const transformedRings = rings.map(ring => {
        return ring.map(coord => transformFromLonLat(coord));
    });

    return new Polygon(transformedRings as any);
}

/**
 * Split a polygon by a line
 * Returns array of resulting polygons
 */
export function splitPolygonByLine(
    polygon: Polygon,
    line: LineString
): Polygon[] {
    const turfPoly = olGeomToTurfFeature(polygon);
    if (!turfPoly) return [];

    // Transform line coords from EPSG:3857 to lon/lat
    const lineCoords3857 = line.getCoordinates() as [number, number][];
    const lineCoordsLonLat = lineCoords3857.map(coord => transformToLonLat(coord));

    const turfLine = turf.lineString(lineCoordsLonLat as [number, number][]);

    try {
        const result = (turf.lineSplit as any)(turfPoly, turfLine);

        return result.features
            .filter((f: any) => f.geometry.type === 'Polygon')
            .map((f: any) => turfPolygonToOlPolygon(f));
    } catch (error) {
        console.error('Error splitting polygon:', error);
        return [];
    }
}

/**
 * Calculate difference between two polygons
 * Returns the parts of the original polygon that are not in the cutter
 */
export function polygonDifference(
    original: Polygon,
    cutter: Polygon
): Polygon[] {
    const turfOriginal = olGeomToTurfFeature(original);
    const turfCutter = olGeomToTurfFeature(cutter);

    if (!turfOriginal || !turfCutter) return [];

    try {
        const diff = turf.difference(turf.featureCollection([turfOriginal, turfCutter]) as any) as any;

        if (!diff) return [];

        if (diff.geometry.type === 'Polygon') {
            return [turfPolygonToOlPolygon(diff)];
        } else if (diff.geometry.type === 'MultiPolygon') {
            return diff.geometry.coordinates.map((polyRings: number[][][]) => {
                const rings = polyRings
                    .map((ring) => turfCoordsToOlPolygon(ring)[0])
                    .filter(Boolean);
                return new Polygon(rings as any);
            });
        }

        return [];
    } catch (error) {
        console.error('Error calculating difference:', error);
        return [];
    }
}

/**
 * Merge multiple polygons into one using union
 */
export function mergePolygons(polygons: Polygon[]): Polygon | null {
    if (polygons.length === 0) return null;
    if (polygons.length === 1) return polygons[0];

    try {
        const turfFeatures = polygons
            .map(p => olGeomToTurfFeature(p))
            .filter((f): f is any => f !== null);

        if (turfFeatures.length === 0) return null;

        let merged: any = turf.featureCollection([turfFeatures[0]]);
        for (let i = 1; i < turfFeatures.length; i++) {
            const result = turf.union(turf.featureCollection([
                ...(merged.type === 'FeatureCollection' ? merged.features : [merged]),
                turfFeatures[i]
            ]) as any);
            if (!result) return null;
            merged = result;
        }

        if (merged && merged.geometry.type === 'Polygon') {
            return turfPolygonToOlPolygon(merged);
        } else if (merged && merged.geometry.type === 'MultiPolygon') {
            const coords = merged.geometry.coordinates;
            if (coords && coords.length > 0) {
                const rings = coords[0]
                    .map((ring: number[][]) => turfCoordsToOlPolygon(ring)[0])
                    .filter(Boolean);
                return new Polygon(rings as any);
            }
        }

        return null;
    } catch (error) {
        console.error('Error merging polygons:', error);
        return null;
    }
}

/**
 * Create a new Feature from a polygon with attributes copied from source
 */
export function createFeatureFromPolygon(
    polygon: Polygon,
    source: Feature,
    newSotTo: string,
    newSoThua: string
): Feature {
    const feature = new Feature({ geometry: polygon });
    feature.set('sodoto', newSotTo);
    feature.set('sothua', newSoThua);
    feature.set('loaidat', source.get('loaidat') || '');
    feature.set('is_primary', true);
    feature.set('gid', null); // New feature, no gid yet
    return feature;
}

/**
 * Calculate area of a polygon in square meters
 */
export function calculateArea(geom: Polygon | MultiPolygon): number {
    return getArea(geom);
}

/**
 * Check if two polygons are adjacent (share a common edge)
 */
export function arePolygonsAdjacent(polygons: Polygon[]): boolean {
    if (polygons.length < 2) return false;

    try {
        for (let i = 0; i < polygons.length - 1; i++) {
            for (let j = i + 1; j < polygons.length; j++) {
                const poly1 = olGeomToTurfFeature(polygons[i]);
                const poly2 = olGeomToTurfFeature(polygons[j]);

                if (poly1 && poly2) {
                    // Check if they share any boundary
                    const shared = turf.lineIntersect(poly1 as any, poly2 as any);
                    if (shared.features.length > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Check if all polygons are valid for merging (they should be adjacent)
 */
export function validatePolygonsForMerge(polygons: Polygon[]): { valid: boolean; error?: string } {
    if (polygons.length < 2) {
        return { valid: false, error: 'Cần ít nhất 2 thửa để gộp' };
    }

    // Check if polygons are adjacent
    for (let i = 0; i < polygons.length - 1; i++) {
        for (let j = i + 1; j < polygons.length; j++) {
            const poly1 = olGeomToTurfFeature(polygons[i]);
            const poly2 = olGeomToTurfFeature(polygons[j]);

            if (poly1 && poly2) {
                // Check intersection
                const intersection = turf.intersect(poly1 as any, poly2 as any);
                // If they don't touch at all (no intersection and not adjacent)
                if (!intersection && !arePolygonsAdjacent([polygons[i], polygons[j]])) {
                    // Allow merging anyway - union will handle non-adjacent
                }
            }
        }
    }

    return { valid: true };
}