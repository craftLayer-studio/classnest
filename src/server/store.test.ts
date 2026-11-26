import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { istDateKey, istInstant, addDays, weekdayOf } from "@/domain";
import { createMemoryDb, type Db } from "./db/client";
import * as t from "./db/schema";
import { DEMO, seedDemo } from "./seed";
import {
  absenceSweep,
  admitEnquiry,
  admitStudent,
  bookDemo,
  cardScan,
  createBatch,
  defaulterList,
  getConsentRequest,
  listBatches,
  ownerDashboard,
  parentPage,
  parentSetConsent,
  posterInfo,
  publishTest,
  recordPayment,
  reminderSweep,
  requestOtp,
  saveMarks,
  selfCheckIn,
  sendAdmissionOffer,
  sendFeeReminder,
  staffMark,
  StoreError,
  submitConsent,
  createTest,
  verifyOtp,
  type Ctx,
} from "./store";

/** A Wednesday at 4:20 pm IST: the 4:00 pm batch is past its 15-minute absence cutoff. */
const TODAY = "2026-11-25";
const NOW = istInstant(TODAY, 16 * 60 + 20);
const BASE = "http://test.local";

let db: Db;
let owner: Ctx;
let staff: Ctx;

async function ctxFor(phone: string): Promise<Ctx> {
  const [u] = await db.select().from(t.users).where(eq(t.users.phone, phone));
  return { db, orgId: u.orgId, userId: u.id, role: u.role, now: NOW, baseUrl: BASE };
}

async function outboxFor(phone: string) {
  return db.select().from(t.outbox).where(eq(t.outbox.toPhone, phone));
}

beforeEach(async () => {
  db = await createMemoryDb();
  await seedDemo(db, NOW);
  owner = await ctxFor(DEMO.owner.phone);
  staff = await ctxFor(DEMO.staff.phone);
});

async function admitNew(ctx: Ctx, phone = "+919900000001") {
  const batches = await listBatches(db, ctx.orgId);
  const b = batches.find((x) => x.name.startsWith("10 Science B"))!;
  const res = await admitStudent(ctx, { name: "Test Child", grade: "Class 10", isMinor: true, guardianName: "Test Parent", guardianPhone: phone, relation: "Mother", batchIds: [b.id], discountPaise: 0, firstDue: addDays(TODAY, -20) });
  return { ...res, batch: b };
}

describe("auth", () => {
  it("signs in staff with phone + OTP and rejects wrong codes", async () => {
    const { demoCode } = await requestOtp(db, "98260 22222", NOW, true);
    expect(demoCode).toMatch(/^\d{6}$/);
    await expect(verifyOtp(db, "9826022222", demoCode === "000000" ? "111111" : "000000", NOW)).rejects.toThrow(/Wrong code/);
    const s = await verifyOtp(db, "9826022222", demoCode!, NOW);
    expect(s.role).toBe("staff");
    await expect(verifyOtp(db, "9826022222", demoCode!, NOW)).rejects.toThrow(/expired/);
  });

  it("does not reveal unknown numbers and enforces roles", async () => {
    const r = await requestOtp(db, "9811111111", NOW, true);
    expect(r.demoCode).toMatch(/no staff/);
    await expect(ownerDashboard(staff)).rejects.toBeInstanceOf(StoreError);
  });
});

describe("admission and guardian consent", () => {
  it("creates a pending student, sends only a consent request, and activates on consent", async () => {
    const { studentId } = await admitNew(staff);
    const msgs = await outboxFor("+919900000001");
    expect(msgs.map((m) => m.template)).toEqual(["consent_request"]);
    const token = msgs[0].body.match(/consent\/([\w-]+)/)![1];
    const req = await getConsentRequest(db, token);
    expect(req?.student).toBe("Test Child");
    await submitConsent(db, token, { child_data: true, service_updates: true, marketing: false }, NOW);
    const [s] = await db.select().from(t.students).where(eq(t.students.id, studentId));
    expect(s.status).toBe("active");
    expect(s.isMinor).toBe(true);
    await expect(submitConsent(db, token, { child_data: true, service_updates: true, marketing: false }, NOW)).rejects.toThrow(/already/);
    const rows = await db.select().from(t.consentRecords).where(eq(t.consentRecords.studentId, studentId));
    expect(rows.map((r) => [r.purpose, r.granted, r.channel])).toContainEqual(["marketing", false, "guardian_link"]);
  });

  it("creates fee instalments from the course plan", async () => {
    const { studentId } = await admitNew(staff);
    const ins = await db.select().from(t.instalments).where(eq(t.instalments.studentId, studentId));
    expect(ins).toHaveLength(3);
    expect(ins.reduce((s, i) => s + i.amountPaise, 0)).toBe(3_600_000);
  });

  it("isolates tenants", async () => {
    await db.insert(t.orgs).values({ id: "org_other", name: "Other", city: "Pune", upiVpa: "o@bank", upiPayee: "O", receiptPrefix: "O", entranceToken: "x1", posterToken: "x2" });
    const foreign: Ctx = { ...owner, orgId: "org_other" };
    expect(await listBatches(db, "org_other")).toHaveLength(0);
    const [stu] = await db.select().from(t.students).where(eq(t.students.orgId, DEMO.orgId)).limit(1);
    await expect(recordPayment(foreign, { studentId: stu.id, amountPaise: 100, mode: "cash" })).rejects.toThrow(/not found/);
  });
});

