import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import * as userRepository from '../modules/users/repositories/user.repository';
import { ROLES } from '../config/roles';
import { isAdminRole, isStaffRole } from './role.utils';

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const userRole = req.user.roleId;

        if (!isAdminRole(userRole)) {
            return res.status(403).json({ message: 'Require Admin or SuperAdmin Role' });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error checking permissions', error });
    }
};

export const isOwnerOrAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const userIdToCheck = req.params.id;
        const actorRoleId = req.user.roleId;
        const actorId = String(req.user.id || '');

        // 1. Users can always access their own profile
        if (actorId == userIdToCheck) {
            return next();
        }

        // 2. SuperAdmins can access everything
        if ((actorRoleId || '').toLowerCase() === (ROLES.SUPER_ADMIN || '').toLowerCase()) {
            return next();
        }

        // If checking a specific user, we need to know their role
        const targetUser = await userRepository.findById(userIdToCheck);
        if (!targetUser) return res.status(404).json({ message: 'User not found' });
        const targetRoleId = targetUser.roleId;

        // 3. Admins can access Developers and Testers
        if ((actorRoleId || '').toLowerCase() === (ROLES.ADMIN || '').toLowerCase() && isStaffRole(targetRoleId)) {
            return next();
        }

        // 4. Developers and Testers can access fellow Developers and Testers (for reassignment)
        if (isStaffRole(actorRoleId) && isStaffRole(targetRoleId)) {
            return next();
        }

        return res.status(403).json({ message: 'Not authorized to perform this action' });
    } catch (error) {
        res.status(500).json({ message: 'Error checking permissions', error });
    }
};

export const authorizeRoles = (allowedRoleIds: string[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

            const userRole = (req.user.roleId || '').toLowerCase();
            const superAdminRole = (ROLES.SUPER_ADMIN || '').toLowerCase();
            const normalizedAllowed = allowedRoleIds.map(id => id.toLowerCase());

            if (userRole === superAdminRole) {
                return next();
            }

            if (!normalizedAllowed.includes(userRole)) {
                return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
            }
            next();
        } catch (error) {
            res.status(500).json({ message: 'Error checking permissions', error });
        }
    };
};

export const checkUserHierarchy = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const targetUserId = req.params.id;
        const actorId = req.user.id;
        const actorRoleId = req.user.roleId;

        if (targetUserId == actorId) {
            return next();
        }

        if (actorRoleId.toLowerCase() === ROLES.SUPER_ADMIN.toLowerCase()) {
            return next();
        }

        const targetUser = await userRepository.findById(targetUserId);
        if (!targetUser) return res.status(404).json({ message: 'User not found' });
        const targetRoleId = targetUser.roleId;

        if (actorRoleId.toLowerCase() === ROLES.ADMIN.toLowerCase()) {
            if (isAdminRole(targetRoleId)) {
                return res.status(403).json({ message: 'Admins cannot modify other Admins or SuperAdmins' });
            }
            return next();
        }

        if (isStaffRole(actorRoleId)) {
            if (isStaffRole(targetRoleId)) {
                return next();
            }
            return res.status(403).json({ message: 'Developers and Testers can only interact with fellow Developers or Testers' });
        }

        return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });

    } catch (error) {
        res.status(500).json({ message: 'Error checking hierarchy', error });
    }
};
