import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  allocatePayment,
  defaulters,
  feeReceipt,
  feeReminder,
  gstSplit,
  instalmentStatus,
  istDateKey,
  outstanding,
  receiptNumber,
  reminderDue,
  REMINDER_STAGES,
  daysBetween,
  type Instalment,
  type Paise,
  type ReminderStage,
} from "@/domain";
import { messaging } from "../adapters/messaging";
import { upiIntent } from "../adapters/payments";
import type { Db } from "../db/client";
import { guardians, instalments, orgs, payments, students } from "../db/schema";
import { guardianConsent, guardianConsentMap } from "./consent";
import { newId, newToken, requireRole, StoreError, type Ctx, type Q } from "./core";
import { getOrg } from "./org";
import { getStudentRecord } from "./students";

type InstalmentRow = typeof instalments.$inferSelect;

export function toInstalment(r: InstalmentRow): Instalment {
  return {
    id: r.id,
    seq: r.seq,
    dueDate: r.dueDate,
    amount: r.amountPaise,
    paid: r.paidPaise,
    lateFee: r.lateFeePaise,
    remindersSent: r.remindersSent ? (r.remindersSent.split(",").filter((s) => (REMINDER_STAGES as readonly string[]).includes(s)) as ReminderStage[]) : [],
  };
}

async function studentInstalments(q: Q, orgId: string, studentId: string) {
  return q.select().from(instalments).where(and(eq(instalments.orgId, orgId), eq(instalments.studentId, studentId))).orderBy(instalments.dueDate, instalments.seq);
}

/**
 * Record a payment (UPI confirmed in the bank app, cash or card). The amount is allocated to the oldest
 * dues on the server; the receipt number comes from an atomic per-institute counter.
 */
export async function recordPayment(ctx: Ctx, input: { studentId: string; amountPaise: Paise; mode: "upi" | "cash" | "card"; reference?: string }) {
  requireRole(ctx, "owner", "staff");
  const { s, g } = await getStudentRecord(ctx.db, ctx.orgId, input.studentId);
  if (input.mode === "upi" && !input.reference) throw new StoreError(400, "Enter the UPI reference (UTR) from the bank app");
  return ctx.db.transaction(async (tx) => {
    const rows = await studentInstalments(tx, ctx.orgId, s.id);
    let alloc;
    try {
      alloc = allocatePayment(rows.map(toInstalment), input.amountPaise);
    } catch (e) {
      throw new StoreError(400, (e as Error).message);
    }
    for (const a of alloc) {
      await tx.update(instalments).set({ paidPaise: sql`${instalments.paidPaise} + ${a.amount}` }).where(and(eq(instalments.id, a.instalmentId), eq(instalments.orgId, ctx.orgId)));
    }
    const [org] = await tx.update(orgs).set({ receiptSeq: sql`${orgs.receiptSeq} + 1` }).where(eq(orgs.id, ctx.orgId)).returning();
    const today = istDateKey(ctx.now);
    const receiptNo = receiptNumber(org.receiptPrefix, today, org.receiptSeq);
    const receiptToken = newToken();
    const gst = org.gstin ? gstSplit(input.amountPaise).gst : 0;
    await tx.insert(payments).values({
      id: newId("pay"),
      orgId: ctx.orgId,
      studentId: s.id,
      amountPaise: input.amountPaise,
      gstPaise: gst,
      mode: input.mode,
      reference: input.reference ?? null,
      receiptNo,
      receiptToken,
      recordedBy: ctx.userId,
      createdAt: new Date(ctx.now),
    });
    const consent = await guardianConsent(tx, ctx.orgId, g.id);
    if (consent.service_updates) {
      await messaging().send(tx, { orgId: ctx.orgId, template: "fee_receipt", to: g.phone, body: feeReceipt({ student: s.name, amount: input.amountPaise, receiptNo, institute: org.name, link: `${ctx.baseUrl}/receipt/${receiptToken}` }) }, new Date(ctx.now));
    }
    return { receiptNo, receiptToken };
  });
}

export async function getReceipt(db: Db, token: string) {
  const [row] = await db
    .select({ p: payments, student: students.name, grade: students.grade, guardian: guardians.name, org: orgs })
    .from(payments)
    .innerJoin(students, eq(students.id, payments.studentId))
    .innerJoin(guardians, eq(guardians.id, students.guardianId))
    .innerJoin(orgs, eq(orgs.id, payments.orgId))
    .where(eq(payments.receiptToken, token));
  if (!row) return null;
  const split = row.org.gstin ? gstSplit(row.p.amountPaise) : null;
  return { ...row, split };
}

