import { pageCtx } from "@/server/context";
import { qrDataUrl } from "@/server/qr";
import { getOrg, listStudents } from "@/server/store";
import { QrSheet } from "@/components/app/QrSheet";

export const metadata = { title: "QR sheet" };

export default async function QrPage() {
  const ctx = await pageCtx("owner");
  const org = await getOrg(ctx.db, ctx.orgId);
  const students = (await listStudents(ctx)).filter((s) => s.status === "active");
  const entranceUrl = `${ctx.baseUrl}/q/${org.entranceToken}`;
  const posterUrl = `${ctx.baseUrl}/e/${org.posterToken}`;
  return (
    <QrSheet
      org={org.name}
      entrance={{ url: entranceUrl, qr: await qrDataUrl(entranceUrl) }}
      poster={{ url: posterUrl, qr: await qrDataUrl(posterUrl) }}
      cards={await Promise.all(students.map(async (s) => ({ id: s.id, name: s.name, grade: s.grade, code: s.cardToken, batches: s.batches.join(", "), qr: await qrDataUrl(`${ctx.baseUrl}/c/${s.cardToken}`) })))}
    />
  );
}
