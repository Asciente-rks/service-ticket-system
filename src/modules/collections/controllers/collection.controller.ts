import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import * as collectionService from '../services/collection.service';

export const listCollections = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const data = await collectionService.listCollections(req.user.organizationId!, req.user.id);
    res.status(200).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not load collections.' });
  }
};

export const createCollection = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { name, description } = req.body as { name: string; description?: string | null };
    const data = await collectionService.createCollection(req.user.organizationId!, req.user.id, { name, description });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not create the collection.' });
  }
};

export const updateCollection = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { name, description } = req.body as { name?: string; description?: string | null };
    const data = await collectionService.updateCollection(req.user.organizationId!, req.params.id, { name, description });
    res.status(200).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not update the collection.' });
  }
};

export const deleteCollection = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const data = await collectionService.deleteCollection(req.user.organizationId!, req.params.id);
    res.status(200).json({ deleted: true, ...data });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not delete the collection.' });
  }
};
