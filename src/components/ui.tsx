'use client';

import {useState, type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
import {Button} from '@astryxdesign/core/Button';
import {Badge} from '@astryxdesign/core/Badge';
import {useToast} from '@astryxdesign/core/Toast';
import {post} from '@/lib/api';

export function PageHeader({title, description, actions}: {title: string; description?: ReactNode; actions?: ReactNode}) {
  return (
    <HStack hAlign="between" vAlign="center" gap={4} wrap="wrap">
      <VStack gap={1}>
        <Heading level={1}>{title}</Heading>
        {description && (
          <Text type="body" color="secondary">
            {description}
          </Text>
        )}
      </VStack>
      {actions && (
        <HStack gap={2} wrap="wrap">
          {actions}
        </HStack>
      )}
    </HStack>
  );
}

export function StatTile({label, value, sub}: {label: string; value: string; sub?: string}) {
  return (
    <Card>
      <VStack gap={1}>
        <Text type="label" color="secondary">
          {label}
        </Text>
        <Heading level={2} accessibilityLevel={3}>
          {value}
        </Heading>
        {sub && <Text type="supporting" color="secondary">{sub}</Text>}
      </VStack>
    </Card>
  );
}

export function SectionCard({title, actions, children}: {title: string; actions?: ReactNode; children: ReactNode}) {
  return (
    <Card>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
          <Heading level={3} accessibilityLevel={2}>
            {title}
          </Heading>
          {actions}
        </HStack>
        {children}
      </VStack>
    </Card>
  );
}

/** Button that POSTs to a staff action, shows a toast with the result, and refreshes server data. */
export function ActionButton({
  label,
  action,
  body = {},
  variant = 'secondary',
  size = 'md',
  done,
  confirmText,
}: {
  label: string;
  action: string;
  body?: Record<string, unknown>;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  done?: (result: Record<string, unknown>) => string;
  confirmText?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  return (
    <Button
      label={label}
      variant={variant}
      size={size}
      clickAction={async () => {
        if (confirmText && !window.confirm(confirmText)) return;
        try {
          const r = await post(`/api/staff/${action}`, body);
          toast({body: done ? done(r) : 'Done'});
          router.refresh();
        } catch (e) {
          toast({body: (e as Error).message, type: 'error'});
        }
      }}
    />
  );
}

/** Hook for forms: submit a staff action with busy and error state. */
export function useAction() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: string, body: Record<string, unknown>, ok?: (r: Record<string, unknown>) => string | void) {
    setBusy(true);
    setError(null);
    try {
      const r = await post(`/api/staff/${action}`, body);
      const msg = ok?.(r);
      if (msg) toast({body: msg});
      router.refresh();
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return {run, busy, error, setError};
}

export function DemoBadge() {
  return <Badge label="Demo" variant="warning" />;
}

export const CONSENT_BADGE = (ok: boolean, yes = 'Opted in', no = 'Not opted in') => <Badge label={ok ? yes : no} variant={ok ? 'success' : 'neutral'} />;
