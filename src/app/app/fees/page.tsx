import { pageCtx } from "@/server/context";
import { defaulterList, feeOverview, getOrg } from "@/server/store";
import { Fees } from "@/components/app/Fees";

export const metadata = { title: "Fees and defaulters" };

export default async function FeesPage() {
  const ctx = await pageCtx("owner", "staff");
  const [defaulters, overview, org] = await Promise.all([defaulterList(ctx), feeOverview(ctx), getOrg(ctx.db, ctx.orgId)]);
  return (
    <Fees
      graceDays={org.graceDays}
      defaulters={defaulters.map((d) => ({ id: d.studentId, name: d.name, grade: d.grade, guardianName: d.guardianName, phone: d.phone, overdue: d.overdue, oldestDue: d.oldestDue, daysLate: d.daysLate, canMessage: d.canMessage, lastReminder: d.lastReminder ?? "" }))}
      upcoming={overview.upcoming.map((u, i) => ({ ...u, id: `${u.studentId}-${i}` }))}
      recent={overview.recent.map((r) => ({ ...r, id: r.receiptToken }))}
    />
  );
}
