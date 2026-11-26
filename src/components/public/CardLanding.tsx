'use client';

import {useState} from 'react';
import {VStack} from '@astryxdesign/core/Layout';
import {Card} from '@astryxdesign/core/Card';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {post} from '@/lib/api';
import {PublicShell} from './PublicShell';

export function CardLanding({code, isStaff}: {code: string; isStaff: boolean}) {
  const [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <PublicShell org="ClassNest">
      <VStack gap={4}>
        <Heading level={1}>Student ID card</Heading>
        <Card>
          <VStack gap={3}>
            <Text>Card code <Text type="code">{code}</Text></Text>
            {isStaff ? (
              <Button
                label="Mark present"
                variant="primary"
                size="lg"
                isLoading={busy}
                width="100%"
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await post<{student: string; batch: string; alreadyMarked: boolean}>('/api/staff/scan', {code});
                    setMsg({ok: true, text: `${r.student} ${r.alreadyMarked ? 'was already marked' : 'marked present'} for ${r.batch}`});
                  } catch (e) {
                    setMsg({ok: false, text: (e as Error).message});
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ) : (
              <Text color="secondary">This card is scanned by staff at the entrance. Students can also scan the entrance QR and type this code.</Text>
            )}
          </VStack>
        </Card>
        {msg && <Banner status={msg.ok ? 'success' : 'error'} title={msg.text} />}
      </VStack>
    </PublicShell>
  );
}
