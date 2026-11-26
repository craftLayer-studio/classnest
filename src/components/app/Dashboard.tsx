'use client';

import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Grid} from '@astryxdesign/core/Grid';
import {Text} from '@astryxdesign/core/Text';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {formatDate, formatINR, STAGE_LABEL, ENQUIRY_STAGES} from '@/domain';
import type {ownerDashboard} from '@/server/store/dashboard';
import {ActionButton, PageHeader, SectionCard, StatTile} from '../ui';

type Data = Awaited<ReturnType<typeof ownerDashboard>>;

const TEMPLATE_LABEL: Record<string, string> = {
  absence_alert: 'Absence alerts',
  arrival_alert: 'Arrival alerts (add-on)',
  fee_reminder: 'Fee reminders',
  fee_receipt: 'Receipts',
  consent_request: 'Consent requests',
  demo_booked: 'Demo confirmations',
  report_card: 'Report cards',
  admission_offer: 'Admission offers (marketing)',
};

const pct = (v: number | null) => (v === null ? '–' : `${v}%`);

export function Dashboard({data}: {data: Data}) {
  const {attendance: a, fees: f, enquiries: e, messages: m} = data;
  const funnelRows = ENQUIRY_STAGES.map(s => ({id: s, stage: STAGE_LABEL[s], count: e.byStage[s]}));
  const funnelCols: TableColumn<(typeof funnelRows)[number]>[] = [
    {key: 'stage', header: 'Stage', width: proportional(2)},
    {key: 'count', header: 'Enquiries', width: proportional(1), align: 'end'},
  ];
  const msgRows = m.byTemplate.map(([t, n]) => ({id: t, label: TEMPLATE_LABEL[t] ?? t, n}));
  const msgCols: TableColumn<(typeof msgRows)[number]>[] = [
    {key: 'label', header: 'Message', width: proportional(3)},
    {key: 'n', header: 'Sent', width: proportional(1), align: 'end'},
  ];
  const chronicCols: TableColumn<(typeof a.chronic)[number]>[] = [
    {key: 'name', header: 'Student', width: proportional(3)},
    {key: 'absences', header: 'Absences (14 days)', width: proportional(2), align: 'end'},
  ];

  return (
    <VStack gap={6}>
      <PageHeader
        title="Owner dashboard"
        description={`${formatDate(data.today)} · ${data.students.active} active students${data.students.pendingConsent ? `, ${data.students.pendingConsent} waiting for guardian consent` : ''}`}
        actions={
          <>
            <ActionButton label="Run absence + reminder jobs" action="run-jobs" done={() => 'Jobs ran. Check the outbox.'} />
            <Button label="Print QR sheet" href="/app/qr" variant="secondary" />
          </>
        }
      />

      <Grid columns={{minWidth: 200, max: 4, repeat: 'fit'}} gap={4}>
        <StatTile label="Attendance today" value={pct(a.today)} sub={`${a.todayMarked} marks so far · 7 days ${pct(a.week)}`} />
        <StatTile label="Collected this month" value={formatINR(f.collectedThisMonth)} sub={`Due this month ${formatINR(f.dueThisMonth)}`} />
        <StatTile label="Overdue now" value={formatINR(f.overdueNow)} sub={`${f.defaulters} defaulters past grace`} />
        <StatTile label="Enquiry conversion" value={pct(e.conversionPercent)} sub={`${e.admitted} admitted of ${e.total} · poster QR ${pct(e.poster.conversionPercent)}`} />
      </Grid>

      <Grid columns={{minWidth: 320, max: 2, repeat: 'fit'}} gap={4}>
        <SectionCard title="Fees: collected vs due this month" actions={<Button label="Open defaulters" href="/app/fees" variant="ghost" />}>
          <VStack gap={2}>
            <ProgressBar value={f.collectedOfDue} max={Math.max(1, f.dueThisMonth)} label="Collected of this month's dues" />
            <Text type="supporting" color="secondary">
              {formatINR(f.collectedOfDue)} of {formatINR(f.dueThisMonth)} due this month collected. {f.defaulters} defaulters owe {formatINR(f.defaulterAmount)}.
            </Text>
          </VStack>
        </SectionCard>
        <SectionCard title="Follow-up results (30 days)">
          <VStack gap={2}>
            <Text type="body">
              {m.remindersSent} fee reminders went to {m.remindedFamilies} families. {m.paidAfterReminder} of them paid afterwards ({formatINR(m.paidAfterReminderAmount)}).
            </Text>
            <Text type="supporting" color="secondary">
              {m.total} WhatsApp messages, estimated cost {formatINR(m.costPaise)} (simulated). Absence-only alerts keep this low.
            </Text>
          </VStack>
        </SectionCard>
      </Grid>

      <Grid columns={{minWidth: 320, max: 3, repeat: 'fit'}} gap={4}>
        <SectionCard title="Enquiry pipeline" actions={<Button label="Open" href="/app/enquiries" variant="ghost" />}>
          <Table data={funnelRows} columns={funnelCols} idKey="id" density="compact" />
        </SectionCard>
        <SectionCard title="Messages by type">
          <Table data={msgRows} columns={msgCols} idKey="id" density="compact" />
        </SectionCard>
        <SectionCard title="Chronic absentees">
          {a.chronic.length ? (
            <Table data={a.chronic} columns={chronicCols} idKey="studentId" density="compact" />
          ) : (
            <Text color="secondary">No student missed 3 or more classes in 14 days.</Text>
          )}
        </SectionCard>
      </Grid>

      <HStack>
        <Banner status="info" title="Demo institute" description="All names, phones and amounts are fictional. WhatsApp messages and UPI payments are simulated; nothing leaves this app." />
      </HStack>
    </VStack>
  );
}
