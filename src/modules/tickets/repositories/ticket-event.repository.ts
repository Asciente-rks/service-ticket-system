import { TicketEvent } from '../models/ticket-event.model';
import { User } from '../../users/models/user.model';

export const create = async (data: {
  ticketId: string;
  organizationId: string | null;
  actorId: string | null;
  type: string;
  fromValue?: string | null;
  toValue?: string | null;
}) => {
  return await TicketEvent.create(data);
};

export const findByTicket = async (ticketId: string) => {
  return await TicketEvent.findAll({
    where: { ticketId },
    include: [{ model: User, as: 'actor', attributes: ['id', 'name'] }],
    order: [['createdAt', 'ASC']],
  });
};

export const deleteByTicket = async (ticketId: string) => {
  await TicketEvent.destroy({ where: { ticketId } });
};
