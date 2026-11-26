import { MESSAGE_COST, TEMPLATE_CATEGORY, type TemplateName } from "@/domain";
import { outbox } from "../db/schema";
import { newId, type Q } from "../store/core";

export interface OutgoingMessage {
  orgId: string;
  template: TemplateName;
  to: string;
  body: string;
}

/** Messaging is an adapter. A real WhatsApp BSP adapter would call the provider; this one only records. */
export interface MessagingAdapter {
  readonly name: string;
  send(q: Q, message: OutgoingMessage, at: Date): Promise<{ id: string; status: "simulated" | "sent" | "failed" }>;
}

export const simulatedWhatsApp: MessagingAdapter = {
  name: "simulated-whatsapp",
  async send(q, m, at) {
    const category = TEMPLATE_CATEGORY[m.template];
    const id = newId("msg");
    await q.insert(outbox).values({
      id,
      orgId: m.orgId,
      channel: "whatsapp",
      category,
      template: m.template,
      toPhone: m.to,
      body: m.body,
      costPaise: MESSAGE_COST[category],
      status: "simulated",
      createdAt: at,
    });
    return { id, status: "simulated" };
  },
};

let adapter: MessagingAdapter = simulatedWhatsApp;
export const messaging = () => adapter;
/** For tests or a future real provider. */
export function setMessagingAdapter(next: MessagingAdapter) {
  adapter = next;
}
