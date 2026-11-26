'use client';

import {useState} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {formatPhone} from '@/domain';
import {PageHeader, SectionCard} from '../ui';
import {AdmitForm, type BatchOption} from './AdmitForm';

type Row = {
  id: string;
  name: string;
  grade: string;
  status: string;
  guardianName: string;
  guardianPhone: string;
  batches: string[];
  updates: boolean;
  marketing: boolean;
  cardToken: string;
}

const STATUS: Record<string, {label: string; variant: 'success' | 'warning' | 'neutral'}> = {
  active: {label: 'Active', variant: 'success'},
  pending_consent: {label: 'Consent pending', variant: 'warning'},
  left: {label: 'Left', variant: 'neutral'},
};

export function Students({students, batches, today}: {students: Row[]; batches: BatchOption[]; today: string}) {
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const shown = students.filter(s => `${s.name} ${s.guardianName} ${s.guardianPhone} ${s.batches.join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  const cols: TableColumn<Row>[] = [
    {key: 'name', header: 'Student', width: proportional(3), renderCell: r => <VStack gap={0.5}><Link href={`/app/students/${r.id}`}>{r.name}</Link><Text type="supporting" color="secondary">{r.grade} · card {r.cardToken}</Text></VStack>},
    {key: 'batches', header: 'Batches', width: proportional(3), renderCell: r => <Text type="supporting">{r.batches.join(', ')}</Text>},
    {key: 'guardian', header: 'Guardian', width: proportional(3), renderCell: r => <VStack gap={0.5}><Text>{r.guardianName}</Text><Text type="supporting" color="secondary">{formatPhone(r.guardianPhone)}</Text></VStack>},
    {key: 'status', header: 'Status', width: proportional(2), renderCell: r => <Badge label={STATUS[r.status].label} variant={STATUS[r.status].variant} />},
    {key: 'consent', header: 'WhatsApp updates', width: proportional(2), renderCell: r => <Badge label={r.updates ? 'Opted in' : 'No'} variant={r.updates ? 'success' : 'neutral'} />},
  ];
  return (
    <VStack gap={6}>
      <PageHeader title="Students" description={`${students.length} students. Minimal records: name, class, batch and guardian contact.`} actions={<Button label={adding ? 'Close form' : 'Add student'} variant="primary" onClick={() => setAdding(a => !a)} />} />
      {adding && (
        <SectionCard title="New admission">
          <AdmitForm batches={batches} today={today} onDone={() => setAdding(false)} />
        </SectionCard>
      )}
      <HStack>
        <TextInput label="Search" isLabelHidden placeholder="Search by student, guardian, phone or batch" value={q} onChange={setQ} startIcon="search" width="100%" />
      </HStack>
      <Table data={shown} columns={cols} idKey="id" density="compact" hasHover />
    </VStack>
  );
}
