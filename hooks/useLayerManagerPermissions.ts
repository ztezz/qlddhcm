import { hasAnyPermission } from '../services/apiClient';

export const useLayerManagerPermissions = (permissions: string[]) => ({
    canCreateTable: hasAnyPermission(permissions, ['CREATE_TABLES', 'MANAGE_TABLES']),
    canEditTable: hasAnyPermission(permissions, ['EDIT_TABLES', 'MANAGE_TABLES']),
    canDeleteTable: hasAnyPermission(permissions, ['DELETE_TABLES', 'MANAGE_TABLES']),
    canSyncTable: hasAnyPermission(permissions, ['SYNC_TABLES', 'MANAGE_TABLES']),
    canRepairTable: hasAnyPermission(permissions, ['REPAIR_TABLES', 'MANAGE_TABLES']),
    canImportGeoJsonParcels: hasAnyPermission(permissions, ['IMPORT_PARCELS', 'CREATE_TABLES', 'MANAGE_TABLES']),
    canCreateLayer: hasAnyPermission(permissions, ['CREATE_LAYERS', 'MANAGE_LAYERS']),
    canEditLayer: hasAnyPermission(permissions, ['EDIT_LAYERS', 'MANAGE_LAYERS']),
    canDeleteLayer: hasAnyPermission(permissions, ['DELETE_LAYERS', 'MANAGE_LAYERS']),
    canToggleLayer: hasAnyPermission(permissions, ['TOGGLE_LAYERS', 'MANAGE_LAYERS']),
    canCreateBasemap: hasAnyPermission(permissions, ['CREATE_BASEMAPS', 'MANAGE_BASEMAPS']),
    canEditBasemap: hasAnyPermission(permissions, ['EDIT_BASEMAPS', 'MANAGE_BASEMAPS']),
    canDeleteBasemap: hasAnyPermission(permissions, ['DELETE_BASEMAPS', 'MANAGE_BASEMAPS']),
    canReorderMapConfig: hasAnyPermission(permissions, ['REORDER_MAP_LAYERS', 'MANAGE_LAYERS', 'MANAGE_BASEMAPS'])
});