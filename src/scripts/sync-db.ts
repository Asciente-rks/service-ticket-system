import { sequelize } from '../config/db';
import { defineAssociations } from '../associations/associations';

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    defineAssociations();

    console.log('Syncing database schema...');
    await sequelize.sync({ alter: true });
    console.log('Database synchronized successfully.');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Unable to sync database:', error);
    process.exit(1);
  }
};

syncDatabase();