import express, { Request, Response, NextFunction } from "express";
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
import { globalLimiter, loginLimiter } from "./middlewares/rate-limit.middleware";
import { securityHeaders } from "./middlewares/security-headers.middleware";

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
];

const ALLOWED_CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOriginAllowlist = ALLOWED_CORS_ORIGINS.length
  ? ALLOWED_CORS_ORIGINS
  : DEFAULT_CORS_ORIGINS;

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(securityHeaders);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsOriginAllowlist.includes("*")) return callback(null, true);
      if (corsOriginAllowlist.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "1mb" }));

app.use(globalLimiter);

app.get("/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(200).json({
    status: "UP",
    service: process.env.SERVICE_NAME || "service-ticket-system",
    timestamp: new Date().toISOString(),
  });
});

app.use("/auth", loginLimiter, authRouter);
app.use("/users", userRouter);
app.use("/tickets", ticketRouter);
app.use("/notifications", notificationRouter);

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  if (err && typeof err.message === "string" && err.message.startsWith("Origin ")) {
    return res.status(403).json({ message: "Origin not allowed" });
  }
  res.status(500).json({ message: "Internal server error" });
});

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
