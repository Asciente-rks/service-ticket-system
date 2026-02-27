import { TicketStatus } from '../models/ticket-status.model';
import { Op } from 'sequelize';

export const findByName = async (name: string) => {
    return await TicketStatus.findOne({ where: { name } });
};

export const findById = async (id: string) => {
    return await TicketStatus.findByPk(id);
};

export const findOrCreate = async (name: string) => {
    return await TicketStatus.findOrCreate({
        where: { name },
        defaults: { name }
    });
};

export const deleteByNames = async (names: string[]) => {
    return await TicketStatus.destroy({ where: { name: { [Op.in]: names } } });
};