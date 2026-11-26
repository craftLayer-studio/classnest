'use client';

import {Center} from '@astryxdesign/core/Center';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Button} from '@astryxdesign/core/Button';

export function NotFound() {
  return (
    <Center role="main" axis="both" padding={6} height="100dvh">
      <EmptyState title="This link is not valid" description="The QR code or link may be old. Ask the institute for a new one." actions={<Button label="Go to ClassNest" href="/" />} headingLevel={1} />
    </Center>
  );
}
