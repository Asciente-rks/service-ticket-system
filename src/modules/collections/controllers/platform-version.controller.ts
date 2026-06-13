import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import * as platformVersionService from '../services/platform-version.service';

export const listPlatformVersions = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const data = await platformVersionService.listPlatformVersions(
      req.user.organizationId!,
      req.params.collectionId,
    );
    res.status(200).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not load platform/versions.' });
  }
};

export const createPlatformVersion = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { platform, version } = req.body as { platform: string; version: string };
    const data = await platformVersionService.createPlatformVersion(
      req.user.organizationId!,
      req.params.collectionId,
      req.user.id,
      { platform, version },
    );
    res.status(201).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not create the platform/version.' });
  }
};

export const updatePlatformVersion = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { platform, version } = req.body as { platform?: string; version?: string };
    const data = await platformVersionService.updatePlatformVersion(
      req.user.organizationId!,
      req.params.collectionId,
      req.params.id,
      { platform, version },
    );
    res.status(200).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not update the platform/version.' });
  }
};

export const deletePlatformVersion = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    await platformVersionService.deletePlatformVersion(
      req.user.organizationId!,
      req.params.collectionId,
      req.params.id,
    );
    res.status(200).json({ deleted: true });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not delete the platform/version.' });
  }
};
