import shpwrite from '@mapbox/shp-write';
import * as proj from 'ol/proj';

export type ParcelExportFormat = 'geojson' | 'shp' | 'dxf';

type GeoJsonFeature = {
    type: 'Feature';
    geometry: any;
    properties: Record<string, any>;
};

type GeoJsonFeatureCollection = {
    type: 'FeatureCollection';
    features: GeoJsonFeature[];
};

const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

const normalizeFeatureCollection = (featureCollection: GeoJsonFeatureCollection): GeoJsonFeatureCollection => {
    const features = (featureCollection.features || []).map((feature) => {
        const props = feature?.properties || {};
        return {
            ...feature,
            properties: {
                ...props,
                sodoto: props.sodoto || props.so_to || props.shbando || '',
                sothua: props.sothua || props.so_thua || props.shthua || '',
                loaidat: props.loaidat || props.kyhieumucd || props.mucdich || '',
                dientich: Number.isFinite(Number(props.dientich ?? props.dien_tich ?? props.area))
                    ? Number(props.dientich ?? props.dien_tich ?? props.area)
                    : 0
            }
        };
    });

    return { type: 'FeatureCollection', features };
};

export const exportGeoJsonFile = (featureCollection: GeoJsonFeatureCollection, filename: string) => {
    const json = JSON.stringify(featureCollection, null, 2);
    downloadBlob(new Blob([json], { type: 'application/json' }), filename);
};

export const exportShpZipFile = async (featureCollection: GeoJsonFeatureCollection, filename: string) => {
    const normalized = normalizeFeatureCollection(featureCollection);
    if (!Array.isArray(normalized.features) || normalized.features.length === 0) {
        throw new Error('Không có dữ liệu hợp lệ để xuất SHP.');
    }

    const zipped = await shpwrite.zip(normalized as any, {
        outputType: 'arraybuffer',
        compression: 'STORE'
    });

    downloadBlob(new Blob([zipped], { type: 'application/zip' }), filename);
};

export const exportDxfFile = (featureCollection: GeoJsonFeatureCollection, filename: string, coordSystem: 'WGS84' | 'VN2000' = 'VN2000') => {
    const features = featureCollection.features || [];
    if (features.length === 0) {
        throw new Error('Không có dữ liệu để xuất DXF.');
    }

    let dxfContent = `  0
SECTION
  2
HEADER
  9
$ACADVER
  1
AC1021
  0
ENDSEC
  0
SECTION
  2
BLOCKS
  0
ENDSEC
  0
SECTION
  2
ENTITIES
`;

    let entityId = 0;

    const appendRing = (ring: any[], featureIndex: number, props: Record<string, any>) => {
        if (!Array.isArray(ring) || ring.length < 3) return;

        const transformedRing = coordSystem === 'VN2000'
            ? ring.map((c: any) => proj.transform(c, 'EPSG:4326', 'EPSG:9210'))
            : ring;

        dxfContent += `  0
LWPOLYLINE
  5
${entityId.toString(16).toUpperCase()}
  8
Thua_${props.sothua || featureIndex}
 70
1
 90
${transformedRing.length}
`;

        transformedRing.forEach((c: any) => {
            dxfContent += ` 10
${c[0]}
 20
${c[1]}
`;
        });
        entityId++;

        if (props.sodoto && props.sothua) {
            const centroid = [
                transformedRing.reduce((sum: number, p: any) => sum + p[0], 0) / transformedRing.length,
                transformedRing.reduce((sum: number, p: any) => sum + p[1], 0) / transformedRing.length
            ];
            dxfContent += `  0
TEXT
  5
${entityId.toString(16).toUpperCase()}
  8
Labels
 10
${centroid[0]}
 20
${centroid[1]}
 40
10
  1
${props.sodoto}/${props.sothua}
`;
            entityId++;
        }
    };

    features.forEach((feature, index) => {
        const geometry = feature?.geometry;
        const props = feature?.properties || {};
        if (!geometry) return;

        if (geometry.type === 'Polygon') {
            appendRing(geometry.coordinates?.[0], index, props);
            return;
        }

        if (geometry.type === 'MultiPolygon') {
            geometry.coordinates?.forEach((polygon: any) => appendRing(polygon?.[0], index, props));
        }
    });

    dxfContent += `  0
ENDSEC
  0
EOF
`;
    downloadBlob(new Blob([dxfContent], { type: 'application/dxf' }), filename);
};
