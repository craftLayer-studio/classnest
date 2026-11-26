import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { requestNow } from "@/server/context";
import { qrDataUrl } from "@/server/qr";
import { parentPage } from "@/server/store";
import { ParentPage } from "@/components/public/ParentPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Report card and fees", robots: { index: false } };

export default async function Parent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await parentPage(await getDb(), token, requestNow());
  if (!data) notFound();
  const upiQr = data.fees.upiLink ? await qrDataUrl(data.fees.upiLink) : null;
  return <ParentPage token={token} data={data} upiQr={upiQr} />;
}
