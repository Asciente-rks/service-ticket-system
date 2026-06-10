import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const useSsl = (process.env.DB_SSL || 'true').toLowerCase() !== 'false';

const sslDialectOptions = useSsl
  ? {
      ssl: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
    }
  : {};

const DB_TARGET_HOST = process.env.DB_HOST;
const DB_TARGET_PORT = Number(process.env.DB_PORT) || 4000;

// Diagnostic (no credentials): shows in CloudWatch exactly which host:port the
// Lambda is dialing, so a wrong DB_HOST/DB_PORT secret is obvious.
console.log(
  `[db] target=${DB_TARGET_HOST || '(DB_HOST UNSET)'}:${DB_TARGET_PORT} ssl=${useSsl}`,
);

export const sequelize = new Sequelize(
  process.env.DB_NAME!,
  process.env.DB_USER!,
  process.env.DB_PASSWORD!,
  {
    host: DB_TARGET_HOST,
    dialect: 'mysql',
    port: DB_TARGET_PORT,
    logging: process.env.NODE_ENV === 'production' ? false : console.log,
    dialectOptions: sslDialectOptions,
    // Small pool: in Lambda each warm container handles one request at a time,
    // and TiDB Serverless caps concurrent connections. Reused across invocations.
    pool: {
      max: Number(process.env.DB_POOL_MAX) || 2,
      min: 0,
      acquire: 30000,
      idle: 2000,
      evict: 1000,
    },
  },
);

export const connectDB = async () => {
  // On managed/serverless databases (TiDB Cloud, PlanetScale, RDS) the database
  // already exists and the deploy user often cannot CREATE DATABASE. Skip the
  // bootstrap step in those environments via SKIP_DB_BOOTSTRAP=true (set in Lambda).
  const skipBootstrap =
    (process.env.SKIP_DB_BOOTSTRAP || 'false').toLowerCase() === 'true';

  if (!skipBootstrap) {
    const bootstrapSequelize = new Sequelize('', process.env.DB_USER!, process.env.DB_PASSWORD!, {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 4000,
      dialect: 'mysql',
      logging: false,
      dialectOptions: {
        ...sslDialectOptions,
        pool: { max: 1, min: 0, idle: 100 },
      },
    });

    try {
      await bootstrapSequelize.query(
        `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`,
      );
    } finally {
      await bootstrapSequelize.close();
    }
  }

  try {
    await sequelize.authenticate();
    console.log('Connection to Service Ticket DB established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
};
