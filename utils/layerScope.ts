import { WMSLayerConfig } from '../types';
import { removeAccents } from './helpers';

export type MapScope = 'MAIN' | 'ADMIN' | 'SHARED';

const normalizeScope = (value: unknown): MapScope | null => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'MAIN' || normalized === 'ADMIN' || normalized === 'SHARED') {
        return normalized as MapScope;
    }
    return null;
};

export const getLayerScope = (layer: WMSLayerConfig): MapScope => {
    const explicitScope = normalizeScope(layer.mapScope);
    if (explicitScope) {
        return explicitScope;
    }

    const mapHints = Array.isArray(layer.availableMaps)
        ? layer.availableMaps.map((item) => normalizeScope(item)).filter(Boolean) as MapScope[]
        : [];

    if (mapHints.includes('MAIN') && mapHints.includes('ADMIN')) {
        return 'SHARED';
    }
    if (mapHints.includes('MAIN')) {
        return 'MAIN';
    }
    if (mapHints.includes('ADMIN')) {
        return 'ADMIN';
    }

    const hintText = removeAccents(`${layer.description || ''} ${layer.name || ''} ${layer.layers || ''}`.toLowerCase());
    if (hintText.includes('[map:shared]') || hintText.includes('[map:all]') || hintText.includes('#map-shared') || hintText.includes('scope:shared')) {
        return 'SHARED';
    }
    if (hintText.includes('[map:admin]') || hintText.includes('#map-admin') || hintText.includes('scope:admin')) {
        return 'ADMIN';
    }
    if (hintText.includes('[map:main]') || hintText.includes('#map-main') || hintText.includes('scope:main')) {
        return 'MAIN';
    }

    return String(layer.category || 'STANDARD').toUpperCase() === 'ADMINISTRATIVE' ? 'ADMIN' : 'MAIN';
};

export const isLayerVisibleInMap = (layer: WMSLayerConfig, targetMap: 'MAIN' | 'ADMIN') => {
    const scope = getLayerScope(layer);
    return scope === 'SHARED' || scope === targetMap;
};

export const filterLayersByMap = (layers: WMSLayerConfig[], targetMap: 'MAIN' | 'ADMIN') => {
    return layers.filter((layer) => isLayerVisibleInMap(layer, targetMap));
};