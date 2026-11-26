'use client';

import {useState} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Grid} from '@astryxdesign/core/Grid';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Dialog} from '@astryxdesign/core/Dialog';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {Selector} from '@astryxdesign/core/Selector';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {formatDate, formatInstant, formatPhone, nextStages, STAGE_LABEL, ENQUIRY_STAGES, type EnquiryStage, type Funnel} from '@/domain';
import {PageHeader, SectionCard, StatTile, useAction} from '../ui';
import {AdmitForm, type BatchOption} from './AdmitForm';

type E = {id: string; guardianName: string; phone: string; studentName: string; grade: string; courseName: string; stage: EnquiryStage; demoBatch: string; demoDate: string; source: string; note: string; createdAt: number; updates: boolean; marketing: boolean; studentId: string};

const STAGE_VARIANT: Record<EnquiryStage, 'neutral' | 'info' | 'blue' | 'purple' | 'success' | 'error'> = {new: 'neutral', demo_booked: 'info', demo_attended: 'blue', fee_discussed: 'purple', admitted: 'success', lost: 'error'};
const SOURCE: Record<string, string> = {poster_qr: 'Poster QR', walk_in: 'Walk-in', call: 'Phone call'};

function StageMover({e}: {e: E}) {
  const {run} = useAction();
  const options = nextStages(e.stage).filter(s => s !== 'admitted');
  if (options.length === 0) return null;
  return <Selector label={`Move ${e.studentName}`} isLabelHidden size="sm" variant="secondary" placeholder="Move to…" options={options.map(s => ({value: s, label: STAGE_LABEL[s]}))} onChange={v => v && run('stage', {enquiryId: e.id, stage: v}, () => `${e.studentName}: ${STAGE_LABEL[v as EnquiryStage]}`)} />;
}

function WalkIn({courses}: {courses: {id: string; name: string}[]}) {
  const [f, setF] = useState({guardianName: '', phone: '', studentName: '', grade: '', courseId: '', source: 'walk_in', note: '', consentUpdates: false, consentMarketing: false});
  const set = (k: keyof typeof f) => (v: string | boolean) => setF(s => ({...s, [k]: v}));
  const {run, busy, error} = useAction();
  return (
    <VStack gap={3}>
      <SegmentedControl label="Source" value={f.source} onChange={set('source')}>
        <SegmentedControlItem value="walk_in" label="Walk-in" />
        <SegmentedControlItem value="call" label="Phone call" />
      </SegmentedControl>
      <Grid columns={{minWidth: 200, max: 3, repeat: 'fit'}} gap={3}>
        <TextInput label="Parent name" value={f.guardianName} onChange={set('guardianName')} width="100%" />
        <TextInput label="Parent mobile" type="tel" value={f.phone} onChange={set('phone')} width="100%" />
        <TextInput label="Student name" value={f.studentName} onChange={set('studentName')} width="100%" />
        <TextInput label="Class or level" value={f.grade} onChange={set('grade')} width="100%" />
        <Selector label="Course interest" options={courses.map(c => ({value: c.id, label: c.name}))} value={f.courseId || undefined} onChange={v => set('courseId')(v ?? '')} width="100%" />
      </Grid>
      <TextArea label="Note" isOptional value={f.note} onChange={set('note')} rows={2} width="100%" />
      <CheckboxInput label="Parent agrees to WhatsApp updates about this enquiry" value={f.consentUpdates} onChange={set('consentUpdates')} />
      <CheckboxInput label="Parent agrees to offers and admission news" value={f.consentMarketing} onChange={set('consentMarketing')} />
      {error && <Banner status="error" title={error} />}
      <HStack>
        <Button label="Add enquiry" variant="primary" isLoading={busy} onClick={() => run('walk-in', f, () => 'Enquiry added')} />
      </HStack>
    </VStack>
  );
}

function OfferSender() {
  const [text, setText] = useState('admissions for the April batch are open. Book a free demo class this week and get 10% off the first instalment.');
  const {run, busy, error} = useAction();
  return (
    <VStack gap={3}>
      <TextArea label="Offer text" value={text} onChange={setText} rows={3} maxLength={300} width="100%" description="Goes only to parents who opted in to offers. Never to students." />
      {error && <Banner status="error" title={error} />}
      <HStack>
        <Button label="Send offer to opted-in parents" variant="secondary" isLoading={busy} onClick={() => run('offer', {text}, r => `Offer sent to ${r.sent} parents; ${r.skipped} skipped (no marketing consent)`)} />
      </HStack>
    </VStack>
  );
}

