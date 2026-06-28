import Feature from 'ol/Feature';
import { Polygon, MultiPolygon, Point, LineString } from 'ol/geom';
import * as style from 'ol/style';
import { getArea, getLength } from 'ol/sphere';

export const getEditStyle = (feature: Feature): style.Style[] => {
    const isNearby = Boolean(feature.get('is_nearby'));
    const isPrimary = Boolean(feature.get('is_primary'));
    const strokeColor = isPrimary ? '#f59e0b' : (isNearby ? '#10b981' : '#3b82f6');
    const fillColor = isPrimary ? 'rgba(245, 158, 11, 0.18)' : (isNearby ? 'rgba(16, 185, 129, 0.14)' : 'rgba(59, 130, 246, 0.1)');

    const styles = [
        new style.Style({
            fill: new style.Fill({ color: fillColor }),
            stroke: new style.Stroke({ color: strokeColor, width: isPrimary ? 2.5 : 2 })
        })
    ];

    const geom = feature.getGeometry();
    let coords: any[] = [];
    if (geom instanceof Polygon) {
        coords = geom.getCoordinates()[0];
    } else if (geom instanceof MultiPolygon) {
        const polyCoords = geom.getCoordinates();
        if (polyCoords.length > 0 && polyCoords[0].length > 0) {
            coords = polyCoords[0][0];
        }
    }

    // Settings retrieved from feature properties (allows dynamic toggling on/off)
    const showVertexNumbers = feature.get('showVertexNumbers') !== false;
    const showSegmentLengths = Boolean(feature.get('showSegmentLengths'));
    const showParcelInfo = Boolean(feature.get('showParcelInfo'));

    // 1. Show Vertex Numbers
    if (showVertexNumbers && coords.length > 0) {
        coords.slice(0, -1).forEach((coord, index) => {
            styles.push(new style.Style({
                geometry: new Point(coord),
                image: new style.Circle({
                    radius: 4,
                    fill: new style.Fill({ color: '#fff' }),
                    stroke: new style.Stroke({ color: strokeColor, width: 2 })
                }),
                text: new style.Text({
                    text: (index + 1).toString(),
                    font: 'bold 10px sans-serif',
                    fill: new style.Fill({ color: '#94a3b8' }),
                    offsetX: 10,
                    offsetY: -10,
                    textAlign: 'left'
                })
            }));
        });
    }

    // 2. Show Segment Lengths
    if (showSegmentLengths && coords.length > 1) {
        for (let i = 0; i < coords.length - 1; i++) {
            const p1 = coords[i];
            const p2 = coords[i + 1];
            const line = new LineString([p1, p2]);
            const length = getLength(line);
            
            if (length > 0.1) {
                const midpoint = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
                styles.push(new style.Style({
                    geometry: new Point(midpoint),
                    text: new style.Text({
                        text: `${length.toFixed(1)}m`,
                        font: 'bold 9px sans-serif',
                        fill: new style.Fill({ color: '#10b981' }),
                        backgroundFill: new style.Fill({ color: 'rgba(15, 23, 42, 0.85)' }),
                        backgroundStroke: new style.Stroke({ color: '#1e293b', width: 1 }),
                        padding: [2, 4, 2, 4],
                        offsetY: 0,
                        textAlign: 'center'
                    })
                }));
            }
        }
    }

    // 3. Show Parcel Info (Tờ/Thửa/Diện tích)
    if (showParcelInfo && geom) {
        let centerCoord: number[] | null = null;
        if (geom instanceof Polygon) {
            centerCoord = geom.getInteriorPoint().getCoordinates();
        } else if (geom instanceof MultiPolygon) {
            const interiorGeom = geom.getInteriorPoints();
            if (interiorGeom) {
                const coordsList = interiorGeom.getCoordinates();
                if (coordsList.length > 0) centerCoord = coordsList[0];
            }
        }
        
        if (centerCoord) {
            const soTo = feature.get('sodoto') || '?';
            const soThua = feature.get('sothua') || '?';
            const loaiDat = feature.get('loaidat') || '';
            const area = getArea(geom);
            
            const labelText = `Tờ: ${soTo}\nThửa: ${soThua}\n${loaiDat ? `Đất: ${loaiDat}\n` : ''}DT: ${area.toFixed(1)} m²`;
            
            styles.push(new style.Style({
                geometry: new Point(centerCoord),
                text: new style.Text({
                    text: labelText,
                    font: 'bold 10px sans-serif',
                    fill: new style.Fill({ color: '#f59e0b' }),
                    backgroundFill: new style.Fill({ color: 'rgba(15, 23, 42, 0.9)' }),
                    backgroundStroke: new style.Stroke({ color: '#d97706', width: 1 }),
                    padding: [4, 6, 4, 6],
                    textAlign: 'center',
                    offsetY: 0
                })
            }));
        }
    }

    return styles;
};

export const getSelectedStyle = (feature: Feature): style.Style[] => {
    const baseStyles = getEditStyle(feature);
    baseStyles[0].getStroke()?.setColor('#f97316');
    baseStyles[0].getStroke()?.setWidth(3);
    baseStyles[0].getStroke()?.setLineDash([5, 5]);
    return baseStyles;
};
