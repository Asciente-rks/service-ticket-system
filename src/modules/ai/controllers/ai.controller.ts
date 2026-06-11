import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import * as aiChatService from '../services/ai-chat.service';
import { detectDuplicates } from '../services/ai-duplicates.service';

export const getStatus = async (req: AuthRequest, res: Response) => {
  res.status(200).json({ configured: aiChatService.isConfigured() });
};

export const listConversations = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const data = await aiChatService.listConversations(req.user.organizationId!, req.user.id);
    res.status(200).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not load AI conversations.' });
  }
};

export const createConversation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { title } = (req.body || {}) as { title?: string };
    const data = await aiChatService.createConversation(req.user.organizationId!, req.user.id, title);
    res.status(201).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not create AI conversation.' });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const data = await aiChatService.getMessages(req.user.organizationId!, req.user.id, req.params.id);
    res.status(200).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not load messages.' });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { body, collectionId } = req.body as { body: string; collectionId?: string };
    const data = await aiChatService.sendMessage(req.user.organizationId!, req.user.id, req.params.id, body, collectionId || null);
    res.status(201).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not send message.' });
  }
};

export const renameConversation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { title } = req.body as { title: string };
    const data = await aiChatService.renameConversation(req.user.organizationId!, req.user.id, req.params.id, title);
    res.status(200).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not rename conversation.' });
  }
};

export const deleteConversation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    await aiChatService.deleteConversation(req.user.organizationId!, req.user.id, req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not delete conversation.' });
  }
};

export const getDuplicates = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const collectionId =
      typeof req.query.collectionId === 'string' && req.query.collectionId.trim()
        ? req.query.collectionId.trim()
        : null;
    const data = await detectDuplicates(req.user.organizationId!, collectionId);
    res.status(200).json(data);
  } catch (error: any) {
    // Duplicate detection is best-effort decoration on the dashboard — when
    // providers are rate-limited just report "no duplicates" instead of an error.
    if (error?.statusCode === 429 || error?.statusCode === 503) {
      return res.status(200).json({ groups: [], checkedAt: null, degraded: true });
    }
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not check duplicates.' });
  }
};

export const askAboutTicket = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { question, history } = (req.body || {}) as {
      question?: string;
      history?: { role: string; body: string }[];
    };
    const data = await aiChatService.askAboutTicket(
      req.user.organizationId!,
      req.user.id,
      req.params.ticketId,
      question,
      Array.isArray(history) ? history : [],
    );
    res.status(200).json(data);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not get an AI answer.' });
  }
};
