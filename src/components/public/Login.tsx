'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {VStack} from '@astryxdesign/core/Layout';
import {Center} from '@astryxdesign/core/Center';
import {Heading, Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Icon} from '@astryxdesign/core/Icon';
import {Banner} from '@astryxdesign/core/Banner';
import {Link} from '@astryxdesign/core/Link';
import {List, ListItem} from '@astryxdesign/core/List';
import {AcademicCapIcon} from '@heroicons/react/24/outline';
import {post} from '@/lib/api';

export function Login({prefill, demoUsers}: {prefill: string; demoUsers: {role: string; name: string; phone: string}[]}) {
  const router = useRouter();
  const [phone, setPhone] = useState(prefill);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function requestCode() {
    setBusy(true);
    setError('');
    try {
      const r = await post<{demoCode?: string}>('/api/auth/otp', {phone});
      setSent(true);
      setDemoCode(r.demoCode ?? null);
      if (r.demoCode && /^\d{6}$/.test(r.demoCode)) setCode(r.demoCode);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError('');
    try {
      const r = await post<{next: string}>('/api/auth/verify', {phone, code});
      router.push(r.next);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Center role="main" axis="both" padding={6} height="100dvh">
      <VStack gap={4} hAlign="center" width="100%" maxWidth={420}>
        <VStack gap={2} hAlign="center">
          <Icon icon={AcademicCapIcon} size="lg" />
          <Text weight="bold" size="lg">ClassNest</Text>
        </VStack>
        <Card padding={8} width="100%">
          <VStack gap={4} hAlign="stretch">
            <VStack gap={1} hAlign="center">
              <Heading level={2} accessibilityLevel={1}>Staff sign in</Heading>
              <Text color="secondary" size="sm">Owner, front desk and teachers sign in with phone and OTP</Text>
            </VStack>
            {error && <Banner status="error" title={error} />}
            <TextInput label="Mobile number" type="tel" inputMode="tel" value={phone} onChange={setPhone} placeholder="98260 11111" size="lg" isDisabled={sent} onEnter={requestCode} />
            {sent && (
              <>
                {demoCode && <Banner status="warning" title={`Demo OTP: ${demoCode}`} description="Shown on screen in demo mode only. A live deployment sends it by SMS." />}
                <TextInput label="6-digit code" inputMode="numeric" value={code} onChange={setCode} size="lg" autoComplete="one-time-code" onEnter={verify} />
              </>
            )}
            {sent ? (
              <VStack gap={2}>
                <Button label="Sign in" variant="primary" size="lg" isLoading={busy} onClick={verify} />
                <Button label="Use another number" variant="ghost" onClick={() => { setSent(false); setCode(''); setDemoCode(null); }} />
              </VStack>
            ) : (
              <Button label="Send code" variant="primary" size="lg" isLoading={busy} onClick={requestCode} />
            )}
          </VStack>
        </Card>
        <Card width="100%" variant="muted">
          <VStack gap={2}>
            <Text weight="semibold">Demo accounts (Shikhar Demo Academy)</Text>
            <List density="compact">
              {demoUsers.map(u => (
                <ListItem key={u.role} label={`${u.role}: ${u.name}`} description={u.phone} onClick={() => { setPhone(u.phone.replace('+91 ', '')); setSent(false); }} />
              ))}
            </List>
          </VStack>
        </Card>
        <Link href="/">Back to ClassNest</Link>
      </VStack>
    </Center>
  );
}
