import { currentSession } from "@/server/context";
import { CardLanding } from "@/components/public/CardLanding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Student card", robots: { index: false } };

/** Target of the QR printed on student ID cards. Staff signed in on the kiosk can mark present; others see a note. */
export default async function CardPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const s = await currentSession();
  return <CardLanding code={code.toUpperCase().slice(0, 20)} isStaff={Boolean(s)} />;
}
