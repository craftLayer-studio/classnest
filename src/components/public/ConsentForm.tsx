'use client';

import {useState} from 'react';
import {VStack} from '@astryxdesign/core/Layout';
import {Card} from '@astryxdesign/core/Card';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {List, ListItem} from '@astryxdesign/core/List';
import {NOTICE_VERSION, PURPOSE_LABEL} from '@/domain';
import {post} from '@/lib/api';
import {PublicShell} from './PublicShell';

/**
 * Verifiable parental consent (DPDP Rules 2025): the link goes only to the guardian's WhatsApp number,
 * so opening it proves possession of that phone. Each purpose is a separate, unticked choice.
 */
export function ConsentForm({token, org, city, isDemo, student, grade, guardian, completed}: {token: string; org: string; city: string; isDemo: boolean; student: string; grade: string; guardian: string; completed: boolean}) {
  const [c, setC] = useState({child_data: false, service_updates: false, marketing: false});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<boolean | null>(completed ? true : null);

  if (done !== null) {
    return (
      <PublicShell org={org} isDemo={isDemo}>
        <VStack gap={4}>
          <Heading level={1}>Thank you</Heading>
          <Banner status={done ? 'success' : 'info'} title={done ? `Your choices are saved. ${student} is now enrolled.` : 'Your choices are saved.'} description={done ? 'You can change them any time from the link in your fee and report-card messages.' : `Without permission to keep ${student}'s class record, the institute cannot enrol them and will delete the record.`} />
        </VStack>
      </PublicShell>
    );
  }

  return (
    <PublicShell org={org} isDemo={isDemo}>
      <VStack gap={5}>
        <VStack gap={1}>
          <Heading level={1}>Consent for {student}</Heading>
          <Text color="secondary">Namaste {guardian}. {org}, {city}, has added {student} ({grade}). As the parent or guardian of a child under 18, please tell us what we may do.</Text>
        </VStack>
        <Card variant="muted">
          <VStack gap={2}>
            <Heading level={2}>What we keep</Heading>
            <List listStyle="disc" density="compact">
              <ListItem label="Name, class and batch" />
              <ListItem label="Attendance, test marks and fee payments" />
              <ListItem label="Your name and WhatsApp number" />
            </List>
            <Text type="supporting">We do not collect your child&apos;s phone, address, photo or date of birth. No ads, no behavioural tracking, and we never message your child. Data is kept while your child studies here and deleted on request. Notice {NOTICE_VERSION}.</Text>
          </VStack>
        </Card>
        <VStack gap={3}>
          <CheckboxInput label={PURPOSE_LABEL.child_data} description="Needed to enrol your child" value={c.child_data} onChange={v => setC({...c, child_data: v})} />
          <CheckboxInput label={PURPOSE_LABEL.service_updates} description="Includes absence alerts" value={c.service_updates} onChange={v => setC({...c, service_updates: v})} />
          <CheckboxInput label={PURPOSE_LABEL.marketing} value={c.marketing} onChange={v => setC({...c, marketing: v})} />
        </VStack>
        {error && <Banner status="error" title={error} />}
        <Button
          label="Save my choices"
          variant="primary"
          size="lg"
          width="100%"
          isLoading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const r = await post<{activated: boolean}>('/api/public/consent', {token, ...c});
              setDone(r.activated);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </VStack>
    </PublicShell>
  );
}