describe("attendance", () => {
  it("self check-in by entrance QR + card code, and card scan by staff", async () => {
    const r = await selfCheckIn(db, DEMO.entranceToken, "aarav001", NOW);
    expect(r.student).toBe("Aarav Sharma");
    const again = await selfCheckIn(db, DEMO.entranceToken, "AARAV001", NOW);
    expect(again.alreadyMarked).toBe(true);
    await expect(selfCheckIn(db, DEMO.entranceToken, "NOPE1234", NOW)).rejects.toThrow(/not recognised/);
    await expect(selfCheckIn(db, "bad-token", "AARAV001", NOW)).rejects.toThrow(/not found/);
    const [ishita] = await db.select().from(t.students).where(eq(t.students.name, "Ishita Patel"));
    const scan = await cardScan(staff, ishita.cardToken);
    expect(scan.student).toBe("Ishita Patel");
  });

  it("marks unmarked students absent after the cutoff and alerts opted-in guardians once", async () => {
    expect(weekdayOf(TODAY)).toBe(3);
    const { studentId, batch } = await admitNew(staff, "+919900000002");
    const token = (await outboxFor("+919900000002"))[0].body.match(/consent\/([\w-]+)/)![1];
    await submitConsent(db, token, { child_data: true, service_updates: true, marketing: false }, NOW);
    const first = await absenceSweep(db, DEMO.orgId, NOW);
    expect(first.markedAbsent).toBeGreaterThan(0);
    const [mark] = await db.select().from(t.attendance).where(and(eq(t.attendance.studentId, studentId), eq(t.attendance.date, TODAY)));
    expect(mark.status).toBe("absent");
    expect((await outboxFor("+919900000002")).map((m) => m.template)).toContain("absence_alert");
    const second = await absenceSweep(db, DEMO.orgId, NOW);
    expect(second.alerts).toBe(0);
    // Late arrival overrides the automatic absence. No arrival alert in absence-only mode.
    await staffMark(staff, { batchId: batch.id, studentId, status: "present" });
    const msgs = await outboxFor("+919900000002");
    expect(msgs.filter((m) => m.template === "arrival_alert")).toHaveLength(0);
  });

  it("skips alerts for guardians without service-update consent", async () => {
    const res = await absenceSweep(db, DEMO.orgId, NOW);
    // Myra Khan's guardian (index 9) has not opted in to updates.
    const [myra] = await db.select().from(t.students).where(eq(t.students.name, "Myra Khan"));
    const [g] = await db.select().from(t.guardians).where(eq(t.guardians.id, myra.guardianId));
    expect((await outboxFor(g.phone)).filter((m) => m.template === "absence_alert" && m.createdAt.getTime() === NOW)).toHaveLength(0);
    expect(res.skippedNoConsent).toBeGreaterThanOrEqual(1);
  });
});

describe("fees", () => {
  it("records a payment against the oldest dues with a GST receipt number", async () => {
    const list = await defaulterList(staff);
    expect(list.length).toBeGreaterThan(0);
    const d = list[0];
    const r = await recordPayment(staff, { studentId: d.studentId, amountPaise: d.overdue, mode: "upi", reference: "UTR123" });
    expect(r.receiptNo).toMatch(/^SDA\/2026-27\/\d{5}$/);
    const after = await defaulterList(staff);
    expect(after.find((x) => x.studentId === d.studentId)).toBeUndefined();
    await expect(recordPayment(staff, { studentId: d.studentId, amountPaise: 999_999_999, mode: "cash" })).rejects.toThrow(/more than/);
    await expect(recordPayment(staff, { studentId: d.studentId, amountPaise: 100, mode: "upi" })).rejects.toThrow(/UTR/);
  });

  it("sends manual reminders only to opted-in guardians", async () => {
    const list = await defaulterList(staff);
    const ok = list.find((d) => d.canMessage)!;
    await sendFeeReminder(staff, ok.studentId);
    expect((await outboxFor(ok.phone)).some((m) => m.template === "fee_reminder" && m.createdAt.getTime() === NOW)).toBe(true);
  });

  it("runs the D-3/D0/D+3/D+7 reminder job once per stage", async () => {
    const first = await reminderSweep(db, DEMO.orgId, NOW, BASE);
    expect(first.sent).toBeGreaterThan(0);
    const second = await reminderSweep(db, DEMO.orgId, NOW, BASE);
    expect(second.sent).toBe(0);
  });

  it("serves the parent page with a UPI intent link", async () => {
    const p = await parentPage(db, "demo-parent-aarav-Xk29Lq", NOW);
    expect(p?.student.name).toBe("Aarav Sharma");
    expect(p?.results.rows.length).toBeGreaterThan(0);
    if (p?.fees.upiLink) expect(p.fees.upiLink).toMatch(/^upi:\/\/pay\?pa=shikhar\.demo%40okdemo/);
    const c = await parentSetConsent(db, "demo-parent-aarav-Xk29Lq", "service_updates", false, NOW);
    expect(c.service_updates).toBe(false);
  });
});

