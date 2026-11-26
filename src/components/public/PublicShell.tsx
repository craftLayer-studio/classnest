'use client';

import type {ReactNode} from 'react';
import {Layout, LayoutContent, LayoutHeader, LayoutFooter, VStack, HStack} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {Icon} from '@astryxdesign/core/Icon';
import {AcademicCapIcon} from '@heroicons/react/24/outline';

/** Mobile-first frame for pages opened from a QR code or WhatsApp link. No login, no tracking. */
export function PublicShell({org, isDemo, children}: {org: string; isDemo?: boolean; children: ReactNode}) {
  return (
    <Layout
      height="auto"
      contentWidth={560}
      header={
        <LayoutHeader>
          <HStack gap={2} vAlign="center" hAlign="between" paddingBlock={3} paddingInline={4}>
            <HStack gap={2} vAlign="center">
              <Icon icon={AcademicCapIcon} size="md" />
              <Text weight="bold">{org}</Text>
            </HStack>
            {isDemo && <Badge label="Demo" variant="warning" />}
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent role="main" padding={4}>
          {children}
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <VStack gap={1} paddingBlock={4} paddingInline={4}>
            <Text type="supporting" color="secondary">
              Powered by ClassNest · No ads, no tracking · Your data is used only to run classes.
            </Text>
          </VStack>
        </LayoutFooter>
      }
    />
  );
}
