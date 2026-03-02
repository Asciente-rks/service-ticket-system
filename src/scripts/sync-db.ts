import { sequelize, connectDB } from '../config/db';
import { defineAssociations } from '../associations/associations';

const syncDatabase = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('UNSAFE OPERATION: Running sync({ alter: true }) in production is not allowed. Use migrations instead.');
    }

    await connectDB();

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