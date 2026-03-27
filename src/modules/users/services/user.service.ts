import bcrypt from 'bcryptjs';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UserResponseDto } from '../dtos/user-response.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import * as userRepository from '../repositories/user.repository';
import { ROLES } from '../../../config/roles';

export const createUser = async (userData: CreateUserDto, creatorRoleId: string): Promise<UserResponseDto> => {
    if (userData.roleId === ROLES.SUPER_ADMIN) {
        throw new Error('Cannot create a user with SuperAdmin role.');
    }
    if (userData.roleId === ROLES.ADMIN && creatorRoleId !== ROLES.SUPER_ADMIN) {
        throw new Error('Only SuperAdmins can create Admin users.');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = await userRepository.create({ ...userData, password: hashedPassword });
    return toUserResponseDto(user);
}

export const getAllUsers = async (requestingUserRoleId?: string): Promise<UserResponseDto[]> => {
  try {
    const users = await userRepository.findAll();
    
    if (requestingUserRoleId !== ROLES.SUPER_ADMIN) {
        return users
            .filter(user => user.roleId !== ROLES.SUPER_ADMIN)
            .map(user => toUserResponseDto(user));
    }

    return users.map(user => toUserResponseDto(user));
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

    if (user.roleId === ROLES.SUPER_ADMIN && requestingUserRoleId !== ROLES.SUPER_ADMIN) {
        return null;
    }

    return user.toJSON() as UserResponseDto;
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