'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Grid} from '@astryxdesign/core/Grid';
import {Text} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {TextInput} from '@astryxdesign/core/TextInput';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {attendancePercent, formatDate, formatINR, formatInstant, formatPhone, PURPOSE_LABEL, type ConsentPurpose} from '@/domain';
import {ActionButton, PageHeader, SectionCard, useAction} from '../ui';
import {QrImage} from '../QrImage';

type Inst = {
  id: string;
  seq: number;
  dueDate: string;
  amount: number;
  paid: number;
  lateFee: number;
  outstanding: number;
  status: string;
  reminders: string;
}
type Pay = {
  id: string;
  receiptNo: string;
  receiptToken: string;
  amount: number;
  mode: string;
  reference: string | null;
  at: number;
}

const INST_BADGE: Record<string, {label: string; variant: 'success' | 'neutral' | 'warning' | 'error' | 'info'}> = {
  paid: {label: 'Paid', variant: 'success'},
  upcoming: {label: 'Upcoming', variant: 'neutral'},
  due: {label: 'Due today', variant: 'info'},
  overdue: {label: 'Overdue (grace)', variant: 'warning'},
  defaulting: {label: 'Defaulting', variant: 'error'},
};

function PaymentForm({studentId, due}: {studentId: string; due: number}) {
  const [amount, setAmount] = useState(due / 100);
  const [mode, setMode] = useState('upi');
  const [ref, setRef] = useState('');
  const {run, busy, error} = useAction();
  return (
    <VStack gap={3}>
      <HStack gap={3} wrap="wrap" vAlign="end">
        <NumberInput label="Amount" units="₹" value={amount} onChange={v => setAmount(v ?? 0)} min={0} step={100} />
        <SegmentedControl label="Mode" value={mode} onChange={setMode}>
          <SegmentedControlItem value="upi" label="UPI" />
          <SegmentedControlItem value="cash" label="Cash" />
          <SegmentedControlItem value="card" label="Card" />
        </SegmentedControl>
        {mode === 'upi' && <TextInput label="UPI reference (UTR)" value={ref} onChange={setRef} placeholder="From the bank app" />}
        <Button label="Record payment" variant="primary" isLoading={busy} onClick={() => run('payment', {studentId, amount, mode, reference: ref || undefined}, r => `Receipt ${r.receiptNo} created and sent`)} />
      </HStack>
      <Text type="supporting" color="secondary">Check the credit in your bank or UPI app first. The amount is applied to the oldest dues.</Text>
      {error && <Banner status="error" title={error} />}
    </VStack>
  );
}

