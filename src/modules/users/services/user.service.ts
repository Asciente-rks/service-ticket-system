import bcrypt from 'bcryptjs';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UserResponseDto } from '../dtos/user-response.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import * as userRepository from '../repositories/user.repository';

export const createUser = async (userData: CreateUserDto): Promise<UserResponseDto> => {
    const hashedPassword = await bcrypt.hash(userData.password, 10)
    const user = await userRepository.create({ ...userData, password: hashedPassword });
    return toUserResponseDto(user);
}

export const getAllUsers = async (): Promise<UserResponseDto[]> => {
  try {
    const users = await userRepository.findAll();
    return users.map(user => toUserResponseDto(user));
  } catch (error) {
    throw new Error(`Error getting all users: ${error}`);
  }
};

export const getUserById = async (id: string): Promise<UserResponseDto | null> => {
  try {
    const user = await userRepository.findById(id);
    if (!user) {
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