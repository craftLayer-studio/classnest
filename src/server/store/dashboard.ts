import { and, desc, eq, gte } from "drizzle-orm";
import { addDays, attendancePercent, chronicAbsentees, funnel, istDateKey, outstanding, type EnquiryStage } from "@/domain";
import { attendance, enquiries, guardians, instalments, outbox, payments, students } from "../db/schema";
import { requireRole, type Ctx } from "./core";
import { defaulterList, toInstalment } from "./fees";

/** Owner dashboard: attendance %, fees collected vs due this month, enquiry conversion, messages and their cost. */
export async function ownerDashboard(ctx: Ctx) {
  requireRole(ctx, "owner");
  const today = istDateKey(ctx.now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = `${today.slice(0, 7)}-31`;
  const d30 = addDays(today, -30);

  const att = await ctx.db.select().from(attendance).where(and(eq(attendance.orgId, ctx.orgId), gte(attendance.date, d30)));
  const todayMarks = att.filter((a) => a.date === today);
  const week = att.filter((a) => a.date > addDays(today, -7));

  const ins = await ctx.db.select().from(instalments).where(eq(instalments.orgId, ctx.orgId));
  const dueThisMonth = ins.filter((i) => i.dueDate >= monthStart && i.dueDate <= monthEnd);
  const pays = await ctx.db.select().from(payments).where(eq(payments.orgId, ctx.orgId));
  const monthStartAt = new Date(`${monthStart}T00:00:00+05:30`);
  const collectedThisMonth = pays.filter((p) => p.createdAt >= monthStartAt).reduce((s, p) => s + p.amountPaise, 0);
  const dueTotal = dueThisMonth.reduce((s, i) => s + i.amountPaise + i.lateFeePaise, 0);
  const dueCollected = dueThisMonth.reduce((s, i) => s + Math.min(i.paidPaise, i.amountPaise + i.lateFeePaise), 0);
  const overdueNow = ins.filter((i) => i.dueDate < today).reduce((s, i) => s + outstanding(toInstalment(i)), 0);
  const defaulters = await defaulterList(ctx);

  const enq = await ctx.db.select({ stage: enquiries.stage, source: enquiries.source }).from(enquiries).where(eq(enquiries.orgId, ctx.orgId));
  const f = funnel(enq.map((e) => e.stage as EnquiryStage));
  const poster = funnel(enq.filter((e) => e.source === "poster_qr").map((e) => e.stage as EnquiryStage));

  const msgs = await ctx.db.select().from(outbox).where(and(eq(outbox.orgId, ctx.orgId), gte(outbox.createdAt, new Date(ctx.now - 30 * 86_400_000))));
  const byTemplate = new Map<string, number>();
  for (const m of msgs) byTemplate.set(m.template, (byTemplate.get(m.template) ?? 0) + 1);

  // Follow-up results: students whose guardian got a fee reminder in the last 30 days and then paid.
  const reminders = msgs.filter((m) => m.template === "fee_reminder");
  const sts = await ctx.db.select({ id: students.id, name: students.name, status: students.status, guardianId: students.guardianId }).from(students).where(eq(students.orgId, ctx.orgId));
  const phoneByStudent = new Map<string, string>();
  const gs = await ctx.db.select().from(guardians).where(eq(guardians.orgId, ctx.orgId));
  for (const s of sts) phoneByStudent.set(s.id, gs.find((g) => g.id === s.guardianId)?.phone ?? "");
  const remindedPhones = new Map<string, number>();
  for (const r of reminders) remindedPhones.set(r.toPhone, Math.min(remindedPhones.get(r.toPhone) ?? Infinity, r.createdAt.getTime()));
  const paidAfter = pays.filter((p) => {
    const first = remindedPhones.get(phoneByStudent.get(p.studentId) ?? "");
    return first !== undefined && p.createdAt.getTime() >= first;
  });

  const chronic = chronicAbsentees(att.filter((a) => a.date > addDays(today, -14)), 3).slice(0, 5).map((c) => ({ ...c, name: sts.find((s) => s.id === c.studentId)?.name ?? "" }));

  return {
    today,
    students: { active: sts.filter((s) => s.status === "active").length, pendingConsent: sts.filter((s) => s.status === "pending_consent").length },
    attendance: { today: attendancePercent(todayMarks), todayMarked: todayMarks.length, week: attendancePercent(week), month: attendancePercent(att), chronic },
    fees: { dueThisMonth: dueTotal, collectedOfDue: dueCollected, collectedThisMonth, overdueNow, defaulters: defaulters.length, defaulterAmount: defaulters.reduce((s, d) => s + d.overdue, 0) },
    enquiries: { ...f, poster },
    messages: {
      total: msgs.length,
      costPaise: msgs.reduce((s, m) => s + m.costPaise, 0),
      byTemplate: [...byTemplate.entries()].sort((a, b) => b[1] - a[1]),
      remindersSent: reminders.length,
      remindedFamilies: remindedPhones.size,
      paidAfterReminder: new Set(paidAfter.map((p) => p.studentId)).size,
      paidAfterReminderAmount: paidAfter.reduce((s, p) => s + p.amountPaise, 0),
    },
  };
}

export async function listOutbox(ctx: Ctx, limit = 200) {
  requireRole(ctx, "owner", "staff");
  return ctx.db.select().from(outbox).where(eq(outbox.orgId, ctx.orgId)).orderBy(desc(outbox.createdAt)).limit(limit);
}
