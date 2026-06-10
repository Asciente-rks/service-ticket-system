import { Response } from 'express';
import * as userService from '../services/user.service';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import { signUserToken } from '../../../utils/token';

export const getOwnProfile = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
        const profile = await userService.getOwnProfile(req.user.id);
        if (!profile) return res.status(404).json({ message: 'User not found' });
        res.status(200).json(profile);
    } catch (error) {
        res.status(500).json({ message: 'Error loading profile', error });
    }
};

export const updateOwnProfile = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const { currentPassword, name, email } = req.body as {
            currentPassword: string;
            name?: string;
            email?: string;
        };

        const result = await userService.updateOwnProfile(req.user.id, {
            currentPassword,
            name,
            email,
        });

        if (!result.ok) {
            if (result.code === 'NOT_FOUND') {
                return res.status(404).json({ message: 'User not found' });
            }
            if (result.code === 'BAD_PASSWORD') {
                return res.status(401).json({ message: 'Current password is incorrect.' });
            }
            return res.status(409).json({ message: 'That email is already in use.' });
        }

        // Email is embedded in the session JWT — re-issue it so the client stays
        // in sync after an email change (name is not part of the token).
        let token: string | undefined;
        if (result.emailChanged) {
            token = signUserToken({
                id: req.user.id,
                roleId: req.user.roleId ?? null,
                organizationId: req.user.organizationId ?? null,
                email: result.user.email,
                role: req.user.role,
            });
        }

        res.status(200).json({ user: result.user, ...(token ? { token } : {}) });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile', error });
    }
};
