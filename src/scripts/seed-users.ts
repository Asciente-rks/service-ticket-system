import { sequelize, connectDB } from '../config/db';
import { User } from '../modules/users/models/user.model';
import { Role } from '../modules/users/models/role.model';
import bcrypt from 'bcryptjs';

interface SeedUser {
    name: string;
    email: string;
    role: 'SuperAdmin' | 'Admin' | 'Developer' | 'Tester';
    password: string;
}

const SEED_USERS: SeedUser[] = [
    {
        name: 'Super Admin',
        email: 'superadmin@test.com',
        role: 'SuperAdmin',
        password: 'Password123!',
    },
    {
        name: 'Admin User',
        email: 'admin@test.com',
        role: 'Admin',
        password: 'Password123!',
    },
    {
        name: 'Developer User',
        email: 'developer@test.com',
        role: 'Developer',
        password: 'Password123!',
    },
    {
        name: 'Tester User',
        email: 'tester@test.com',
        role: 'Tester',
        password: 'Password123!',
    },
];

const seedUsers = async () => {
    try {
        await connectDB();

        console.log('--- FORCING USER RESET (4 accounts) ---');

        for (const seed of SEED_USERS) {
            const role = await Role.findOne({ where: { name: seed.role } });

            if (!role) {
                console.error(`Role '${seed.role}' not found. Run 'npm run seed:roles' first!`);
                process.exit(1);
            }

            const hashedPassword = await bcrypt.hash(seed.password, 10);

            const [user, created] = await User.upsert({
                name: seed.name,
                email: seed.email,
                password: hashedPassword,
                roleId: role.id,
            });

            console.log(`${created ? 'CREATED' : 'UPDATED'}: ${user.email} (${seed.role})`);
        }

        console.log(`-------------------------------`);
        console.log(`All seeded accounts share the password: Password123!`);
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
