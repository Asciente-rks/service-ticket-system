import express from "express";
import dotenv from "dotenv";

dotenv.config();

import cors from "cors";
import helmet from "helmet";
import { sequelize, connectDB } from "./config/db";
import { defineAssociations } from "./associations/associations";
import { userRouter } from "./modules/users/routes/user.routes";
import { authRouter } from "./modules/users/routes/auth.routes";
import { ticketRouter } from "./modules/tickets/routes/ticket.routes";
import { notificationRouter } from "./modules/notifications/routes/notification.routes";
import { initCronJobs } from "./modules/tickets/cron/ticket.cron";

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(200).json({
    status: "UP",
    service: process.env.SERVICE_NAME || "service-ticket-system",
    timestamp: new Date().toISOString(),
  });
});

app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/tickets", ticketRouter);
app.use("/notifications", notificationRouter);

const startServer = async () => {
  try {
    await connectDB();

    defineAssociations();

    console.log(
      `Databases connected and synced (Mode: ${isProd ? "Production" : "Development"}).`,
    );

    initCronJobs();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
