import { assertPaise, type Paise } from "./money";
import { addDays, daysBetween, type DateKey } from "./time";

export interface InstalmentDraft {
  seq: number;
  dueDate: DateKey;
  amount: Paise;
}

export interface Instalment extends InstalmentDraft {
  id: string;
  paid: Paise;
  lateFee: Paise;
  remindersSent: ReminderStage[];
}

export const MAX_INSTALMENTS = 12;

/** Add calendar months to a date key, clamping to the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: DateKey, months: number): DateKey {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

/**
 * Split a fee (after discount) into `count` instalments, `everyMonths` apart, starting on `firstDue`.
 * Paise left over from even division go on the first instalment so the sum is exact.
 */
export function planInstalments(params: {
  total: Paise;
  discount?: Paise;
  count: number;
  firstDue: DateKey;
  everyMonths?: number;
}): InstalmentDraft[] {
  const discount = params.discount ?? 0;
  assertPaise(params.total, "total");
  assertPaise(discount, "discount");
  if (discount > params.total) throw new Error("Discount cannot exceed the total fee");
  if (!Number.isInteger(params.count) || params.count < 1 || params.count > MAX_INSTALMENTS) {
    throw new Error(`Instalments must be between 1 and ${MAX_INSTALMENTS}`);
  }
  const every = params.everyMonths ?? 1;
  const net = params.total - discount;
  const base = Math.floor(net / params.count);
  const remainder = net - base * params.count;
  return Array.from({ length: params.count }, (_, i) => ({
    seq: i + 1,
    dueDate: addMonths(params.firstDue, i * every),
    amount: base + (i === 0 ? remainder : 0),
  }));
}

export function outstanding(i: Pick<Instalment, "amount" | "paid" | "lateFee">): Paise {
  return Math.max(0, i.amount + i.lateFee - i.paid);
}

export type InstalmentStatus = "paid" | "upcoming" | "due" | "overdue" | "defaulting";

/**
 * upcoming: due date in the future; due: due today; overdue: past due within the grace period;
 * defaulting: overdue by more than `graceDays` (shows on the defaulter list).
 */
export function instalmentStatus(i: Pick<Instalment, "amount" | "paid" | "lateFee" | "dueDate">, today: DateKey, graceDays: number): InstalmentStatus {
  if (outstanding(i) === 0) return "paid";
  const late = daysBetween(i.dueDate, today);
  if (late < 0) return "upcoming";
  if (late === 0) return "due";
  return late > graceDays ? "defaulting" : "overdue";
}

/** Allocate a payment to the oldest unpaid instalments first. Rejects overpayment. */
export function allocatePayment(instalments: Instalment[], amount: Paise): { instalmentId: string; amount: Paise }[] {
  assertPaise(amount, "payment");
  if (amount === 0) throw new Error("Payment must be more than zero");
  const open = [...instalments].sort((a, b) => a.seq - b.seq).filter((i) => outstanding(i) > 0);
  const totalDue = open.reduce((s, i) => s + outstanding(i), 0);
  if (amount > totalDue) throw new Error("Payment is more than the amount due");
  const out: { instalmentId: string; amount: Paise }[] = [];
  let left = amount;
  for (const i of open) {
    if (left === 0) break;
    const take = Math.min(left, outstanding(i));
    out.push({ instalmentId: i.id, amount: take });
    left -= take;
  }
  return out;
}

/** Reminder schedule relative to the due date: 3 days before, on the day, 3 and 7 days after. */
export const REMINDER_STAGES = ["D-3", "D0", "D+3", "D+7"] as const;
export type ReminderStage = (typeof REMINDER_STAGES)[number];
const STAGE_OFFSET: Record<ReminderStage, number> = { "D-3": -3, D0: 0, "D+3": 3, "D+7": 7 };

/**
 * Which automatic reminder is due today, if any. If the job missed a day it catches up with the
 * latest stage reached, and never repeats a stage already sent.
 */
export function reminderDue(i: Pick<Instalment, "amount" | "paid" | "lateFee" | "dueDate" | "remindersSent">, today: DateKey): ReminderStage | null {
  if (outstanding(i) === 0) return null;
  const diff = daysBetween(i.dueDate, today);
  let latest: ReminderStage | null = null;
  for (const s of REMINDER_STAGES) if (diff >= STAGE_OFFSET[s]) latest = s;
  if (!latest || i.remindersSent.includes(latest)) return null;
  // Do not send an older stage once a newer one has gone out.
  const sentIdx = Math.max(-1, ...i.remindersSent.map((s) => REMINDER_STAGES.indexOf(s)));
  return REMINDER_STAGES.indexOf(latest) > sentIdx ? latest : null;
}

export function reminderDate(dueDate: DateKey, stage: ReminderStage): DateKey {
  return addDays(dueDate, STAGE_OFFSET[stage]);
}

/** GST on coaching services is 18%. Fees are quoted GST-inclusive; split into taxable value and CGST/SGST. */
export const GST_RATE_PERCENT = 18;
export function gstSplit(inclusive: Paise, ratePercent = GST_RATE_PERCENT): { taxable: Paise; cgst: Paise; sgst: Paise; gst: Paise } {
  assertPaise(inclusive);
  const taxable = Math.round((inclusive * 100) / (100 + ratePercent));
  const gst = inclusive - taxable;
  const cgst = Math.floor(gst / 2);
  return { taxable, cgst, sgst: gst - cgst, gst };
}

/** Indian financial year label for a date: 2026-11-25 -> "2026-27", 2027-02-10 -> "2026-27". */
export function financialYear(date: DateKey): string {
  const [y, m] = date.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function receiptNumber(prefix: string, date: DateKey, seq: number): string {
  return `${prefix}/${financialYear(date)}/${String(seq).padStart(5, "0")}`;
}

/**
 * Pro-rata refund when a student leaves mid-course (Ministry of Education coaching guidelines, 2024):
 * refund the unused share of fees paid, by whole months remaining.
 */
export function proRataRefund(params: { paid: Paise; total: Paise; months: number; monthsUsed: number }): Paise {
  const { paid, total, months, monthsUsed } = params;
  assertPaise(paid);
  assertPaise(total);
  if (months <= 0 || monthsUsed < 0) throw new Error("Invalid course length");
  const used = Math.round((total * Math.min(monthsUsed, months)) / months);
  return Math.max(0, paid - used);
}

export interface DefaulterRow {
  studentId: string;
  overdue: Paise;
  oldestDue: DateKey;
  daysLate: number;
}

/** Students with any instalment overdue past the grace period, worst first. */
export function defaulters(
  rows: { studentId: string; instalments: Pick<Instalment, "amount" | "paid" | "lateFee" | "dueDate">[] }[],
  today: DateKey,
  graceDays: number,
): DefaulterRow[] {
  const out: DefaulterRow[] = [];
  for (const r of rows) {
    const late = r.instalments.filter((i) => instalmentStatus(i, today, graceDays) === "defaulting");
    if (late.length === 0) continue;
    // Everything past due counts towards the overdue amount once the student is a defaulter.
    const pastDue = r.instalments.filter((i) => outstanding(i) > 0 && daysBetween(i.dueDate, today) > 0);
    const oldestDue = late.map((i) => i.dueDate).sort()[0];
    out.push({
      studentId: r.studentId,
      overdue: pastDue.reduce((s, i) => s + outstanding(i), 0),
      oldestDue,
      daysLate: daysBetween(oldestDue, today),
    });
  }
  return out.sort((a, b) => b.overdue - a.overdue || b.daysLate - a.daysLate);
}
