import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Avatar,
  Banner,
  Button,
  Card,
  CardHeader,
  CircleButton,
  Divider,
  EmptyState,
  ErrorState,
  Eyebrow,
  Gauge,
  Icon,
  InsufficientData,
  LinkButton,
  MenuRow,
  ProgressBar,
  RowIcon,
  Screen,
  SkeletonList,
  SpendBar,
  Stack,
  StatTile,
  TrendChart,
  Txt,
} from '@/components';
import { mileageGaugeMax , efficiencyToDisplay } from '@/calculations/units';
import { confidenceLabel } from '@/calculations/mileage';
import { STATUS_LABEL } from '@/calculations/maintenance';
import { BikeSwitcherButton, BikeSwitcherSheet, useBikeSwitcher } from '@/features/bikes/BikeSwitcher';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { MileageExplainSheet } from '@/features/fuel/MileageExplainSheet';
import { useNotificationRows } from '@/features/notifications/useNotifications';
import { useAuth } from '@/features/auth/AuthProvider';
import { DashboardAdCard } from '@/features/ads/DashboardAdCard';
import { useConnectivity } from '@/services/connectivity';
import { formatLongDate, formatMonthLabel, formatShortDate, monthKey, todayIso } from '@/utils/date';
import {
  formatCurrency,
  formatDistance,
  formatDistanceValue,
  formatMileageValue,
  formatRate,
  formatVolume,
  NO_VALUE,
} from '@/utils/format';
import { useTheme } from '@/theme';
import { StatusTone } from '@/features/maintenance/statusTone';

/**
 * The dashboard, built entirely from the rider's own records.
 *
 * Where a figure cannot be computed it says so — there is no sample data, and no
 * zero standing in for "we don't know yet" (requirement 21 / 31).
 */
