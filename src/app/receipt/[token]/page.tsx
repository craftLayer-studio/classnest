import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { getReceipt } from "@/server/store";
import { Receipt } from "@/components/public/Receipt";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fee receipt", robots: { index: false } };

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await getReceipt(await getDb(), token);
  if (!r) notFound();
  return (
    <Receipt
      org={{ name: r.org.name, city: r.org.city, gstin: r.org.gstin, isDemo: r.org.isDemo }}
      receipt={{ no: r.p.receiptNo, at: r.p.createdAt.getTime(), amount: r.p.amountPaise, mode: r.p.mode, reference: r.p.reference }}
      student={r.student}
      grade={r.grade}
      guardian={r.guardian}
      split={r.split}
    />
  );
}
