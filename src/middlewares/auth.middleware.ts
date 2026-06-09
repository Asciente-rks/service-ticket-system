import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        roleId: string | null;
        organizationId: string | null;
        email: string;
        role: string;
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token not found' });
    }

    jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

/**
 * Tenant gate: routes that operate on org-scoped data require the caller to
 * belong to an organization. Users who have registered but not yet joined or
 * created an org are blocked here and must complete onboarding first.
 */
export const requireOrganization = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!req.user.organizationId) {
        return res.status(403).json({
            message: 'No organization selected. Create or join an organization to continue.',
            code: 'NO_ORGANIZATION',
        });
    }
    next();
};
