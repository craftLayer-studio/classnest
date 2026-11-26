'use client';

import {Layout, LayoutContent, LayoutHeader, LayoutFooter, VStack, HStack} from '@astryxdesign/core/Layout';
import {Grid} from '@astryxdesign/core/Grid';
import {Card} from '@astryxdesign/core/Card';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Button} from '@astryxdesign/core/Button';
import {Badge} from '@astryxdesign/core/Badge';
import {Link} from '@astryxdesign/core/Link';
import {Icon} from '@astryxdesign/core/Icon';
import {Section} from '@astryxdesign/core/Section';
import {List, ListItem} from '@astryxdesign/core/List';
import {AcademicCapIcon, ArrowRightIcon} from '@heroicons/react/24/outline';

const FEATURES = [
  {title: 'QR attendance at the door', body: 'Students scan the entrance QR, or staff scan the ID card. 15 minutes after class starts, parents of absent children get one WhatsApp alert.'},
  {title: 'Fees that collect themselves', body: 'Instalment plans, UPI pay links, reminders at D-3, D0, D+3 and D+7, GST receipts and a defaulter list with one-tap reminders.'},
  {title: 'Admissions from posters', body: 'The same QR on flyers opens a demo-class booking page. Leads flow through New, Demo, Fee discussed, Admitted, and convert in one tap.'},
  {title: 'Tests and report cards', body: 'Enter marks, get ranks and class averages, and send each parent a report-card link with attendance and fee status.'},
  {title: 'Batches and timetable', body: 'Rooms, teachers and days, with clash detection before you double-book a room or a teacher.'},
  {title: 'Owner dashboard', body: 'Attendance %, fees collected vs due, enquiry conversion and what your WhatsApp follow-ups achieved.'},
];

export function Landing({entrance, poster, parent, consent}: {entrance: string; poster: string; parent: string; consent: string}) {
  return (
    <Layout
      height="auto"
      contentWidth={1100}
      header={
        <LayoutHeader>
          <HStack hAlign="between" vAlign="center" paddingBlock={3} paddingInline={4} gap={3}>
            <HStack gap={2} vAlign="center">
              <Icon icon={AcademicCapIcon} size="md" />
              <Text weight="bold" size="lg">ClassNest</Text>
            </HStack>
            <Button label="Staff sign in" href="/login" variant="secondary" />
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent role="main" padding={6}>
          <VStack gap={10}>
            <VStack gap={5} hAlign="center" paddingBlock={8}>
              <Badge label="For coaching institutes, tuition centres and music & art academies" variant="yellow" />
              <Heading level={1} type="display-2" justify="center" textWrap="balance">Every student marked, every parent informed, every fee collected.</Heading>
              <Text type="large" color="secondary" justify="center" textWrap="balance">ClassNest is the front desk for offline institutes in India. A QR at the door marks attendance and alerts parents on WhatsApp. UPI links and reminders shrink the defaulter list. Poster QRs fill demo classes.</Text>
              <HStack gap={3} wrap="wrap" hAlign="center">
                <Button label="Try the demo" variant="primary" size="lg" href="/login?demo=1" endContent={<Icon icon={ArrowRightIcon} size="sm" color="inherit" />} />
                <Button label="Book a demo class (parent view)" size="lg" href={poster} />
              </HStack>
            </VStack>

            <Grid columns={{minWidth: 280, max: 3, repeat: 'fit'}} gap={4}>
              {FEATURES.map(f => (
                <Card key={f.title}>
                  <VStack gap={2}>
                    <Heading level={3}>{f.title}</Heading>
                    <Text color="secondary">{f.body}</Text>
                  </VStack>
                </Card>
              ))}
            </Grid>

            <Section variant="muted" padding={6}>
              <VStack gap={4}>
                <Heading level={2}>Walk through the demo</Heading>
                <Text color="secondary">Shikhar Demo Academy, Indore, is fictional. Messages and payments are simulated and show up in the WhatsApp outbox.</Text>
                <List listStyle="decimal" hasDividers>
                  <ListItem label={<Link href="/login?demo=1">Sign in as the owner (OTP shown on screen)</Link>} description="See the dashboard, defaulters, enquiries and the printable QR sheet." />
                  <ListItem label={<Link href={entrance}>Scan the entrance QR as a student</Link>} description="Card code AARAV001 marks Aarav present." />
                  <ListItem label={<Link href={poster}>Scan the poster QR as a parent</Link>} description="Book a free demo class; the lead appears in Enquiries." />
                  <ListItem label={<Link href={consent}>Open a guardian consent link</Link>} description="A new admission waiting for parental consent." />
                  <ListItem label={<Link href={parent}>Open a parent&apos;s report card and fee page</Link>} description="Marks, rank, attendance, UPI pay link and consent choices." />
                </List>
              </VStack>
            </Section>

            <Grid columns={{minWidth: 300, max: 2, repeat: 'fit'}} gap={4}>
              <Card>
                <VStack gap={2}>
                  <Heading level={2}>Built for children&apos;s data</Heading>
                  <Text color="secondary">Students are treated as minors by default (DPDP Act 2023, DPDP Rules 2025). Parents give consent from their own phone, with separate unticked choices for class records, WhatsApp updates and offers. We keep minimal fields, never show ads, never track behaviour and never message students. Parents can change choices or ask for deletion any time.</Text>
                </VStack>
              </Card>
              <Card>
                <VStack gap={2}>
                  <Heading level={2}>Simple pricing</Heading>
                  <Text color="secondary">Starter ₹799/month (up to 100 students), Growth ₹1,499/month (300), Pro ₹2,999/month (1,000, multi-branch), billed yearly. Zero platform fee on UPI fee collection. WhatsApp messages beyond the bundle are billed as credits.</Text>
                </VStack>
              </Card>
            </Grid>
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <VStack gap={1} paddingBlock={6} paddingInline={4}>
            <Text type="supporting" color="secondary">
              ClassNest is a <Link href="https://craftlayer.store">CraftLayer Studio</Link> product · <Link href="https://classnest.craftlayer.store">classnest.craftlayer.store</Link>
            </Text>
            <Text type="supporting" color="secondary">
              Support <Link href="mailto:classnest@craftlayer.store">classnest@craftlayer.store</Link> · General <Link href="mailto:hello@craftlayer.store">hello@craftlayer.store</Link> · Commercial licences <Link href="mailto:licensing@craftlayer.store">licensing@craftlayer.store</Link>
            </Text>
            <Text type="supporting" color="secondary">MVP with demo data. Messaging and payments are simulated.</Text>
          </VStack>
        </LayoutFooter>
      }
    />
  );
}
