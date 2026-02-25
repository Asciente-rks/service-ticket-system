import { sequelize } from '../config/db';
import { Role } from '../modules/users/models/role.model';

const seedRoles = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    await sequelize.sync(); 

    const roles = ['Admin', 'Developer', 'Tester'];

    console.log('--- ROLES ---');
    for (const roleName of roles) {
      const [role, created] = await Role.findOrCreate({
        where: { name: roleName },
        defaults: { name: roleName }
      });
      console.log(`${roleName}: ${role.id}`);
    }
    console.log('-------------');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Unable to seed roles:', error);
    process.exit(1);
  }
};

seedRoles();