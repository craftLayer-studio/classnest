import { pageCtx } from "@/server/context";
import { absenceSweep, getOrg, todayBoard } from "@/server/store";
import { AttendanceBoard } from "@/components/app/AttendanceBoard";

export const metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const ctx = await pageCtx();
  const org = await getOrg(ctx.db, ctx.orgId);
  // The absence job is idempotent. Production runs it from cron (/api/cron); opening this screen also runs it.
  const sweep = await absenceSweep(ctx.db, ctx.orgId, ctx.now);
  const board = await todayBoard(ctx);
  return <AttendanceBoard board={board} alertMode={org.alertMode} entranceUrl={`${ctx.baseUrl}/q/${org.entranceToken}`} sweep={sweep} isDemo={org.isDemo} />;
}
