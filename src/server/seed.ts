import { count, sql } from "drizzle-orm";
import {
  absenceAlert,
  addDays,
  feeReceipt,
  feeReminder,
  gstSplit,
  istDateKey,
  istInstant,
  MESSAGE_COST,
  meetsOn,
  NOTICE_VERSION,
  parseDays,
  planInstalments,
  receiptNumber,
  TEMPLATE_CATEGORY,
  type ConsentPurpose,
  type TemplateName,
} from "@/domain";
import type { Db } from "./db/client";
import * as t from "./db/schema";
import { newCardCode, newId, newToken } from "./store/core";

/** Fictional demo institute. Names, phones and numbers are made up. */
export const DEMO = {
  orgId: "org_demo_shikhar",
  name: "Shikhar Demo Academy",
  city: "Indore",
  owner: { name: "Rajesh Verma", phone: "+919826011111" },
  staff: { name: "Priya Joshi", phone: "+919826022222" },
  teacher: { name: "Arjun Mehta", phone: "+919826033333" },
  teacher2: { name: "Kavita Iyer", phone: "+919826044444" },
  entranceToken: "demo-entrance-7Qm2xK9pLs",
  posterToken: "demo-poster-Vb4nT8rWc2",
};

/** Deterministic pseudo-random numbers, so the demo looks the same on every machine. */
function prng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const STUDENTS: [string, string, string, string][] = [
  // student, class, guardian, relation
  ["Aarav Sharma", "Class 10", "Sunil Sharma", "Father"],
  ["Ishita Patel", "Class 10", "Meena Patel", "Mother"],
  ["Vihaan Gupta", "Class 10", "Ramesh Gupta", "Father"],
  ["Ananya Singh", "Class 10", "Pooja Singh", "Mother"],
  ["Kabir Jain", "Class 10", "Alok Jain", "Father"],
  ["Diya Choudhary", "Class 10", "Neha Choudhary", "Mother"],
  ["Arjun Rathore", "Class 10", "Vikram Rathore", "Father"],
  ["Saanvi Agrawal", "Class 10", "Rekha Agrawal", "Mother"],
  ["Reyansh Tiwari", "Class 10", "Manoj Tiwari", "Father"],
  ["Myra Khan", "Class 10", "Farhan Khan", "Father"],
  ["Aditya Yadav", "Class 12", "Santosh Yadav", "Father"],
  ["Kavya Mishra", "Class 12", "Sunita Mishra", "Mother"],
  ["Rohan Dubey", "Class 12", "Anil Dubey", "Father"],
  ["Tanvi Saxena", "Class 12", "Shalini Saxena", "Mother"],
  ["Yash Malviya", "Class 12", "Dinesh Malviya", "Father"],
  ["Nisha Parmar", "Class 12", "Kiran Parmar", "Mother"],
  ["Arnav Soni", "Class 8", "Prakash Soni", "Father"],
  ["Riya Bhatt", "Class 8", "Geeta Bhatt", "Mother"],
  ["Om Pandey", "Class 8", "Rajiv Pandey", "Father"],
  ["Zara Qureshi", "Class 8", "Salma Qureshi", "Mother"],
  ["Ira Nair", "Grade 2 (vocal)", "Lakshmi Nair", "Mother"],
  ["Advik Kulkarni", "Grade 1 (vocal)", "Sameer Kulkarni", "Father"],
  ["Meher Arora", "Grade 1 (vocal)", "Simran Arora", "Mother"],
  ["Laksh Chouhan", "Class 10", "Bharat Chouhan", "Father"],
];

const ENQUIRIES: [string, string, string, string, number, string, string][] = [
  // guardian, student, class, phone, courseIdx, stage, source
  ["Harish Verma", "Pranav Verma", "Class 10", "+919893100001", 0, "new", "poster_qr"],
  ["Anjali Rao", "Siya Rao", "Class 10", "+919893100002", 0, "demo_booked", "poster_qr"],
  ["Mohit Goyal", "Dev Goyal", "Class 12", "+919893100003", 1, "demo_attended", "poster_qr"],
  ["Preeti Sethi", "Aryan Sethi", "Class 12", "+919893100004", 1, "fee_discussed", "walk_in"],
  ["Ravi Shukla", "Krish Shukla", "Class 8", "+919893100005", 2, "admitted", "poster_qr"],
  ["Deepa Menon", "Anika Menon", "Grade 1 (vocal)", "+919893100006", 3, "demo_booked", "poster_qr"],
  ["Sanjay Bansal", "Ved Bansal", "Class 10", "+919893100007", 0, "lost", "call"],
  ["Komal Thakur", "Avni Thakur", "Class 8", "+919893100008", 2, "new", "call"],
  ["Imran Sheikh", "Ayaan Sheikh", "Class 12", "+919893100009", 1, "admitted", "poster_qr"],
  ["Nidhi Kapoor", "Kiara Kapoor", "Class 10", "+919893100010", 0, "demo_attended", "poster_qr"],
  ["Gaurav Mittal", "Shaurya Mittal", "Class 12", "+919893100011", 1, "new", "poster_qr"],
  ["Swati Deshmukh", "Aadhya Deshmukh", "Grade 1 (vocal)", "+919893100012", 3, "lost", "walk_in"],
];

