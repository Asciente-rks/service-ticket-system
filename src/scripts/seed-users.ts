import { sequelize, connectDB } from '../config/db';
import { User } from '../modules/users/models/user.model';
import { Role } from '../modules/users/models/role.model';
import bcrypt from 'bcryptjs';

const seedUsers = async () => {
    try {
        await connectDB();

        const superAdminData = {
            name: 'Super Admin',
            email: 'superadmin@test.com',
            role: 'SuperAdmin',
            password: 'password123',
        };

        console.log('--- FORCING SUPERADMIN RESET ---');

        const role = await Role.findOne({ where: { name: superAdminData.role } });

        if (!role) {
            console.error(`Role '${superAdminData.role}' not found. Run 'npm run seed:roles' first!`);
            process.exit(1);
        }

        const hashedPassword = await bcrypt.hash(superAdminData.password, 10);
        
        const [user, created] = await User.upsert({
            name: superAdminData.name,
            email: superAdminData.email,
            password: hashedPassword,
            roleId: role.id,
        });

        console.log(`-------------------------------`);
        console.log(`Result: ${created ? 'CREATED NEW' : 'UPDATED EXISTING'} user: ${user.email}`);
        console.log(`Role assigned: ${superAdminData.role} (ID: ${role.id})`);
        console.log(`Password reset to: ${superAdminData.password}`);
        console.log(`-------------------------------`);

        await sequelize.close();
        console.log('Seed complete. You can now log in.');
        process.exit(0);
    } catch (error: any) {
        console.error('CRITICAL SEED ERROR:', error.message);
        process.exit(1);
    }
};

seedUsers();