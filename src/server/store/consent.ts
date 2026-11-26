import { and, desc, eq, inArray } from "drizzle-orm";
import { consentRequest, currentConsent, NOTICE_VERSION, type ConsentChannel, type ConsentPurpose } from "@/domain";
import { messaging } from "../adapters/messaging";
import { consentRecords, consentRequests, guardians, orgs, students } from "../db/schema";
import { newId, newToken, notFound, StoreError, type Q } from "./core";

export async function guardianConsent(q: Q, orgId: string, guardianId: string) {
  const rows = await q.select().from(consentRecords).where(and(eq(consentRecords.orgId, orgId), eq(consentRecords.guardianId, guardianId)));
  return currentConsent(rows.map((r) => ({ purpose: r.purpose, granted: r.granted, at: r.createdAt.getTime() })));
}

export async function guardianConsentMap(q: Q, orgId: string, guardianIds: string[]) {
  const out = new Map<string, ReturnType<typeof currentConsent>>();
  if (guardianIds.length === 0) return out;
  const rows = await q.select().from(consentRecords).where(and(eq(consentRecords.orgId, orgId), inArray(consentRecords.guardianId, guardianIds)));
  for (const gid of guardianIds) {
    out.set(gid, currentConsent(rows.filter((r) => r.guardianId === gid).map((r) => ({ purpose: r.purpose, granted: r.granted, at: r.createdAt.getTime() }))));
  }
  return out;
}

export async function recordConsent(
  q: Q,
  p: { orgId: string; guardianId?: string | null; enquiryId?: string | null; studentId?: string | null; channel: ConsentChannel; at: number; choices: Partial<Record<ConsentPurpose, boolean>> },
) {
  const rows = Object.entries(p.choices)
    .filter(([, v]) => typeof v === "boolean")
    .map(([purpose, granted]) => ({
      id: newId("con"),
      orgId: p.orgId,
      guardianId: p.guardianId ?? null,
      enquiryId: p.enquiryId ?? null,
      studentId: p.studentId ?? null,
      purpose: purpose as ConsentPurpose,
      granted: granted as boolean,
      noticeVersion: NOTICE_VERSION,
      channel: p.channel,
      createdAt: new Date(p.at),
    }));
  if (rows.length) await q.insert(consentRecords).values(rows);
}

/** Send the guardian a one-time consent link on WhatsApp. This is the only message allowed before consent. */
export async function sendConsentRequest(q: Q, p: { orgId: string; guardianId: string; studentId: string; at: number; baseUrl: string }) {
  const token = newToken();
  await q.insert(consentRequests).values({ id: newId("crq"), orgId: p.orgId, guardianId: p.guardianId, studentId: p.studentId, token, createdAt: new Date(p.at) });
  const [row] = await q
    .select({ org: orgs.name, student: students.name, phone: guardians.phone })
    .from(students)
    .innerJoin(guardians, eq(guardians.id, students.guardianId))
    .innerJoin(orgs, eq(orgs.id, students.orgId))
    .where(and(eq(students.id, p.studentId), eq(students.orgId, p.orgId)));
  if (!row) notFound("Student");
  await messaging().send(q, { orgId: p.orgId, template: "consent_request", to: row.phone, body: consentRequest({ student: row.student, institute: row.org, link: `${p.baseUrl}/consent/${token}` }) }, new Date(p.at));
  return token;
}

export async function getConsentRequest(q: Q, token: string) {
  const [row] = await q
    .select({ req: consentRequests, org: orgs.name, orgCity: orgs.city, isDemo: orgs.isDemo, student: students.name, grade: students.grade, guardian: guardians.name })
    .from(consentRequests)
    .innerJoin(students, eq(students.id, consentRequests.studentId))
    .innerJoin(guardians, eq(guardians.id, consentRequests.guardianId))
    .innerJoin(orgs, eq(orgs.id, consentRequests.orgId))
    .where(eq(consentRequests.token, token));
  return row ?? null;
}

/** Guardian answers the consent link. Keeping the child's record (child_data) is required to activate the student. */
export async function submitConsent(q: Q, token: string, choices: Record<ConsentPurpose, boolean>, at: number) {
  const row = await getConsentRequest(q, token);
  if (!row) notFound("Consent link");
  if (row.req.completedAt) throw new StoreError(409, "This consent link has already been used. Use the parent page to change your choices.");
  await recordConsent(q, { orgId: row.req.orgId, guardianId: row.req.guardianId, studentId: row.req.studentId, channel: "guardian_link", at, choices });
  await q.update(consentRequests).set({ completedAt: new Date(at) }).where(eq(consentRequests.id, row.req.id));
  if (choices.child_data) {
    await q.update(students).set({ status: "active" }).where(and(eq(students.id, row.req.studentId), eq(students.status, "pending_consent")));
  }
  return { activated: choices.child_data };
}

export async function consentHistory(q: Q, orgId: string, guardianId: string) {
  return q.select().from(consentRecords).where(and(eq(consentRecords.orgId, orgId), eq(consentRecords.guardianId, guardianId))).orderBy(desc(consentRecords.createdAt));
}
