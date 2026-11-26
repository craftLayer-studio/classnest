import { and, desc, eq, inArray } from "drizzle-orm";
import { isDateKey, istDateKey, normalizeIndianPhone, planInstalments, type DateKey, type Paise } from "@/domain";
import { attendance, batches, courses, enrolments, guardians, instalments, payments, students } from "../db/schema";
import { guardianConsent, guardianConsentMap, sendConsentRequest } from "./consent";
import { newCardCode, newId, newToken, notFound, requireRole, StoreError, type Ctx, type Q } from "./core";

export interface AdmitInput {
  name: string;
  grade: string;
  isMinor: boolean;
  guardianName: string;
  guardianPhone: string;
  relation: string;
  batchIds: string[];
  discountPaise: Paise;
  firstDue: DateKey;
}

/**
 * Admit a student: upsert the guardian by phone, create the minimal student record, enrol in batches,
 * create the fee instalments from each course's plan, and send the guardian a consent link.
 */
export async function admitStudent(ctx: Ctx, input: AdmitInput, q: Q = ctx.db) {
  requireRole(ctx, "owner", "staff");
  const name = input.name.trim();
  const guardianName = input.guardianName.trim();
  if (name.length < 2 || name.length > 80) throw new StoreError(400, "Student name must be 2 to 80 characters");
  if (guardianName.length < 2 || guardianName.length > 80) throw new StoreError(400, "Guardian name must be 2 to 80 characters");
  if (!input.grade.trim() || input.grade.length > 40) throw new StoreError(400, "Class or level is required");
  const phone = normalizeIndianPhone(input.guardianPhone);
  if (!phone) throw new StoreError(400, "Enter the guardian's 10-digit mobile number");
  if (input.batchIds.length === 0 || input.batchIds.length > 5) throw new StoreError(400, "Pick 1 to 5 batches");
  if (!isDateKey(input.firstDue)) throw new StoreError(400, "First due date is invalid");
  if (!Number.isInteger(input.discountPaise) || input.discountPaise < 0) throw new StoreError(400, "Discount is invalid");

  const run = async (tx: Q) => {
    const bs = await tx
      .select({ id: batches.id, courseId: batches.courseId, capacity: batches.capacity, name: batches.name })
      .from(batches)
      .where(and(eq(batches.orgId, ctx.orgId), inArray(batches.id, input.batchIds)));
    if (bs.length !== new Set(input.batchIds).size) notFound("Batch");
    for (const b of bs) {
      const n = await tx.select({ id: enrolments.id }).from(enrolments).where(eq(enrolments.batchId, b.id));
      if (n.length >= b.capacity) throw new StoreError(409, `${b.name} is full`);
    }
    const courseIds = [...new Set(bs.map((b) => b.courseId))];
    const cs = await tx.select().from(courses).where(and(eq(courses.orgId, ctx.orgId), inArray(courses.id, courseIds)));

    let [guardian] = await tx.select().from(guardians).where(and(eq(guardians.orgId, ctx.orgId), eq(guardians.phone, phone)));
    if (!guardian) {
      [guardian] = await tx.insert(guardians).values({ id: newId("gdn"), orgId: ctx.orgId, name: guardianName, phone, relation: input.relation.trim().slice(0, 30) || "Parent", createdAt: new Date(ctx.now) }).returning();
    }
    const existingConsent = await guardianConsent(tx, ctx.orgId, guardian.id);
    const studentId = newId("stu");
    await tx.insert(students).values({
      id: studentId,
      orgId: ctx.orgId,
      guardianId: guardian.id,
      name,
      grade: input.grade.trim(),
      isMinor: input.isMinor,
      status: "pending_consent",
      cardToken: newCardCode(),
      parentToken: newToken(),
      createdAt: new Date(ctx.now),
    });
    const today = istDateKey(ctx.now);
    for (const b of bs) await tx.insert(enrolments).values({ id: newId("enr"), orgId: ctx.orgId, studentId, batchId: b.id, startDate: today });
    let discountLeft = input.discountPaise;
    for (const c of cs) {
      const discount = Math.min(discountLeft, c.feePaise);
      discountLeft -= discount;
      const plan = planInstalments({ total: c.feePaise, discount, count: c.instalments, firstDue: input.firstDue });
      for (const p of plan) {
        await tx.insert(instalments).values({ id: newId("ins"), orgId: ctx.orgId, studentId, courseId: c.id, seq: p.seq, dueDate: p.dueDate, amountPaise: p.amount });
      }
    }
    await sendConsentRequest(tx, { orgId: ctx.orgId, guardianId: guardian.id, studentId, at: ctx.now, baseUrl: ctx.baseUrl });
    return { studentId, guardianId: guardian.id, siblingConsentOnFile: existingConsent.child_data };
  };
  return q === ctx.db ? ctx.db.transaction(run) : run(q);
}

