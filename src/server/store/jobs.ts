import type { Db } from "../db/client";
import { orgs } from "../db/schema";
import { absenceSweep } from "./attendance";
import { reminderSweep } from "./fees";

/** Background jobs for every institute: absence alerts and fee reminders. Safe to run repeatedly (idempotent). */
export async function runJobs(db: Db, now: number, baseUrl: string) {
  const all = await db.select({ id: orgs.id }).from(orgs);
  const out = [];
  for (const o of all) {
    const absence = await absenceSweep(db, o.id, now);
    const reminders = await reminderSweep(db, o.id, now, baseUrl);
    out.push({ orgId: o.id, absence, reminders });
  }
  return out;
}
