import { StaffShell } from "@/components/StaffShell";
import { pageCtx } from "@/server/context";
import { getOrg } from "@/server/store";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await pageCtx();
  const org = await getOrg(ctx.db, ctx.orgId);
  return (
    <StaffShell org={org.name} user={ctx.name} role={ctx.role} isDemo={org.isDemo}>
      {children}
    </StaffShell>
  );
}
