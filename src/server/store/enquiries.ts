import { and, desc, eq, inArray } from "drizzle-orm";
import {
  addDays,
  admissionOffer,
  canMoveEnquiry,
  currentConsent,
  demoBooked,
  ENQUIRY_STAGES,
  isDateKey,
  istDateKey,
  meetsOn,
  normalizeIndianPhone,
  STAGE_LABEL,
  type DateKey,
  type EnquiryStage,
} from "@/domain";
import { messaging } from "../adapters/messaging";
import type { Db } from "../db/client";
import { batches, consentRecords, courses, enquiries, guardians, orgs } from "../db/schema";
import { toSlot } from "./batches";
import { guardianConsentMap, recordConsent } from "./consent";
import { newId, notFound, requireRole, StoreError, type Ctx, type Q } from "./core";
import { admitStudent } from "./students";

const DEMO_DAYS_AHEAD = 7;

/** Public poster page: institute, courses and the demo-class sessions in the next 7 days. */
export async function posterInfo(db: Db, posterToken: string, now: number) {
  const [org] = await db.select().from(orgs).where(eq(orgs.posterToken, posterToken));
  if (!org) return null;
  const cs = await db.select().from(courses).where(eq(courses.orgId, org.id)).orderBy(courses.name);
  const bs = await db.select().from(batches).where(eq(batches.orgId, org.id)).orderBy(batches.startMin);
  const today = istDateKey(now);
  const slots: { batchId: string; batchName: string; courseId: string; date: DateKey; startMin: number }[] = [];
  for (let d = 1; d <= DEMO_DAYS_AHEAD; d++) {
    const date = addDays(today, d);
    for (const b of bs) if (meetsOn(toSlot(b), date)) slots.push({ batchId: b.id, batchName: b.name, courseId: b.courseId, date, startMin: b.startMin });
  }
  return { org: { id: org.id, name: org.name, city: org.city, isDemo: org.isDemo }, courses: cs.map((c) => ({ id: c.id, name: c.name, feePaise: c.feePaise, instalments: c.instalments, months: c.months })), slots };
}

export interface DemoBookingInput {
  guardianName: string;
  phone: string;
  studentName: string;
  grade: string;
  courseId: string;
  slot?: { batchId: string; date: DateKey };
  isGuardian: boolean;
  consentUpdates: boolean;
  consentMarketing: boolean;
}

/** Public: a parent books a free demo class from the poster QR. Consent choices are recorded as separate rows. */
export async function bookDemo(db: Db, posterToken: string, input: DemoBookingInput, now: number) {
  const [org] = await db.select().from(orgs).where(eq(orgs.posterToken, posterToken));
  if (!org) notFound("Poster");
  if (!input.isGuardian) throw new StoreError(400, "Only a parent or guardian can book for a child under 18");
  const phone = normalizeIndianPhone(input.phone);
  if (!phone) throw new StoreError(400, "Enter a valid 10-digit mobile number");
  const guardianName = input.guardianName.trim();
  const studentName = input.studentName.trim();
  if (guardianName.length < 2 || guardianName.length > 80) throw new StoreError(400, "Enter your name");
  if (studentName.length < 2 || studentName.length > 80) throw new StoreError(400, "Enter the student's name");
  if (!input.grade.trim() || input.grade.length > 40) throw new StoreError(400, "Enter the class or level");
  const [course] = await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.orgId, org.id)));
  if (!course) notFound("Course");
  let batch: typeof batches.$inferSelect | undefined;
  if (input.slot) {
    if (!isDateKey(input.slot.date)) throw new StoreError(400, "Pick a demo date");
    [batch] = await db.select().from(batches).where(and(eq(batches.id, input.slot.batchId), eq(batches.orgId, org.id)));
    const today = istDateKey(now);
    if (!batch || batch.courseId !== course.id || !meetsOn(toSlot(batch), input.slot.date) || input.slot.date <= today || input.slot.date > addDays(today, DEMO_DAYS_AHEAD)) {
      throw new StoreError(400, "That demo slot is not available");
    }
  }
  return db.transaction(async (tx) => {
    const id = newId("enq");
    await tx.insert(enquiries).values({
      id,
      orgId: org.id,
      guardianName,
      phone,
      studentName,
      grade: input.grade.trim(),
      courseId: course.id,
      stage: batch ? "demo_booked" : "new",
      demoBatchId: batch?.id ?? null,
      demoDate: batch ? input.slot!.date : null,
      source: "poster_qr",
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });
    await recordConsent(tx, { orgId: org.id, enquiryId: id, channel: "poster_form", at: now, choices: { service_updates: input.consentUpdates, marketing: input.consentMarketing } });
    if (batch && input.consentUpdates) {
      await messaging().send(tx, { orgId: org.id, template: "demo_booked", to: phone, body: demoBooked({ student: studentName, batch: batch.name, date: input.slot!.date, startMin: batch.startMin, institute: org.name }) }, new Date(now));
    }
    return { id, stage: batch ? "demo_booked" : "new", demo: batch ? { batch: batch.name, date: input.slot!.date, startMin: batch.startMin } : null };
  });
}

async function enquiryConsent(q: Q, orgId: string, ids: string[]) {
  const rows = ids.length ? await q.select().from(consentRecords).where(and(eq(consentRecords.orgId, orgId), inArray(consentRecords.enquiryId, ids))) : [];
  return new Map(ids.map((id) => [id, currentConsent(rows.filter((r) => r.enquiryId === id).map((r) => ({ purpose: r.purpose, granted: r.granted, at: r.createdAt.getTime() })))]));
}

