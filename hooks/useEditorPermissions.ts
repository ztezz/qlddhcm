import { useMemo } from 'react';
import { User, UserRole } from '../types';
import { DEFAULT_ROLE_PERMISSIONS, hasAnyPermission } from '../services/apiClient';

export const useEditorPermissions = (
    user: User | null,
    rolePermissions: any[],
    branchPermissions: any,
    targetTable: string,
    permissionLoading: boolean
) => {
    const currentPermissions = user?.role === UserRole.ADMIN
        ? DEFAULT_ROLE_PERMISSIONS[UserRole.ADMIN]
        : rolePermissions.find((rolePermission) => rolePermission.role === user?.role)?.permissions || (user?.role ? DEFAULT_ROLE_PERMISSIONS[user.role] || [] : []);

    const isBranchWriteAllowed = useMemo(() => {
        if (user?.role === UserRole.ADMIN) return true;
        if (!user?.branchId || !branchPermissions) return true;
        const branchPerms = branchPermissions[user.branchId];
        if (!branchPerms) return true;
        return !!branchPerms[targetTable]?.write;
    }, [user, branchPermissions, targetTable]);

    const canSaveToDb = !permissionLoading && hasAnyPermission(currentPermissions, ['SAVE_MAP_TO_DB']) && isBranchWriteAllowed;

    return {
        currentPermissions,
        isBranchWriteAllowed,
        canSaveToDb
    };
};