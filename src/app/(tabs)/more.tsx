import React from 'react';

import { Badge, Card, Divider, Eyebrow, MenuRow, ProBadge, Screen, Stack, TabHeader } from '@/components';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useExpiringDocuments } from '@/features/records/useRecordQueries';
import { useRouter } from 'expo-router';

/**
 * More — the design's three grouped menus.
 *
 * Every badge on this screen is live: the maintenance count and the document
 * warning come from the same calculations the destination screens use, so they
 * can never disagree with what the rider finds when they tap through.
 */
export default function MoreTab() {
  const router = useRouter();
  const { isPro } = useGarage();
  const { analytics } = useGarageData();
  const expiring = useExpiringDocuments();

  const dueCount = analytics
    ? analytics.maintenance.counts.overdue + analytics.maintenance.counts.due_soon
    : 0;

  return (
    <Screen variant="tab" testID="screen-more">
      <TabHeader title="More" />

      <Stack>
        <Card variant="list">
          <Eyebrow>CAPTURE &amp; LOG</Eyebrow>
          <MenuRow label="Fast Capture" onPress={() => router.push('/capture')} testID="row-capture" />
          <Divider />
          <MenuRow
            label="Maintenance"
            onPress={() => router.push('/maintenance')}
            right={dueCount > 0 ? <Badge label={`${dueCount} DUE`} tone="warn" /> : undefined}
            testID="row-maintenance"
          />
          <Divider />
          <MenuRow label="Service plan" onPress={() => router.push('/maintenance/plan')} testID="row-service-plan" />
          <Divider />
          <MenuRow label="Service history" onPress={() => router.push('/services')} testID="row-services" />
          <Divider />
          <MenuRow
            label="Workshop records"
            onPress={() => router.push('/services/workshop')}
            testID="row-workshop"
          />
        </Card>

        <Card variant="list">
          <Eyebrow>OWNERSHIP</Eyebrow>
          <MenuRow label="Parts &amp; accessories" onPress={() => router.push('/parts')} testID="row-parts" />
          <Divider />
          <MenuRow
            label="Safety &amp; condition"
            onPress={() => router.push('/records/safety')}
            testID="row-safety"
          />
          <Divider />
          <MenuRow
            label="Document vault"
            onPress={() => router.push('/records/vault')}
            right={
              expiring.expiredCount > 0 ? (
                <Badge label={`${expiring.expiredCount} EXPIRED`} tone="bad" />
              ) : expiring.expiringCount > 0 ? (
                <Badge label={`${expiring.expiringCount} EXPIRING`} tone="warn" />
              ) : undefined
            }
            testID="row-vault"
          />
          <Divider />
          <MenuRow
            label="Warranties"
            onPress={() => router.push('/records/warranties')}
            testID="row-warranties"
          />
          <Divider />
          <MenuRow
            label="Proof pack · resale report"
            onPress={() => router.push('/records/proof-pack')}
            testID="row-proof"
          />
        </Card>

        <Card variant="list">
          <Eyebrow>INSIGHTS &amp; APP</Eyebrow>
          <MenuRow label="Analytics" onPress={() => router.push('/analytics')} testID="row-analytics" />
          <Divider />
          <MenuRow
            label="Notifications"
            onPress={() => router.push('/notifications')}
            testID="row-notifications"
          />
          <Divider />
          <MenuRow
            label="Assistant"
            badge={isPro ? undefined : <ProBadge />}
            onPress={() => router.push('/assistant')}
            testID="row-assistant"
          />
          <Divider />
          <MenuRow label="Settings" onPress={() => router.push('/settings')} testID="row-settings" />
          <Divider />
          <MenuRow
            label="Free / Pro"
            onPress={() => router.push('/plan')}
            right={<Badge label={isPro ? 'PRO' : 'FREE PLAN'} tone={isPro ? 'accent' : 'neutral'} />}
            testID="row-plan"
          />
        </Card>
      </Stack>
    </Screen>
  );
}
