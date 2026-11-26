import { findClashes } from "@/domain";
import { pageCtx } from "@/server/context";
import { listBatches, listCourses, listStaff, toSlot } from "@/server/store";
import { Batches } from "@/components/app/Batches";

export const metadata = { title: "Batches and timetable" };

export default async function BatchesPage() {
  const ctx = await pageCtx();
  const [batches, courses, staff] = await Promise.all([listBatches(ctx.db, ctx.orgId), listCourses(ctx.db, ctx.orgId), listStaff(ctx)]);
  const clashes = findClashes(batches.map(toSlot));
  return (
    <Batches
      canEdit={ctx.role === "owner"}
      batches={batches.map((b) => ({ id: b.id, name: b.name, courseName: b.courseName, teacherName: b.teacherName ?? "", room: b.room, days: b.daysList, startMin: b.startMin, endMin: b.endMin, enrolled: b.enrolled, capacity: b.capacity }))}
      courses={courses.map((c) => ({ id: c.id, name: c.name, feePaise: c.feePaise, instalments: c.instalments, months: c.months }))}
      teachers={staff.filter((s) => s.role !== "staff").map((s) => ({ id: s.id, name: s.name }))}
      clashCount={clashes.length}
    />
  );
}
