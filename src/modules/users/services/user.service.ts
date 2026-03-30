import bcrypt from 'bcryptjs';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UserResponseDto } from '../dtos/user-response.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import * as userRepository from '../repositories/user.repository';
import { ROLES } from '../../../config/roles';
import { isStaffRole } from '../../../middlewares/role.utils';
import { Op } from 'sequelize';

export const createUser = async (userData: CreateUserDto, creatorRoleId: string): Promise<UserResponseDto> => {
    const targetRoleId = (userData.roleId || '').toLowerCase();
    const actorRoleId = (creatorRoleId || '').toLowerCase();
    const superAdminRole = ROLES.SUPER_ADMIN.toLowerCase();
    const adminRole = ROLES.ADMIN.toLowerCase();

    if (targetRoleId === superAdminRole) {
        throw new Error('Cannot create a user with SuperAdmin role.');
    }
    if (targetRoleId === adminRole && actorRoleId !== superAdminRole) {
        throw new Error('Only SuperAdmins can create Admin users.');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = await userRepository.create({ ...userData, password: hashedPassword });
    return toUserResponseDto(user);
}

export const getAllUsers = async (requestingUserRoleId?: string): Promise<UserResponseDto[]> => {
  try {
    const reqRoleId = (requestingUserRoleId || '').toLowerCase();
    const superAdminRole = ROLES.SUPER_ADMIN.toLowerCase();
    const adminRole = ROLES.ADMIN.toLowerCase();

    if (reqRoleId === superAdminRole) {
        const users = await userRepository.findAll();
        return users.map(user => toUserResponseDto(user));
    }

    // Admins, Developers, and Testers only see fellow Staff (Devs/Testers) for reassignment
    // TiDB Optimization: Filter at the DB level instead of using .filter()
    if (reqRoleId === adminRole || isStaffRole(reqRoleId)) {
        const staffUsers = await userRepository.findAll({
            where: {
                roleId: { [Op.in]: [ROLES.DEVELOPER, ROLES.TESTER] }
            }
        });
        return staffUsers.map(user => toUserResponseDto(user));
    }

    return [];
  } catch (error) {
    throw new Error(`Error getting all users: ${error}`);
  }
};

export const getUserById = async (id: string, requestingUserRoleId?: string, requestingUserId?: string): Promise<UserResponseDto | null> => {
  try {
    const user = await userRepository.findById(id);
    if (!user) {
      return null;
    }

    const userRoleId = (user.roleId || '').toLowerCase();
    const reqRoleId = (requestingUserRoleId || '').toLowerCase();
    const superAdminRole = ROLES.SUPER_ADMIN.toLowerCase();

    if (userRoleId === superAdminRole && reqRoleId !== superAdminRole) {
        return null;
    }

    return toUserResponseDto(user);
  } catch (error) {
    throw new Error(`Error getting user by id: ${error}`);
  }
}

export const updateUser = async (id: string, updates: UpdateUserDto): Promise<UserResponseDto | null> => {
  try {
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const user = await userRepository.update(id, updates);
    if (!user) return null;
    
    return toUserResponseDto(user);
  } catch (error) {
    throw new Error(`Error updating user: ${error}`);
  };
}

export const deleteUser = async (id: string) => {
    return await userRepository.remove(id);
}

const toUserResponseDto = (user: any): UserResponseDto => {
  return {
    id: user.id.toString(),
    roleId: user.roleId,
    name: user.name,
    email: user.email,
  };
};