import { istDateKey } from "@/domain";
import { pageCtx } from "@/server/context";
import { listBatches, listTests } from "@/server/store";
import { Tests } from "@/components/app/Tests";

export const metadata = { title: "Tests and marks" };

export default async function TestsPage() {
  const ctx = await pageCtx();
  const [tests, batches] = await Promise.all([listTests(ctx), listBatches(ctx.db, ctx.orgId)]);
  return (
    <Tests
      today={istDateKey(ctx.now)}
      tests={tests.map((t) => ({ id: t.id, name: t.name, batchName: t.batchName, heldOn: t.heldOn, maxMarks: t.maxMarks, published: Boolean(t.publishedAt) }))}
      batches={batches.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
