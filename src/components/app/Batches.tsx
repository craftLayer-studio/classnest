'use client';

import {useState} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Grid} from '@astryxdesign/core/Grid';
import {Text} from '@astryxdesign/core/Text';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Selector} from '@astryxdesign/core/Selector';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {formatClock, formatDays, formatINR, WEEKDAY_SHORT, type Weekday} from '@/domain';
import {PageHeader, SectionCard, useAction} from '../ui';

type BatchRow = {id: string; name: string; courseName: string; teacherName: string; room: string; days: Weekday[]; startMin: number; endMin: number; enrolled: number; capacity: number};
type Course = {id: string; name: string; feePaise: number; instalments: number; months: number};

function CourseForm() {
  const [name, setName] = useState('');
  const [fee, setFee] = useState(24000);
  const [instalments, setInstalments] = useState(3);
  const [months, setMonths] = useState(10);
  const {run, busy, error} = useAction();
  return (
    <VStack gap={3}>
      <Grid columns={{minWidth: 180, max: 4, repeat: 'fit'}} gap={3}>
        <TextInput label="Course name" value={name} onChange={setName} placeholder="Class 9 Maths" width="100%" />
        <NumberInput label="Total fee (incl. GST)" units="₹" value={fee} onChange={v => setFee(v ?? 0)} min={1} width="100%" />
        <NumberInput label="Instalments" value={instalments} onChange={v => setInstalments(v ?? 1)} min={1} max={12} isIntegerOnly width="100%" />
        <NumberInput label="Duration" units="months" value={months} onChange={v => setMonths(v ?? 1)} min={1} max={36} isIntegerOnly width="100%" />
      </Grid>
      {error && <Banner status="error" title={error} />}
      <HStack>
        <Button label="Add course" variant="secondary" isLoading={busy} onClick={() => run('course', {name, fee, instalments, months}, () => 'Course added').then(r => r && setName(''))} />
      </HStack>
    </VStack>
  );
}

function BatchForm({courses, teachers}: {courses: Course[]; teachers: {id: string; name: string}[]}) {
  const [courseId, setCourseId] = useState<string | null>(courses[0]?.id ?? null);
  const [name, setName] = useState('');
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [room, setRoom] = useState('');
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [start, setStart] = useState('17:00');
  const [end, setEnd] = useState('18:30');
  const [capacity, setCapacity] = useState(25);
  const {run, busy, error} = useAction();
  return (
    <VStack gap={3}>
      <Grid columns={{minWidth: 200, max: 3, repeat: 'fit'}} gap={3}>
        <Selector label="Course" options={courses.map(c => ({value: c.id, label: c.name}))} value={courseId ?? undefined} onChange={v => setCourseId(v)} width="100%" />
        <TextInput label="Batch name" value={name} onChange={setName} placeholder="9 Maths evening" width="100%" />
        <Selector label="Teacher" options={[{value: '', label: 'Not assigned'}, ...teachers.map(t => ({value: t.id, label: t.name}))]} value={teacherId ?? ''} onChange={v => setTeacherId(v || null)} width="100%" />
        <TextInput label="Room" value={room} onChange={setRoom} placeholder="Room 1" width="100%" />
        <TextInput label="Starts (24h)" value={start} onChange={setStart} placeholder="17:00" width="100%" />
        <TextInput label="Ends (24h)" value={end} onChange={setEnd} placeholder="18:30" width="100%" />
        <NumberInput label="Seats" value={capacity} onChange={v => setCapacity(v ?? 1)} min={1} max={500} isIntegerOnly width="100%" />
      </Grid>
      <HStack gap={3} wrap="wrap">
        {WEEKDAY_SHORT.map((d, i) => (
          <CheckboxInput key={d} label={d} value={days.includes(i)} onChange={v => setDays(s => (v ? [...s, i] : s.filter(x => x !== i)))} />
        ))}
      </HStack>
      {error && <Banner status="error" title={error} />}
      <HStack>
        <Button label="Add batch (checks clashes)" variant="primary" isLoading={busy} onClick={() => run('batch', {courseId, name, teacherId, room, days: days.map(String), start, end, capacity}, () => 'Batch added').then(r => r && setName(''))} />
      </HStack>
    </VStack>
  );
}

export function Batches({canEdit, batches, courses, teachers, clashCount}: {canEdit: boolean; batches: BatchRow[]; courses: Course[]; teachers: {id: string; name: string}[]; clashCount: number}) {
  const cols: TableColumn<BatchRow>[] = [
    {key: 'name', header: 'Batch', width: proportional(3), renderCell: r => <VStack gap={0.5}><Text weight="medium">{r.name}</Text><Text type="supporting" color="secondary">{r.courseName}</Text></VStack>},
    {key: 'days', header: 'Days', width: proportional(3), renderCell: r => formatDays(r.days)},
    {key: 'time', header: 'Time', width: proportional(2), renderCell: r => `${formatClock(r.startMin)}–${formatClock(r.endMin)}`},
    {key: 'room', header: 'Room', width: proportional(2)},
    {key: 'teacherName', header: 'Teacher', width: proportional(2)},
    {key: 'seats', header: 'Seats', width: proportional(1), align: 'end', renderCell: r => `${r.enrolled}/${r.capacity}`},
  ];
  const courseCols: TableColumn<Course>[] = [
    {key: 'name', header: 'Course', width: proportional(3)},
    {key: 'fee', header: 'Fee (incl. GST)', width: proportional(2), align: 'end', renderCell: r => formatINR(r.feePaise)},
    {key: 'plan', header: 'Plan', width: proportional(2), renderCell: r => `${r.instalments} instalment${r.instalments > 1 ? 's' : ''} · ${r.months} months`},
  ];
  const week = WEEKDAY_SHORT.map((d, i) => ({id: d, day: d, list: batches.filter(b => b.days.includes(i as Weekday)).map(b => `${formatClock(b.startMin)} ${b.name}`).join(' · ') || '–'}));
  const weekCols: TableColumn<(typeof week)[number]>[] = [
    {key: 'day', header: 'Day', width: proportional(1)},
    {key: 'list', header: 'Classes', width: proportional(8)},
  ];
  return (
    <VStack gap={6}>
      <PageHeader title="Batches and timetable" description={`${batches.length} batches · ${courses.length} courses`} />
      {clashCount > 0 ? <Banner status="warning" title={`${clashCount} room or teacher clash${clashCount > 1 ? 'es' : ''} in the timetable`} /> : <Banner status="success" title="No room or teacher clashes" />}
      <SectionCard title="Batches">
        <Table data={batches} columns={cols} idKey="id" density="compact" />
      </SectionCard>
      <SectionCard title="Week at a glance">
        <Table data={week} columns={weekCols} idKey="id" density="compact" />
      </SectionCard>
      <SectionCard title="Courses and fee plans">
        <Table data={courses} columns={courseCols} idKey="id" density="compact" />
      </SectionCard>
      {canEdit && (
        <>
          <SectionCard title="Add a batch">
            <BatchForm courses={courses} teachers={teachers} />
          </SectionCard>
          <SectionCard title="Add a course">
            <CourseForm />
          </SectionCard>
        </>
      )}
    </VStack>
  );
}
