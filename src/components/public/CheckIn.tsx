'use client';

import {useEffect, useState} from 'react';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Card} from '@astryxdesign/core/Card';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {formatClock} from '@/domain';
import {post} from '@/lib/api';
import {PublicShell} from './PublicShell';

const KEY = 'classnest.card';

/**
 * Entrance QR: the student scans with their own phone and taps "I'm here". The card code can be remembered
 * on this phone (stored only in this browser, never sent anywhere else). Shared phones should untick it.
 */
export function CheckIn({token, org, isDemo}: {token: string; org: string; isDemo: boolean}) {
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{student: string; batch: string; startMin: number; alreadyMarked: boolean; relaxed: boolean} | null>(null);

  useEffect(() => {
    try {
      const s = window.localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from browser storage after mount
      if (s) setSaved(s);
    } catch {}
  }, []);

  async function checkIn(c: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await post<NonNullable<typeof done>>('/api/public/checkin', {token, code: c});
      setDone(r);
      try {
        if (remember) window.localStorage.setItem(KEY, c.toUpperCase());
      } catch {}
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell org={org} isDemo={isDemo}>
      <VStack gap={4}>
        <Heading level={1}>Mark attendance</Heading>
        {done ? (
          <Card>
            <VStack gap={2}>
              <Heading level={2}>{done.alreadyMarked ? 'Already marked' : 'You are marked present'}</Heading>
              <Text>{done.student} · {done.batch} ({formatClock(done.startMin)})</Text>
              {done.relaxed && <Text type="supporting" color="secondary">Demo: matched the nearest batch that meets today.</Text>}
              <HStack>
                <Button label="Done" onClick={() => setDone(null)} />
              </HStack>
            </VStack>
          </Card>
        ) : saved ? (
          <Card>
            <VStack gap={3}>
              <Text>Card {saved} is saved on this phone.</Text>
              <Button label="I'm here" variant="primary" size="lg" isLoading={busy} onClick={() => checkIn(saved)} width="100%" />
              <Button
                label="Use a different card"
                variant="ghost"
                onClick={() => {
                  try {
                    window.localStorage.removeItem(KEY);
                  } catch {}
                  setSaved(null);
                }}
              />
            </VStack>
          </Card>
        ) : (
          <Card>
            <VStack gap={3}>
              <TextInput label="Your card code" description="Printed under the QR on your ID card" value={code} onChange={v => setCode(v.toUpperCase())} autoCapitalize="characters" size="lg" width="100%" onEnter={() => code && checkIn(code)} />
              <CheckboxInput label="Remember my card on this phone" description="Untick on a shared phone" value={remember} onChange={setRemember} />
              <Button label="I'm here" variant="primary" size="lg" isLoading={busy} isDisabled={code.length < 4} onClick={() => checkIn(code)} width="100%" />
              {isDemo && <Text type="supporting" color="secondary">Demo: try card code AARAV001.</Text>}
            </VStack>
          </Card>
        )}
        {error && <Banner status="error" title={error} />}
        <Text type="supporting" color="secondary">If you are not marked within 15 minutes of class start, your parent gets an absence message.</Text>
      </VStack>
    </PublicShell>
  );
}
