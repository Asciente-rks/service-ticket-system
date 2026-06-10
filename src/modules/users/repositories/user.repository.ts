import { User } from '../models/user.model';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { Role } from '../models/role.model';
import { Ticket } from '../../tickets/models/ticket.model';
import { Notification } from '../../notifications/models/notification.model';

const BASIC_ATTRS = ['id', 'name', 'email', 'roleId', 'organizationId'];

export const create = async (userData: any) => {
    return await User.create(userData);
};

export const findBasicById = async (id: string) => {
    return await User.findByPk(id, { attributes: BASIC_ATTRS });
};

// Basic fields + createdAt, for the read-only profile view.
export const findProfileById = async (id: string) => {
    return await User.findByPk(id, { attributes: [...BASIC_ATTRS, 'createdAt'] });
};

// Includes the password hash + organizationId — used for self-service flows
// (change password / update profile) that must verify the current password.
export const findByIdWithSecret = async (id: string) => {
    return await User.findByPk(id);
};

export const findByIdWithContext = async (id: string) => {
    return await User.findByPk(id, {
        attributes: BASIC_ATTRS,
        include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }],
    });
};

export const findAll = async (options: any = {}) => {
    const optimizedOptions = {
        attributes: BASIC_ATTRS,
        ...options
    };
    return await User.findAll(optimizedOptions);
};

export const findById = async (id: string) => {
    return await User.findByPk(id, {
        attributes: BASIC_ATTRS,
        include: [
            {
                model: Role,
                as: 'role',
                attributes: ['id', 'name'],
            },
            {
                model: Ticket,
                as: 'reportedTickets',
                attributes: ['id', 'title', 'priority', 'createdAt'],
            },
            {
                model: Ticket,
                as: 'assignedTickets',
                attributes: ['id', 'title', 'priority', 'createdAt'],
            },
            {
                model: Notification,
                as: 'notifications',
                limit: 5,
                order: [['createdAt', 'DESC']],
                attributes: ['id', 'message', 'read', 'createdAt'],
            },
        ],
    });
};

export const findByEmail = async (email: string) => {
    return await User.unscoped().findOne({
        where: { email },
        include: [{ model: Role, as: 'role', attributes: ['name'] }]
    });
  };

export const update = async (id: string, updates: UpdateUserDto | Record<string, any>) => {
    const user = await User.findByPk(id);
    if (!user) return null;
    return await user.update(updates);
};

export const remove = async (id: string) => {
    const user = await User.findByPk(id);
    if (!user) return null;
    return await user.destroy();
};
