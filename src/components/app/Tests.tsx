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
import {TextInput} from '@astryxdesign/core/TextInput';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {formatDate} from '@/domain';
import {iso} from '@/lib/dates';
import {PageHeader, SectionCard, useAction} from '../ui';

type T = {id: string; name: string; batchName: string; heldOn: string; maxMarks: number; published: boolean};

export function Tests({tests, batches, today}: {tests: T[]; batches: {id: string; name: string}[]; today: string}) {
  const [batchId, setBatchId] = useState<string | undefined>(batches[0]?.id);
  const [name, setName] = useState('');
  const [maxMarks, setMax] = useState(50);
  const [heldOn, setHeldOn] = useState(today);
  const {run, busy, error} = useAction();
  const router = useRouter();
  const cols: TableColumn<T>[] = [
    {key: 'name', header: 'Test', width: proportional(3), renderCell: r => <Link href={`/app/tests/${r.id}`}>{r.name}</Link>},
    {key: 'batchName', header: 'Batch', width: proportional(3)},
    {key: 'heldOn', header: 'Held on', width: proportional(2), renderCell: r => formatDate(r.heldOn)},
    {key: 'maxMarks', header: 'Max', width: proportional(1), align: 'end'},
    {key: 'published', header: 'Status', width: proportional(2), renderCell: r => <Badge label={r.published ? 'Sent to parents' : 'Draft'} variant={r.published ? 'success' : 'warning'} />},
  ];
  return (
    <VStack gap={6}>
      <PageHeader title="Tests and marks" description="Enter marks, see ranks, and send each parent a report-card link." />
      <SectionCard title="New test">
        <VStack gap={3}>
          <Grid columns={{minWidth: 200, max: 4, repeat: 'fit'}} gap={3}>
            <Selector label="Batch" options={batches.map(b => ({value: b.id, label: b.name}))} value={batchId} onChange={v => setBatchId(v)} width="100%" />
            <TextInput label="Test name" value={name} onChange={setName} placeholder="Unit Test 3: Magnetism" width="100%" />
            <NumberInput label="Maximum marks" value={maxMarks} onChange={v => setMax(v ?? 1)} min={1} max={1000} isIntegerOnly width="100%" />
            <DateInput label="Held on" value={iso(heldOn)} onChange={v => setHeldOn(v ?? today)} width="100%" />
          </Grid>
          {error && <Banner status="error" title={error} />}
          <HStack>
            <Button label="Create test" variant="primary" isLoading={busy} onClick={async () => { const r = await run('test', {batchId, name, maxMarks, heldOn}); if (r) router.push(`/app/tests/${r.id}`); }} />
          </HStack>
        </VStack>
      </SectionCard>
      <Table data={tests} columns={cols} idKey="id" density="compact" hasHover emptyState={<Text color="secondary">No tests yet.</Text>} />
    </VStack>
  );
}
