'use client';

import {VStack, HStack} from '@astryxdesign/core/Layout';
import {Grid} from '@astryxdesign/core/Grid';
import {Card} from '@astryxdesign/core/Card';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {PageHeader} from '../ui';
import {QrImage} from '../QrImage';

function Poster({title, line, url, qr}: {title: string; line: string; url: string; qr: string}) {
  return (
    <Card padding={6}>
      <VStack gap={3} hAlign="center">
        <Heading level={2} justify="center">{title}</Heading>
        <Text justify="center" color="secondary">{line}</Text>
        <VStack width="70%">
          <QrImage src={qr} alt={`QR code: ${title}`} />
        </VStack>
        <Text type="supporting" color="secondary" justify="center" wordBreak="break-all">{url}</Text>
      </VStack>
    </Card>
  );
}

export function QrSheet({org, entrance, poster, cards}: {org: string; entrance: {url: string; qr: string}; poster: {url: string; qr: string}; cards: {id: string; name: string; grade: string; code: string; batches: string; qr: string}[]}) {
  return (
    <VStack gap={6}>
      <HStack>
        <PageHeader title="Printable QR sheet" description="Print the entrance and poster QR codes, and cut out student ID cards." actions={<Button label="Print" variant="primary" onClick={() => window.print()} />} />
      </HStack>
      <Grid columns={{minWidth: 300, max: 2, repeat: 'fit'}} gap={4}>
        <Poster title={`${org}: mark attendance`} line="Students: scan with your phone at the entrance and tap I'm here." url={entrance.url} qr={entrance.qr} />
        <Poster title={`${org}: book a free demo class`} line="Parents: scan to see courses and fees and pick a demo class." url={poster.url} qr={poster.qr} />
      </Grid>
      <Heading level={2}>Student ID cards</Heading>
      <Grid columns={{minWidth: 240, max: 4, repeat: 'fit'}} gap={3}>
        {cards.map(c => (
          <Card key={c.id} padding={3}>
            <HStack gap={3} vAlign="center">
              <VStack width="40%">
                <QrImage src={c.qr} alt={`ID card QR for ${c.name}`} />
              </VStack>
              <VStack gap={0.5}>
                <Text weight="semibold">{c.name}</Text>
                <Text type="supporting">{c.grade}</Text>
                <Text type="code">{c.code}</Text>
                <Text type="supporting" color="secondary">{org}</Text>
              </VStack>
            </HStack>
          </Card>
        ))}
      </Grid>
    </VStack>
  );
}
