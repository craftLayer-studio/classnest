import { and, eq, gte, inArray } from "drizzle-orm";
import {
  absenceAlert,
  arrivalAlert,
  attendancePercent,
  formatClock,
  istDateKey,
  istMinuteOfDay,
  meetsOn,
  pastAbsenceCutoff,
  pickCheckinBatch,
  shouldAlert,
  unmarked,
  addDays,
  type AttendanceSource,
  type AttendanceStatus,
} from "@/domain";
import { messaging } from "../adapters/messaging";
import type { Db } from "../db/client";
import { attendance, batches, enrolments, guardians, orgs, students } from "../db/schema";
import { toSlot } from "./batches";
import { guardianConsentMap } from "./consent";
import { newId, notFound, requireRole, StoreError, type Ctx, type Q } from "./core";
import { getOrg } from "./org";

type Org = Awaited<ReturnType<typeof getOrg>>;

async function enrolledBatches(q: Q, orgId: string, studentId: string) {
  return q
    .select({ b: batches })
    .from(enrolments)
    .innerJoin(batches, eq(batches.id, enrolments.batchId))
    .where(and(eq(enrolments.orgId, orgId), eq(enrolments.studentId, studentId)))
    .then((rows) => rows.map((r) => r.b));
}

/**
 * Pick which batch a check-in belongs to. Normal window: 30 min before start to the end.
 * Demo institutes relax this to "any batch that meets today", so the demo works at any hour.
 */
async function resolveBatch(q: Q, org: Org, studentId: string, now: number) {
  const bs = await enrolledBatches(q, org.id, studentId);
  const slots = bs.map((b) => ({ ...toSlot(b), row: b }));
  const inWindow = pickCheckinBatch(slots, now);
  if (inWindow) return { batch: inWindow.row, relaxed: false };
  if (org.isDemo) {
    const today = istDateKey(now);
    const m = istMinuteOfDay(now);
    const todays = slots.filter((s) => meetsOn(s, today)).sort((a, b) => Math.abs(a.startMin - m) - Math.abs(b.startMin - m));
    if (todays[0]) return { batch: todays[0].row, relaxed: true };
  }
  return null;
}

/** Upsert a mark. A late arrival overrides an automatic absence. Returns whether the status changed. */
async function setMark(q: Q, p: { orgId: string; studentId: string; batchId: string; date: string; status: AttendanceStatus; source: AttendanceSource; at: number }) {
  const [existing] = await q
    .select()
    .from(attendance)
    .where(and(eq(attendance.orgId, p.orgId), eq(attendance.studentId, p.studentId), eq(attendance.batchId, p.batchId), eq(attendance.date, p.date)));
  if (existing) {
    if (existing.status === p.status) return { changed: false, id: existing.id };
    await q.update(attendance).set({ status: p.status, source: p.source, markedAt: new Date(p.at) }).where(eq(attendance.id, existing.id));
    return { changed: true, id: existing.id };
  }
  const id = newId("att");
  await q.insert(attendance).values({ id, orgId: p.orgId, studentId: p.studentId, batchId: p.batchId, date: p.date, status: p.status, source: p.source, markedAt: new Date(p.at) });
  return { changed: true, id };
}

async function markPresent(q: Q, org: Org, student: { id: string; name: string; guardianId: string; status: string }, source: AttendanceSource, now: number, batchId?: string) {
  if (student.status !== "active") throw new StoreError(409, `${student.name} is not active yet (guardian consent pending)`);
  let batch;
  let relaxed = false;
  if (batchId) {
    [batch] = await q.select().from(batches).where(and(eq(batches.id, batchId), eq(batches.orgId, org.id)));
    if (!batch) notFound("Batch");
  } else {
    const r = await resolveBatch(q, org, student.id, now);
    if (!r) throw new StoreError(409, `No class for ${student.name} right now`);
    batch = r.batch;
    relaxed = r.relaxed;
  }
  const date = istDateKey(now);
  const res = await setMark(q, { orgId: org.id, studentId: student.id, batchId: batch.id, date, status: "present", source, at: now });
  // Arrival alerts are an opt-in add-on (alert mode "all"); absence-only is the default.
  if (res.changed && shouldAlert(org.alertMode, "present")) {
    const consent = (await guardianConsentMap(q, org.id, [student.guardianId])).get(student.guardianId)!;
    if (consent.service_updates) {
      const [g] = await q.select().from(guardians).where(eq(guardians.id, student.guardianId));
      await messaging().send(q, { orgId: org.id, template: "arrival_alert", to: g.phone, body: arrivalAlert({ student: student.name, batch: batch.name, institute: org.name, time: formatClock(istMinuteOfDay(now)) }) }, new Date(now));
      await q.update(attendance).set({ alertSent: true }).where(eq(attendance.id, res.id));
    }
  }
  return { student: student.name, batch: batch.name, startMin: batch.startMin, alreadyMarked: !res.changed, relaxed };
}