export async function defaulterList(ctx: Ctx) {
  requireRole(ctx, "owner", "staff");
  const org = await getOrg(ctx.db, ctx.orgId);
  const today = istDateKey(ctx.now);
  const rows = await ctx.db.select().from(instalments).where(eq(instalments.orgId, ctx.orgId));
  const byStudent = new Map<string, Instalment[]>();
  for (const r of rows) byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), toInstalment(r)]);
  const list = defaulters([...byStudent.entries()].map(([studentId, ins]) => ({ studentId, instalments: ins })), today, org.graceDays);
  if (list.length === 0) return [];
  const info = await ctx.db
    .select({ id: students.id, name: students.name, grade: students.grade, guardianId: students.guardianId, guardianName: guardians.name, phone: guardians.phone })
    .from(students)
    .innerJoin(guardians, eq(guardians.id, students.guardianId))
    .where(and(eq(students.orgId, ctx.orgId), inArray(students.id, list.map((d) => d.studentId))));
  const consent = await guardianConsentMap(ctx.db, ctx.orgId, [...new Set(info.map((i) => i.guardianId))]);
  return list.map((d) => {
    const i = info.find((x) => x.id === d.studentId)!;
    const sent = byStudent.get(d.studentId)!.flatMap((x) => x.remindersSent);
    return { ...d, ...i, canMessage: consent.get(i.guardianId)?.service_updates ?? false, lastReminder: sent.length ? sent[sent.length - 1] : null };
  });
}

/** Total due now (everything due today or earlier) and the next upcoming instalment. */
function duesSummary(rows: InstalmentRow[], today: string) {
  const ins = rows.map(toInstalment);
  const dueNow = ins.filter((i) => outstanding(i) > 0 && daysBetween(i.dueDate, today) >= 0);
  const next = ins.filter((i) => outstanding(i) > 0 && daysBetween(i.dueDate, today) < 0)[0] ?? null;
  return { dueNow: dueNow.reduce((s, i) => s + outstanding(i), 0), oldest: dueNow[0]?.dueDate ?? null, next, totalOutstanding: ins.reduce((s, i) => s + outstanding(i), 0) };
}

/** Manual "send reminder" from the defaulter list. Fee reminders are utility messages: service_updates consent is enough. */
export async function sendFeeReminder(ctx: Ctx, studentId: string) {
  requireRole(ctx, "owner", "staff");
  const { s, g } = await getStudentRecord(ctx.db, ctx.orgId, studentId);
  const consent = await guardianConsent(ctx.db, ctx.orgId, g.id);
  if (!consent.service_updates) throw new StoreError(409, `${g.name} has not opted in to WhatsApp updates. Call instead.`);
  const org = await getOrg(ctx.db, ctx.orgId);
  const today = istDateKey(ctx.now);
  const sum = duesSummary(await studentInstalments(ctx.db, ctx.orgId, s.id), today);
  const amount = sum.dueNow || sum.next?.amount || 0;
  if (amount === 0) throw new StoreError(409, "Nothing is due");
  await messaging().send(ctx.db, { orgId: ctx.orgId, template: "fee_reminder", to: g.phone, body: feeReminder({ student: s.name, amount, due: sum.oldest ?? sum.next!.dueDate, institute: org.name, link: `${ctx.baseUrl}/p/${s.parentToken}`, overdue: sum.dueNow > 0 }) }, new Date(ctx.now));
  return { sent: true };
}

export async function sendAllDefaulterReminders(ctx: Ctx) {
  const list = await defaulterList(ctx);
  let sent = 0;
  let skipped = 0;
  for (const d of list) {
    if (!d.canMessage) {
      skipped++;
      continue;
    }
    await sendFeeReminder(ctx, d.studentId);
    sent++;
  }
  return { sent, skipped };
}

/**
 * Daily reminder job: D-3, D0, D+3, D+7 for every open instalment of active students whose guardian opted in.
 * Also adds the institute's flat late fee once an instalment passes the grace period.
 */
