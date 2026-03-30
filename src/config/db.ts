import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

export const sequelize = new Sequelize(
  process.env.DB_NAME!,
  process.env.DB_USER!,
  process.env.DB_PASSWORD!,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    port: Number(process.env.DB_PORT) || 4000,
    logging: process.env.NODE_ENV === 'production' ? false : console.log,
    dialectOptions: {
      ssl: {
        rejectUnauthorized: true,
      },
    },
    pool: {
      max: 5,
      min: 0,        // Release all connections when idle to save RUs
      acquire: 30000,
      idle: 2000,    // Kill connection after 2 seconds
      evict: 1000    // Check every 1 second
    },
  }
);

export const connectDB = async () => {
  const bootstrapSequelize = new Sequelize('', process.env.DB_USER!, process.env.DB_PASSWORD!, {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 4000, // Make sure this is 4000 for TiDB
    dialect: 'mysql',
    logging: false,
    /* ADD THIS BLOCK BELOW */
    dialectOptions: {
      ssl: {
        rejectUnauthorized: true,
      },
      pool: { max: 1, min: 0, idle: 100 },
    },
  });

  try {
    // This will now work because it's using SSL
    await bootstrapSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
    await bootstrapSequelize.close();

    await sequelize.authenticate();
    console.log('Connection to Service Ticket DB established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
};