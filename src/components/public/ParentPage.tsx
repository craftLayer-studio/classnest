'use client';

import {useState} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Card} from '@astryxdesign/core/Card';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {List, ListItem} from '@astryxdesign/core/List';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {formatDate, formatINR, formatInstant, PURPOSE_LABEL, type ConsentPurpose} from '@/domain';
import type {parentPage} from '@/server/store/parent';
import {post} from '@/lib/api';
import {PublicShell} from './PublicShell';
import {QrImage} from '../QrImage';

type Data = NonNullable<Awaited<ReturnType<typeof parentPage>>>;
type I = Data['fees']['instalments'][number];

const TREND: Record<string, string> = {up: 'Improving', down: 'Dipped since last test', flat: 'Steady'};
const INST: Record<string, {label: string; variant: 'success' | 'neutral' | 'info' | 'warning' | 'error'}> = {
  paid: {label: 'Paid', variant: 'success'},
  upcoming: {label: 'Upcoming', variant: 'neutral'},
  due: {label: 'Due today', variant: 'info'},
  overdue: {label: 'Overdue', variant: 'warning'},
  defaulting: {label: 'Overdue', variant: 'error'},
};

export function ParentPage({token, data, upiQr}: {token: string; data: Data; upiQr: string | null}) {
  const [consent, setConsent] = useState(data.consent);
  const [msg, setMsg] = useState<string | null>(null);
  const {student: s, attendance: a, results, fees} = data;
  const iCols: TableColumn<I>[] = [
    {key: 'dueDate', header: 'Due', width: proportional(2), renderCell: r => formatDate(r.dueDate)},
    {key: 'amount', header: 'Amount', width: proportional(2), align: 'end', renderCell: r => formatINR(r.amount + r.lateFee)},
    {key: 'status', header: 'Status', width: proportional(2), renderCell: r => <Badge label={INST[r.status].label} variant={INST[r.status].variant} />},
  ];

  async function toggle(purpose: ConsentPurpose, granted: boolean) {
    if (purpose === 'child_data' && !granted && !window.confirm('Withdrawing this asks the institute to delete your child\'s record. Continue?')) return;
    try {
      const c = await post<typeof consent>('/api/public/parent-consent', {token, purpose, granted});
      setConsent(c);
      setMsg(purpose === 'child_data' && !granted ? 'Recorded. The institute will delete the record and confirm.' : 'Your choice is saved.');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <PublicShell org={data.org.name} isDemo={data.org.isDemo}>
      <VStack gap={5}>
        <VStack gap={1}>
          <Heading level={1}>{s.name}</Heading>
          <Text color="secondary">{s.grade} · {s.batches.join(', ')}</Text>
        </VStack>

        <Card>
          <VStack gap={1}>
            <Text type="label" color="secondary">Attendance, last 30 days</Text>
            <Heading level={2}>{a.percent === null ? 'No classes yet' : `${a.percent}%`}</Heading>
            <Text type="supporting" color="secondary">{a.sessions} classes · {a.absences} absent</Text>
          </VStack>
        </Card>

        <Card>
          <VStack gap={3}>
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
              <Heading level={2}>Report card</Heading>
              {results.trend && <Badge label={TREND[results.trend]} variant={results.trend === 'down' ? 'warning' : 'success'} />}
            </HStack>
            {results.rows.length === 0 ? (
              <Text color="secondary">No results published yet.</Text>
            ) : (
              <List hasDividers density="compact">
                {results.rows.map(r => (
                  <ListItem
                    key={r.testId}
                    label={r.name}
                    description={<Text type="supporting" color="secondary">{`${formatDate(r.heldOn)} · rank ${r.rank} of ${r.of} · class average ${r.average ?? '–'}`}</Text>}
                    endContent={<VStack gap={0.5} hAlign="end"><Text weight="semibold">{`${r.score}/${r.maxMarks}`}</Text><Badge label={r.grade} variant="info" /></VStack>}
                  />
                ))}
              </List>
            )}
          </VStack>
        </Card>

        <Card>
          <VStack gap={3}>
            <Heading level={2}>Fees</Heading>
            {fees.payAmount > 0 && fees.upiLink ? (
              <VStack gap={3}>
                <Text weight="semibold">{fees.dueNow > 0 ? `${formatINR(fees.dueNow)} due now` : `Next instalment ${formatINR(fees.payAmount)}`}</Text>
                <Button label={`Pay ${formatINR(fees.payAmount)} with any UPI app`} variant="primary" size="lg" href={fees.upiLink} width="100%" />
                {upiQr && (
                  <VStack gap={1} hAlign="center">
                    <VStack width="50%">
                      <QrImage src={upiQr} alt={"UPI payment QR code"} />
                    </VStack>
                    <Text type="supporting" color="secondary" justify="center">On a computer? Scan this with your phone&apos;s UPI app.</Text>
                  </VStack>
                )}
                <Text type="supporting" color="secondary">The institute confirms your payment and sends a receipt on WhatsApp.</Text>
              </VStack>
            ) : (
              <Banner status="success" title="No fees due" />
            )}
            <Table data={fees.instalments} columns={iCols} idKey="id" density="compact" />
            {fees.payments.length > 0 && (
              <VStack gap={1}>
                <Text type="label">Receipts</Text>
                {fees.payments.map(p => (
                  <Link key={p.receiptToken} href={`/receipt/${p.receiptToken}`}>{`${p.receiptNo} · ${formatINR(p.amount)} · ${formatInstant(p.at)}`}</Link>
                ))}
              </VStack>
            )}
          </VStack>
        </Card>

        <Card>
          <VStack gap={3}>
            <Heading level={2}>Your choices</Heading>
            <Text type="supporting" color="secondary">Change these any time. Each change is recorded with the date.</Text>
            {(Object.keys(PURPOSE_LABEL) as ConsentPurpose[]).map(p => (
              <CheckboxInput key={p} label={PURPOSE_LABEL[p]} value={consent[p]} onChange={v => toggle(p, v)} />
            ))}
            {msg && <Banner status="info" title={msg} />}
          </VStack>
        </Card>
      </VStack>
    </PublicShell>
  );
}
