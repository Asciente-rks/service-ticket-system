import * as commentRepository from '../repositories/comment.repository';
import * as ticketRepository from '../repositories/ticket.repository';
import * as userRepository from '../../users/repositories/user.repository';
import * as notificationService from '../../notifications/services/notification.service';
import { ROLES } from '../../../config/roles';

const toCommentDto = (c: any) => ({
  id: c.id,
  ticketId: c.ticketId,
  parentId: c.parentId ?? null,
  body: c.body,
  createdAt: c.createdAt,
  author: c.author
    ? { id: c.author.id, name: c.author.name, email: c.author.email }
    : { id: c.authorId, name: 'Unknown', email: '' },
});

/** Returns top-level comments with their replies nested, oldest first. */
export const listComments = async (ticketId: string, organizationId: string) => {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket || String((ticket as any).organizationId) !== String(organizationId)) {
    const err: any = new Error('Ticket not found.');
    err.statusCode = 404;
    throw err;
  }

  const rows = await commentRepository.findByTicket(ticketId);
  const dtos = rows.map(toCommentDto);

  const topLevel = dtos.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, any[]>();
  dtos.filter((c) => c.parentId).forEach((r) => {
    const list = repliesByParent.get(r.parentId) || [];
    list.push(r);
    repliesByParent.set(r.parentId, list);
  });

  return topLevel.map((c) => ({ ...c, replies: repliesByParent.get(c.id) || [] }));
};

export const createComment = async (
  ticketId: string,
  organizationId: string,
  authorId: string,
  body: string,
  parentId?: string | null,
) => {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket || String((ticket as any).organizationId) !== String(organizationId)) {
    const err: any = new Error('Ticket not found.');
    err.statusCode = 404;
    throw err;
  }

  let parent: any = null;
  if (parentId) {
    parent = await commentRepository.findById(parentId);
    if (!parent || String(parent.ticketId) !== String(ticketId)) {
      const err: any = new Error('Parent comment not found.');
      err.statusCode = 404;
      throw err;
    }
  }

  const created = await commentRepository.create({
    ticketId,
    organizationId,
    authorId,
    parentId: parentId || null,
    body: body.trim(),
  });

  const author = await userRepository.findBasicById(authorId);
  const authorName = (author as any)?.name || 'Someone';
  const title = (ticket as any).title;

  // Build recipient -> message map (reply notice takes priority), excluding the author.
  const recipients = new Map<string, string>();
  if (parent && String(parent.authorId) !== String(authorId)) {
    recipients.set(String(parent.authorId), `${authorName} replied to your comment on "${title}".`);
  }
  const reporterId = String((ticket as any).reportedBy);
  if (reporterId && reporterId !== String(authorId) && !recipients.has(reporterId)) {
    recipients.set(reporterId, `${authorName} commented on your ticket "${title}".`);
  }
  const assigneeId = (ticket as any).assignedTo ? String((ticket as any).assignedTo) : null;
  if (assigneeId && assigneeId !== String(authorId) && !recipients.has(assigneeId)) {
    recipients.set(assigneeId, `${authorName} commented on ticket "${title}" assigned to you.`);
  }

  for (const [userId, message] of recipients) {
    notificationService
      .createNotification({ userId, ticketId, organizationId, message })
      .catch((err) => console.error('Comment notification failed:', err));
  }

  const full = await commentRepository.findById(created.id);
  return toCommentDto(full);
};

export const deleteComment = async (
  commentId: string,
  ticketId: string,
  organizationId: string,
  userId: string,
  roleId: string,
) => {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket || String((ticket as any).organizationId) !== String(organizationId)) {
    const err: any = new Error('Ticket not found.');
    err.statusCode = 404;
    throw err;
  }

  const comment = await commentRepository.findById(commentId);
  if (!comment || String(comment.ticketId) !== String(ticketId)) {
    const err: any = new Error('Comment not found.');
    err.statusCode = 404;
    throw err;
  }

  const actorRole = (roleId || '').toLowerCase();
  const isAdmin =
    actorRole === ROLES.SUPER_ADMIN.toLowerCase() || actorRole === ROLES.ADMIN.toLowerCase();
  const isAuthor = String(comment.authorId) === String(userId);
  if (!isAdmin && !isAuthor) {
    const err: any = new Error('You can only delete your own comments.');
    err.statusCode = 403;
    throw err;
  }

  await commentRepository.remove(commentId);
  return { success: true };
};
