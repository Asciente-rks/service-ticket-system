import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { Role } from '../modules/users/models/role.model';

export const isAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const adminRole = await Role.findOne({ where: { name: 'Admin' } });
        
        if (!adminRole || req.user.roleId !== adminRole.id) {
            return res.status(403).json({ message: 'Require Admin Role' });
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

        if (req.user.id === userIdToCheck) {
            return next();
        }
        const adminRole = await Role.findOne({ where: { name: 'Admin' } });
        if (adminRole && req.user.roleId === adminRole.id) {
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
            const userRole = await Role.findByPk(req.user.roleId);
            if (!userRole || !allowedRoles.includes(userRole.name)) {
                return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
            }
            next();
        } catch (error) {
            res.status(500).json({ message: 'Error checking permissions', error });
        }
    };
};
