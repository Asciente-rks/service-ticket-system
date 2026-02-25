import { sequelize } from '../config/db';
import { defineAssociations } from '../associations/associations';

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Ensure associations are defined so foreign keys are recognized
    defineAssociations();

    console.log('Syncing database schema...');
    // alter: true checks the current state of the tables and adds/updates columns
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