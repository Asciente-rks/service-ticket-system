import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import * as userRepository from '../modules/users/repositories/user.repository';
import { ROLES } from '../config/roles';

export const isAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const allowedAdminIds = [ROLES.ADMIN, ROLES.SUPER_ADMIN];
        if (!allowedAdminIds.includes(req.user.roleId)) {
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
        if (req.user.id == userIdToCheck) {
            return next();
        }
        const allowedAdminIds = [ROLES.ADMIN, ROLES.SUPER_ADMIN];
        if (allowedAdminIds.includes(req.user.roleId)) {
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

            if (req.user.roleId === ROLES.SUPER_ADMIN) {
                return next();
            }

            if (!allowedRoleIds.includes(req.user.roleId)) {
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
        if (targetUserId == actorId) {
            return next();
        }

        if (req.user.roleId === ROLES.SUPER_ADMIN) {
            return next();
        }

        if (req.user.roleId === ROLES.ADMIN) {
            const targetUser = await userRepository.findById(targetUserId);
            if (!targetUser) return res.status(404).json({ message: 'User not found' });

            if (targetUser.roleId === ROLES.ADMIN || targetUser.roleId === ROLES.SUPER_ADMIN) {
                return res.status(403).json({ message: 'Admins cannot modify other Admins or SuperAdmins' });
            }
            return next();
        }

        return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });

    } catch (error) {
        res.status(500).json({ message: 'Error checking hierarchy', error });
    }
};
