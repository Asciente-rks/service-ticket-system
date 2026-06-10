import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import * as organizationService from '../services/organization.service';
import { ROLES } from '../../../config/roles';

const isAdminRole = (roleId: string | null | undefined): boolean => {
  const r = (roleId || '').toLowerCase();
  return r === ROLES.SUPER_ADMIN.toLowerCase() || r === ROLES.ADMIN.toLowerCase();
};

export const createOrganization = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { name } = req.body as { name: string };
    const result = await organizationService.createOrganization(req.user.id, name);
    res.status(201).json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || 'Could not create organization.' });
  }
};

export const joinOrganization = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { inviteCode } = req.body as { inviteCode: string };
    const result = await organizationService.joinOrganization(req.user.id, inviteCode);
    res.status(200).json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || 'Could not join organization.' });
  }
};

export const getMyOrganization = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!req.user.organizationId) {
      return res.status(404).json({ message: 'You are not part of an organization yet.' });
    }
    const org = await organizationService.getMyOrganization(
      req.user.organizationId,
      isAdminRole(req.user.roleId),
      req.user.id,
    );
    if (!org) return res.status(404).json({ message: 'Organization not found.' });
    res.status(200).json(org);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Could not load organization.' });
  }
};

export const updateOrganization = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!req.user.organizationId) {
      return res.status(404).json({ message: 'You are not part of an organization yet.' });
    }
    const { name } = req.body as { name: string };
    const org = await organizationService.renameOrganization(req.user.organizationId, name);
    res.status(200).json(org);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || 'Could not update organization.' });
  }
};

export const regenerateInviteCode = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!req.user.organizationId) {
      return res.status(404).json({ message: 'You are not part of an organization yet.' });
    }
    const result = await organizationService.regenerateInviteCode(req.user.organizationId);
    res.status(200).json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || 'Could not regenerate invite code.' });
  }
};

export const deleteOrganization = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!req.user.organizationId) {
      return res.status(404).json({ message: 'You are not part of an organization yet.' });
    }
    const result = await organizationService.deleteOrganization(req.user.organizationId, req.user.id);
    res.status(200).json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || 'Could not delete organization.' });
  }
};