export default function Dashboard() {
  const router = useRouter();
  const { c } = useTheme();
  const { user } = useAuth();
  const { activeBike, isPro, profile } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();
  const { unreadCount } = useNotificationRows();
  const connectivity = useConnectivity();
  const switcher = useBikeSwitcher();
  const [explainOpen, setExplainOpen] = useState(false);

  const name = profile?.displayName ?? user?.displayName ?? 'rider';
  const today = todayIso();

  return (
    <Screen variant="tab" onRefresh={refetch} testID="screen-dashboard">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <BikeSwitcherButton onPress={switcher.open} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CircleButton
            accessibilityLabel={
              unreadCount > 0 ? `Notifications, ${unreadCount} needing attention` : 'Notifications'
            }
            onPress={() => router.push('/notifications')}
            showDot={unreadCount > 0}
            testID="open-notifications"
          >
            <Icon name="bell" size={19} color={c.ink} />
          </CircleButton>
          <Avatar
            name={name}
            uri={profile?.photoPath ?? null}
            onPress={() => router.push('/settings')}
            testID="open-settings"
          />
        </View>
      </View>

      <View style={{ gap: 2, marginBottom: 16 }}>
        <Txt role="greeting" numberOfLines={2}>
          Welcome back, {name}.
        </Txt>
        <Txt role="bodySmall" tone="mut" numberOfLines={2}>
          {activeBike
            ? `Here's how your ${activeBike.nickname} is doing · ${formatShortDate(today)}`
            : `Add a motorcycle to get started · ${formatShortDate(today)}`}
        </Txt>
      </View>

      {!connectivity.isOnline ? (
        <Banner
          icon="wifiOff"
          message="You're offline. Everything still works — logs save here and sync later."
          style={{ marginBottom: 16 }}
          testID="banner-offline"
        />
      ) : null}

      {error ? (
        <ErrorState
          title="Couldn't load your garage"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : isPending && analytics === null ? (
        <SkeletonList count={4} height={110} />
      ) : analytics === null ? (
        <EmptyState
          icon="motorcycle"
          title="No motorcycle selected"
          message="Add a motorcycle and your dashboard fills in from what you log."
          primaryAction={{ label: 'Add a motorcycle', onPress: () => router.push('/(onboarding)/add-bike') }}
          variant="page"
        />
      ) : analytics.isEmpty ? (
        <EmptyDashboard />
      ) : (
        <Stack>
          <OdometerCard analytics={analytics} />
          <MileageCard analytics={analytics} onExplain={() => setExplainOpen(true)} />
          {isPro ? <TrendCard analytics={analytics} /> : null}
          <MaintenanceCard analytics={analytics} />
          {activeBike?.company.enabled ? <AllowanceCard analytics={analytics} /> : null}
          <SpendingCard analytics={analytics} />
          <ActivityCard analytics={analytics} />
          {!isPro ? <DashboardAdCard /> : null}
          {!isPro ? <FreePlanNotice /> : null}
        </Stack>
      )}

      <BikeSwitcherSheet visible={switcher.visible} onClose={switcher.close} />
      <MileageExplainSheet visible={explainOpen} onClose={() => setExplainOpen(false)} analytics={analytics} />
    </Screen>
  );
}

function EmptyDashboard() {
  const router = useRouter();
  const { c } = useTheme();

  return (
    <Stack>
      <Card style={{ paddingVertical: 36, paddingHorizontal: 24, alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 66,
            height: 66,
            borderRadius: 33,
            backgroundColor: c.accS,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="fuel" size={30} color={c.acc} />
        </View>
        <Txt role="cardTitle" align="center">
          No rides logged yet
        </Txt>
        <Txt role="body" tone="mut" align="center">
          Log your first fill-up to unlock mileage, running cost and trends. Revora never estimates numbers you
          didn&apos;t log.
        </Txt>
        <Button
          label="Log first fill-up"
          onPress={() => router.push('/fuel/add')}
          size="medium"
          style={{ height: 48, marginTop: 4 }}
          testID="cta-first-fill"
        />
        <Button
          label="Or use Fast Capture"
          variant="secondary"
          size="small"
          onPress={() => router.push('/capture')}
        />
      </Card>

      <Card variant="list">
        <Eyebrow>WHILE YOU&apos;RE HERE</Eyebrow>
        <View style={{ height: 4 }} />
        <MenuRow label="Set up maintenance reminders" onPress={() => router.push('/maintenance')} />
        <Divider />
        <MenuRow
          label="Add registration & insurance documents"
          onPress={() => router.push('/records/vault')}
        />
      </Card>
    </Stack>
  );
}

type CardProps = { analytics: NonNullable<ReturnType<typeof useGarageData>['analytics']> };

function OdometerCard({ analytics }: CardProps) {
  const { units, currency } = analytics;
  const odo = analytics.odometer;
  const latestInterval = analytics.mileage.latest;

  const updatedLine =
    odo.latest === null
      ? 'No reading logged yet'
      : `Updated ${formatShortDate(odo.latest.date)}${
          latestInterval ? ` · latest ride +${formatDistance(latestInterval.distanceMetres, units.distance)}` : ''
        }`;

  return (
    <Card style={{ paddingBottom: 16 }}>
      <Eyebrow>CURRENT ODOMETER</Eyebrow>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6, marginBottom: 4 }}>
        <Txt role="hero" numberOfLines={1} adjustsFontSizeToFit>
          {formatDistanceValue(odo.currentMetres, units.distance)}
        </Txt>
        <Txt role="dialogTitle" tone="mut">
          {units.distance}
        </Txt>
      </View>
      <Txt role="meta" tone="mut" numberOfLines={2}>
        {updatedLine}
      </Txt>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <StatTile
          label={`FUEL · ${formatMonthLabel(monthKey(analytics.today)).toUpperCase()}`}
          value={formatCurrency(analytics.fuel.thisMonthSpendMinor, currency)}
        />
        <StatTile
          label="RUNNING COST"
          value={formatRate(analytics.ownership.costPerDistanceScaled, currency)}
          suffix={analytics.ownership.costPerDistanceScaled === null ? undefined : `/${units.distance}`}
        />
        <StatTile
          label="LAST FILL"
          value={analytics.fuel.latest ? formatVolume(analytics.fuel.latest.litresMl, units.volume) : NO_VALUE}
        />
      </View>
    </Card>
  );
}

function MileageCard({ analytics, onExplain }: CardProps & { onExplain: () => void }) {
  const { units } = analytics;
  const latest = analytics.mileage.latest;
  const gaugeValue = latest ? efficiencyToDisplay(latest.efficiency, units.mileage) : null;

  return (
    <Card>
      <CardHeader
        title="LATEST MILEAGE"
        action={<LinkButton label="How is this calculated?" onPress={onExplain} testID="link-explain" />}
      />
      {latest ? (
        <>
          <View style={{ marginTop: 6 }}>
            <Gauge
              value={gaugeValue}
              max={mileageGaugeMax(units.mileage)}
              caption={`${units.mileage === 'km_per_l' ? 'km/L' : ''} · ${formatShortDate(latest.date)}`.replace(
                /^ · /,
                '',
              )}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <StatTile
              variant="centered"
              label="AVERAGE"
              value={formatMileageValue(analytics.mileage.average, units.mileage)}
            />
            <StatTile variant="centered" label="INTERVALS" value={String(analytics.mileage.count)} />
            <StatTile
              variant="centered"
              label="CONFIDENCE"
              value={confidenceLabel(analytics.mileage.confidence)}
              tone={
                analytics.mileage.confidence === 'high'
                  ? 'good'
                  : analytics.mileage.confidence === 'medium'
                    ? 'warn'
                    : 'ink'
              }
            />
          </View>
        </>
      ) : (
        <InsufficientData
          title="No mileage yet"
          message="Mileage appears after your second full-tank fill — Revora measures between two full tanks and never guesses."
          style={{ marginTop: 12 }}
        />
      )}
    </Card>
  );
}

function TrendCard({ analytics }: CardProps) {
  const router = useRouter();
  const latest = analytics.mileage.latest;

  return (
    <Card>
      <CardHeader
        title="MILEAGE TREND"
        action={<LinkButton label="Analytics" onPress={() => router.push('/analytics')} />}
        style={{ marginBottom: 10 }}
      />
      {analytics.mileage.count >= 3 ? (
        <TrendPreview analytics={analytics} />
      ) : (
        <InsufficientData
          title="Not enough data for a trend yet"
          message={`Log ${3 - analytics.mileage.count} more full-tank fill${
            3 - analytics.mileage.count === 1 ? '' : 's'
          } and the trend line appears here. Revora never invents data points.`}
        />
      )}
      {latest ? (
        <View style={{ marginTop: 12 }}>
          <LatestIntervalRow analytics={analytics} />
        </View>
      ) : null}
    </Card>
  );
}

function TrendPreview({ analytics }: CardProps) {
  const { units } = analytics;
  const points = analytics.mileage.intervals.slice(-5).map((interval) => ({
    value: efficiencyToDisplay(interval.efficiency, units.mileage),
    label: formatShortDate(interval.date),
  }));
  return <TrendChart points={points} formatValue={(v: number) => v.toFixed(1)} />;
}

function LatestIntervalRow({ analytics }: CardProps) {
  const { c, radius } = useTheme();
  const { units } = analytics;
  const latest = analytics.mileage.latest;
  if (!latest) return null;

  return (
    <View
      style={{
        backgroundColor: c.sur2,
        borderRadius: radius.smallCard - 2,
        paddingHorizontal: 13,
        paddingVertical: 11,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Txt role="smallStrong" tone="mut">
        Latest interval
      </Txt>
      <Txt role="smallStrong" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>
        {formatDistance(latest.distanceMetres, units.distance)} ·{' '}
        {formatVolume(latest.fuelMl, units.volume)} · {formatMileageValue(latest.efficiency, units.mileage)}{' '}
        {units.mileage === 'km_per_l' ? 'km/L' : ''}
      </Txt>
    </View>
  );
}

function MaintenanceCard({ analytics }: CardProps) {
  const router = useRouter();
  const counts = analytics.maintenance.counts;

  const chips = [
    { label: `${counts.overdue} overdue`, tone: 'bad' as const, show: counts.overdue > 0 },
    { label: `${counts.due_soon} due soon`, tone: 'warn' as const, show: counts.due_soon > 0 },
    { label: `${counts.upcoming} upcoming`, tone: 'neutral' as const, show: counts.upcoming > 0 },
    { label: `${counts.good} good`, tone: 'good' as const, show: counts.good > 0 },
  ].filter((chip) => chip.show);

  const urgent = analytics.maintenance.rules
    .filter((r) => r.status.kind === 'overdue' || r.status.kind === 'due_soon' || r.status.kind === 'upcoming')
    .slice(0, 2);

  return (
    <Card>
      <CardHeader
        title="MAINTENANCE"
        action={<LinkButton label="All rules" onPress={() => router.push('/maintenance')} />}
        style={{ marginBottom: 12 }}
      />

      {analytics.maintenance.rules.length === 0 ? (
        <InsufficientData
          title="No maintenance rules yet"
          message="Add a rule and Revora will track it against your odometer and the calendar."
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {chips.map((chip) => (
              <StatusTone key={chip.label} label={chip.label} tone={chip.tone} />
            ))}
          </View>

          <View style={{ gap: 10 }}>
            {urgent.length === 0 ? (
              <Txt role="metaSmall" tone="mut">
                Nothing due soon — everything is inside its interval.
              </Txt>
            ) : (
              urgent.map(({ rule, status }) => (
                <MenuRow
                  key={rule.id}
                  label={rule.name}
                  onPress={() => router.push('/maintenance')}
                  right={
                    <StatusTone
                      label={STATUS_LABEL[status.kind]}
                      tone={
                        status.kind === 'overdue'
                          ? 'bad'
                          : status.kind === 'due_soon'
                            ? 'warn'
                            : status.kind === 'good'
                              ? 'good'
                              : 'neutral'
                      }
                      small
                    />
                  }
                />
              ))
            )}
          </View>
        </>
      )}
    </Card>
  );
}

function AllowanceCard({ analytics }: CardProps) {
  const router = useRouter();
  const { c, radius } = useTheme();
  const allowance = analytics.allowance;
  const currency = analytics.currency;

  return (
    <Card>
      <CardHeader
        title="COMPANY ALLOWANCE"
        action={<LinkButton label="Settings" onPress={() => router.push('/garage/company')} />}
        style={{ marginBottom: 10 }}
      />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 8,
          gap: 10,
        }}
      >
        <Txt role="figureSmall" numberOfLines={1}>
          {formatCurrency(allowance.allowanceMinor, currency)}
          <Txt role="meta" tone="mut">
            /mo
          </Txt>
        </Txt>
        <Txt role="smallStrong" tone="mut" numberOfLines={1}>
          {formatCurrency(allowance.usedMinor, currency)} used
        </Txt>
      </View>
      <ProgressBar fraction={allowance.usedFraction} style={{ marginBottom: 12 }} />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: c.sur2,
          borderRadius: radius.smallCard - 2,
          paddingHorizontal: 13,
          paddingVertical: 11,
          gap: 10,
        }}
      >
        <Txt role="smallStrong" tone="mut">
          Rider fuel cost this month
        </Txt>
        <Txt
          role="value"
          tone={allowance.riderFuelCostMinor === 0 ? 'good' : 'ink'}
          numberOfLines={1}
        >
          {allowance.riderFuelCostMinor === 0
            ? `${formatCurrency(0, currency)} · covered`
            : formatCurrency(allowance.riderFuelCostMinor, currency)}
        </Txt>
      </View>
      <Txt role="micro" tone="mut" style={{ marginTop: 8 }}>
        True operating cost ({formatCurrency(allowance.trueOperatingCostMinor, currency)} this month) stays
        visible in Expenses.
      </Txt>
    </Card>
  );
}

