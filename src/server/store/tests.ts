import { and, desc, eq, inArray } from "drizzle-orm";
import { classAverage, grade, isDateKey, percent, rankScores, reportCardMessage, trend, validateScore } from "@/domain";
import { messaging } from "../adapters/messaging";
import { batches, enrolments, guardians, marks, students, tests } from "../db/schema";
import { guardianConsentMap } from "./consent";
import { newId, notFound, requireRole, StoreError, type Ctx, type Q } from "./core";
import { getOrg } from "./org";

export async function listTests(ctx: Ctx) {
  return ctx.db
    .select({ t: tests, batchName: batches.name })
    .from(tests)
    .innerJoin(batches, eq(batches.id, tests.batchId))
    .where(eq(tests.orgId, ctx.orgId))
    .orderBy(desc(tests.heldOn))
    .then((rows) => rows.map((r) => ({ ...r.t, batchName: r.batchName })));
}

export async function createTest(ctx: Ctx, input: { batchId: string; name: string; maxMarks: number; heldOn: string }) {
  requireRole(ctx, "owner", "teacher", "staff");
  if (!input.name.trim() || input.name.length > 80) throw new StoreError(400, "Test name is required");
  if (!Number.isInteger(input.maxMarks) || input.maxMarks < 1 || input.maxMarks > 1000) throw new StoreError(400, "Maximum marks must be 1 to 1000");
  if (!isDateKey(input.heldOn)) throw new StoreError(400, "Date is invalid");
  const [b] = await ctx.db.select().from(batches).where(and(eq(batches.id, input.batchId), eq(batches.orgId, ctx.orgId)));
  if (!b) notFound("Batch");
  const id = newId("tst");
  await ctx.db.insert(tests).values({ id, orgId: ctx.orgId, batchId: b.id, name: input.name.trim(), maxMarks: input.maxMarks, heldOn: input.heldOn, createdAt: new Date(ctx.now) });
  return { id };
}

async function getTest(q: Q, orgId: string, testId: string) {
  const [t] = await q.select().from(tests).where(and(eq(tests.id, testId), eq(tests.orgId, orgId)));
  return t ?? notFound("Test");
}

export async function testDetail(ctx: Ctx, testId: string) {
  const t = await getTest(ctx.db, ctx.orgId, testId);
  const [b] = await ctx.db.select().from(batches).where(eq(batches.id, t.batchId));
  const roster = await ctx.db
    .select({ id: students.id, name: students.name })
    .from(enrolments)
    .innerJoin(students, eq(students.id, enrolments.studentId))
    .where(and(eq(enrolments.batchId, t.batchId), eq(enrolments.orgId, ctx.orgId)))
    .orderBy(students.name);
  const ms = await ctx.db.select().from(marks).where(and(eq(marks.testId, t.id), eq(marks.orgId, ctx.orgId)));
  const ranked = rankScores(ms.map((m) => ({ studentId: m.studentId, score: m.scoreX2 / 2 })));
  return {
    test: t,
    batchName: b.name,
    average: classAverage(ranked),
    rows: roster.map((r) => {
      const m = ranked.find((x) => x.studentId === r.id);
      return { studentId: r.id, name: r.name, score: m?.score ?? null, rank: m?.rank ?? null, percent: m ? percent(m.score, t.maxMarks) : null };
    }),
  };
}

