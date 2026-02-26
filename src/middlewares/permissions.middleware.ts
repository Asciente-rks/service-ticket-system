import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { Role } from '../modules/users/models/role.model';
import { User } from '../modules/users/models/user.model';

export const isAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const userRole = await Role.findByPk(req.user.roleId);
        
        if (!userRole || (userRole.name !== 'Admin' && userRole.name !== 'SuperAdmin')) {
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

        if (req.user.id === userIdToCheck) {
            return next();
        }
        const userRole = await Role.findByPk(req.user.roleId);
        if (userRole && (userRole.name === 'Admin' || userRole.name === 'SuperAdmin')) {
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
            
            // SuperAdmin has access to everything
            if (userRole && userRole.name === 'SuperAdmin') {
                return next();
            }

            if (!userRole || !allowedRoles.includes(userRole.name)) {
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
        
        // Allow users to modify themselves
        if (targetUserId === actorId) {
            return next();
        }

        const actorRole = await Role.findByPk(req.user.roleId);
        if (!actorRole) return res.status(403).json({ message: 'Role not found' });

        // SuperAdmin can do anything
        if (actorRole.name === 'SuperAdmin') {
            return next();
        }

        // If actor is Admin, check target's role
        if (actorRole.name === 'Admin') {
            const targetUser = await User.findByPk(targetUserId);
            if (!targetUser) return res.status(404).json({ message: 'User not found' });

            const targetRole = await Role.findByPk(targetUser.roleId);
            if (targetRole && (targetRole.name === 'Admin' || targetRole.name === 'SuperAdmin')) {
                return res.status(403).json({ message: 'Admins cannot modify other Admins or SuperAdmins' });
            }
            return next();
        }

        // If not SuperAdmin or Admin (and not self), deny
        return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });

    } catch (error) {
        res.status(500).json({ message: 'Error checking hierarchy', error });
    }
};
