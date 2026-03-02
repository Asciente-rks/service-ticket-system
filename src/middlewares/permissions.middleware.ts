import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import * as userRepository from '../modules/users/repositories/user.repository';
import * as roleRepository from '../modules/users/repositories/role.repository';
import { Role } from '../modules/users/models/role.model';

export const isAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        if (req.user.role !== 'Admin' && req.user.role !== 'SuperAdmin') {
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
        if (req.user.role === 'Admin' || req.user.role === 'SuperAdmin') {
            return next();
        }
        return res.status(403).json({ message: 'Not authorized to perform this action' });
    } catch (error) {
        res.status(500).json({ message: 'Error checking permissions', error });
    }
};

export const authorizeRoles = (allowedRoles: string[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

            if (req.user.role === 'SuperAdmin') {
                return next();
            }

            if (!allowedRoles.includes(req.user.role)) {
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

        if (req.user.role === 'SuperAdmin') {
            return next();
        }

        if (req.user.role === 'Admin') {
            const targetUser = await userRepository.findById(targetUserId, {
                include: [{ model: Role, as: 'role' }]
            });
            if (!targetUser) return res.status(404).json({ message: 'User not found' });

            const targetRole = (targetUser as any).role;
            if (targetRole && (targetRole.name === 'Admin' || targetRole.name === 'SuperAdmin')) {
                return res.status(403).json({ message: 'Admins cannot modify other Admins or SuperAdmins' });
            }
            return next();
        }

        return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });

    } catch (error) {
        res.status(500).json({ message: 'Error checking hierarchy', error });
    }
};
