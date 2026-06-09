import { Op } from 'sequelize';
import { Conversation } from '../models/conversation.model';
import { User } from '../../users/models/user.model';

const participantsInclude = [
  { model: User, as: 'user1', attributes: ['id', 'name', 'email'] },
  { model: User, as: 'user2', attributes: ['id', 'name', 'email'] },
];

export const create = async (data: { organizationId: string; user1Id: string; user2Id: string }) => {
  return await Conversation.create(data);
};

export const findByPair = async (organizationId: string, user1Id: string, user2Id: string) => {
  return await Conversation.findOne({ where: { organizationId, user1Id, user2Id } });
};

export const findById = async (id: string) => {
  return await Conversation.findByPk(id, { include: participantsInclude });
};

export const findAllForUser = async (organizationId: string, meId: string) => {
  return await Conversation.findAll({
    where: { organizationId, [Op.or]: [{ user1Id: meId }, { user2Id: meId }] },
    include: participantsInclude,
    order: [['lastMessageAt', 'DESC']],
  });
};

export const touch = async (id: string, text: string, senderId: string, at: Date) => {
  await Conversation.update(
    { lastMessageAt: at, lastMessageText: text, lastMessageSenderId: senderId },
    { where: { id } },
  );
};
