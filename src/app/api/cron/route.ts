import { getDb } from "@/server/db/client";
import { BadRequest, handle } from "@/server/http";
import { runJobs } from "@/server/store";

/** Scheduler entry point (every 5 minutes): absence alerts and fee reminders. Needs `Authorization: Bearer $CRON_SECRET`. */
export async function POST(request: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) throw new BadRequest("Unauthorized", 401);
    const base = (process.env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
    return runJobs(await getDb(), Date.now(), base);
  });
}
