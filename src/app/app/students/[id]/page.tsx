import { instalmentStatus, istDateKey, outstanding } from "@/domain";
import { pageCtx } from "@/server/context";
import { qrDataUrl } from "@/server/qr";
import { consentHistory, getOrg, studentDetail } from "@/server/store";
import { toInstalment } from "@/server/store/fees";
import { StudentDetail } from "@/components/app/StudentDetail";

export const metadata = { title: "Student" };

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pageCtx("owner", "staff");
  const d = await studentDetail(ctx, id);
  const org = await getOrg(ctx.db, ctx.orgId);
  const history = await consentHistory(ctx.db, ctx.orgId, d.guardian.id);
  const today = istDateKey(ctx.now);
  return (
    <StudentDetail
      role={ctx.role}
      student={{ id: d.student.id, name: d.student.name, grade: d.student.grade, status: d.student.status, isMinor: d.student.isMinor, cardToken: d.student.cardToken }}
      guardian={{ name: d.guardian.name, phone: d.guardian.phone, relation: d.guardian.relation }}
      batches={d.batches.map((b) => b.name)}
      consent={d.consent}
      history={history.map((h) => ({ id: h.id, purpose: h.purpose, granted: h.granted, channel: h.channel, notice: h.noticeVersion, at: h.createdAt.getTime() }))}
      instalments={d.instalments.map((r) => {
        const i = toInstalment(r);
        return { id: i.id, seq: i.seq, dueDate: i.dueDate, amount: i.amount, paid: i.paid, lateFee: i.lateFee, outstanding: outstanding(i), status: instalmentStatus(i, today, org.graceDays), reminders: i.remindersSent.join(", ") };
      })}
      payments={d.payments.map((p) => ({ id: p.id, receiptNo: p.receiptNo, receiptToken: p.receiptToken, amount: p.amountPaise, mode: p.mode, reference: p.reference, at: p.createdAt.getTime() }))}
      attendance={d.attendance.map((a) => ({ id: a.id, date: a.date, status: a.status, source: a.source }))}
      parentUrl={`${ctx.baseUrl}/p/${d.student.parentToken}`}
      cardQr={await qrDataUrl(`${ctx.baseUrl}/c/${d.student.cardToken}`)}
    />
  );
}