export function Enquiries({isOwner, today, posterUrl, funnel, enquiries, batches, courses}: {isOwner: boolean; today: string; posterUrl: string; funnel: Funnel; enquiries: E[]; batches: BatchOption[]; courses: {id: string; name: string}[]}) {
  const [admitting, setAdmitting] = useState<E | null>(null);
  const [filter, setFilter] = useState<string>('open');
  const shown = enquiries.filter(e => (filter === 'open' ? e.stage !== 'admitted' && e.stage !== 'lost' : filter === 'all' ? true : e.stage === filter));
  const cols: TableColumn<E>[] = [
    {key: 'student', header: 'Student', width: proportional(3), renderCell: r => <VStack gap={0.5}><Text weight="medium">{r.studentName}</Text><Text type="supporting" color="secondary">{r.grade} · {r.courseName}</Text></VStack>},
    {key: 'parent', header: 'Parent', width: proportional(3), renderCell: r => <VStack gap={0.5}><Text>{r.guardianName}</Text><Link href={`https://wa.me/${r.phone.replace('+', '')}`} target="_blank">{formatPhone(r.phone)}</Link></VStack>},
    {key: 'stage', header: 'Stage', width: proportional(2), renderCell: r => <Badge label={STAGE_LABEL[r.stage]} variant={STAGE_VARIANT[r.stage]} />},
    {key: 'demo', header: 'Demo class', width: proportional(3), renderCell: r => <Text type="supporting">{r.demoDate ? `${formatDate(r.demoDate)} · ${r.demoBatch}` : '–'}</Text>},
    {key: 'source', header: 'Source', width: proportional(2), renderCell: r => <VStack gap={0.5}><Text type="supporting">{SOURCE[r.source]}</Text><Text type="supporting" color="secondary">{formatInstant(r.createdAt)}</Text></VStack>},
    {key: 'consent', header: 'Offers', width: proportional(1), renderCell: r => <Badge label={r.marketing ? 'Yes' : 'No'} variant={r.marketing ? 'success' : 'neutral'} />},
    {
      key: 'act',
      header: 'Next step',
      width: proportional(3),
      renderCell: r =>
        r.stage === 'admitted' ? (
          r.studentId ? <Link href={`/app/students/${r.studentId}`}>Open student</Link> : <Text type="supporting">Admitted</Text>
        ) : (
          <HStack gap={1} wrap="wrap">
            {nextStages(r.stage).includes('admitted') && <Button label="Admit" size="sm" variant="primary" onClick={() => setAdmitting(r)} />}
            <StageMover e={r} />
          </HStack>
        ),
    },
  ];
  return (
    <VStack gap={6}>
      <PageHeader title="Enquiries and demo classes" description="Leads from poster QR codes, walk-ins and calls." actions={<Button label="Open poster booking page" href={posterUrl} target="_blank" />} />
      <Grid columns={{minWidth: 160, max: 4, repeat: 'fit'}} gap={4}>
        <StatTile label="Enquiries" value={String(funnel.total)} />
        <StatTile label="Reached a demo" value={String(funnel.demoBooked)} />
        <StatTile label="Admitted" value={String(funnel.admitted)} />
        <StatTile label="Conversion" value={funnel.conversionPercent === null ? '–' : `${funnel.conversionPercent}%`} />
      </Grid>
      <HStack gap={2} wrap="wrap">
        <SegmentedControl label="Filter" value={filter} onChange={setFilter} size="sm">
          <SegmentedControlItem value="open" label="Open" />
          {ENQUIRY_STAGES.map(s => (
            <SegmentedControlItem key={s} value={s} label={`${STAGE_LABEL[s]} (${funnel.byStage[s]})`} />
          ))}
          <SegmentedControlItem value="all" label="All" />
        </SegmentedControl>
      </HStack>
      <Table data={shown} columns={cols} idKey="id" density="compact" emptyState={<Text color="secondary">No enquiries here.</Text>} />
      <Grid columns={{minWidth: 340, max: 2, repeat: 'fit'}} gap={4}>
        <SectionCard title="Add a walk-in or call">
          <WalkIn courses={courses} />
        </SectionCard>
        {isOwner && (
          <SectionCard title="Admission offer (marketing)">
            <OfferSender />
          </SectionCard>
        )}
      </Grid>
      <Dialog isOpen={admitting !== null} onOpenChange={o => !o && setAdmitting(null)} purpose="form" width="40rem" padding={6}>
        {admitting && (
          <VStack gap={4}>
            <Heading level={2}>Admit {admitting.studentName}</Heading>
            <Text color="secondary">Parent {admitting.guardianName}, {formatPhone(admitting.phone)}. They will get a consent link on WhatsApp.</Text>
            <AdmitForm batches={batches} today={today} enquiry={admitting} onDone={() => setAdmitting(null)} />
          </VStack>
        )}
      </Dialog>
    </VStack>
  );
}
