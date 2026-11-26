import { pageCtx } from "@/server/context";
import { testDetail } from "@/server/store";
import { TestMarks } from "@/components/app/TestMarks";

export const metadata = { title: "Marks" };

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pageCtx();
  const d = await testDetail(ctx, id);
  return (
    <TestMarks
      canPublish={ctx.role !== "staff"}
      test={{ id: d.test.id, name: d.test.name, maxMarks: d.test.maxMarks, heldOn: d.test.heldOn, published: Boolean(d.test.publishedAt) }}
      batchName={d.batchName}
      average={d.average}
      rows={d.rows.map((r) => ({ ...r, id: r.studentId }))}
    />
  );
}
