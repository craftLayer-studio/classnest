import { and, eq } from "drizzle-orm";
import { clashesFor, parseDays, validateSlot, type BatchSlot, type Paise, type Weekday } from "@/domain";
import { batches, courses, enrolments, users } from "../db/schema";
import { newId, notFound, requireRole, StoreError, type Ctx, type Q } from "./core";

export async function listCourses(q: Q, orgId: string) {
  return q.select().from(courses).where(eq(courses.orgId, orgId)).orderBy(courses.name);
}

export async function createCourse(ctx: Ctx, input: { name: string; feePaise: Paise; instalments: number; months: number }) {
  requireRole(ctx, "owner");
  if (!Number.isInteger(input.feePaise) || input.feePaise <= 0 || input.feePaise > 100_000_000) throw new StoreError(400, "Fee must be between ₹1 and ₹10,00,000");
  if (!Number.isInteger(input.instalments) || input.instalments < 1 || input.instalments > 12) throw new StoreError(400, "Instalments must be 1 to 12");
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 36) throw new StoreError(400, "Duration must be 1 to 36 months");
  const id = newId("crs");
  await ctx.db.insert(courses).values({ id, orgId: ctx.orgId, ...input });
  return { id };
}

export type BatchRow = Awaited<ReturnType<typeof listBatches>>[number];

export async function listBatches(q: Q, orgId: string) {
  const rows = await q
    .select({ batch: batches, courseName: courses.name, teacherName: users.name })
    .from(batches)
    .innerJoin(courses, eq(courses.id, batches.courseId))
    .leftJoin(users, eq(users.id, batches.teacherId))
    .where(eq(batches.orgId, orgId))
    .orderBy(batches.startMin, batches.name);
  const counts = await q.select({ batchId: enrolments.batchId }).from(enrolments).where(eq(enrolments.orgId, orgId));
  const count = new Map<string, number>();
  for (const c of counts) count.set(c.batchId, (count.get(c.batchId) ?? 0) + 1);
  return rows.map((r) => ({ ...r.batch, daysList: parseDays(r.batch.days), courseName: r.courseName, teacherName: r.teacherName, enrolled: count.get(r.batch.id) ?? 0 }));
}

export function toSlot(b: { id: string; name: string; days: string; startMin: number; endMin: number; room: string; teacherId: string | null }): BatchSlot {
  return { id: b.id, name: b.name, days: parseDays(b.days), startMin: b.startMin, endMin: b.endMin, room: b.room, teacherId: b.teacherId };
}

export interface BatchInput {
  courseId: string;
  name: string;
  teacherId: string | null;
  room: string;
  days: Weekday[];
  startMin: number;
  endMin: number;
  capacity: number;
}

/** Create a batch. Room and teacher clashes are rejected (clash detection). */
export async function createBatch(ctx: Ctx, input: BatchInput) {
  requireRole(ctx, "owner");
  const errors = validateSlot(input);
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 500) errors.push("Capacity must be 1 to 500");
  if (errors.length) throw new StoreError(400, errors.join(". "));
  const [course] = await ctx.db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.orgId, ctx.orgId)));
  if (!course) notFound("Course");
  if (input.teacherId) {
    const [t] = await ctx.db.select().from(users).where(and(eq(users.id, input.teacherId), eq(users.orgId, ctx.orgId)));
    if (!t) notFound("Teacher");
  }
  const id = newId("bat");
  const existing = (await ctx.db.select().from(batches).where(eq(batches.orgId, ctx.orgId))).map(toSlot);
  const clashes = clashesFor({ id, name: input.name, days: input.days, startMin: input.startMin, endMin: input.endMin, room: input.room, teacherId: input.teacherId }, existing);
  if (clashes.length) {
    const other = existing.find((e) => e.id === (clashes[0].a === id ? clashes[0].b : clashes[0].a));
    throw new StoreError(409, `Clashes with ${other?.name ?? "another batch"} (same ${clashes[0].reason})`);
  }
  await ctx.db.insert(batches).values({ id, orgId: ctx.orgId, ...input, days: input.days.join(",") });
  return { id };
}
