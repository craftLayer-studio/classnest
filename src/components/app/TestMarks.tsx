'use client';

import {useState} from 'react';
import {VStack} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {formatDate, grade} from '@/domain';
import {ActionButton, PageHeader, useAction} from '../ui';

type Row = {id: string; studentId: string; name: string; score: number | null; rank: number | null; percent: number | null};

export function TestMarks({test, batchName, average, rows, canPublish}: {test: {id: string; name: string; maxMarks: number; heldOn: string; published: boolean}; batchName: string; average: number | null; rows: Row[]; canPublish: boolean}) {
  const [scores, setScores] = useState<Record<string, number | null>>(Object.fromEntries(rows.map(r => [r.studentId, r.score])));
  const {run, busy, error} = useAction();
  const cols: TableColumn<Row>[] = [
    {key: 'name', header: 'Student', width: proportional(3)},
    {
      key: 'score',
      header: `Score (out of ${test.maxMarks})`,
      width: proportional(3),
      renderCell: r => (
        <NumberInput label={`Score for ${r.name}`} isLabelHidden value={scores[r.studentId]} onChange={v => setScores(s => ({...s, [r.studentId]: Number.isFinite(v) ? v : null}))} min={0} max={test.maxMarks} step={0.5} hasClear size="sm" />
      ),
    },
    {key: 'rank', header: 'Rank', width: proportional(1), align: 'end', renderCell: r => (r.rank ? String(r.rank) : '–')},
    {key: 'percent', header: '%', width: proportional(1), align: 'end', renderCell: r => (r.percent === null ? '–' : `${r.percent}`)},
    {key: 'grade', header: 'Grade', width: proportional(2), renderCell: r => (r.percent === null ? '–' : grade(r.percent))},
  ];
  return (
    <VStack gap={6}>
      <PageHeader
        title={test.name}
        description={`${batchName} · ${formatDate(test.heldOn)} · class average ${average ?? '–'} / ${test.maxMarks}`}
        actions={
          <>
            <Button label="Save marks" variant="primary" isLoading={busy} onClick={() => run('marks', {testId: test.id, entries: rows.map(r => ({studentId: r.studentId, score: scores[r.studentId] ?? null}))}, () => 'Marks saved, ranks updated')} />
            {canPublish && <ActionButton label={test.published ? 'Send report cards again' : 'Publish and send report cards'} action="publish" body={{testId: test.id}} done={r => `${r.sent} parents got a report-card link; ${r.skipped} not opted in`} />}
          </>
        }
      />
      {error && <Banner status="error" title={error} />}
      <Text type="supporting" color="secondary">Leave a score empty for a student who missed the test. Ties share a rank (1, 2, 2, 4).</Text>
      <Table data={rows} columns={cols} idKey="id" density="compact" />
    </VStack>
  );
}
