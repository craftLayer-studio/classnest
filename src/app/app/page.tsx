import { pageCtx } from "@/server/context";
import { ownerDashboard } from "@/server/store";
import { Dashboard } from "@/components/app/Dashboard";

export const metadata = { title: "Owner dashboard" };

export default async function DashboardPage() {
  const ctx = await pageCtx("owner");
  const data = await ownerDashboard(ctx);
  return <Dashboard data={data} />;
}
