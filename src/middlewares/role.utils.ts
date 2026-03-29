import { ROLES } from '../config/roles';

export const isStaffRole = (roleId: string | undefined): boolean => {
    const normalized = (roleId || '').toLowerCase();
    return normalized === ROLES.DEVELOPER.toLowerCase() || normalized === ROLES.TESTER.toLowerCase();
};

export const isAdminRole = (roleId: string | undefined): boolean => {
    const normalized = (roleId || '').toLowerCase();
    return normalized === ROLES.ADMIN.toLowerCase() || normalized === ROLES.SUPER_ADMIN.toLowerCase();
};