describe("tests and report cards", () => {
  it("saves marks, ranks them and publishes to opted-in guardians", async () => {
    const batches = await listBatches(db, DEMO.orgId);
    const b = batches.find((x) => x.name.startsWith("12 Physics"))!;
    const { id } = await createTest(owner, { batchId: b.id, name: "Mock 1", maxMarks: 100, heldOn: TODAY });
    const roster = await db.select().from(t.enrolments).where(eq(t.enrolments.batchId, b.id));
    await expect(saveMarks(owner, id, [{ studentId: roster[0].studentId, score: 101 }])).rejects.toThrow(/more than/);
    await saveMarks(owner, id, roster.map((r, i) => ({ studentId: r.studentId, score: 60 + i })));
    const res = await publishTest(owner, id);
    expect(res.sent + res.skipped).toBe(roster.length);
  });
});

describe("enquiries", () => {
  it("books a demo from the poster QR with separate consents, then admits in one tap", async () => {
    const info = await posterInfo(db, DEMO.posterToken, NOW);
    expect(info!.slots.length).toBeGreaterThan(0);
    const slot = info!.slots[0];
    await expect(bookDemo(db, DEMO.posterToken, { guardianName: "A Parent", phone: "9812345678", studentName: "Kid", grade: "Class 10", courseId: slot.courseId, slot, isGuardian: false, consentUpdates: true, consentMarketing: false }, NOW)).rejects.toThrow(/guardian/);
    const r = await bookDemo(db, DEMO.posterToken, { guardianName: "A Parent", phone: "9812345678", studentName: "Kid", grade: "Class 10", courseId: slot.courseId, slot: { batchId: slot.batchId, date: slot.date }, isGuardian: true, consentUpdates: true, consentMarketing: false }, NOW);
    expect(r.stage).toBe("demo_booked");
    expect((await outboxFor("+919812345678")).map((m) => m.template)).toEqual(["demo_booked"]);
    const admitted = await admitEnquiry(staff, r.id, { batchIds: [slot.batchId], discountPaise: 0, firstDue: TODAY });
    const [e] = await db.select().from(t.enquiries).where(eq(t.enquiries.id, r.id));
    expect(e.stage).toBe("admitted");
    expect(e.studentId).toBe(admitted.studentId);
  });

  it("sends admission offers only to marketing opt-ins", async () => {
    await bookDemo(db, DEMO.posterToken, { guardianName: "No Ads", phone: "9812300000", studentName: "Kid", grade: "Class 8", courseId: (await posterInfo(db, DEMO.posterToken, NOW))!.courses[0].id, isGuardian: true, consentUpdates: true, consentMarketing: false }, NOW);
    const r = await sendAdmissionOffer(owner, "10% off the April batch if you join by 31 March.");
    expect(r.sent).toBeGreaterThan(0);
    expect((await outboxFor("+919812300000")).filter((m) => m.template === "admission_offer")).toHaveLength(0);
    const offers = await db.select().from(t.outbox).where(eq(t.outbox.template, "admission_offer"));
    expect(offers.every((m) => m.category === "marketing")).toBe(true);
  });
});

describe("timetable", () => {
  it("rejects a batch that clashes on room or teacher", async () => {
    const [course] = await db.select().from(t.courses).limit(1);
    const [arjun] = await db.select().from(t.users).where(eq(t.users.phone, DEMO.teacher.phone));
    await expect(createBatch(owner, { courseId: course.id, name: "Clash", teacherId: arjun.id, room: "Room 9", days: [3], startMin: 1000, endMin: 1060, capacity: 10 })).rejects.toThrow(/Clashes/);
    const ok = await createBatch(owner, { courseId: course.id, name: "Free slot", teacherId: null, room: "Room 9", days: [0], startMin: 480, endMin: 540, capacity: 10 });
    expect(ok.id).toBeTruthy();
    await expect(createBatch(staff, { courseId: course.id, name: "x", teacherId: null, room: "", days: [0], startMin: 480, endMin: 540, capacity: 10 })).rejects.toThrow(/access/);
  });
});

describe("owner dashboard", () => {
  it("reports attendance, fees and conversion", async () => {
    await selfCheckIn(db, DEMO.entranceToken, "AARAV001", NOW);
    const d = await ownerDashboard(owner);
    expect(d.today).toBe(istDateKey(NOW));
    expect(d.attendance.month).toBeGreaterThan(50);
    expect(d.fees.defaulters).toBeGreaterThan(0);
    expect(d.enquiries.total).toBe(12);
    expect(d.enquiries.conversionPercent).toBe(17);
    expect(d.messages.total).toBeGreaterThan(0);
  });
});
