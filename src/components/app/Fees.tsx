'use client';

import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Grid} from '@astryxdesign/core/Grid';
import {Text} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {formatDate, formatINR, formatInstant, formatPhone} from '@/domain';
import {ActionButton, PageHeader, SectionCard, StatTile} from '../ui';

type Def = {id: string; name: string; grade: string; guardianName: string; phone: string; overdue: number; oldestDue: string; daysLate: number; canMessage: boolean; lastReminder: string};
type Up = {id: string; studentId: string; name: string; dueDate: string; outstanding: number; status: string};
type Rec = {id: string; name: string; studentId: string; amount: number; mode: string; receiptNo: string; receiptToken: string; at: number};

export function Fees({graceDays, defaulters, upcoming, recent}: {graceDays: number; defaulters: Def[]; upcoming: Up[]; recent: Rec[]}) {
  const total = defaulters.reduce((s, d) => s + d.overdue, 0);
  const defCols: TableColumn<Def>[] = [
    {key: 'name', header: 'Student', width: proportional(3), renderCell: r => <VStack gap={0.5}><Link href={`/app/students/${r.id}`}>{r.name}</Link><Text type="supporting" color="secondary">{r.grade}</Text></VStack>},
    {key: 'guardian', header: 'Guardian', width: proportional(3), renderCell: r => <VStack gap={0.5}><Text>{r.guardianName}</Text><Link href={`tel:${r.phone}`}>{formatPhone(r.phone)}</Link></VStack>},
    {key: 'overdue', header: 'Overdue', width: proportional(2), align: 'end', renderCell: r => <Text weight="semibold">{formatINR(r.overdue)}</Text>},
    {key: 'late', header: 'Late since', width: proportional(2), renderCell: r => <VStack gap={0.5}><Text>{formatDate(r.oldestDue)}</Text><Text type="supporting" color="secondary">{r.daysLate} days</Text></VStack>},
    {key: 'last', header: 'Last auto reminder', width: proportional(2), renderCell: r => <Text type="supporting">{r.lastReminder || '–'}</Text>},
    {
      key: 'act',
      header: 'Follow up',
      width: proportional(3),
      renderCell: r =>
        r.canMessage ? (
          <ActionButton label="Send reminder" size="sm" action="remind" body={{studentId: r.id}} done={() => `Reminder with UPI link sent to ${r.guardianName}`} />
        ) : (
          <HStack gap={1} vAlign="center"><Badge label="No WhatsApp consent" variant="neutral" /><Button label="Call" size="sm" href={`tel:${r.phone}`} variant="ghost" /></HStack>
        ),
    },
  ];
  const upCols: TableColumn<Up>[] = [
    {key: 'name', header: 'Student', width: proportional(3), renderCell: r => <Link href={`/app/students/${r.studentId}`}>{r.name}</Link>},
    {key: 'dueDate', header: 'Due', width: proportional(2), renderCell: r => formatDate(r.dueDate)},
    {key: 'outstanding', header: 'Amount', width: proportional(2), align: 'end', renderCell: r => formatINR(r.outstanding)},
  ];
  const recCols: TableColumn<Rec>[] = [
    {key: 'receiptNo', header: 'Receipt', width: proportional(3), renderCell: r => <Link href={`/receipt/${r.receiptToken}`} target="_blank">{r.receiptNo}</Link>},
    {key: 'name', header: 'Student', width: proportional(3)},
    {key: 'at', header: 'When', width: proportional(2), renderCell: r => formatInstant(r.at)},
    {key: 'amount', header: 'Amount', width: proportional(2), align: 'end', renderCell: r => `${formatINR(r.amount)} ${r.mode.toUpperCase()}`},
  ];
  return (
    <VStack gap={6}>
      <PageHeader
        title="Fees and defaulters"
        description={`Defaulters are students with an instalment more than ${graceDays} days overdue. Reminders go automatically at D-3, D0, D+3 and D+7.`}
        actions={
          <>
            <ActionButton label="Remind all defaulters" variant="primary" action="remind-all" done={r => `${r.sent} reminders sent, ${r.skipped} need a call (no WhatsApp consent)`} />
            <ActionButton label="Run scheduled reminders now" action="run-reminders" done={r => `${r.sent} scheduled reminders sent, ${r.lateFees} late fees applied`} />
          </>
        }
      />
      <Grid columns={{minWidth: 200, max: 3, repeat: 'fit'}} gap={4}>
        <StatTile label="Defaulters" value={String(defaulters.length)} />
        <StatTile label="Overdue amount" value={formatINR(total)} />
        <StatTile label="Due in next 14 days" value={formatINR(upcoming.reduce((s, u) => s + u.outstanding, 0))} sub={`${upcoming.length} instalments`} />
      </Grid>
      <SectionCard title="Defaulter list">
        <Table data={defaulters} columns={defCols} idKey="id" density="compact" emptyState={<Text color="secondary">No defaulters. Every fee is within the grace period.</Text>} />
      </SectionCard>
      <Grid columns={{minWidth: 340, max: 2, repeat: 'fit'}} gap={4}>
        <SectionCard title="Upcoming dues (14 days)">
          <Table data={upcoming} columns={upCols} idKey="id" density="compact" emptyState={<Text color="secondary">Nothing due soon.</Text>} />
        </SectionCard>
        <SectionCard title="Recent payments">
          <Table data={recent} columns={recCols} idKey="id" density="compact" />
        </SectionCard>
      </Grid>
    </VStack>
  );
}