/** Public: a student scans the entrance QR with their own phone and enters (or has saved) their card code. */
export async function selfCheckIn(db: Db, entranceToken: string, cardCode: string, now: number) {
  const [org] = await db.select().from(orgs).where(eq(orgs.entranceToken, entranceToken));
  if (!org) notFound("Entrance QR");
  const code = cardCode.trim().toUpperCase();
  const [student] = await db.select().from(students).where(and(eq(students.orgId, org.id), eq(students.cardToken, code)));
  if (!student) throw new StoreError(404, "Card code not recognised. Check the code on your ID card.");
  return db.transaction((tx) => markPresent(tx, org, student, "qr_self", now));
}

export async function entranceInfo(db: Db, entranceToken: string) {
  const [org] = await db.select({ name: orgs.name, city: orgs.city, isDemo: orgs.isDemo }).from(orgs).where(eq(orgs.entranceToken, entranceToken));
  return org ?? null;
}

/** Staff: the kiosk scans the QR on a student's ID card. */
export async function cardScan(ctx: Ctx, cardCode: string, batchId?: string) {
  requireRole(ctx, "owner", "staff", "teacher");
  const org = await getOrg(ctx.db, ctx.orgId);
  const code = cardCode.trim().toUpperCase();
  const [student] = await ctx.db.select().from(students).where(and(eq(students.orgId, ctx.orgId), eq(students.cardToken, code)));
  if (!student) throw new StoreError(404, "Card not recognised");
  return ctx.db.transaction((tx) => markPresent(tx, org, student, "qr_card", ctx.now, batchId));
}

/** Staff: one-tap present/absent on the batch list. */
export async function staffMark(ctx: Ctx, p: { batchId: string; studentId: string; status: AttendanceStatus }) {
  requireRole(ctx, "owner", "staff", "teacher");
  const [enr] = await ctx.db.select().from(enrolments).where(and(eq(enrolments.orgId, ctx.orgId), eq(enrolments.batchId, p.batchId), eq(enrolments.studentId, p.studentId)));
  if (!enr) throw new StoreError(404, "Student is not in this batch");
  const [student] = await ctx.db.select().from(students).where(and(eq(students.id, p.studentId), eq(students.orgId, ctx.orgId)));
  if (p.status === "present") {
    const org = await getOrg(ctx.db, ctx.orgId);
    return ctx.db.transaction((tx) => markPresent(tx, org, student, "staff", ctx.now, p.batchId));
  }
  await setMark(ctx.db, { orgId: ctx.orgId, studentId: p.studentId, batchId: p.batchId, date: istDateKey(ctx.now), status: "absent", source: "staff", at: ctx.now });
  return { student: student.name, status: "absent" };
}

/**
 * Absence job (run every few minutes, or from the attendance screen): 15 minutes after a batch starts,
 * unmarked active students become absent, and the guardian of each absent student gets one WhatsApp
 * utility alert (only if they opted in to service updates).
 */
