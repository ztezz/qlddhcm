import { Dispatch, MutableRefObject, SetStateAction, useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import { Draw } from 'ol/interaction';
import { LineString, Polygon } from 'ol/geom';
import { Vector as VectorSource } from 'ol/source';
import * as style from 'ol/style';
import { getArea, getLength } from 'ol/sphere';

type ActiveInteraction = 'SELECT' | 'AREA_SELECT' | 'DRAW' | 'MODIFY';

export const useEditorMeasure = (
    mapInstance: MutableRefObject<Map | null>,
    setActiveInteraction: Dispatch<SetStateAction<ActiveInteraction>>
) => {
    const measureSource = useRef<VectorSource>(new VectorSource());
    const measureDrawInteraction = useRef<Draw | null>(null);
    const [measureType, setMeasureType] = useState<'length' | 'area' | null>(null);
    const [measureValue, setMeasureValue] = useState<string | null>(null);

    useEffect(() => {
        if (!mapInstance.current) return;

        if (measureDrawInteraction.current) {
            mapInstance.current.removeInteraction(measureDrawInteraction.current);
            measureDrawInteraction.current = null;
        }

        if (measureType) {
            setActiveInteraction('SELECT');

            const drawType = measureType === 'length' ? 'LineString' : 'Polygon';
            const draw = new Draw({
                source: measureSource.current,
                type: drawType,
                style: new style.Style({
                    fill: new style.Fill({ color: 'rgba(244, 63, 94, 0.15)' }),
                    stroke: new style.Stroke({ color: '#f43f5e', width: 2, lineDash: [4, 4] }),
                    image: new style.Circle({
                        radius: 5,
                        stroke: new style.Stroke({ color: '#f43f5e', width: 2 }),
                        fill: new style.Fill({ color: '#fff' })
                    })
                })
            });

            draw.on('drawstart', (event) => {
                measureSource.current.clear();
                const geometry = event.feature.getGeometry();
                setMeasureValue(measureType === 'length' ? '0.00 m' : '0.00 m²');

                geometry?.on('change', (changeEvent) => {
                    const nextGeometry = changeEvent.target;
                    let result = '';
                    if (nextGeometry instanceof LineString) {
                        const length = getLength(nextGeometry);
                        result = `${length.toFixed(2)} m`;
                    } else if (nextGeometry instanceof Polygon) {
                        const area = getArea(nextGeometry);
                        result = `${area.toFixed(2)} m²`;
                    }
                    setMeasureValue(result);
                });
            });

            mapInstance.current.addInteraction(draw);
            measureDrawInteraction.current = draw;
        } else {
            measureSource.current.clear();
            setMeasureValue(null);
        }
    }, [measureType]);

    return {
        measureSource,
        measureDrawInteraction,
        measureType,
        setMeasureType,
        measureValue
    };
};