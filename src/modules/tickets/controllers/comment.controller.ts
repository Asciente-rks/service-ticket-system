import { Response } from 'express';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import * as commentService from '../services/comment.service';
import * as ticketEventService from '../services/ticket-event.service';

export const listComments = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const comments = await commentService.listComments(req.params.id, req.user.organizationId!);
    res.status(200).json(comments);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not load comments.' });
  }
};

export const createComment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { body, parentId } = req.body as { body: string; parentId?: string };
    const comment = await commentService.createComment(
      req.params.id,
      req.user.organizationId!,
      req.user.id,
      body,
      parentId || null,
    );
    res.status(201).json(comment);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not post comment.' });
  }
};

export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    await commentService.deleteComment(
      req.params.commentId,
      req.params.id,
      req.user.organizationId!,
      req.user.id,
      req.user.roleId || '',
    );
    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not delete comment.' });
  }
};

export const getTicketHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const history = await ticketEventService.getHistory(req.params.id, req.user.organizationId!);
    res.status(200).json(history);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Could not load history.' });
  }
};
