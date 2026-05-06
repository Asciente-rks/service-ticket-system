import { sequelize, connectDB } from '../config/db';
import { Role } from '../modules/users/models/role.model';

const SYSTEM_ROLES = [
  { id: 'c3b538f5-8c72-48e2-b268-6a1359a62fe7', name: 'SuperAdmin' },
  { id: '0927eb32-25c8-4819-bddd-c8e9c6c1dfaf', name: 'Admin' },
  { id: 'bbf4184d-92c3-4a90-bbb2-de33c6c38a29', name: 'Tester' },
  { id: '668f4898-47ae-4da3-a1a5-fe8eb34a7f82', name: 'Developer' }
];

const seedRoles = async () => {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('--- STARTING ROLE SEEDING (UPSERT) ---');

    for (const roleData of SYSTEM_ROLES) {
      const [role, created] = await Role.upsert({
        id: roleData.id,
        name: roleData.name,
      });

      if (created) {
        console.log(`CREATED: ${role.name} with ID: ${role.id}`);
      } else {
        console.log(`EXISTS/UPDATED: ${role.name} with ID: ${role.id}`);
      }
    }

    console.log('--- SEEDING COMPLETE ---');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('FATAL: Unable to seed roles:', error);
    process.exit(1);
  }
};

seedRoles();