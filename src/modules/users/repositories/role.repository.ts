import { Role } from '../models/role.model';

export const findById = async (id: string) => {
    return await Role.findByPk(id);
};

export const findByName = async (name: string) => {
    return await Role.findOne({ where: { name } });
};