import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Every business table carries org_id and every query filters by it (multi-tenant).
 * Money columns are integer paise. Timestamps are UTC timestamptz; calendar dates are IST "YYYY-MM-DD" text.
 */
const id = () => text("id").primaryKey();
const orgId = () => text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

export const orgs = pgTable("orgs", {
  id: id(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  gstin: text("gstin"),
  upiVpa: text("upi_vpa").notNull(),
  upiPayee: text("upi_payee").notNull(),
  receiptPrefix: text("receipt_prefix").notNull(),
  receiptSeq: integer("receipt_seq").notNull().default(0),
  entranceToken: text("entrance_token").notNull().unique(),
  posterToken: text("poster_token").notNull().unique(),
  alertMode: text("alert_mode", { enum: ["absence_only", "all"] }).notNull().default("absence_only"),
  graceDays: integer("grace_days").notNull().default(5),
  lateFeePaise: integer("late_fee_paise").notNull().default(0),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    orgId: orgId(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    role: text("role", { enum: ["owner", "staff", "teacher"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_phone_uq").on(t.phone)],
);

export const otpCodes = pgTable("otp_codes", {
  id: id(),
  phone: text("phone").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
  createdAt: createdAt(),
});

export const courses = pgTable("courses", {
  id: id(),
  orgId: orgId(),
  name: text("name").notNull(),
  feePaise: integer("fee_paise").notNull(),
  instalments: integer("instalments").notNull().default(1),
  months: integer("months").notNull().default(12),
  createdAt: createdAt(),
});

export const batches = pgTable(
  "batches",
  {
    id: id(),
    orgId: orgId(),
    courseId: text("course_id").notNull().references(() => courses.id),
    name: text("name").notNull(),
    teacherId: text("teacher_id").references(() => users.id),
    room: text("room").notNull().default(""),
    days: text("days").notNull(), // "1,3,5"
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    capacity: integer("capacity").notNull().default(30),
    createdAt: createdAt(),
  },
  (t) => [index("batches_org_idx").on(t.orgId)],
);

/** Parent or guardian: the WhatsApp contact and consenting party for a minor. Keyed by phone per org. */
export const guardians = pgTable(
  "guardians",
  {
    id: id(),
    orgId: orgId(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    relation: text("relation").notNull().default("Parent"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("guardians_org_phone_uq").on(t.orgId, t.phone)],
);

/** Minimal student record. No date of birth, photo, address or student phone: students are treated as minors. */
export const students = pgTable(
  "students",
  {
    id: id(),
    orgId: orgId(),
    guardianId: text("guardian_id").notNull().references(() => guardians.id),
    name: text("name").notNull(),
    grade: text("grade").notNull(),
    isMinor: boolean("is_minor").notNull().default(true),
    status: text("status", { enum: ["pending_consent", "active", "left"] }).notNull().default("pending_consent"),
    /** Code printed on the ID card QR; used by kiosk scans and self check-in. */
    cardToken: text("card_token").notNull().unique(),
    /** Link sent to the guardian for the report card and fee page. */
    parentToken: text("parent_token").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index("students_org_idx").on(t.orgId)],
);

export const enrolments = pgTable(
  "enrolments",
  {
    id: id(),
    orgId: orgId(),
    studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    batchId: text("batch_id").notNull().references(() => batches.id),
    startDate: text("start_date").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("enrolments_student_batch_uq").on(t.studentId, t.batchId)],
);

/** Append-only consent ledger. Current state per purpose is the latest row. */
export const consentRecords = pgTable(
  "consent_records",
  {
    id: id(),
    orgId: orgId(),
    guardianId: text("guardian_id").references(() => guardians.id),
    enquiryId: text("enquiry_id"),
    studentId: text("student_id"),
    purpose: text("purpose", { enum: ["child_data", "service_updates", "marketing"] }).notNull(),
    granted: boolean("granted").notNull(),
    noticeVersion: text("notice_version").notNull(),
    channel: text("channel", { enum: ["guardian_link", "poster_form", "staff_desk"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("consent_guardian_idx").on(t.orgId, t.guardianId)],
);

/** One-time consent links sent to a guardian's WhatsApp (possession of the phone is the verification). */
export const consentRequests = pgTable("consent_requests", {
  id: id(),
  orgId: orgId(),
  guardianId: text("guardian_id").notNull().references(() => guardians.id),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  createdAt: createdAt(),
});

export const attendance = pgTable(
  "attendance",
  {
    id: id(),
    orgId: orgId(),
    studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    batchId: text("batch_id").notNull().references(() => batches.id),
    date: text("date").notNull(),
    status: text("status", { enum: ["present", "absent"] }).notNull(),
    source: text("source", { enum: ["qr_self", "qr_card", "staff", "auto"] }).notNull(),
    alertSent: boolean("alert_sent").notNull().default(false),
    markedAt: timestamp("marked_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("attendance_uq").on(t.orgId, t.studentId, t.batchId, t.date), index("attendance_org_date_idx").on(t.orgId, t.date)],
);

export const instalments = pgTable(
  "instalments",
  {
    id: id(),
    orgId: orgId(),
    studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull().references(() => courses.id),
    seq: integer("seq").notNull(),
    dueDate: text("due_date").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    paidPaise: integer("paid_paise").notNull().default(0),
    lateFeePaise: integer("late_fee_paise").notNull().default(0),
    remindersSent: text("reminders_sent").notNull().default(""), // "D-3,D0"
    createdAt: createdAt(),
  },
  (t) => [index("instalments_org_student_idx").on(t.orgId, t.studentId)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orgId: orgId(),
    studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    amountPaise: integer("amount_paise").notNull(),
    gstPaise: integer("gst_paise").notNull(),
    mode: text("mode", { enum: ["upi", "cash", "card"] }).notNull(),
    reference: text("reference"),
    receiptNo: text("receipt_no").notNull(),
    receiptToken: text("receipt_token").notNull().unique(),
    recordedBy: text("recorded_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("payments_receipt_uq").on(t.orgId, t.receiptNo)],
);

export const tests = pgTable("tests", {
  id: id(),
  orgId: orgId(),
  batchId: text("batch_id").notNull().references(() => batches.id),
  name: text("name").notNull(),
  maxMarks: integer("max_marks").notNull(),
  heldOn: text("held_on").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
  createdAt: createdAt(),
});

export const marks = pgTable(
  "marks",
  {
    id: id(),
    orgId: orgId(),
    testId: text("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
    studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    /** Stored in half-marks x2 so it stays an integer (37.5 -> 75). */
    scoreX2: integer("score_x2").notNull(),
  },
  (t) => [uniqueIndex("marks_test_student_uq").on(t.testId, t.studentId)],
);

export const enquiries = pgTable(
  "enquiries",
  {
    id: id(),
    orgId: orgId(),
    guardianName: text("guardian_name").notNull(),
    phone: text("phone").notNull(),
    studentName: text("student_name").notNull(),
    grade: text("grade").notNull(),
    courseId: text("course_id").references(() => courses.id),
    stage: text("stage", { enum: ["new", "demo_booked", "demo_attended", "fee_discussed", "admitted", "lost"] }).notNull().default("new"),
    demoBatchId: text("demo_batch_id").references(() => batches.id),
    demoDate: text("demo_date"),
    source: text("source", { enum: ["poster_qr", "walk_in", "call"] }).notNull(),
    note: text("note").notNull().default(""),
    studentId: text("student_id"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("enquiries_org_idx").on(t.orgId)],
);

/** Simulated WhatsApp outbox. The simulated adapter writes here; a real BSP adapter would send. */
export const outbox = pgTable(
  "outbox",
  {
    id: id(),
    orgId: orgId(),
    channel: text("channel", { enum: ["whatsapp", "sms"] }).notNull(),
    category: text("category", { enum: ["utility", "marketing"] }).notNull(),
    template: text("template").notNull(),
    toPhone: text("to_phone").notNull(),
    body: text("body").notNull(),
    costPaise: integer("cost_paise").notNull(),
    status: text("status", { enum: ["simulated", "sent", "failed"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("outbox_org_idx").on(t.orgId, t.createdAt)],
);

