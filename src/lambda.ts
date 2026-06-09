import serverlessHttp from "serverless-http";
import { app } from "./app";
import { defineAssociations } from "./associations/associations";
import { runStaleTicketCheck } from "./modules/tickets/cron/ticket.cron";

// One-time, per-container init. Only wires up model associations (pure in-memory,
// no network). Sequelize opens the actual DB connection lazily on the first query
// and reuses it across warm invocations — so /health never depends on the DB.
let initialized = false;
const ensureReady = (): void => {
  if (!initialized) {
    defineAssociations();
    initialized = true;
  }
};

const serverlessHandler = serverlessHttp(app);

const isScheduledEvent = (event: any): boolean =>
  !!event &&
  (event["detail-type"] === "Scheduled Event" ||
    event.source === "aws.events" ||
    event.source === "aws.scheduler" ||
    event.__cron === true);

export const handler = async (event: any, context: any) => {
  // Don't wait for the Sequelize pool to drain before returning the response.
  if (context) context.callbackWaitsForEmptyEventLoop = false;

  ensureReady();

  // Optional: only fires if something invokes the function with { "__cron": true }.
  // (No EventBridge is provisioned by default — kept here so the SLA job can be
  // triggered manually or by any free scheduler you choose to add later.)
  if (isScheduledEvent(event)) {
    await runStaleTicketCheck();
    return { statusCode: 200, body: JSON.stringify({ ok: true, job: "stale-ticket-check" }) };
  }

  return serverlessHandler(event, context);
};
