import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/db';
import { Message } from '../models/message.model';
import { User } from '../../users/models/user.model';

export const create = async (data: { conversationId: string; senderId: string; body: string }) => {
  return await Message.create(data);
};

export const findByConversation = async (conversationId: string) => {
  return await Message.findAll({
    where: { conversationId },
    include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'email'] }],
    order: [['createdAt', 'ASC']],
  });
};

/** Mark all messages from the OTHER person in this conversation as read by me. */
export const markRead = async (conversationId: string, meId: string) => {
  await Message.update(
    { readAt: new Date() },
    { where: { conversationId, senderId: { [Op.ne]: meId }, readAt: null as any } },
  );
};

/** Unread counts per conversation for me (messages from others, not yet read). */
export const unreadCountsByConversation = async (conversationIds: string[], meId: string) => {
  if (!conversationIds.length) return new Map<string, number>();
  const rows = await Message.findAll({
    attributes: ['conversationId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    where: { conversationId: { [Op.in]: conversationIds }, senderId: { [Op.ne]: meId }, readAt: null as any },
    group: ['conversationId'],
    raw: true,
  });
  const map = new Map<string, number>();
  rows.forEach((r: any) => map.set(String(r.conversationId), Number(r.count)));
  return map;
};

/** Total unread across all of my conversations in the org (for the sidebar badge). */
export const unreadTotalForUser = async (meId: string, organizationId: string): Promise<number> => {
  const rows = await sequelize.query<{ c: number }>(
    `SELECT COUNT(*) AS c
       FROM messages m
       JOIN conversations conv ON m.conversation_id = conv.id
      WHERE conv.organization_id = :org
        AND (conv.user1_id = :me OR conv.user2_id = :me)
        AND m.sender_id <> :me
        AND m.read_at IS NULL`,
    { replacements: { org: organizationId, me: meId }, type: QueryTypes.SELECT },
  );
  return Number(rows[0]?.c || 0);
};
