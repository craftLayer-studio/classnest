'use client';

import type {ReactNode} from 'react';
import {usePathname, useRouter} from 'next/navigation';
import {AppShell} from '@astryxdesign/core/AppShell';
import {SideNav, SideNavHeading, SideNavItem, SideNavSection} from '@astryxdesign/core/SideNav';
import {NavIcon} from '@astryxdesign/core/NavIcon';
import {Icon} from '@astryxdesign/core/Icon';
import {Badge} from '@astryxdesign/core/Badge';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {
  AcademicCapIcon,
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon,
  Cog6ToothIcon,
  DocumentChartBarIcon,
  FunnelIcon,
  QrCodeIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import {post} from '@/lib/api';

type Role = 'owner' | 'staff' | 'teacher';

const NAV: {href: string; label: string; icon: typeof ChartBarIcon; roles: Role[]}[] = [
  {href: '/app', label: 'Dashboard', icon: ChartBarIcon, roles: ['owner']},
  {href: '/app/attendance', label: 'Attendance', icon: ClipboardDocumentCheckIcon, roles: ['owner', 'staff', 'teacher']},
  {href: '/app/students', label: 'Students', icon: UserGroupIcon, roles: ['owner', 'staff']},
  {href: '/app/batches', label: 'Batches & timetable', icon: CalendarDaysIcon, roles: ['owner', 'staff', 'teacher']},
  {href: '/app/fees', label: 'Fees & defaulters', icon: BanknotesIcon, roles: ['owner', 'staff']},
  {href: '/app/tests', label: 'Tests & marks', icon: DocumentChartBarIcon, roles: ['owner', 'staff', 'teacher']},
  {href: '/app/enquiries', label: 'Enquiries', icon: FunnelIcon, roles: ['owner', 'staff']},
  {href: '/app/messages', label: 'WhatsApp outbox', icon: ChatBubbleLeftRightIcon, roles: ['owner', 'staff']},
];

const OWNER_NAV = [
  {href: '/app/qr', label: 'QR sheet', icon: QrCodeIcon},
  {href: '/app/settings', label: 'Settings', icon: Cog6ToothIcon},
];

export function StaffShell({children, org, user, role, isDemo}: {children: ReactNode; org: string; user: string; role: Role; isDemo: boolean}) {
  const path = usePathname();
  const router = useRouter();
  const selected = (href: string) => (href === '/app' ? path === '/app' : path.startsWith(href));

  return (
    <AppShell
      contentPadding={0}
      sideNav={
        <SideNav
          collapsible
          header={
            <SideNavHeading
              heading={org}
              icon={<NavIcon icon={<Icon icon={AcademicCapIcon} size="sm" />} />}
              headingHref={role === 'owner' ? '/app' : '/app/attendance'}
            />
          }
          footer={
            <SideNavSection title="Account" isHeaderHidden>
              {role === 'owner' && OWNER_NAV.map(n => <SideNavItem key={n.href} label={n.label} icon={n.icon} href={n.href} isSelected={selected(n.href)} />)}
              <SideNavItem
                label={`Sign out ${user}`}
                icon={ArrowRightOnRectangleIcon}
                onClick={async () => {
                  await post('/api/auth/logout');
                  router.push('/login');
                }}
              />
            </SideNavSection>
          }>
          <SideNavSection title="Menu" isHeaderHidden>
            {NAV.filter(n => n.roles.includes(role)).map(n => (
              <SideNavItem key={n.href} label={n.label} icon={n.icon} href={n.href} isSelected={selected(n.href)} />
            ))}
          </SideNavSection>
          {isDemo && (
            <SideNavSection title="Demo" isHeaderHidden>
              <SideNavItem label="Demo data" endContent={<Badge label="Demo" variant="warning" />} href="/" />
            </SideNavSection>
          )}
        </SideNav>
      }>
      <Layout height="auto" contentWidth={1200} content={<LayoutContent role="main" padding={6}>{children}</LayoutContent>} />
    </AppShell>
  );
}