export async function seedIfEmpty(db: Db, now = Date.now()) {
  const [{ n }] = await db.select({ n: count() }).from(t.orgs);
  if (n > 0) return false;
  await seedDemo(db, now);
  return true;
}

export async function resetDemo(db: Db, now = Date.now()) {
  await db.execute(sql`delete from orgs where id = ${DEMO.orgId}`);
  await db.execute(sql`delete from otp_codes`);
  await seedDemo(db, now);
}

export async function seedDemo(db: Db, now = Date.now()) {
  const rand = prng(20261126);
  const today = istDateKey(now);
  const at = (date: string, minute: number) => new Date(Math.min(istInstant(date, minute), now));
  const orgId = DEMO.orgId;

  await db.transaction(async (tx) => {
    await tx.insert(t.orgs).values({
      id: orgId,
      name: DEMO.name,
      city: DEMO.city,
      isDemo: true,
      gstin: "23AAKFS0000D1Z5",
      upiVpa: "shikhar.demo@okdemo",
      upiPayee: DEMO.name,
      receiptPrefix: "SDA",
      entranceToken: DEMO.entranceToken,
      posterToken: DEMO.posterToken,
      graceDays: 5,
      lateFeePaise: 10000,
      createdAt: new Date(now - 90 * 86_400_000),
    });
    const owner = newId("usr");
    const staff = newId("usr");
    const arjun = newId("usr");
    const kavita = newId("usr");
    await tx.insert(t.users).values([
      { id: owner, orgId, role: "owner", ...DEMO.owner },
      { id: staff, orgId, role: "staff", ...DEMO.staff },
      { id: arjun, orgId, role: "teacher", ...DEMO.teacher },
      { id: kavita, orgId, role: "teacher", ...DEMO.teacher2 },
    ]);

    const courseDefs = [
      { name: "Class 10 Science (Boards)", feePaise: 3_600_000, instalments: 3, months: 10 },
      { name: "Class 12 Physics (JEE Foundation)", feePaise: 4_800_000, instalments: 4, months: 12 },
      { name: "Class 8 Maths", feePaise: 2_400_000, instalments: 2, months: 10 },
      { name: "Hindustani Vocal (monthly)", feePaise: 1_800_000, instalments: 12, months: 12 },
    ];
    const courseIds = courseDefs.map(() => newId("crs"));
    await tx.insert(t.courses).values(courseDefs.map((c, i) => ({ id: courseIds[i], orgId, ...c })));

    const batchDefs = [
      { name: "10 Science A (morning)", course: 0, teacherId: arjun, room: "Room 1", days: "1,2,3,4,5,6", startMin: 420, endMin: 510, capacity: 30 },
      { name: "10 Science B (evening)", course: 0, teacherId: arjun, room: "Room 1", days: "1,2,3,4,5,6", startMin: 960, endMin: 1050, capacity: 30 },
      { name: "12 Physics JEE", course: 1, teacherId: arjun, room: "Room 2", days: "1,2,3,4,5,6", startMin: 1050, endMin: 1140, capacity: 25 },
      { name: "8 Maths", course: 2, teacherId: kavita, room: "Room 1", days: "1,3,5,6", startMin: 1080, endMin: 1140, capacity: 25 },
      { name: "Vocal Beginners", course: 3, teacherId: kavita, room: "Music room", days: "0,3,6", startMin: 600, endMin: 660, capacity: 12 },
    ];
    const batchIds = batchDefs.map(() => newId("bat"));
    await tx.insert(t.batches).values(batchDefs.map((b, i) => ({ id: batchIds[i], orgId, courseId: courseIds[b.course], name: b.name, teacherId: b.teacherId, room: b.room, days: b.days, startMin: b.startMin, endMin: b.endMin, capacity: b.capacity })));
    const batchFor = (grade: string, i: number) =>
      grade === "Class 12" ? 2 : grade === "Class 8" ? 3 : grade.includes("vocal") ? 4 : i % 2 === 0 ? 0 : 1;

    const outboxRows: (typeof t.outbox.$inferInsert)[] = [];
    const msg = (template: TemplateName, to: string, body: string, when: Date) =>
      outboxRows.push({ id: newId("msg"), orgId, channel: "whatsapp", category: TEMPLATE_CATEGORY[template], template, toPhone: to, body, costPaise: MESSAGE_COST[TEMPLATE_CATEGORY[template]], status: "simulated", createdAt: when });

    let receiptSeq = 0;
    const roster: { id: string; batch: number; name: string; phone: string; updates: boolean; active: boolean }[] = [];
    for (let i = 0; i < STUDENTS.length; i++) {
      const [name, grade, guardianName, relation] = STUDENTS[i];
      const gid = newId("gdn");
      const phone = `+9198${String(27000000 + i * 1371 + 105).padStart(8, "0")}`;
      await tx.insert(t.guardians).values({ id: gid, orgId, name: guardianName, phone, relation, createdAt: new Date(now - 80 * 86_400_000) });
      const pending = i === 22 || i === 23;
      const sid = newId("stu");
      await tx.insert(t.students).values({ id: sid, orgId, guardianId: gid, name, grade, status: pending ? "pending_consent" : "active", cardToken: i === 0 ? "AARAV001" : newCardCode(), parentToken: i === 0 ? "demo-parent-aarav-Xk29Lq" : newToken(), createdAt: new Date(now - 75 * 86_400_000) });
      const b = batchFor(grade, i);
      await tx.insert(t.enrolments).values({ id: newId("enr"), orgId, studentId: sid, batchId: batchIds[b], startDate: addDays(today, -75) });
      const updates = !pending && i !== 9 && i !== 15;
      const marketing = !pending && i % 3 === 0;
      const consentAt = new Date(now - 74 * 86_400_000);
      if (!pending) {
        const choices: [ConsentPurpose, boolean][] = [["child_data", true], ["service_updates", updates], ["marketing", marketing]];
        await tx.insert(t.consentRecords).values(choices.map(([purpose, granted]) => ({ id: newId("con"), orgId, guardianId: gid, studentId: sid, purpose, granted, noticeVersion: NOTICE_VERSION, channel: "guardian_link" as const, createdAt: consentAt })));
        await tx.insert(t.consentRequests).values({ id: newId("crq"), orgId, guardianId: gid, studentId: sid, token: newToken(), completedAt: consentAt, createdAt: consentAt });
      } else {
        await tx.insert(t.consentRequests).values({ id: newId("crq"), orgId, guardianId: gid, studentId: sid, token: i === 22 ? "demo-consent-Meher-4kPz" : newToken(), createdAt: new Date(now - 86_400_000) });
      }
      roster.push({ id: sid, batch: b, name, phone, updates, active: !pending });

      // Fees: first instalment ~70 days ago for most; a few started recently so reminders are due soon.
      const c = courseDefs[batchDefs[b].course];
      const firstDue = i % 7 === 3 ? addDays(today, 3) : addDays(today, -70 + (i % 5));
      const plan = planInstalments({ total: c.feePaise, discount: i % 6 === 0 ? 200_000 : 0, count: c.instalments, firstDue, everyMonths: 1 });
      // Payment behaviour: defaulters are i in {2, 6, 13, 18}; partial payer 10.
      const defaulter = [2, 6, 13, 18].includes(i);
      for (const p of plan) {
        const isPast = p.dueDate <= today;
        let paid = 0;
        if (isPast && !pending) {
          if (!defaulter || p.seq === 1) paid = p.amount;
          if (i === 10 && p.seq === 2) paid = Math.floor(p.amount / 2);
          if (defaulter && p.seq === 1 && i === 13) paid = 0;
        }
        const insId = newId("ins");
        const reminders = isPast && paid < p.amount ? "D-3,D0,D+3,D+7" : isPast ? "D-3" : "";
        const late = isPast && paid < p.amount && p.dueDate < addDays(today, -5) ? 10000 : 0;
        await tx.insert(t.instalments).values({ id: insId, orgId, studentId: sid, courseId: courseIds[batchDefs[b].course], seq: p.seq, dueDate: p.dueDate, amountPaise: p.amount, paidPaise: paid, lateFeePaise: late, remindersSent: reminders });
        if (paid > 0) {
          receiptSeq++;
          const payDate = addDays(p.dueDate, Math.floor(rand() * 4) - 1);
          const when = at(payDate <= today ? payDate : today, 1080 + Math.floor(rand() * 120));
          const receiptNo = receiptNumber("SDA", istDateKey(when.getTime()), receiptSeq);
          const token = newToken();
          await tx.insert(t.payments).values({ id: newId("pay"), orgId, studentId: sid, amountPaise: paid, gstPaise: gstSplit(paid).gst, mode: rand() < 0.75 ? "upi" : "cash", reference: rand() < 0.75 ? `UTR${Math.floor(rand() * 1e12)}` : null, receiptNo, receiptToken: token, recordedBy: staff, createdAt: when });
          if (updates) msg("fee_receipt", phone, feeReceipt({ student: name, amount: paid, receiptNo, institute: DEMO.name, link: `/receipt/${token}` }), when);
        }
        if (isPast && paid < p.amount && updates) {
          msg("fee_reminder", phone, feeReminder({ student: name, amount: p.amount - paid, due: p.dueDate, institute: DEMO.name, link: "/p/…", overdue: true }), at(addDays(p.dueDate, 3), 600));
        }
      }
    }
    await tx.update(t.orgs).set({ receiptSeq }).where(sql`id = ${orgId}`);

    // Attendance for the last 14 days (not today). Rohan (12) and Om (18) are chronic absentees.
    const attRows: (typeof t.attendance.$inferInsert)[] = [];
    for (let d = 14; d >= 1; d--) {
      const date = addDays(today, -d);
      for (const s of roster) {
        if (!s.active) continue;
        const b = batchDefs[s.batch];
        if (!meetsOn({ days: parseDays(b.days) }, date)) continue;
        const pAbsent = s.name.startsWith("Rohan") || s.name.startsWith("Om") ? 0.4 : 0.08;
        const absent = rand() < pAbsent;
        const when = at(date, b.startMin + (absent ? 15 : Math.floor(rand() * 20) - 10));
        attRows.push({ id: newId("att"), orgId, studentId: s.id, batchId: batchIds[s.batch], date, status: absent ? "absent" : "present", source: absent ? "auto" : rand() < 0.6 ? "qr_self" : "qr_card", alertSent: absent && s.updates, markedAt: when });
        if (absent && s.updates) msg("absence_alert", s.phone, absenceAlert({ student: s.name.split(" ")[0], batch: b.name, startMin: b.startMin, institute: DEMO.name, date }), when);
      }
    }
    for (let i = 0; i < attRows.length; i += 200) await tx.insert(t.attendance).values(attRows.slice(i, i + 200));

    // Tests: two published, one awaiting publish.
    const testDefs = [
      { batch: 0, name: "Unit Test 1: Light", maxMarks: 50, daysAgo: 20, published: true },
      { batch: 0, name: "Unit Test 2: Electricity", maxMarks: 50, daysAgo: 6, published: true },
      { batch: 1, name: "Unit Test 1: Light", maxMarks: 50, daysAgo: 19, published: true },
      { batch: 2, name: "Weekly Test: Kinematics", maxMarks: 100, daysAgo: 4, published: false },
    ];
    for (const td of testDefs) {
      const tid = newId("tst");
      const heldOn = addDays(today, -td.daysAgo);
      await tx.insert(t.tests).values({ id: tid, orgId, batchId: batchIds[td.batch], name: td.name, maxMarks: td.maxMarks, heldOn, publishedAt: td.published ? at(addDays(heldOn, 2), 1200) : null, createdAt: at(heldOn, 1200) });
      const members = roster.filter((s) => s.batch === td.batch && s.active);
      await tx.insert(t.marks).values(members.map((s) => ({ id: newId("mrk"), orgId, testId: tid, studentId: s.id, scoreX2: Math.round((td.maxMarks * (0.45 + rand() * 0.53)) * 2) })));
    }

    // Enquiries from posters, walk-ins and calls.
    for (let i = 0; i < ENQUIRIES.length; i++) {
      const [guardianName, studentName, grade, phone, ci, stage, source] = ENQUIRIES[i];
      const id = newId("enq");
      const created = new Date(now - (25 - i * 2) * 86_400_000);
      const demoBatch = batchIds[batchDefs.findIndex((b) => b.course === ci)];
      const hasDemo = stage !== "new" && stage !== "lost";
      await tx.insert(t.enquiries).values({ id, orgId, guardianName, phone, studentName, grade, courseId: courseIds[ci], stage: stage as "new", source: source as "poster_qr", demoBatchId: hasDemo ? demoBatch : null, demoDate: stage === "demo_booked" ? addDays(today, 1 + (i % 3)) : hasDemo ? addDays(istDateKey(created.getTime()), 2) : null, createdAt: created, updatedAt: created });
      await tx.insert(t.consentRecords).values([
        { id: newId("con"), orgId, enquiryId: id, purpose: "service_updates", granted: true, noticeVersion: NOTICE_VERSION, channel: source === "poster_qr" ? "poster_form" : "staff_desk", createdAt: created },
        { id: newId("con"), orgId, enquiryId: id, purpose: "marketing", granted: i % 2 === 0, noticeVersion: NOTICE_VERSION, channel: source === "poster_qr" ? "poster_form" : "staff_desk", createdAt: created },
      ]);
    }

    for (let i = 0; i < outboxRows.length; i += 200) await tx.insert(t.outbox).values(outboxRows.slice(i, i + 200));
  });
}
