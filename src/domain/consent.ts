/**
 * Consent purposes (DPDP Act 2023, DPDP Rules 2025). Students are treated as minors by default, so
 * the parent or guardian gives consent for:
 * - child_data: processing the child's minimal record (name, class, batch, attendance, marks, fees) to run classes.
 * - service_updates: WhatsApp alerts about attendance, fees, receipts and report cards.
 * - marketing: offers and admission news. Never sent to students; only to guardians or enquirers who opt in.
 */
export const CONSENT_PURPOSES = ["child_data", "service_updates", "marketing"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const NOTICE_VERSION = "2026-11-v1";

export const PURPOSE_LABEL: Record<ConsentPurpose, string> = {
  child_data: "Keep my child's class record (name, class, batch, attendance, marks, fees)",
  service_updates: "Send me WhatsApp updates about attendance, fees, receipts and report cards",
  marketing: "Send me offers and admission news (optional)",
};

export type ConsentChannel = "guardian_link" | "poster_form" | "staff_desk";

export interface ConsentEvent {
  purpose: ConsentPurpose;
  granted: boolean;
  at: number;
}

/** Current state per purpose = the latest event for that purpose. Missing means not given. */
export function currentConsent(events: ConsentEvent[]): Record<ConsentPurpose, boolean> {
  const latest = new Map<ConsentPurpose, ConsentEvent>();
  for (const e of events) {
    const prev = latest.get(e.purpose);
    if (!prev || e.at >= prev.at) latest.set(e.purpose, e);
  }
  return {
    child_data: latest.get("child_data")?.granted ?? false,
    service_updates: latest.get("service_updates")?.granted ?? false,
    marketing: latest.get("marketing")?.granted ?? false,
  };
}

export type MessageCategory = "utility" | "marketing";

/** May we message this guardian for this category? Utility needs service_updates; marketing needs marketing. */
export function mayMessage(consent: Record<ConsentPurpose, boolean>, category: MessageCategory): boolean {
  return category === "marketing" ? consent.marketing : consent.service_updates;
}
