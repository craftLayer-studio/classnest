import { pageCtx } from "@/server/context";
import { getOrg, listStaff } from "@/server/store";
import { Settings } from "@/components/app/Settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await pageCtx("owner");
  const [org, staff] = await Promise.all([getOrg(ctx.db, ctx.orgId), listStaff(ctx)]);
  return (
    <Settings
      org={{ name: org.name, city: org.city, upiVpa: org.upiVpa, upiPayee: org.upiPayee, gstin: org.gstin ?? "", alertMode: org.alertMode, graceDays: org.graceDays, lateFee: org.lateFeePaise / 100, isDemo: org.isDemo }}
      staff={staff.map((s) => ({ id: s.id, name: s.name, phone: s.phone, role: s.role }))}
    />
  );
}