/** Save marks for a test. `score: null` clears a mark (absent from the test). */
export async function saveMarks(ctx: Ctx, testId: string, entries: { studentId: string; score: number | null }[]) {
  requireRole(ctx, "owner", "teacher", "staff");
  const t = await getTest(ctx.db, ctx.orgId, testId);
  const roster = new Set(
    (await ctx.db.select({ id: enrolments.studentId }).from(enrolments).where(and(eq(enrolments.batchId, t.batchId), eq(enrolments.orgId, ctx.orgId)))).map((r) => r.id),
  );
  for (const e of entries) {
    if (!roster.has(e.studentId)) throw new StoreError(400, "A student is not in this batch");
    if (e.score !== null) {
      const err = validateScore(e.score, t.maxMarks);
      if (err) throw new StoreError(400, err);
    }
  }
  await ctx.db.transaction(async (tx) => {
    for (const e of entries) {
      await tx.delete(marks).where(and(eq(marks.testId, t.id), eq(marks.studentId, e.studentId)));
      if (e.score !== null) await tx.insert(marks).values({ id: newId("mrk"), orgId: ctx.orgId, testId: t.id, studentId: e.studentId, scoreX2: Math.round(e.score * 2) });
    }
  });
  return { saved: entries.length };
}

/** Publish results: each opted-in guardian gets a WhatsApp link to the report card. */
export async function publishTest(ctx: Ctx, testId: string) {
  requireRole(ctx, "owner", "teacher");
  const t = await getTest(ctx.db, ctx.orgId, testId);
  const org = await getOrg(ctx.db, ctx.orgId);
  const rows = await ctx.db
    .select({ name: students.name, parentToken: students.parentToken, guardianId: students.guardianId, phone: guardians.phone })
    .from(marks)
    .innerJoin(students, eq(students.id, marks.studentId))
    .innerJoin(guardians, eq(guardians.id, students.guardianId))
    .where(and(eq(marks.testId, t.id), eq(marks.orgId, ctx.orgId)));
  if (rows.length === 0) throw new StoreError(409, "Enter marks before publishing");
  const consent = await guardianConsentMap(ctx.db, ctx.orgId, [...new Set(rows.map((r) => r.guardianId))]);
  let sent = 0;
  await ctx.db.transaction(async (tx) => {
    for (const r of rows) {
      if (!consent.get(r.guardianId)?.service_updates) continue;
      await messaging().send(tx, { orgId: ctx.orgId, template: "report_card", to: r.phone, body: reportCardMessage({ student: r.name, test: t.name, institute: org.name, link: `${ctx.baseUrl}/p/${r.parentToken}` }) }, new Date(ctx.now));
      sent++;
    }
    await tx.update(tests).set({ publishedAt: new Date(ctx.now) }).where(eq(tests.id, t.id));
  });
  return { sent, skipped: rows.length - sent };
}

/** Report card rows for one student: every published test in their batches with score, rank and class average. */
export async function studentResults(q: Q, orgId: string, studentId: string) {
  const bIds = (await q.select({ id: enrolments.batchId }).from(enrolments).where(and(eq(enrolments.studentId, studentId), eq(enrolments.orgId, orgId)))).map((r) => r.id);
  if (bIds.length === 0) return { rows: [], trend: null };
  const ts = (await q.select({ t: tests, batchName: batches.name }).from(tests).innerJoin(batches, eq(batches.id, tests.batchId)).where(and(eq(tests.orgId, orgId), inArray(tests.batchId, bIds)))).filter((r) => r.t.publishedAt);
  ts.sort((a, b) => a.t.heldOn.localeCompare(b.t.heldOn));
  const all = ts.length ? await q.select().from(marks).where(and(eq(marks.orgId, orgId), inArray(marks.testId, ts.map((x) => x.t.id)))) : [];
  const rows = ts.flatMap(({ t, batchName }) => {
    const ranked = rankScores(all.filter((m) => m.testId === t.id).map((m) => ({ studentId: m.studentId, score: m.scoreX2 / 2 })));
    const mine = ranked.find((r) => r.studentId === studentId);
    if (!mine) return [];
    const pct = percent(mine.score, t.maxMarks);
    return [{ testId: t.id, name: t.name, batchName, heldOn: t.heldOn, score: mine.score, maxMarks: t.maxMarks, percent: pct, grade: grade(pct), rank: mine.rank, of: ranked.length, average: classAverage(ranked) }];
  });
  return { rows, trend: trend(rows.map((r) => r.percent)) };
}
