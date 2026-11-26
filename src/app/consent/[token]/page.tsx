import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { getConsentRequest } from "@/server/store";
import { ConsentForm } from "@/components/public/ConsentForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parent consent", robots: { index: false } };

export default async function ConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const req = await getConsentRequest(await getDb(), token);
  if (!req) notFound();
  return <ConsentForm token={token} org={req.org} city={req.orgCity} isDemo={req.isDemo} student={req.student} grade={req.grade} guardian={req.guardian} completed={Boolean(req.req.completedAt)} />;
}
