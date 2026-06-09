import { app } from "./app";
import { connectDB } from "./config/db";
import { defineAssociations } from "./associations/associations";
import { initCronJobs } from "./modules/tickets/cron/ticket.cron";
import { runSeedRoles } from "./scripts/seed-roles";
import { runSeedTicketStatuses } from "./scripts/seed-ticket-status";
import { runSeedUsers } from "./scripts/seed-users";

const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

const SEED_ON_BOOT = (process.env.SEED_ON_BOOT || "true").toLowerCase() !== "false";

const startServer = async () => {
  try {
    await connectDB();

    defineAssociations();

    console.log(
      `Databases connected and synced (Mode: ${isProd ? "Production" : "Development"}).`,
    );

    if (SEED_ON_BOOT) {
      try {
        await runSeedRoles({ manageConnection: false, silent: true });
        await runSeedTicketStatuses({ manageConnection: false, silent: true });
        await runSeedUsers({ manageConnection: false, silent: true });
        console.log("Demo data seeded on boot (roles + ticket statuses + demo org).");
      } catch (seedError) {
        console.error("Auto-seed on boot failed (non-fatal):", seedError);
      }
    }

    // In-process cron for local development only. In Lambda this is driven by
    // an EventBridge schedule that invokes the handler (see src/lambda.ts).
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
