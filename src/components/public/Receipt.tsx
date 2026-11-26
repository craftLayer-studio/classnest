'use client';

import {VStack} from '@astryxdesign/core/Layout';
import {Card} from '@astryxdesign/core/Card';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {formatINR, formatInstant, GST_RATE_PERCENT} from '@/domain';
import {PublicShell} from './PublicShell';

export function Receipt({org, receipt, student, grade, guardian, split}: {org: {name: string; city: string; gstin: string | null; isDemo: boolean}; receipt: {no: string; at: number; amount: number; mode: string; reference: string | null}; student: string; grade: string; guardian: string; split: {taxable: number; cgst: number; sgst: number} | null}) {
  return (
    <PublicShell org={org.name} isDemo={org.isDemo}>
      <VStack gap={4}>
        <Heading level={1}>Fee receipt</Heading>
        <Card>
          <MetadataList>
            <MetadataListItem label="Receipt no.">{receipt.no}</MetadataListItem>
            <MetadataListItem label="Date">{formatInstant(receipt.at)}</MetadataListItem>
            <MetadataListItem label="Received from">{guardian}</MetadataListItem>
            <MetadataListItem label="For">{`${student} (${grade})`}</MetadataListItem>
            <MetadataListItem label="Mode">{`${receipt.mode.toUpperCase()}${receipt.reference ? ` · ${receipt.reference}` : ''}`}</MetadataListItem>
            {split && <MetadataListItem label="Taxable value">{formatINR(split.taxable)}</MetadataListItem>}
            {split && <MetadataListItem label={`CGST ${GST_RATE_PERCENT / 2}%`}>{formatINR(split.cgst)}</MetadataListItem>}
            {split && <MetadataListItem label={`SGST ${GST_RATE_PERCENT / 2}%`}>{formatINR(split.sgst)}</MetadataListItem>}
            <MetadataListItem label="Total received">{formatINR(receipt.amount)}</MetadataListItem>
            {org.gstin && <MetadataListItem label="GSTIN">{org.gstin}</MetadataListItem>}
          </MetadataList>
        </Card>
        <Text type="supporting" color="secondary">{org.name}, {org.city}. Computer-generated receipt; no signature needed.{org.isDemo ? ' Demo receipt: not a real payment.' : ''}</Text>
        <Button label="Print or save as PDF" onClick={() => window.print()} />
      </VStack>
    </PublicShell>
  );
}
