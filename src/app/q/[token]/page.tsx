import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { entranceInfo } from "@/server/store";
import { CheckIn } from "@/components/public/CheckIn";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check in", robots: { index: false } };

export default async function EntrancePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const org = await entranceInfo(await getDb(), token);
  if (!org) notFound();
  return <CheckIn token={token} org={org.name} isDemo={org.isDemo} />;
}
