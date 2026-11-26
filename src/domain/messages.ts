import { formatINR, type Paise } from "./money";
import { formatClock, formatDate, type DateKey } from "./time";
import type { MessageCategory } from "./consent";

/** Simulated WhatsApp template costs in paise (utility vs marketing), for the outbox and dashboard. */
export const MESSAGE_COST: Record<MessageCategory, Paise> = { utility: 13, marketing: 88 };

export type TemplateName =
  | "absence_alert"
  | "arrival_alert"
  | "fee_reminder"
  | "fee_receipt"
  | "consent_request"
  | "demo_booked"
  | "report_card"
  | "admission_offer"
  | "staff_otp";

export const TEMPLATE_CATEGORY: Record<TemplateName, MessageCategory> = {
  absence_alert: "utility",
  arrival_alert: "utility",
  fee_reminder: "utility",
  fee_receipt: "utility",
  consent_request: "utility",
  demo_booked: "utility",
  report_card: "utility",
  admission_offer: "marketing",
  staff_otp: "utility",
};

export function absenceAlert(p: { student: string; batch: string; startMin: number; institute: string; date: DateKey }): string {
  return `${p.institute}: ${p.student} was marked absent for ${p.batch} (${formatClock(p.startMin)}) on ${formatDate(p.date)}. Reply 1 if you know, 2 for a call from the institute.`;
}

export function arrivalAlert(p: { student: string; batch: string; institute: string; time: string }): string {
  return `${p.institute}: ${p.student} reached class for ${p.batch} at ${p.time}.`;
}

export function feeReminder(p: { student: string; amount: Paise; due: DateKey; institute: string; link: string; overdue: boolean }): string {
  const when = p.overdue ? `was due on ${formatDate(p.due)}` : `is due on ${formatDate(p.due)}`;
  return `${p.institute}: fee of ${formatINR(p.amount)} for ${p.student} ${when}. Pay by UPI: ${p.link}. Ignore if already paid.`;
}

export function feeReceipt(p: { student: string; amount: Paise; receiptNo: string; institute: string; link: string }): string {
  return `${p.institute}: received ${formatINR(p.amount)} for ${p.student}. Receipt ${p.receiptNo}: ${p.link}. Thank you.`;
}

export function consentRequest(p: { student: string; institute: string; link: string }): string {
  return `${p.institute} has added ${p.student}. As parent or guardian, please review what we keep and give consent: ${p.link}`;
}

export function demoBooked(p: { student: string; batch: string; date: DateKey; startMin: number; institute: string }): string {
  return `${p.institute}: free demo class booked for ${p.student} in ${p.batch} on ${formatDate(p.date)} at ${formatClock(p.startMin)}. See you there.`;
}

export function reportCardMessage(p: { student: string; test: string; institute: string; link: string }): string {
  return `${p.institute}: ${p.test} results for ${p.student} are out. Report card: ${p.link}`;
}

export function admissionOffer(p: { name: string; institute: string; text: string }): string {
  return `${p.institute}: Hi ${p.name}, ${p.text} Reply STOP to opt out.`;
}
