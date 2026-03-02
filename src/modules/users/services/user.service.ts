import bcrypt from 'bcryptjs';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UserResponseDto } from '../dtos/user-response.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import * as userRepository from '../repositories/user.repository';
import * as roleRepository from '../repositories/role.repository';

export const createUser = async (userData: CreateUserDto, creatorRoleId: string): Promise<UserResponseDto> => {
    const creatorRole = await roleRepository.findById(creatorRoleId);
    if (!creatorRole) throw new Error('Creator role not found');

    const targetRole = await roleRepository.findById(userData.roleId);
    if (!targetRole) throw new Error('Role not found');

    if (targetRole.name === 'SuperAdmin') {
        throw new Error('Cannot create a user with SuperAdmin role.');
    }
    if (targetRole.name === 'Admin' && creatorRole.name !== 'SuperAdmin') {
        throw new Error('Only SuperAdmins can create Admin users.');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = await userRepository.create({ ...userData, password: hashedPassword });
    return toUserResponseDto(user);
}

export const getAllUsers = async (requestingUserRole?: string): Promise<UserResponseDto[]> => {
  try {
    const users = await userRepository.findAll();
    
    const superAdminRole = await roleRepository.findByName('SuperAdmin');
    const filteredUsers = (superAdminRole && requestingUserRole !== 'SuperAdmin')
        ? users.filter(user => user.roleId != superAdminRole.id)
        : users;

    return filteredUsers.map(user => toUserResponseDto(user));
  } catch (error) {
    throw new Error(`Error getting all users: ${error}`);
  }
};

export const getUserById = async (id: string, requestingUserRole?: string, requestingUserId?: string): Promise<UserResponseDto | null> => {
  try {
    const user = await userRepository.findById(id);
    if (!user) {
      return null;
    }

    if (requestingUserId && user.id == requestingUserId) {
        return toUserResponseDto(user);
    }

    const superAdminRole = await roleRepository.findByName('SuperAdmin');

    if (superAdminRole && user.roleId == superAdminRole.id && requestingUserRole !== 'SuperAdmin') {
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