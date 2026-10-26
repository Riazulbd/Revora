import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Avatar,
  Badge,
  Card,
  DividedList,
  Eyebrow,
  HeroCard,
  Icon,
  IconSquareButton,
  MenuRow,
  ProBadge,
  Screen,
  TabHeader,
  Txt,
} from '@/components';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useExpiringDocuments } from '@/features/records/useRecordQueries';
import { useTheme } from '@/theme';

/**
 * More (Figma `E1 More — tab`): the plan card, then the design's three grouped
 * menus.
 *
 * Every badge on this screen is live: the maintenance count and the document
 * warning come from the same calculations the destination screens use, so they
 * can never disagree with what the rider finds when they tap through.
 */
export default function MoreTab() {
  const router = useRouter();
  const { c } = useTheme();
  const { profile, activeBike, isPro } = useGarage();
  const { analytics } = useGarageData();
  const expiring = useExpiringDocuments();

  const dueCount = analytics
    ? analytics.maintenance.counts.overdue + analytics.maintenance.counts.due_soon
    : 0;

  const riderName = profile?.displayName?.trim() || 'Rider';
  const bikeLine = activeBike
    ? `${activeBike.nickname} · ${[activeBike.manufacturer, activeBike.model].filter(Boolean).join(' ')}`
    : 'No motorcycle yet';

  return (
    <Screen wash variant="tab" testID="screen-more" contentStyle={{ gap: 16 }}>
      <TabHeader
        title="More"
        action={<IconSquareButton icon="search" accessibilityLabel="Search" onPress={() => router.push('/search')} testID="cta-search" />}
        style={{ marginBottom: 0 }}
      />

      {/* Figma `Plan card — dark accent`. */}
      <HeroCard gap={16} testID="card-plan-more">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={riderName} uri={profile?.photoPath ?? null} onDark />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt role="cardTitle" color={c.heroInk} numberOfLines={1}>
              {riderName}
            </Txt>
            <Txt role="meta" color={c.heroMut} numberOfLines={1}>
              {bikeLine}
            </Txt>
          </View>
          <View style={{ backgroundColor: isPro ? c.heroAcc : c.heroChip, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Txt role="eyebrow" uppercase color={isPro ? '#14171B' : c.heroChipInk}>
              {isPro ? 'Pro' : 'Free plan'}
            </Txt>
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <Txt role="headline" color={c.heroInk}>
            {isPro ? 'Pro · every motorcycle' : 'Free · one motorcycle'}
          </Txt>
          <Txt role="bodySmall" color={c.heroMut}>
            {isPro
              ? 'Multiple motorcycles, advanced charts, CSV export and no ads — all yours.'
              : 'Pro adds multiple motorcycles, advanced charts, CSV export and no ads.'}
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPro ? 'Manage plan' : 'Upgrade to Pro'}
          onPress={() => router.push('/plan')}
          testID="cta-more-upgrade"
          style={({ pressed }) => ({
            height: 48,
            borderRadius: 999,
            backgroundColor: isPro ? c.heroChip : c.heroAcc,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: 20,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon name="sparkles" size={20} color={isPro ? c.heroInk : '#14171B'} />
          <Txt role="rowTitleLarge" color={isPro ? c.heroInk : '#14171B'}>
            {isPro ? 'Manage plan' : 'Upgrade to Pro'}
          </Txt>
        </Pressable>
      </HeroCard>

      {/* Figma `Card · Capture & log`. */}
      <MenuCard eyebrow="Capture & log">
        <MenuRow icon="camera" iconTone="accent" label="Fast Capture" onPress={() => router.push('/capture')} testID="row-capture" />
        <MenuRow
          icon="wrench"
          iconTone="warn"
          label="Maintenance"
          onPress={() => router.push('/maintenance')}
          right={dueCount > 0 ? <Badge label={`${dueCount} due`} tone="warn" uppercase /> : undefined}
          testID="row-maintenance"
        />
        <MenuRow icon="calendarCheck" iconTone="info" label="Service plan" onPress={() => router.push('/maintenance/plan')} testID="row-service-plan" />
        <MenuRow icon="history" iconTone="neutral" label="Service history" onPress={() => router.push('/services')} testID="row-services" />
        <MenuRow icon="store" iconTone="neutral" label="Workshop records" onPress={() => router.push('/services/workshop')} testID="row-workshop" />
      </MenuCard>

      {/* Figma `Card · Ownership`. */}
      <MenuCard eyebrow="Ownership">
        <MenuRow icon="package" iconTone="neutral" label="Parts & accessories" onPress={() => router.push('/parts')} testID="row-parts" />
        <MenuRow icon="shieldCheck" iconTone="good" label="Safety & condition" onPress={() => router.push('/records/safety')} testID="row-safety" />
        <MenuRow
          icon="folderLock"
          iconTone="accent"
          label="Document vault"
          onPress={() => router.push('/records/vault')}
          right={
            expiring.expiredCount > 0 ? (
              <Badge label={`${expiring.expiredCount} expired`} tone="bad" uppercase />
            ) : expiring.expiringCount > 0 ? (
              <Badge label={`${expiring.expiringCount} expiring`} tone="warn" uppercase />
            ) : undefined
          }
          testID="row-vault"
        />
        <MenuRow icon="badgeCheck" iconTone="info" label="Warranties" onPress={() => router.push('/records/warranties')} testID="row-warranties" />
        <MenuRow icon="fileCheck" iconTone="neutral" label="Proof pack · resale report" onPress={() => router.push('/records/proof-pack')} testID="row-proof" />
      </MenuCard>

      {/* Figma `Card · Insights & app`. */}
      <MenuCard eyebrow="Insights & app">
        <MenuRow icon="chart" iconTone="info" label="Analytics" onPress={() => router.push('/analytics')} testID="row-analytics" />
        <MenuRow icon="bell" iconTone="neutral" label="Notifications" onPress={() => router.push('/notifications')} testID="row-notifications" />
        <MenuRow
          icon="sparkles"
          iconTone="accent"
          label="Assistant"
          badge={isPro ? undefined : <ProBadge small />}
          onPress={() => router.push('/assistant')}
          testID="row-assistant"
        />
        <MenuRow icon="messageSquare" iconTone="neutral" label="Feedback & support" onPress={() => router.push('/feedback')} testID="row-feedback" />
        <MenuRow icon="settings" iconTone="neutral" label="Settings" onPress={() => router.push('/settings')} testID="row-settings" />
        <MenuRow
          icon="crown"
          iconTone="accent"
          label="Free / Pro"
          onPress={() => router.push('/plan')}
          right={<Badge label={isPro ? 'Pro' : 'Free plan'} tone={isPro ? 'accent' : 'neutral'} uppercase />}
          testID="row-plan"
        />
      </MenuCard>
    </Screen>
  );
}

/** Figma `Card · …`: `padding:16px 16px 6px`, the eyebrow 6px over the first row, a hairline between rows. */
function MenuCard({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <Card variant="list" style={{ paddingTop: 16, paddingBottom: 6 }}>
      <Eyebrow style={{ paddingBottom: 6 }}>{eyebrow}</Eyebrow>
      <DividedList>{children}</DividedList>
    </Card>
  );
}
