import { eq } from "drizzle-orm";
import { type ConsentPurpose } from "@/domain";
import type { Db } from "../db/client";
import { batches, enrolments, guardians, orgs, students } from "../db/schema";
import { studentAttendancePercent } from "./attendance";
import { guardianConsent, recordConsent } from "./consent";
import { notFound } from "./core";
import { parentFees } from "./fees";
import { studentResults } from "./tests";

async function byToken(db: Db, token: string) {
  const [row] = await db
    .select({ s: students, g: guardians, org: orgs })
    .from(students)
    .innerJoin(guardians, eq(guardians.id, students.guardianId))
    .innerJoin(orgs, eq(orgs.id, students.orgId))
    .where(eq(students.parentToken, token));
  return row ?? null;
}

/** The parent page (from the WhatsApp link): report card, attendance, fees with UPI link, consent controls. */
export async function parentPage(db: Db, token: string, now: number) {
  const row = await byToken(db, token);
  if (!row) return null;
  const { s, g, org } = row;
  const [att, results, fees, consent, bs] = await Promise.all([
    studentAttendancePercent(db, org.id, s.id, now),
    studentResults(db, org.id, s.id),
    parentFees(db, org, s.id, s.name, now),
    guardianConsent(db, org.id, g.id),
    db.select({ name: batches.name }).from(enrolments).innerJoin(batches, eq(batches.id, enrolments.batchId)).where(eq(enrolments.studentId, s.id)),
  ]);
  return {
    org: { name: org.name, city: org.city, isDemo: org.isDemo, gstin: org.gstin },
    student: { name: s.name, grade: s.grade, status: s.status, batches: bs.map((b) => b.name) },
    guardian: { name: g.name },
    attendance: att,
    results,
    fees,
    consent,
  };
}

/** Easy opt-out: the guardian changes a choice from the parent page. Withdrawing child_data asks the institute to delete. */
export async function parentSetConsent(db: Db, token: string, purpose: ConsentPurpose, granted: boolean, now: number) {
  const row = await byToken(db, token);
  if (!row) notFound("Parent link");
  await recordConsent(db, { orgId: row.org.id, guardianId: row.g.id, studentId: row.s.id, channel: "guardian_link", at: now, choices: { [purpose]: granted } });
  return guardianConsent(db, row.org.id, row.g.id);
}
