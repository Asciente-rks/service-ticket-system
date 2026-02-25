import express from 'express';
import dotenv from 'dotenv';
import { sequelize, connectDB } from './config/db';
import { defineAssociations } from './associations/associations';
import { userRouter } from './modules/users/routes/user.routes';
import { authRouter } from './modules/users/routes/auth.routes';
import { ticketRouter
  
 } from './modules/tickets/routes/ticket.routes';
import { notificationRouter } from './modules/notifications/routes/notification.routes';
import { initCronJobs } from './modules/tickets/cron/ticket.cron';
dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use('/users', userRouter);
app.use('/auth', authRouter);
app.use('/tickets', ticketRouter);
app.use('/notifications', notificationRouter);

const startServer = async () => {
  try {
    await connectDB();
    defineAssociations();
    await sequelize.sync();
    console.log('Databases synced successfully.');

    initCronJobs();

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();