export async function absenceSweep(db: Db, orgId: string, now: number) {
  const org = await getOrg(db, orgId);
  const date = istDateKey(now);
  const bs = (await db.select().from(batches).where(eq(batches.orgId, orgId))).filter((b) => pastAbsenceCutoff(toSlot(b), now));
  let markedAbsent = 0;
  let alerts = 0;
  let skippedNoConsent = 0;
  for (const b of bs) {
    const enrolled = await db
      .select({ id: students.id })
      .from(enrolments)
      .innerJoin(students, eq(students.id, enrolments.studentId))
      .where(and(eq(enrolments.batchId, b.id), eq(enrolments.orgId, orgId), eq(students.status, "active")));
    const marks = await db.select().from(attendance).where(and(eq(attendance.orgId, orgId), eq(attendance.batchId, b.id), eq(attendance.date, date)));
    const missing = unmarked(enrolled.map((e) => e.id), marks.map((m) => m.studentId));
    for (const studentId of missing) {
      await setMark(db, { orgId, studentId, batchId: b.id, date, status: "absent", source: "auto", at: now });
      markedAbsent++;
    }
    const pending = await db
      .select({ a: attendance, name: students.name, guardianId: students.guardianId, phone: guardians.phone })
      .from(attendance)
      .innerJoin(students, eq(students.id, attendance.studentId))
      .innerJoin(guardians, eq(guardians.id, students.guardianId))
      .where(and(eq(attendance.orgId, orgId), eq(attendance.batchId, b.id), eq(attendance.date, date), eq(attendance.status, "absent"), eq(attendance.alertSent, false)));
    const consent = await guardianConsentMap(db, orgId, [...new Set(pending.map((p) => p.guardianId))]);
    for (const p of pending) {
      if (!consent.get(p.guardianId)?.service_updates) {
        skippedNoConsent++;
        continue;
      }
      await db.transaction(async (tx) => {
        await messaging().send(tx, { orgId, template: "absence_alert", to: p.phone, body: absenceAlert({ student: p.name, batch: b.name, startMin: b.startMin, institute: org.name, date }) }, new Date(now));
        await tx.update(attendance).set({ alertSent: true }).where(eq(attendance.id, p.a.id));
      });
      alerts++;
    }
  }
  return { markedAbsent, alerts, skippedNoConsent };
}

/** Today's batches with every enrolled student and their mark. */
export async function todayBoard(ctx: Ctx) {
  const date = istDateKey(ctx.now);
  const bs = (await ctx.db.select().from(batches).where(eq(batches.orgId, ctx.orgId)).orderBy(batches.startMin)).filter((b) => meetsOn(toSlot(b), date));
  if (bs.length === 0) return { date, batches: [] };
  const ids = bs.map((b) => b.id);
  const enr = await ctx.db
    .select({ batchId: enrolments.batchId, id: students.id, name: students.name, grade: students.grade, status: students.status, cardToken: students.cardToken })
    .from(enrolments)
    .innerJoin(students, eq(students.id, enrolments.studentId))
    .where(and(eq(enrolments.orgId, ctx.orgId), inArray(enrolments.batchId, ids)))
    .orderBy(students.name);
  const marks = await ctx.db.select().from(attendance).where(and(eq(attendance.orgId, ctx.orgId), eq(attendance.date, date), inArray(attendance.batchId, ids)));
  return {
    date,
    batches: bs.map((b) => {
      const list = enr
        .filter((e) => e.batchId === b.id)
        .map((e) => {
          const m = marks.find((x) => x.batchId === b.id && x.studentId === e.id);
          return { id: e.id, name: e.name, grade: e.grade, active: e.status === "active", mark: m ? { status: m.status, source: m.source, alertSent: m.alertSent, at: m.markedAt.getTime() } : null };
        });
      return {
        id: b.id,
        name: b.name,
        room: b.room,
        startMin: b.startMin,
        endMin: b.endMin,
        pastCutoff: pastAbsenceCutoff(toSlot(b), ctx.now),
        students: list,
        present: list.filter((s) => s.mark?.status === "present").length,
        absent: list.filter((s) => s.mark?.status === "absent").length,
      };
    }),
  };
}

export async function attendanceSince(q: Q, orgId: string, fromDate: string) {
  return q.select({ studentId: attendance.studentId, status: attendance.status, date: attendance.date, batchId: attendance.batchId }).from(attendance).where(and(eq(attendance.orgId, orgId), gte(attendance.date, fromDate)));
}

export async function studentAttendancePercent(q: Q, orgId: string, studentId: string, now: number, days = 30) {
  const rows = await q.select({ status: attendance.status }).from(attendance).where(and(eq(attendance.orgId, orgId), eq(attendance.studentId, studentId), gte(attendance.date, addDays(istDateKey(now), -days))));
  return { percent: attendancePercent(rows), sessions: rows.length, absences: rows.filter((r) => r.status === "absent").length };
}
