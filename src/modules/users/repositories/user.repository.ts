import { User } from '../models/user.model';
import { UpdateUserDto } from '../dtos/update-user.dto';

export const create = async (userData: any) => {
    return await User.create(userData);
};

export const findAll = async () => {
    return await User.findAll();
};

export const findById = async (id: string, options: any = {}) => {
    return await User.findByPk(id, options);
};

export const findByEmail = async (email: string) => {
    return await User.findOne({ where: { email } });
};

export const update = async (id: string, updates: UpdateUserDto) => {
    const user = await User.findByPk(id);
    if (!user) return null;
    return await user.update(updates);
};

export const remove = async (id: string) => {
    const user = await User.findByPk(id);
    if (!user) return null;
    return await user.destroy();
};