import { istDateKey } from "@/domain";
import { pageCtx } from "@/server/context";
import { listBatches, listStudents } from "@/server/store";
import { Students } from "@/components/app/Students";

export const metadata = { title: "Students" };

export default async function StudentsPage() {
  const ctx = await pageCtx("owner", "staff");
  const [students, batches] = await Promise.all([listStudents(ctx), listBatches(ctx.db, ctx.orgId)]);
  return (
    <Students
      students={students.map((s) => ({ id: s.id, name: s.name, grade: s.grade, status: s.status, guardianName: s.guardianName, guardianPhone: s.guardianPhone, batches: s.batches, updates: s.consent.service_updates, marketing: s.consent.marketing, cardToken: s.cardToken }))}
      batches={batches.map((b) => ({ id: b.id, name: b.name, courseName: b.courseName, enrolled: b.enrolled, capacity: b.capacity }))}
      today={istDateKey(ctx.now)}
    />
  );
}
