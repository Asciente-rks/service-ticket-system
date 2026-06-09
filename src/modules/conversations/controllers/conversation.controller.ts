import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import * as conversationService from '../services/conversation.service';

export const listConversations = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const data = await conversationService.listConversations(req.user.organizationId!, req.user.id, search);
    res.status(200).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not load conversations.' });
  }
};

export const startConversation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { userId } = req.body as { userId: string };
    const convo = await conversationService.startConversation(req.user.organizationId!, req.user.id, userId);
    res.status(201).json(convo);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not start conversation.' });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const data = await conversationService.getMessages(req.user.organizationId!, req.user.id, req.params.id);
    res.status(200).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not load messages.' });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { body } = req.body as { body: string };
    const message = await conversationService.sendMessage(req.user.organizationId!, req.user.id, req.params.id, body);
    res.status(201).json(message);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not send message.' });
  }
};

export const getUnreadTotal = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const data = await conversationService.getUnreadTotal(req.user.organizationId!, req.user.id);
    res.status(200).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not load unread count.' });
  }
};
