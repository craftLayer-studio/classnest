import { pageCtx } from "@/server/context";
import { listOutbox } from "@/server/store";
import { Outbox } from "@/components/app/Outbox";

export const metadata = { title: "WhatsApp outbox" };

export default async function MessagesPage() {
  const ctx = await pageCtx("owner", "staff");
  const rows = await listOutbox(ctx);
  return <Outbox rows={rows.map((m) => ({ id: m.id, template: m.template, category: m.category, to: m.toPhone, body: m.body, cost: m.costPaise, at: m.createdAt.getTime() }))} />;
}
