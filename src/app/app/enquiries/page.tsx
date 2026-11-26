import { funnel, istDateKey } from "@/domain";
import { pageCtx } from "@/server/context";
import { getOrg, listBatches, listCourses, listEnquiries } from "@/server/store";
import { Enquiries } from "@/components/app/Enquiries";

export const metadata = { title: "Enquiries" };

export default async function EnquiriesPage() {
  const ctx = await pageCtx("owner", "staff");
  const [list, batches, courses, org] = await Promise.all([listEnquiries(ctx), listBatches(ctx.db, ctx.orgId), listCourses(ctx.db, ctx.orgId), getOrg(ctx.db, ctx.orgId)]);
  return (
    <Enquiries
      isOwner={ctx.role === "owner"}
      today={istDateKey(ctx.now)}
      posterUrl={`${ctx.baseUrl}/e/${org.posterToken}`}
      funnel={funnel(list.map((e) => e.stage))}
      enquiries={list.map((e) => ({ id: e.id, guardianName: e.guardianName, phone: e.phone, studentName: e.studentName, grade: e.grade, courseName: e.courseName ?? "", stage: e.stage, demoBatch: e.demoBatch ?? "", demoDate: e.demoDate ?? "", source: e.source, note: e.note, createdAt: e.createdAt.getTime(), updates: e.consent.service_updates, marketing: e.consent.marketing, studentId: e.studentId ?? "" }))}
      batches={batches.map((b) => ({ id: b.id, name: b.name, courseName: b.courseName, enrolled: b.enrolled, capacity: b.capacity }))}
      courses={courses.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
