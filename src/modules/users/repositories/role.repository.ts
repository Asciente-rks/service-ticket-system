import { Role } from '../models/role.model';

export const findAll = async () => {
  return await Role.findAll({
    attributes: ['id', 'name']
  });
};

export const findById = async (id: string) => {
  return await Role.findByPk(id);
};