'use client';

import {useState} from 'react';
import {VStack} from '@astryxdesign/core/Layout';
import {Card} from '@astryxdesign/core/Card';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {RadioList, RadioListItem} from '@astryxdesign/core/RadioList';
import {List, ListItem} from '@astryxdesign/core/List';
import {formatClock, formatDate, formatINR, NOTICE_VERSION} from '@/domain';
import {post} from '@/lib/api';
import {PublicShell} from './PublicShell';

type Course = {id: string; name: string; feePaise: number; instalments: number; months: number};
type Slot = {id: string; batchId: string; batchName: string; courseId: string; date: string; startMin: number};

export function DemoBooking({token, org, courses, slots}: {token: string; org: {name: string; city: string; isDemo: boolean}; courses: Course[]; slots: Slot[]}) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [slotId, setSlotId] = useState('');
  const [f, setF] = useState({guardianName: '', phone: '', studentName: '', grade: ''});
  const [isGuardian, setIsGuardian] = useState(false);
  const [updates, setUpdates] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{demo: {batch: string; date: string; startMin: number} | null} | null>(null);
  const courseSlots = slots.filter(s => s.courseId === courseId).slice(0, 8);

  async function submit() {
    setBusy(true);
    setError(null);
    const slot = courseSlots.find(s => s.id === slotId);
    try {
      const r = await post<{demo: {batch: string; date: string; startMin: number} | null}>('/api/public/enquiry', {token, ...f, courseId, batchId: slot?.batchId, date: slot?.date, isGuardian, consentUpdates: updates, consentMarketing: marketing});
      setDone(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <PublicShell org={org.name} isDemo={org.isDemo}>
        <VStack gap={4}>
          <Heading level={1}>Thank you</Heading>
          <Banner
            status="success"
            title={done.demo ? `Demo class booked: ${formatDate(done.demo.date)} at ${formatClock(done.demo.startMin)}` : 'Enquiry received'}
            description={done.demo ? `${done.demo.batch}. ${updates ? 'A WhatsApp confirmation is on its way.' : 'Please note the time; we will not message you.'}` : 'The institute will call you about timings and fees.'}
          />
          {org.isDemo && <Text type="supporting" color="secondary">Demo: messages are simulated and appear in the staff WhatsApp outbox.</Text>}
        </VStack>
      </PublicShell>
    );
  }

  return (
    <PublicShell org={org.name} isDemo={org.isDemo}>
      <VStack gap={5}>
        <VStack gap={1}>
          <Heading level={1}>Book a free demo class</Heading>
          <Text color="secondary">{org.name}, {org.city}. Pick a course, choose a class to attend, and come along. No payment needed.</Text>
        </VStack>
        <Card>
          <VStack gap={2}>
            <Heading level={2}>Courses and fees</Heading>
            <List hasDividers density="compact">
              {courses.map(c => (
                <ListItem key={c.id} label={c.name} description={`${formatINR(c.feePaise)} incl. GST · ${c.instalments} instalment${c.instalments > 1 ? 's' : ''} · ${c.months} months`} />
              ))}
            </List>
          </VStack>
        </Card>
        <RadioList label="Course" value={courseId} onChange={v => { setCourseId(v); setSlotId(''); }}>
          {courses.map(c => <RadioListItem key={c.id} value={c.id} label={c.name} />)}
        </RadioList>
        {courseSlots.length > 0 ? (
          <RadioList label="Demo class" description="Next 7 days" value={slotId} onChange={setSlotId}>
            {courseSlots.map(s => <RadioListItem key={s.id} value={s.id} label={`${formatDate(s.date)}, ${formatClock(s.startMin)}`} description={s.batchName} />)}
          </RadioList>
        ) : (
          <Text color="secondary">No demo slot this week for this course. Send an enquiry and the institute will call you.</Text>
        )}
        <TextInput label="Parent or guardian name" value={f.guardianName} onChange={v => setF({...f, guardianName: v})} autoComplete="name" width="100%" />
        <TextInput label="Parent's WhatsApp number" type="tel" inputMode="tel" value={f.phone} onChange={v => setF({...f, phone: v})} autoComplete="tel" placeholder="98260 12345" width="100%" />
        <TextInput label="Student's first name" value={f.studentName} onChange={v => setF({...f, studentName: v})} width="100%" />
        <TextInput label="Class or level" value={f.grade} onChange={v => setF({...f, grade: v})} placeholder="Class 10" width="100%" />
        <Card variant="muted">
          <VStack gap={3}>
            <Text type="supporting">
              We keep only these details to arrange the demo and follow up on your enquiry. We do not collect the child&apos;s phone, address or date of birth, and we never show ads or track browsing. Notice {NOTICE_VERSION}.
            </Text>
            <CheckboxInput label="I am the student's parent or legal guardian" isRequired value={isGuardian} onChange={setIsGuardian} />
            <CheckboxInput label="Send me WhatsApp updates about this enquiry and demo class" isOptional value={updates} onChange={setUpdates} />
            <CheckboxInput label="Send me offers and admission news" isOptional value={marketing} onChange={setMarketing} />
          </VStack>
        </Card>
        {error && <Banner status="error" title={error} />}
        <Button label={slotId ? 'Book demo class' : 'Send enquiry'} variant="primary" size="lg" width="100%" isLoading={busy} isDisabled={!isGuardian} onClick={submit} />
      </VStack>
    </PublicShell>
  );
}
