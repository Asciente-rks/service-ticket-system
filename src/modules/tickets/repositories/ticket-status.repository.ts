import { TicketStatus } from '../models/ticket-status.model';

export const findAll = async () => {
  return await TicketStatus.findAll({
    attributes: ['id', 'name']
  });
};

export const findById = async (id: string) => {
  return await TicketStatus.findByPk(id);
};

export const findByName = async (name: string) => {
  return await TicketStatus.findOne({ where: { name } });
};