function SpendingCard({ analytics }: CardProps) {
  const router = useRouter();
  const spend = analytics.spend;
  const currency = analytics.currency;
  const max = Math.max(spend.fuel, spend.services, spend.parts, spend.accessories, spend.other, 1);

  const rows = [
    { category: 'Services', amount: spend.services, opacity: 1 },
    { category: 'Fuel', amount: spend.fuel, opacity: 0.8 },
    { category: 'Parts', amount: spend.parts, opacity: 0.6 },
    { category: 'Extras', amount: spend.accessories + spend.other, opacity: 0.4 },
  ];

  return (
    <Card>
      <CardHeader
        title="SPENDING · ALL TIME"
        action={<LinkButton label="Ledger" onPress={() => router.push('/(tabs)/expenses')} />}
        style={{ marginBottom: 12 }}
      />
      <View style={{ gap: 10 }}>
        {rows.map((row) => (
          <SpendBar
            key={row.category}
            category={row.category}
            amount={formatCurrency(row.amount, currency)}
            fraction={row.amount / max}
            opacity={row.opacity}
          />
        ))}
      </View>
    </Card>
  );
}

function ActivityCard({ analytics }: CardProps) {
  const { c } = useTheme();
  const currency = analytics.currency;
  const recent = analytics.ledger.slice(0, 3);

  if (recent.length === 0) return null;

  return (
    <Card>
      <Eyebrow>RECENT ACTIVITY</Eyebrow>
      <View style={{ gap: 12, marginTop: 12 }}>
        {recent.map((entry) => (
          <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <RowIcon
              size={34}
              tone={entry.source === 'fuel' ? 'accent' : entry.source === 'service' ? 'good' : 'neutral'}
            >
              <Icon
                name={entry.source === 'fuel' ? 'fuel' : entry.source === 'service' ? 'check' : 'document'}
                size={15}
                color={entry.source === 'fuel' ? c.acc : entry.source === 'service' ? c.good : c.mut}
              />
            </RowIcon>
            <View style={{ flex: 1, gap: 1 }}>
              <Txt role="mediumStrong" numberOfLines={1}>
                {entry.label}
              </Txt>
              <Txt role="metaSmall" tone="mut" numberOfLines={1}>
                {formatLongDate(entry.date)}
              </Txt>
            </View>
            <Txt role="mediumStrong" numberOfLines={1}>
              {formatCurrency(entry.amountMinor, currency)}
            </Txt>
          </View>
        ))}
      </View>
    </Card>
  );
}

function FreePlanNotice() {
  const router = useRouter();
  const { c, radius } = useTheme();

  return (
    <View
      style={{
        backgroundColor: c.sur,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: c.brd,
        borderRadius: radius.card,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Txt role="smallStrong" tone="mut">
          You&apos;re on Revora Free
        </Txt>
        <Txt role="micro" tone="mut">
          One motorcycle, full history, no time limit.
        </Txt>
      </View>
      <LinkButton label="See Pro" onPress={() => router.push('/plan')} />
    </View>
  );
}