export async function reminderSweep(db: Db, orgId: string, now: number, baseUrl: string) {
  const org = await getOrg(db, orgId);
  const today = istDateKey(now);
  const rows = await db
    .select({ i: instalments, name: students.name, parentToken: students.parentToken, guardianId: students.guardianId, phone: guardians.phone })
    .from(instalments)
    .innerJoin(students, eq(students.id, instalments.studentId))
    .innerJoin(guardians, eq(guardians.id, students.guardianId))
    .where(and(eq(instalments.orgId, orgId), eq(students.status, "active")));
  const consent = await guardianConsentMap(db, orgId, [...new Set(rows.map((r) => r.guardianId))]);
  let sent = 0;
  let lateFees = 0;
  for (const r of rows) {
    const ins = toInstalment(r.i);
    if (org.lateFeePaise > 0 && ins.lateFee === 0 && instalmentStatus(ins, today, org.graceDays) === "defaulting") {
      await db.update(instalments).set({ lateFeePaise: org.lateFeePaise }).where(eq(instalments.id, ins.id));
      ins.lateFee = org.lateFeePaise;
      lateFees++;
    }
    const stage = reminderDue(ins, today);
    if (!stage || !consent.get(r.guardianId)?.service_updates) continue;
    await db.transaction(async (tx) => {
      await messaging().send(tx, { orgId, template: "fee_reminder", to: r.phone, body: feeReminder({ student: r.name, amount: outstanding(ins), due: ins.dueDate, institute: org.name, link: `${baseUrl}/p/${r.parentToken}`, overdue: daysBetween(ins.dueDate, today) > 0 }) }, new Date(now));
      await tx.update(instalments).set({ remindersSent: [...ins.remindersSent, stage].join(",") }).where(eq(instalments.id, ins.id));
    });
    sent++;
  }
  return { sent, lateFees };
}

/** Fee section of the parent page: dues, a UPI intent link for the amount due now, and receipts. */
export async function parentFees(q: Q, org: typeof orgs.$inferSelect, studentId: string, studentName: string, now: number) {
  const today = istDateKey(now);
  const rows = await studentInstalments(q, org.id, studentId);
  const sum = duesSummary(rows, today);
  const payAmount = sum.dueNow || sum.next?.amount || 0;
  const pays = await q.select().from(payments).where(and(eq(payments.orgId, org.id), eq(payments.studentId, studentId))).orderBy(desc(payments.createdAt));
  return {
    instalments: rows.map((r) => ({ ...toInstalment(r), status: instalmentStatus(toInstalment(r), today, org.graceDays), outstanding: outstanding(toInstalment(r)) })),
    dueNow: sum.dueNow,
    totalOutstanding: sum.totalOutstanding,
    payAmount,
    upiLink: payAmount > 0 ? upiIntent.collectLink({ vpa: org.upiVpa, payee: org.upiPayee, amount: payAmount, note: `Fee ${studentName}`.slice(0, 50), reference: `CN${studentId.slice(-10)}` }) : null,
    payments: pays.map((p) => ({ receiptNo: p.receiptNo, receiptToken: p.receiptToken, amount: p.amountPaise, mode: p.mode, at: p.createdAt.getTime() })),
  };
}

export async function feeOverview(ctx: Ctx) {
  requireRole(ctx, "owner", "staff");
  const rows = await ctx.db
    .select({ i: instalments, name: students.name })
    .from(instalments)
    .innerJoin(students, eq(students.id, instalments.studentId))
    .where(eq(instalments.orgId, ctx.orgId))
    .orderBy(instalments.dueDate);
  const recent = await ctx.db
    .select({ p: payments, name: students.name })
    .from(payments)
    .innerJoin(students, eq(students.id, payments.studentId))
    .where(eq(payments.orgId, ctx.orgId))
    .orderBy(desc(payments.createdAt))
    .limit(20);
  const org = await getOrg(ctx.db, ctx.orgId);
  const today = istDateKey(ctx.now);
  const upcoming = rows.filter((r) => outstanding(toInstalment(r.i)) > 0 && daysBetween(today, r.i.dueDate) >= 0 && daysBetween(today, r.i.dueDate) <= 14);
  return {
    upcoming: upcoming.map((r) => ({ studentId: r.i.studentId, name: r.name, dueDate: r.i.dueDate, outstanding: outstanding(toInstalment(r.i)), status: instalmentStatus(toInstalment(r.i), today, org.graceDays) })),
    recent: recent.map((r) => ({ name: r.name, studentId: r.p.studentId, amount: r.p.amountPaise, mode: r.p.mode, receiptNo: r.p.receiptNo, receiptToken: r.p.receiptToken, at: r.p.createdAt.getTime() })),
  };
}