export function StudentDetail(props: {
  role: string;
  student: {id: string; name: string; grade: string; status: string; isMinor: boolean; cardToken: string};
  guardian: {name: string; phone: string; relation: string};
  batches: string[];
  consent: Record<ConsentPurpose, boolean>;
  history: {id: string; purpose: ConsentPurpose; granted: boolean; channel: string; notice: string; at: number}[];
  instalments: Inst[];
  payments: Pay[];
  attendance: {id: string; date: string; status: 'present' | 'absent'; source: string}[];
  parentUrl: string;
  cardQr: string;
}) {
  const {student: s, guardian: g, consent} = props;
  const router = useRouter();
  const due = props.instalments.filter(i => i.status !== 'upcoming').reduce((t, i) => t + i.outstanding, 0);
  const instCols: TableColumn<Inst>[] = [
    {key: 'seq', header: '#', width: proportional(1)},
    {key: 'dueDate', header: 'Due', width: proportional(2), renderCell: r => formatDate(r.dueDate)},
    {key: 'amount', header: 'Amount', width: proportional(2), align: 'end', renderCell: r => formatINR(r.amount + r.lateFee) + (r.lateFee ? ' (incl. late fee)' : '')},
    {key: 'outstanding', header: 'Balance', width: proportional(2), align: 'end', renderCell: r => formatINR(r.outstanding)},
    {key: 'status', header: 'Status', width: proportional(2), renderCell: r => <Badge label={INST_BADGE[r.status].label} variant={INST_BADGE[r.status].variant} />},
    {key: 'reminders', header: 'Reminders sent', width: proportional(2), renderCell: r => <Text type="supporting" color="secondary">{r.reminders || '–'}</Text>},
  ];
  const payCols: TableColumn<Pay>[] = [
    {key: 'receiptNo', header: 'Receipt', width: proportional(3), renderCell: r => <Link href={`/receipt/${r.receiptToken}`} target="_blank">{r.receiptNo}</Link>},
    {key: 'at', header: 'Date', width: proportional(2), renderCell: r => formatInstant(r.at)},
    {key: 'mode', header: 'Mode', width: proportional(1), renderCell: r => r.mode.toUpperCase()},
    {key: 'amount', header: 'Amount', width: proportional(2), align: 'end', renderCell: r => formatINR(r.amount)},
  ];
  const histCols: TableColumn<(typeof props.history)[number]>[] = [
    {key: 'at', header: 'When', width: proportional(2), renderCell: r => formatInstant(r.at)},
    {key: 'purpose', header: 'Purpose', width: proportional(4), renderCell: r => <Text type="supporting">{PURPOSE_LABEL[r.purpose]}</Text>},
    {key: 'granted', header: 'Choice', width: proportional(1), renderCell: r => <Badge label={r.granted ? 'Yes' : 'No'} variant={r.granted ? 'success' : 'neutral'} />},
    {key: 'channel', header: 'Channel · notice', width: proportional(2), renderCell: r => <Text type="supporting" color="secondary">{r.channel.replace('_', ' ')} · {r.notice}</Text>},
  ];
  const pct = attendancePercent(props.attendance);

  return (
    <VStack gap={6}>
      <PageHeader
        title={s.name}
        description={`${s.grade} · ${props.batches.join(', ')}`}
        actions={
          <>
            <Button label="Parent page" href={props.parentUrl} target="_blank" />
            {s.status === 'pending_consent' && <ActionButton label="Resend consent link" action="resend-consent" body={{studentId: s.id}} done={() => 'Consent link sent again'} />}
            {due > 0 && consent.service_updates && <ActionButton label="Send fee reminder" action="remind" body={{studentId: s.id}} done={() => 'Reminder sent on WhatsApp (simulated)'} />}
          </>
        }
      />
      {s.status === 'pending_consent' && <Banner status="warning" title="Waiting for guardian consent" description="The guardian got a WhatsApp link. Until they agree, the student cannot check in and no alerts go out." />}

      <Grid columns={{minWidth: 300, max: 3, repeat: 'fit'}} gap={4}>
        <SectionCard title="Guardian and consent">
          <MetadataList>
            <MetadataListItem label="Guardian">{`${g.name} (${g.relation})`}</MetadataListItem>
            <MetadataListItem label="WhatsApp">{formatPhone(g.phone)}</MetadataListItem>
            <MetadataListItem label="Minor">{s.isMinor ? 'Yes (guardian consents)' : 'No'}</MetadataListItem>
            <MetadataListItem label="Class record">{consent.child_data ? 'Agreed' : 'Not yet'}</MetadataListItem>
            <MetadataListItem label="Updates">{consent.service_updates ? 'Opted in' : 'Not opted in'}</MetadataListItem>
            <MetadataListItem label="Offers">{consent.marketing ? 'Opted in' : 'Not opted in'}</MetadataListItem>
          </MetadataList>
        </SectionCard>
        <SectionCard title="Attendance (last 30 marks)">
          <VStack gap={2}>
            <Text type="large" weight="semibold">{pct === null ? 'No marks yet' : `${pct}% present`}</Text>
            <Text type="supporting" color="secondary">{props.attendance.filter(a => a.status === 'absent').length} absences: {props.attendance.filter(a => a.status === 'absent').slice(0, 6).map(a => formatDate(a.date)).join(', ') || 'none'}</Text>
          </VStack>
        </SectionCard>
        <SectionCard title="ID card QR">
          <HStack gap={4} vAlign="center">
            <VStack width="40%">
              <QrImage src={props.cardQr} alt={`ID card QR for ${s.name}`} />
            </VStack>
            <VStack gap={1}>
              <Text type="label">Card code</Text>
              <Text type="code">{s.cardToken}</Text>
              <Text type="supporting" color="secondary">Print on the ID card. Staff scan it at the kiosk, or the student types it on the entrance QR page.</Text>
            </VStack>
          </HStack>
        </SectionCard>
      </Grid>

      <SectionCard title={`Fees · ${formatINR(due)} due now`}>
        <VStack gap={4}>
          <Table data={props.instalments} columns={instCols} idKey="id" density="compact" />
          {props.instalments.some(i => i.outstanding > 0) && <PaymentForm key={due} studentId={s.id} due={due} />}
        </VStack>
      </SectionCard>

      <SectionCard title="Receipts">
        <Table data={props.payments} columns={payCols} idKey="id" density="compact" emptyState={<Text color="secondary">No payments yet.</Text>} />
      </SectionCard>

      <SectionCard title="Consent ledger">
        <Table data={props.history} columns={histCols} idKey="id" density="compact" emptyState={<Text color="secondary">No consent recorded yet.</Text>} />
      </SectionCard>

      {props.role === 'owner' && (
        <SectionCard title="Erase this student">
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Text type="supporting" color="secondary">Deletes the student, attendance, marks, fees and receipts. Use when a guardian withdraws consent or asks for erasure.</Text>
            <Button
              label="Delete student record"
              variant="destructive"
              clickAction={async () => {
                if (!window.confirm(`Delete all records for ${s.name}? This cannot be undone.`)) return;
                const res = await fetch('/api/staff/delete-student', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({studentId: s.id})});
                if (res.ok) router.push('/app/students');
              }}
            />
          </HStack>
        </SectionCard>
      )}
    </VStack>
  );
}
