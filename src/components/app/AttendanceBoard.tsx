'use client';

import {useState} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {formatClock, formatDate, formatInstant} from '@/domain';
import type {todayBoard} from '@/server/store/attendance';
import {ActionButton, PageHeader, SectionCard, useAction} from '../ui';

type Board = Awaited<ReturnType<typeof todayBoard>>;
type Row = Board['batches'][number]['students'][number];

const SOURCE: Record<string, string> = {qr_self: 'Entrance QR', qr_card: 'ID card scan', staff: 'Staff', auto: 'Auto (no scan)'};

function Kiosk() {
  const [code, setCode] = useState('');
  const {run, busy, error} = useAction();
  const [last, setLast] = useState<string | null>(null);
  async function scan() {
    const r = await run('scan', {code}, x => `${x.student} marked present for ${x.batch}`);
    if (r) {
      setLast(`${r.student} · ${r.batch}${r.alreadyMarked ? ' (already marked)' : ''}`);
      setCode('');
    }
  }
  return (
    <SectionCard title="Kiosk: scan a student ID card">
      <VStack gap={3}>
        <Text type="supporting" color="secondary">
          Point a USB/Bluetooth QR scanner at the card (it types the code here), or open the card QR with this tablet&apos;s camera while signed in.
        </Text>
        <HStack gap={2} vAlign="end" wrap="wrap">
          <TextInput label="Card code" value={code} onChange={v => setCode(v.toUpperCase())} onEnter={scan} placeholder="e.g. AARAV001" hasAutoFocus autoCapitalize="characters" />
          <Button label="Mark present" variant="primary" isLoading={busy} onClick={scan} isDisabled={code.length < 4} />
        </HStack>
        {error && <Banner status="error" title={error} />}
        {last && !error && <Banner status="success" title={`Marked: ${last}`} />}
      </VStack>
    </SectionCard>
  );
}

export function AttendanceBoard({board, alertMode, entranceUrl, sweep, isDemo}: {board: Board; alertMode: string; entranceUrl: string; sweep: {markedAbsent: number; alerts: number; skippedNoConsent: number}; isDemo: boolean}) {
  return (
    <VStack gap={6}>
      <PageHeader
        title="Today's attendance"
        description={`${formatDate(board.date)} · Alerts: ${alertMode === 'all' ? 'absence + arrival (add-on)' : 'absence only (default)'}`}
        actions={
          <>
            <ActionButton label="Run absence check" action="sweep" done={r => `${r.markedAbsent} marked absent, ${r.alerts} parent alerts sent, ${r.skippedNoConsent} skipped (no consent)`} />
            <Button label="Open entrance QR page" href={entranceUrl} variant="secondary" target="_blank" />
          </>
        }
      />
      {(sweep.markedAbsent > 0 || sweep.alerts > 0) && (
        <Banner status="info" title={`Absence check just ran: ${sweep.markedAbsent} marked absent, ${sweep.alerts} WhatsApp alerts to parents (simulated).`} description="Students not scanned 15 minutes after a batch starts are marked absent. Only guardians who opted in to updates get alerts." />
      )}
      {isDemo && <Banner status="warning" title="Demo: self check-in accepts any batch that meets today, so you can try it at any hour." />}
      <Kiosk />
      {board.batches.length === 0 && <EmptyState title="No batches meet today" description="Check the timetable or add a batch." />}
      {board.batches.map(b => {
        const cols: TableColumn<Row>[] = [
          {key: 'name', header: 'Student', width: proportional(3), renderCell: r => <VStack gap={0.5}><Text weight="medium">{r.name}</Text><Text type="supporting" color="secondary">{r.grade}</Text></VStack>},
          {
            key: 'status',
            header: 'Status',
            width: proportional(2),
            renderCell: r =>
              !r.active ? <Badge label="Consent pending" variant="neutral" /> : r.mark ? <Badge label={r.mark.status === 'present' ? 'Present' : 'Absent'} variant={r.mark.status === 'present' ? 'success' : 'error'} /> : <Badge label="Not marked" variant="warning" />,
          },
          {key: 'source', header: 'How', width: proportional(2), renderCell: r => <Text type="supporting" color="secondary">{r.mark ? `${SOURCE[r.mark.source]} · ${formatInstant(r.mark.at).split(', ')[1]}${r.mark.alertSent ? (r.mark.status === 'present' ? ' · arrived after absence alert' : ' · parent alerted') : ''}` : '–'}</Text>},
          {
            key: 'actions',
            header: 'Mark',
            width: proportional(2),
            renderCell: r =>
              r.active ? (
                <HStack gap={1}>
                  <ActionButton label="Present" size="sm" variant={r.mark?.status === 'present' ? 'primary' : 'secondary'} action="mark" body={{batchId: b.id, studentId: r.id, status: 'present'}} done={() => `${r.name}: present`} />
                  <ActionButton label="Absent" size="sm" variant={r.mark?.status === 'absent' ? 'destructive' : 'ghost'} action="mark" body={{batchId: b.id, studentId: r.id, status: 'absent'}} done={() => `${r.name}: absent`} />
                </HStack>
              ) : null,
          },
        ];
        return (
          <SectionCard key={b.id} title={`${b.name} · ${formatClock(b.startMin)}–${formatClock(b.endMin)}${b.room ? ` · ${b.room}` : ''}`} actions={<Text type="supporting" color="secondary">{b.present} present · {b.absent} absent · {b.students.length} enrolled{b.pastCutoff ? '' : ' · absence cutoff not reached'}</Text>}>
            <Table data={b.students} columns={cols} idKey="id" density="compact" />
          </SectionCard>
        );
      })}
    </VStack>
  );
}
