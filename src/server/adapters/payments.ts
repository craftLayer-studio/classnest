import { buildUpiUri, type Paise } from "@/domain";

/**
 * Payments are an adapter. The free interim path is a UPI intent link (upi://pay) that any UPI app opens.
 * It does not confirm payment: staff record the payment (with the UPI reference) after checking their bank app.
 * A gateway adapter (Razorpay payment links + webhook) would replace `collectLink` and auto-record.
 */
export interface PaymentsAdapter {
  readonly name: string;
  collectLink(p: { vpa: string; payee: string; amount: Paise; note: string; reference: string }): string;
}

export const upiIntent: PaymentsAdapter = {
  name: "upi-intent",
  collectLink: (p) => buildUpiUri({ vpa: p.vpa, payeeName: p.payee, amount: p.amount, note: p.note, reference: p.reference }),
};
