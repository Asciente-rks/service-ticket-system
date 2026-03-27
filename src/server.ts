import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; // Added for Frontend connection
import helmet from 'helmet'; // Added for Security
import { sequelize, connectDB } from './config/db';
import { defineAssociations } from './associations/associations';
import { userRouter } from './modules/users/routes/user.routes';
import { authRouter } from './modules/users/routes/auth.routes';
import { ticketRouter} from './modules/tickets/routes/ticket.routes';
import { notificationRouter } from './modules/notifications/routes/notification.routes';
import { initCronJobs } from './modules/tickets/cron/ticket.cron';
import { notificationSettingsRouter } from './modules/users/routes/notification-settings.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// --- Middleware ---
app.use(helmet()); // Protects against common web vulnerabilities
app.use(cors());   // Allows your frontend (React/Vue/etc) to call this API
app.use(express.json());

// --- Health Check (Essential for Render/Railway/AWS) ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// --- Routes ---
app.use('/auth', authRouter);
app.use('/users', userRouter);
app.use('/tickets', ticketRouter);
app.use('/notifications', notificationRouter);
app.use('/notification-settings', notificationSettingsRouter);

// --- Server Startup ---
const startServer = async () => {
  try {
    // 1. Establish SSL Connection to TiDB
    await connectDB();
    
    // 2. Setup Relationships
    defineAssociations();
    
    // 3. Smart Sync
    // In Dev: 'alter: true' updates tables as you code
    // In Prod: Just syncs without changing existing data structure
    await sequelize.sync({ alter: !isProd }); 
    console.log(`Databases synced successfully (Mode: ${isProd ? 'Production' : 'Development'}).`);

    initCronJobs();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();