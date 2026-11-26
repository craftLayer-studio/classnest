import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { requestNow } from "@/server/context";
import { posterInfo } from "@/server/store";
import { DemoBooking } from "@/components/public/DemoBooking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book a free demo class" };

export default async function PosterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await posterInfo(await getDb(), token, requestNow());
  if (!info) notFound();
  return <DemoBooking token={token} org={info.org} courses={info.courses} slots={info.slots.map((s, i) => ({ ...s, id: String(i) }))} />;
}
