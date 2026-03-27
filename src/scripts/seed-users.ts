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

      console.log('--- SEEDING SUPERADMIN USER ---');
      const role = await Role.findOne({ where: { name: superAdminData.role } });

      if (!role) {
        console.error(`Role '${superAdminData.role}' not found. Please run role seeder first.`);
        process.exit(1);
      }

      const hashedPassword = await bcrypt.hash(superAdminData.password, 10);

    const [user, created] = await User.findOrCreate({
      where: { email: superAdminData.email },
      defaults: {
        name: superAdminData.name,
        email: superAdminData.email,
        password: hashedPassword,
        roleId: role.id,
      },
    });

    console.log(`${created ? 'Created' : 'Found'} user: ${user.email} [${superAdminData.role}]`);
    console.log('-----------------------------');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Unable to seed superadmin user:', error);
    process.exit(1);
  }
};

seedUsers();