import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";

dotenv.config();

import cors from "cors";
import helmet from "helmet";
import { userRouter } from "./modules/users/routes/user.routes";
import { authRouter } from "./modules/users/routes/auth.routes";
import { organizationRouter } from "./modules/organizations/routes/organization.routes";
import { ticketRouter } from "./modules/tickets/routes/ticket.routes";
import { notificationRouter } from "./modules/notifications/routes/notification.routes";
import { conversationRouter } from "./modules/conversations/routes/conversation.routes";
import { globalLimiter } from "./middlewares/rate-limit.middleware";
import { securityHeaders } from "./middlewares/security-headers.middleware";

const app = express();

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "https://service-ticket-system-frontend.vercel.app",
];

const DEFAULT_CORS_PATTERNS: RegExp[] = [
  /^https:\/\/service-ticket-system-frontend(-[a-z0-9-]+)?\.vercel\.app$/,
];

const ALLOWED_CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOriginAllowlist = ALLOWED_CORS_ORIGINS.length
  ? ALLOWED_CORS_ORIGINS
  : DEFAULT_CORS_ORIGINS;

const corsOriginPatterns: RegExp[] = ALLOWED_CORS_ORIGINS.length
  ? []
  : DEFAULT_CORS_PATTERNS;

const isOriginAllowed = (origin: string): boolean => {
  if (corsOriginAllowlist.includes("*")) return true;
  if (corsOriginAllowlist.includes(origin)) return true;
  return corsOriginPatterns.some((pattern) => pattern.test(origin));
};

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
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

app.use("/auth", authRouter);
app.use("/organizations", organizationRouter);
app.use("/users", userRouter);
app.use("/tickets", ticketRouter);
app.use("/notifications", notificationRouter);
app.use("/conversations", conversationRouter);

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  if (err && typeof err.message === "string" && err.message.startsWith("Origin ")) {
    return res.status(403).json({ message: "Origin not allowed" });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

export { app };
