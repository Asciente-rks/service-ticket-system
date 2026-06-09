import { Op } from 'sequelize';
import { Comment } from '../models/comment.model';
import { User } from '../../users/models/user.model';

const authorInclude = { model: User, as: 'author', attributes: ['id', 'name', 'email'] };

export const create = async (data: {
  ticketId: string;
  organizationId: string | null;
  authorId: string;
  parentId: string | null;
  body: string;
}) => {
  return await Comment.create(data);
};

export const findByTicket = async (ticketId: string) => {
  return await Comment.findAll({
    where: { ticketId },
    include: [authorInclude],
    order: [['createdAt', 'ASC']],
  });
};

export const findById = async (id: string) => {
  return await Comment.findByPk(id, { include: [authorInclude] });
};

export const remove = async (id: string) => {
  // Deleting a comment removes its direct replies too.
  await Comment.destroy({ where: { [Op.or]: [{ id }, { parentId: id }] } });
};

export const deleteByTicket = async (ticketId: string) => {
  await Comment.destroy({ where: { ticketId } });
};
