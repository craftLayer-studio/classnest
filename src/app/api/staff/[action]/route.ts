import { ENQUIRY_STAGES, parseClock, parseDays } from "@/domain";
import { apiCtx } from "@/server/context";
import { BadRequest, bool, handle, int, num, oneOf, optStr, paise, readBody, str, strList } from "@/server/http";
import { resetDemo } from "@/server/seed";
import * as store from "@/server/store";


const clock = (body: Record<string, unknown>, key: string) => {
  const m = parseClock(str(body, key, 5));
  if (m === null) throw new BadRequest(`${key} must be a time like 17:30`);
  return m;
};

/**
 * Staff and owner actions. Each case only parses input and calls the store; the store enforces roles,
 * tenancy (org from the signed session, never from the request) and business rules.
 */
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  return handle(async () => {
    const ctx = await apiCtx();
    const b = await readBody(request);
    switch (action) {
      // Attendance
      case "mark":
        return store.staffMark(ctx, { batchId: str(b, "batchId"), studentId: str(b, "studentId"), status: oneOf(b, "status", ["present", "absent"] as const) });
      case "scan":
        return store.cardScan(ctx, str(b, "code", 20), optStr(b, "batchId", 100));
      case "sweep":
        store.requireRole(ctx, "owner", "staff", "teacher");
        return store.absenceSweep(ctx.db, ctx.orgId, ctx.now);

      // Students and consent
      case "admit":
        return store.admitStudent(ctx, {
          name: str(b, "name", 80),
          grade: str(b, "grade", 40),
          isMinor: b.isMinor === undefined ? true : bool(b, "isMinor"),
          guardianName: str(b, "guardianName", 80),
          guardianPhone: str(b, "guardianPhone", 20),
          relation: optStr(b, "relation", 30) ?? "Parent",
          batchIds: strList(b, "batchIds", 5),
          discountPaise: b.discount === undefined ? 0 : paise(b, "discount"),
          firstDue: str(b, "firstDue", 10),
        });
      case "resend-consent":
        return store.resendConsent(ctx, str(b, "studentId"));
      case "delete-student":
        return store.deleteStudent(ctx, str(b, "studentId"));

      // Fees
      case "payment":
        return store.recordPayment(ctx, { studentId: str(b, "studentId"), amountPaise: paise(b, "amount"), mode: oneOf(b, "mode", ["upi", "cash", "card"] as const), reference: optStr(b, "reference", 40) });
      case "remind":
        return store.sendFeeReminder(ctx, str(b, "studentId"));
      case "remind-all":
        return store.sendAllDefaulterReminders(ctx);
      case "run-reminders":
        store.requireRole(ctx, "owner", "staff");
        return store.reminderSweep(ctx.db, ctx.orgId, ctx.now, ctx.baseUrl);

      // Courses and timetable
      case "course":
        return store.createCourse(ctx, { name: str(b, "name", 80), feePaise: paise(b, "fee"), instalments: int(b, "instalments"), months: int(b, "months") });
      case "batch":
        return store.createBatch(ctx, {
          courseId: str(b, "courseId"),
          name: str(b, "name", 80),
          teacherId: optStr(b, "teacherId", 100) ?? null,
          room: optStr(b, "room", 40) ?? "",
          days: parseDays(strList(b, "days", 7).join(",")),
          startMin: clock(b, "start"),
          endMin: clock(b, "end"),
          capacity: int(b, "capacity"),
        });

      // Tests and marks
      case "test":
        return store.createTest(ctx, { batchId: str(b, "batchId"), name: str(b, "name", 80), maxMarks: int(b, "maxMarks"), heldOn: str(b, "heldOn", 10) });
      case "marks": {
        const entries = b.entries;
        if (!Array.isArray(entries) || entries.length > 500) throw new BadRequest("entries must be a list");
        return store.saveMarks(
          ctx,
          str(b, "testId"),
          entries.map((e) => {
            const r = e as Record<string, unknown>;
            return { studentId: str(r, "studentId"), score: r.score === null || r.score === undefined ? null : num(r, "score") };
          }),
        );
      }
      case "publish":
        return store.publishTest(ctx, str(b, "testId"));

      // Enquiries
      case "walk-in":
        return store.addWalkIn(ctx, {
          guardianName: str(b, "guardianName", 80),
          phone: str(b, "phone", 20),
          studentName: str(b, "studentName", 80),
          grade: optStr(b, "grade", 40) ?? "",
          courseId: optStr(b, "courseId", 100) ?? null,
          source: oneOf(b, "source", ["walk_in", "call"] as const),
          note: optStr(b, "note", 500) ?? "",
          consentUpdates: bool(b, "consentUpdates"),
          consentMarketing: bool(b, "consentMarketing"),
        });
      case "stage":
        return store.moveEnquiry(ctx, str(b, "enquiryId"), oneOf(b, "stage", ENQUIRY_STAGES));
      case "admit-enquiry":
        return store.admitEnquiry(ctx, str(b, "enquiryId"), { batchIds: strList(b, "batchIds", 5), discountPaise: b.discount === undefined ? 0 : paise(b, "discount"), firstDue: str(b, "firstDue", 10) });
      case "offer":
        return store.sendAdmissionOffer(ctx, str(b, "text", 300));

      // Settings and demo
      case "settings":
        return store.updateSettings(ctx, {
          name: optStr(b, "name", 80),
          upiVpa: optStr(b, "upiVpa", 100),
          upiPayee: optStr(b, "upiPayee", 80),
          gstin: b.gstin === "" ? null : optStr(b, "gstin", 15)?.toUpperCase(),
          alertMode: b.alertMode === undefined ? undefined : oneOf(b, "alertMode", ["absence_only", "all"] as const),
          graceDays: b.graceDays === undefined ? undefined : int(b, "graceDays"),
          lateFeePaise: b.lateFee === undefined ? undefined : paise(b, "lateFee"),
        });
      case "run-jobs":
        store.requireRole(ctx, "owner");
        return store.runJobs(ctx.db, ctx.now, ctx.baseUrl);
      case "reset-demo": {
        store.requireRole(ctx, "owner");
        const org = await store.getOrg(ctx.db, ctx.orgId);
        if (!org.isDemo) throw new BadRequest("Only the demo institute can be reset", 403);
        await resetDemo(ctx.db);
        return { ok: true };
      }
      default:
        throw new BadRequest("Unknown action", 404);
    }
  });
}