export async function listStudents(ctx: Ctx) {
  const rows = await ctx.db
    .select({ s: students, guardianName: guardians.name, guardianPhone: guardians.phone })
    .from(students)
    .innerJoin(guardians, eq(guardians.id, students.guardianId))
    .where(eq(students.orgId, ctx.orgId))
    .orderBy(students.name);
  const enr = await ctx.db
    .select({ studentId: enrolments.studentId, batchName: batches.name })
    .from(enrolments)
    .innerJoin(batches, eq(batches.id, enrolments.batchId))
    .where(eq(enrolments.orgId, ctx.orgId));
  const consent = await guardianConsentMap(ctx.db, ctx.orgId, [...new Set(rows.map((r) => r.s.guardianId))]);
  return rows.map((r) => ({
    ...r.s,
    guardianName: r.guardianName,
    guardianPhone: r.guardianPhone,
    batches: enr.filter((e) => e.studentId === r.s.id).map((e) => e.batchName),
    consent: consent.get(r.s.guardianId)!,
  }));
}

export async function getStudentRecord(q: Q, orgId: string, studentId: string) {
  const [row] = await q
    .select({ s: students, g: guardians })
    .from(students)
    .innerJoin(guardians, eq(guardians.id, students.guardianId))
    .where(and(eq(students.id, studentId), eq(students.orgId, orgId)));
  return row ?? notFound("Student");
}

export async function studentDetail(ctx: Ctx, studentId: string) {
  const { s, g } = await getStudentRecord(ctx.db, ctx.orgId, studentId);
  const [bs, ins, pays, att, consent] = await Promise.all([
    ctx.db.select({ id: batches.id, name: batches.name }).from(enrolments).innerJoin(batches, eq(batches.id, enrolments.batchId)).where(and(eq(enrolments.studentId, studentId), eq(enrolments.orgId, ctx.orgId))),
    ctx.db.select().from(instalments).where(and(eq(instalments.studentId, studentId), eq(instalments.orgId, ctx.orgId))).orderBy(instalments.dueDate, instalments.seq),
    ctx.db.select().from(payments).where(and(eq(payments.studentId, studentId), eq(payments.orgId, ctx.orgId))).orderBy(desc(payments.createdAt)),
    ctx.db.select().from(attendance).where(and(eq(attendance.studentId, studentId), eq(attendance.orgId, ctx.orgId))).orderBy(desc(attendance.date)).limit(30),
    guardianConsent(ctx.db, ctx.orgId, g.id),
  ]);
  return { student: s, guardian: g, batches: bs, instalments: ins, payments: pays, attendance: att, consent };
}

/** Right to erasure: delete the student's record and everything keyed to it. Owner only. */
export async function deleteStudent(ctx: Ctx, studentId: string) {
  requireRole(ctx, "owner");
  await getStudentRecord(ctx.db, ctx.orgId, studentId);
  await ctx.db.delete(students).where(and(eq(students.id, studentId), eq(students.orgId, ctx.orgId)));
  return { deleted: true };
}

export async function resendConsent(ctx: Ctx, studentId: string) {
  requireRole(ctx, "owner", "staff");
  const { s } = await getStudentRecord(ctx.db, ctx.orgId, studentId);
  await sendConsentRequest(ctx.db, { orgId: ctx.orgId, guardianId: s.guardianId, studentId, at: ctx.now, baseUrl: ctx.baseUrl });
  return { sent: true };
}
