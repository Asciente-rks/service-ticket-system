import bcrypt from 'bcryptjs';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UserResponseDto } from '../dtos/user-response.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import * as userRepository from '../repositories/user.repository';
import { ROLES } from '../../../config/roles';
import { isStaffRole } from '../../../middlewares/role.utils';
import { Op } from 'sequelize';

export const createUser = async (userData: CreateUserDto, creatorRoleId: string | null, organizationId: string): Promise<UserResponseDto> => {
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
    const email = String(userData.email || '').trim().toLowerCase();

    // New users created by an admin are members of that admin's organization.
    const user = await userRepository.create({
        ...userData,
        email,
        password: hashedPassword,
        organizationId,
    });
    return toUserResponseDto(user);
}

export const getAllUsers = async (requestingUserRoleId: string | null | undefined, organizationId: string): Promise<UserResponseDto[]> => {
  try {
    const reqRoleId = (requestingUserRoleId || '').toLowerCase();
    const superAdminRole = ROLES.SUPER_ADMIN.toLowerCase();
    const adminRole = ROLES.ADMIN.toLowerCase();

    if (reqRoleId === superAdminRole) {
        const users = await userRepository.findAll({ where: { organizationId } });
        return users.map(user => toUserResponseDto(user));
    }

    if (reqRoleId === adminRole || isStaffRole(reqRoleId)) {
        const staffUsers = await userRepository.findAll({
            where: {
                organizationId,
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

export const getUserById = async (id: string, requestingUserRoleId: string | null | undefined, requestingUserId: string | undefined, organizationId: string): Promise<UserResponseDto | null> => {
  try {
    const user = await userRepository.findById(id);
    if (!user) {
      return null;
    }

    // Tenant isolation: never expose users from other organizations.
    if (String((user as any).organizationId) !== String(organizationId)) {
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

export const updateUser = async (id: string, updates: UpdateUserDto, organizationId: string): Promise<UserResponseDto | null> => {
  try {
    const target = await userRepository.findBasicById(id);
    if (!target) return null;
    if (String((target as any).organizationId) !== String(organizationId)) return null;

    const safeUpdates: Record<string, any> = { ...updates };
    // Org membership cannot be changed through the profile/user update endpoint.
    delete safeUpdates.organizationId;

    if (safeUpdates.email) {
      safeUpdates.email = String(safeUpdates.email).trim().toLowerCase();
    }
    if (safeUpdates.password) {
      safeUpdates.password = await bcrypt.hash(safeUpdates.password, 10);
    }

    const user = await userRepository.update(id, safeUpdates);
    if (!user) return null;

    return toUserResponseDto(user);
  } catch (error) {
    throw new Error(`Error updating user: ${error}`);
  };
}

export const deleteUser = async (id: string, organizationId: string) => {
    const target = await userRepository.findBasicById(id);
    if (!target) return null;
    if (String((target as any).organizationId) !== String(organizationId)) return null;
    return await userRepository.remove(id);
}

const toUserResponseDto = (user: any): UserResponseDto => {
  return {
    id: user.id.toString(),
    roleId: user.roleId,
    organizationId: user.organizationId ?? null,
    name: user.name,
    email: user.email,
  };
};
