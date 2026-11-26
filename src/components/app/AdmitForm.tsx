'use client';

import {useState} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {Grid} from '@astryxdesign/core/Grid';
import {useAction} from '../ui';
import {iso} from '@/lib/dates';

export interface BatchOption {
  id: string;
  name: string;
  courseName: string;
  enrolled: number;
  capacity: number;
}

/**
 * Admission form with minimal fields only: no date of birth, address, photo or student phone.
 * The guardian's phone is the contact; they receive a WhatsApp consent link before anything else is sent.
 */
export function AdmitForm({batches, today, onDone, enquiry}: {batches: BatchOption[]; today: string; onDone?: () => void; enquiry?: {id: string; studentName: string; guardianName: string; phone: string; grade: string}}) {
  const [name, setName] = useState(enquiry?.studentName ?? '');
  const [grade, setGrade] = useState(enquiry?.grade ?? '');
  const [guardianName, setGuardianName] = useState(enquiry?.guardianName ?? '');
  const [phone, setPhone] = useState(enquiry?.phone ?? '');
  const [relation, setRelation] = useState('Parent');
  const [picked, setPicked] = useState<string[]>([]);
  const [discount, setDiscount] = useState(0);
  const [firstDue, setFirstDue] = useState(today);
  const [isMinor, setIsMinor] = useState(true);
  const {run, busy, error} = useAction();

  async function submit() {
    const body = {name, grade, guardianName, guardianPhone: phone, relation, batchIds: picked, discount, firstDue, isMinor};
    const r = enquiry
      ? await run('admit-enquiry', {enquiryId: enquiry.id, batchIds: picked, discount, firstDue}, () => 'Admitted. Consent link sent to the guardian.')
      : await run('admit', body, () => 'Student added. Consent link sent to the guardian on WhatsApp.');
    if (r) onDone?.();
  }

  return (
    <VStack gap={4}>
      {!enquiry && (
        <Grid columns={{minWidth: 220, max: 2, repeat: 'fit'}} gap={3}>
          <TextInput label="Student name" value={name} onChange={setName} isRequired width="100%" />
          <TextInput label="Class or level" value={grade} onChange={setGrade} placeholder="Class 10, Grade 2 vocal" isRequired width="100%" />
          <TextInput label="Parent or guardian name" value={guardianName} onChange={setGuardianName} isRequired width="100%" />
          <TextInput label="Guardian's WhatsApp number" type="tel" inputMode="tel" value={phone} onChange={setPhone} placeholder="98260 12345" isRequired width="100%" />
          <TextInput label="Relation" value={relation} onChange={setRelation} width="100%" />
          <CheckboxInput label="Student is under 18" description="Default. Consent comes from the guardian, and the student is never messaged or shown ads." value={isMinor} onChange={setIsMinor} />
        </Grid>
      )}
      <VStack gap={2}>
        <Text type="label">Batches</Text>
        {batches.map(b => (
          <CheckboxInput
            key={b.id}
            label={`${b.name} (${b.courseName})`}
            description={`${b.enrolled} of ${b.capacity} seats taken`}
            value={picked.includes(b.id)}
            isDisabled={b.enrolled >= b.capacity}
            onChange={v => setPicked(p => (v ? [...p, b.id] : p.filter(x => x !== b.id)))}
          />
        ))}
      </VStack>
      <Grid columns={{minWidth: 220, max: 2, repeat: 'fit'}} gap={3}>
        <NumberInput label="Discount" units="₹" value={discount} onChange={v => setDiscount(v ?? 0)} min={0} width="100%" />
        <DateInput label="First instalment due" value={iso(firstDue)} onChange={v => setFirstDue(v ?? today)} width="100%" />
      </Grid>
      <Text type="supporting" color="secondary">
        Instalments follow each course&apos;s fee plan, a month apart. The guardian gets a WhatsApp link to review what we keep and give consent; the student becomes active once they agree.
      </Text>
      {error && <Banner status="error" title={error} />}
      <HStack gap={2}>
        <Button label={enquiry ? 'Admit and send consent link' : 'Add student and send consent link'} variant="primary" isLoading={busy} onClick={submit} isDisabled={picked.length === 0} />
      </HStack>
    </VStack>
  );
}