export async function listEnquiries(ctx: Ctx) {
  requireRole(ctx, "owner", "staff");
  const rows = await ctx.db
    .select({ e: enquiries, courseName: courses.name, demoBatch: batches.name })
    .from(enquiries)
    .leftJoin(courses, eq(courses.id, enquiries.courseId))
    .leftJoin(batches, eq(batches.id, enquiries.demoBatchId))
    .where(eq(enquiries.orgId, ctx.orgId))
    .orderBy(desc(enquiries.createdAt));
  const consent = await enquiryConsent(ctx.db, ctx.orgId, rows.map((r) => r.e.id));
  return rows.map((r) => ({ ...r.e, courseName: r.courseName, demoBatch: r.demoBatch, consent: consent.get(r.e.id)! }));
}

export async function addWalkIn(ctx: Ctx, input: { guardianName: string; phone: string; studentName: string; grade: string; courseId: string | null; source: "walk_in" | "call"; note: string; consentUpdates: boolean; consentMarketing: boolean }) {
  requireRole(ctx, "owner", "staff");
  const phone = normalizeIndianPhone(input.phone);
  if (!phone) throw new StoreError(400, "Enter a valid 10-digit mobile number");
  if (input.guardianName.trim().length < 2 || input.studentName.trim().length < 2) throw new StoreError(400, "Enter the parent's and student's names");
  if (input.courseId) {
    const [c] = await ctx.db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.orgId, ctx.orgId)));
    if (!c) notFound("Course");
  }
  const id = newId("enq");
  await ctx.db.transaction(async (tx) => {
    await tx.insert(enquiries).values({ id, orgId: ctx.orgId, guardianName: input.guardianName.trim(), phone, studentName: input.studentName.trim(), grade: input.grade.trim() || "-", courseId: input.courseId, source: input.source, note: input.note.slice(0, 500), createdAt: new Date(ctx.now), updatedAt: new Date(ctx.now) });
    await recordConsent(tx, { orgId: ctx.orgId, enquiryId: id, channel: "staff_desk", at: ctx.now, choices: { service_updates: input.consentUpdates, marketing: input.consentMarketing } });
  });
  return { id };
}

export async function moveEnquiry(ctx: Ctx, id: string, to: EnquiryStage) {
  requireRole(ctx, "owner", "staff");
  if (!ENQUIRY_STAGES.includes(to) || to === "admitted") throw new StoreError(400, "Use Admit to convert an enquiry");
  const [e] = await ctx.db.select().from(enquiries).where(and(eq(enquiries.id, id), eq(enquiries.orgId, ctx.orgId)));
  if (!e) notFound("Enquiry");
  if (!canMoveEnquiry(e.stage, to)) throw new StoreError(409, `Cannot move from ${STAGE_LABEL[e.stage]} to ${STAGE_LABEL[to]}`);
  await ctx.db.update(enquiries).set({ stage: to, updatedAt: new Date(ctx.now) }).where(eq(enquiries.id, id));
  return { stage: to };
}

/** One-tap conversion: the enquiry becomes a student with a fee plan, and the guardian gets the consent link. */
export async function admitEnquiry(ctx: Ctx, id: string, input: { batchIds: string[]; discountPaise: number; firstDue: string }) {
  requireRole(ctx, "owner", "staff");
  const [e] = await ctx.db.select().from(enquiries).where(and(eq(enquiries.id, id), eq(enquiries.orgId, ctx.orgId)));
  if (!e) notFound("Enquiry");
  if (!canMoveEnquiry(e.stage, "admitted")) throw new StoreError(409, `Cannot admit from ${STAGE_LABEL[e.stage]}`);
  return ctx.db.transaction(async (tx) => {
    const res = await admitStudent(ctx, { name: e.studentName, grade: e.grade, isMinor: true, guardianName: e.guardianName, guardianPhone: e.phone, relation: "Parent", batchIds: input.batchIds, discountPaise: input.discountPaise, firstDue: input.firstDue }, tx);
    await tx.update(enquiries).set({ stage: "admitted", studentId: res.studentId, updatedAt: new Date(ctx.now) }).where(eq(enquiries.id, id));
    return res;
  });
}

/**
 * Marketing follow-up (admission offer). Sent only to enquirers and guardians who opted in to marketing,
 * never to students, and never to admitted/lost leads twice over: phones are de-duplicated.
 */
export async function sendAdmissionOffer(ctx: Ctx, text: string) {
  requireRole(ctx, "owner");
  const body = text.trim();
  if (body.length < 10 || body.length > 300) throw new StoreError(400, "Offer text must be 10 to 300 characters");
  const [org] = await ctx.db.select().from(orgs).where(eq(orgs.id, ctx.orgId));
  const leads = (await listEnquiries(ctx)).filter((e) => e.stage !== "admitted" && e.stage !== "lost");
  const gs = await ctx.db.select().from(guardians).where(eq(guardians.orgId, ctx.orgId));
  const gConsent = await guardianConsentMap(ctx.db, ctx.orgId, gs.map((g) => g.id));
  const recipients = new Map<string, string>();
  let skipped = 0;
  for (const l of leads) {
    if (l.consent.marketing) recipients.set(l.phone, l.guardianName);
    else skipped++;
  }
  for (const g of gs) {
    if (gConsent.get(g.id)?.marketing) recipients.set(g.phone, g.name);
    else skipped++;
  }
  await ctx.db.transaction(async (tx) => {
    for (const [phone, name] of recipients) {
      await messaging().send(tx, { orgId: ctx.orgId, template: "admission_offer", to: phone, body: admissionOffer({ name: name.split(" ")[0], institute: org.name, text: body }) }, new Date(ctx.now));
    }
  });
  return { sent: recipients.size, skipped };
}
