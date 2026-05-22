import Feature from 'ol/Feature';
import { Polygon, MultiPolygon, Point } from 'ol/geom';
import * as style from 'ol/style';

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

    if (coords.length > 0) {
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
    return styles;
};

export const getSelectedStyle = (feature: Feature): style.Style[] => {
    const baseStyles = getEditStyle(feature);
    baseStyles[0].getStroke()?.setColor('#f97316');
    baseStyles[0].getStroke()?.setWidth(3);
    baseStyles[0].getStroke()?.setLineDash([5, 5]);
    return baseStyles;
};
