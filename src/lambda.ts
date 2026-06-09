import serverlessHttp from "serverless-http";
import { app } from "./app";
import { connectDB } from "./config/db";
import { defineAssociations } from "./associations/associations";
import { runStaleTicketCheck } from "./modules/tickets/cron/ticket.cron";

// Memoize one-time, per-container initialization. AWS Lambda reuses a warm
// container across invocations, so associations + the DB connection are only
// set up on the first (cold) invocation and reused afterwards.
let readyPromise: Promise<void> | null = null;

const ensureReady = (): Promise<void> => {
  if (!readyPromise) {
    readyPromise = (async () => {
      defineAssociations();
      await connectDB();
    })().catch((err) => {
      // Reset so the next invocation can retry instead of caching a failure.
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
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

  await ensureReady();

  // EventBridge / EventBridge Scheduler trigger -> run the SLA stale-ticket job.
  if (isScheduledEvent(event)) {
    await runStaleTicketCheck();
    return { statusCode: 200, body: JSON.stringify({ ok: true, job: "stale-ticket-check" }) };
  }

  // Otherwise treat it as an HTTP event from the Lambda Function URL.
  return serverlessHandler(event, context);
};
