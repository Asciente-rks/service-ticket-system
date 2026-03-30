import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserResponseDto } from '../dtos/user-response.dto';
import * as userRepository from '../repositories/user.repository';
import * as roleRepository from '../repositories/role.repository';
export const login = async (email: string, password: string) => {
    const user = await userRepository.findByEmail(email);
    
    if (!user) {
        return { user: null, token: null };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if(!isPasswordValid) {
        return{ user: null, token: null };
    }

    const roleName = (user as any).role ? (user as any).role.name : '';

    const token = jwt.sign(
        { id: user.id.toString(), roleId: user.roleId, email: user.email, role: roleName }, 
        process.env.JWT_SECRET!, 
        { expiresIn: '1h' }
    );

    const userResponse: UserResponseDto = { id: user.id.toString(), roleId: user.roleId, name: user.name, email: user.email };
    return { user: userResponse, token };
} 