'use client';

import {useState} from 'react';
import {VStack} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Link} from '@astryxdesign/core/Link';
import {Selector} from '@astryxdesign/core/Selector';
import {Table, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {formatINR, formatInstant, formatPhone} from '@/domain';
import {PageHeader} from '../ui';

type M = {id: string; template: string; category: string; to: string; body: string; cost: number; at: number};

/** Links inside simulated messages, made clickable so the demo flows through (consent, parent page, receipts). */
function Body({text}: {text: string}) {
  const parts = text.split(/(https?:\/\/\S+|\/(?:consent|p|receipt)\/[\w-]+)/g);
  return (
    <Text type="supporting">
      {parts.map((p, i) => (/^(https?:\/\/|\/)/.test(p) ? <Link key={i} href={p.replace(/[.,]$/, '')} target="_blank">{p}</Link> : p))}
    </Text>
  );
}

export function Outbox({rows}: {rows: M[]}) {
  const [t, setT] = useState<string>('all');
  const templates = [...new Set(rows.map(r => r.template))];
  const shown = t === 'all' ? rows : rows.filter(r => r.template === t);
  const cols: TableColumn<M>[] = [
    {key: 'at', header: 'When', width: proportional(2), renderCell: r => <Text type="supporting">{formatInstant(r.at)}</Text>},
    {key: 'to', header: 'To', width: proportional(2), renderCell: r => <Text type="supporting">{formatPhone(r.to)}</Text>},
    {key: 'template', header: 'Template', width: proportional(2), renderCell: r => <VStack gap={0.5}><Text type="supporting">{r.template.replace(/_/g, ' ')}</Text><Badge label={r.category} variant={r.category === 'marketing' ? 'purple' : 'neutral'} /></VStack>},
    {key: 'body', header: 'Message', width: proportional(7), renderCell: r => <Body text={r.body} />},
    {key: 'cost', header: 'Cost', width: proportional(1), align: 'end', renderCell: r => <Text type="supporting">{formatINR(r.cost)}</Text>},
  ];
  return (
    <VStack gap={6}>
      <PageHeader title="WhatsApp outbox" description="Every message ClassNest would send. The simulated adapter records them here instead of calling WhatsApp." />
      <Banner status="info" title="Simulated messaging" description="No message leaves this app. Costs are estimates of WhatsApp utility (₹0.13) and marketing (₹0.88) template rates." />
      <Selector label="Template" options={[{value: 'all', label: 'All templates'}, ...templates.map(x => ({value: x, label: x.replace(/_/g, ' ')}))]} value={t} onChange={v => setT(v ?? 'all')} />
      <Table data={shown} columns={cols} idKey="id" density="compact" verticalAlign="top" emptyState={<Text color="secondary">No messages yet.</Text>} />
    </VStack>
  );
}
