'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Grid} from '@astryxdesign/core/Grid';
import {Text} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {RadioList, RadioListItem} from '@astryxdesign/core/RadioList';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {formatPhone} from '@/domain';
import {post} from '@/lib/api';
import {PageHeader, SectionCard, useAction} from '../ui';

type Org = {name: string; city: string; upiVpa: string; upiPayee: string; gstin: string; alertMode: string; graceDays: number; lateFee: number; isDemo: boolean};
type S = {id: string; name: string; phone: string; role: string};

export function Settings({org, staff}: {org: Org; staff: S[]}) {
  const [f, setF] = useState(org);
  const {run, busy, error} = useAction();
  const router = useRouter();
  const cols: TableColumn<S>[] = [
    {key: 'name', header: 'Name', width: proportional(3)},
    {key: 'phone', header: 'Phone (sign-in)', width: proportional(3), renderCell: r => formatPhone(r.phone)},
    {key: 'role', header: 'Role', width: proportional(2), renderCell: r => <Badge label={r.role} variant={r.role === 'owner' ? 'info' : 'neutral'} />},
  ];
  return (
    <VStack gap={6}>
      <PageHeader title="Settings" description={`${org.name}, ${org.city}`} actions={<Button label="Printable QR sheet" href="/app/qr" />} />
      <SectionCard title="Institute and payments">
        <VStack gap={3}>
          <Grid columns={{minWidth: 220, max: 2, repeat: 'fit'}} gap={3}>
            <TextInput label="Institute name" value={f.name} onChange={v => setF({...f, name: v})} width="100%" />
            <TextInput label="GSTIN" isOptional description="Receipts show CGST and SGST when set" value={f.gstin} onChange={v => setF({...f, gstin: v.toUpperCase()})} width="100%" />
            <TextInput label="UPI ID for fees" value={f.upiVpa} onChange={v => setF({...f, upiVpa: v})} placeholder="name@bank" width="100%" />
            <TextInput label="UPI payee name" value={f.upiPayee} onChange={v => setF({...f, upiPayee: v})} width="100%" />
            <NumberInput label="Grace period" units="days" description="Overdue beyond this = defaulter" value={f.graceDays} onChange={v => setF({...f, graceDays: v ?? 0})} min={0} max={60} isIntegerOnly width="100%" />
            <NumberInput label="Late fee (flat, once)" units="₹" value={f.lateFee} onChange={v => setF({...f, lateFee: v ?? 0})} min={0} max={10000} width="100%" />
          </Grid>
          <RadioList label="Parent attendance alerts" value={f.alertMode} onChange={v => setF({...f, alertMode: v})}>
            <RadioListItem value="absence_only" label="Absence only (recommended)" description="One WhatsApp alert when a child misses class. Keeps message costs low." />
            <RadioListItem value="all" label="Absence and arrival (add-on)" description="Also tells parents when their child reaches class. About 20x more messages." />
          </RadioList>
          {error && <Banner status="error" title={error} />}
          <HStack>
            <Button label="Save settings" variant="primary" isLoading={busy} onClick={() => run('settings', {name: f.name, gstin: f.gstin, upiVpa: f.upiVpa, upiPayee: f.upiPayee, graceDays: f.graceDays, lateFee: f.lateFee, alertMode: f.alertMode}, () => 'Settings saved')} />
          </HStack>
        </VStack>
      </SectionCard>
      <SectionCard title="Staff">
        <Table data={staff} columns={cols} idKey="id" density="compact" />
      </SectionCard>
      <SectionCard title="Children's data (DPDP Act 2023 and Rules 2025)">
        <VStack gap={2}>
          <Text>Students are treated as minors by default. A parent or guardian gives consent from their own phone before the student is active. Records hold only name, class, batches, attendance, marks and fees. No date of birth, address, photo or student phone.</Text>
          <Text>No ads, no behavioural tracking, and no marketing to students. Offers go only to parents who opted in. Parents can change their choices on their parent page at any time; the owner can erase a student record from the student page.</Text>
        </VStack>
      </SectionCard>
      {org.isDemo && (
        <SectionCard title="Demo">
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Text color="secondary">Reset the demo institute to fresh sample data. You stay signed in.</Text>
            <Button
              label="Reset demo data"
              variant="destructive"
              clickAction={async () => {
                if (!window.confirm('Reset all demo data?')) return;
                await post('/api/staff/reset-demo');
                router.refresh();
              }}
            />
          </HStack>
        </SectionCard>
      )}
    </VStack>
  );
}
