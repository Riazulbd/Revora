import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Banner,
  Card,
  CardHeader,
  Divider,
  EmptyState,
  ErrorState,
  Footnote,
  HeroCard,
  HeroFigure,
  HeroHead,
  Icon,
  LinkButton,
  MiniBars,
  RowIcon,
  Screen,
  SkeletonList,
  Sparkline,
  Stack,
  StatRow,
  StatTile,
  Txt,
} from '@/components';
import { mileageUnitLabel } from '@/calculations/units';
import { mileageBlockerMessage } from '@/calculations/mileage';
import { SETTLED_DISTANCE_FOR_COST_PER_UNIT } from '@/calculations/ownership';
import { monthlySeries } from '@/calculations/analytics';
import {
  activityDetail,
  activityTitle,
  compactAgo,
  costPerDistanceNote,
  mileageChange,
  mileageSparkline,
  monthOverMonth,
  odometerUpdatedLine,
  weekdayDate,
} from '@/calculations/dashboard';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { DashboardAdCard } from '@/features/ads/DashboardAdCard';
import { useConnectivity } from '@/services/connectivity';
import { formatMonthLabel, monthKey, monthName, todayIso } from '@/utils/date';
import { formatCurrencySymbol, formatDistanceValue, formatMileageValue, formatRateSymbol, formatVolume } from '@/utils/format';
import { fontFamily, useTheme } from '@/theme';
import { AttentionCard } from '@/features/dashboard/AttentionCard';
import { AttentionBell, DashboardActions } from '@/features/dashboard/EntryLayer';
import { useAttention } from '@/features/dashboard/useAttention';

/**
 * The Dashboard (Figma `01 Dashboard — Redesign`), built entirely from the
 * rider's own records.
 *
 * The order is the argument: where the bike stands (the dark hero), the one
 * thing most often done next (Add fuel), what is wrong, how it runs and what it
 * costs, then what was logged last. Nothing above the fold is a number the
 * rider has to go and ask for.
 *
 * Where a figure cannot be computed it says so — there is no sample data, and
 * no zero standing in for "we don't know yet" (requirement 21 / 31).
 */
export default function Dashboard() {
  const router = useRouter();
  const { activeBike, isPro } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();
  const connectivity = useConnectivity();
  const attention = useAttention();

  const today = analytics?.today ?? todayIso();
  // The load-error state drops the bike's name: with no records loaded, the
  // app cannot honestly claim which motorcycle this screen is about.
  const named = error === null && activeBike !== null;

  return (
    <Screen variant="tab" onRefresh={refetch} testID="screen-dashboard">
      <DashboardHeader
        title={named ? activeBike.nickname : 'Dashboard'}
        subtitle={named ? `${activeBike.manufacturer} ${activeBike.model} · ${weekdayDate(today)}` : undefined}
        attentionCount={attention.count}
        onSwitch={named ? () => router.push('/(tabs)/garage') : undefined}
      />

      {!connectivity.isOnline ? (
        <Banner
          tone="offline"
          message="You're offline. Everything still works — logs save here and sync later."
          style={{ marginBottom: 16 }}
          testID="banner-offline"
        />
      ) : null}

      {error ? (
        <Stack>
          <View>
            <DashboardActions variant="degraded" />
            <Footnote>Both still work — capture queues locally, offline documents open without the server.</Footnote>
          </View>
          <AttentionCard items={[]} hasError />
          <ErrorState
            title="Couldn't load your records"
            message="Your data is safe on your account — this is a loading problem, not a data problem."
            onRetry={() => void refetch()}
            testID="state-dashboard-error"
          />
        </Stack>
      ) : isPending && analytics === null ? (
        <SkeletonList count={4} height={120} />
      ) : analytics === null ? (
        <EmptyState
          icon="bike"
          title="No motorcycle selected"
          message="Add a motorcycle and your dashboard fills in from what you log."
          primaryAction={{
            label: 'Add a motorcycle',
            onPress: () => router.push('/(onboarding)/add-bike'),
            testID: 'cta-add-bike',
          }}
          variant="page"
        />
      ) : (
        <Stack>
          <OdometerHero analytics={analytics} />
          <DashboardActions documentsExpiring={attention.documentsExpiring} />
          <AttentionCard items={attention.items} isPending={attention.isPending} hasRecords={!analytics.isEmpty} />
          <StarterRules analytics={analytics} />
          <Bento analytics={analytics} />
          <ActivityCard analytics={analytics} />
          {isPro ? null : <DashboardAdCard />}
        </Stack>
      )}
    </Screen>
  );
}

type CardProps = { analytics: NonNullable<ReturnType<typeof useGarageData>['analytics']> };

/**
 * Figma `Header`: the bike's name (`700 24px`) with a chevron that opens the
 * garage to switch bikes, the model and date under it (`400 13px` muted), and
 * the 48px bell on the right.
 */
function DashboardHeader({
  title,
  subtitle,
  attentionCount,
  onSwitch,
}: {
  title: string;
  subtitle: string | undefined;
  attentionCount: number;
  onSwitch: (() => void) | undefined;
}) {
  const { c } = useTheme();
  const name = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Txt role="greeting" numberOfLines={1} style={{ flexShrink: 1 }}>
        {title}
      </Txt>
      {onSwitch ? <Icon name="chevronDown" size={20} color={c.ink} /> : null}
    </View>
  );

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}
    >
      <View style={{ flexShrink: 1, gap: 2 }}>
        {onSwitch ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}. Switch motorcycle`}
            onPress={onSwitch}
            testID="cta-switch-bike"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            {name}
          </Pressable>
        ) : (
          name
        )}
        {subtitle ? (
          <Txt role="subtitle" tone="mut" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <AttentionBell count={attentionCount} />
    </View>
  );
}

/**
 * Figma `Hero — dark accent`: the odometer and the three figures it pays for.
 *
 * Mileage is the latest measured interval, or the whole-log estimate labelled
 * as one; its line shows the change against the interval before. Cost per
 * distance names the basis it is counted on. A short log gets one sentence
 * under the tiles saying how much distance the figures rest on.
 */
function OdometerHero({ analytics }: CardProps) {
  const { c } = useTheme();
  const { units, currency, odometer, mileage, fuel } = analytics;

  const shown = mileage.latest ?? mileage.provisional;
  const estimated = mileage.latest === null && mileage.provisional !== null;
  const unitLabel = mileageUnitLabel(units.mileage);
  const change = mileageChange(mileage.intervals, units.mileage);
  // The arrow follows the number, the colour follows whether that is good: on
  // L/100km a falling figure is the improvement.
  const rising = change ? (units.mileage === 'l_per_100km' ? !change.better : change.better) : false;

  const loggedFuel = fuel.entries.length > 0;
  const note = loggedFuel
    ? costPerDistanceNote({
        trackedMetres: analytics.ownership.distanceMetres,
        settledMetres: SETTLED_DISTANCE_FOR_COST_PER_UNIT,
        distanceUnit: units.distance,
      })
    : 'Nothing logged yet — these fill in with your first fuel record.';

  return (
    <HeroCard testID="card-odometer">
      <HeroHead
        eyebrow="Odometer"
        chip={odometerUpdatedLine({
          latest: odometer.latest,
          lastRideMetres: null,
          distanceUnit: units.distance,
          today: analytics.today,
        })}
      />
      <HeroFigure
        value={odometer.currentMetres === null ? undefined : formatDistanceValue(odometer.currentMetres, units.distance)}
        unit={units.distance}
        testID="hero-odometer"
      />
      <View style={{ gap: 12 }}>
        <StatRow>
          <StatTile
            variant="hero"
            label="Mileage"
            {...(shown ? { value: formatMileageValue(shown.efficiency, units.mileage) } : {})}
            {...(change
              ? {
                  sub: `${rising ? '▲' : '▼'} ${change.delta.toFixed(1)} ${unitLabel}`,
                  subTone: change.better ? ('good' as const) : ('bad' as const),
                }
              : { sub: estimated ? 'estimated' : unitLabel })}
            testID="tile-mileage"
          />
          <StatTile
            variant="hero"
            label={`Cost / ${units.distance}`}
            value={formatRateSymbol(analytics.ownership.costPerDistanceScaled, currency)}
            sub={analytics.ownership.costBasis === 'total' ? 'all costs' : 'running costs'}
          />
          <StatTile
            variant="hero"
            label="Last fill"
            {...(fuel.latest ? { value: compactAgo(fuel.latest.date, analytics.today) } : {})}
            {...(fuel.latest
              ? {
                  sub: `${formatVolume(fuel.latest.litresMl, units.volume)} ${
                    fuel.latest.fillType === 'full' ? 'full' : fuel.latest.fillType === 'partial' ? 'partial' : ''
                  }`.trim(),
                }
              : {})}
          />
        </StatRow>
        {note ? (
          <Txt role="helper" color={c.heroMut} testID="hint-cost-per-distance">
            {note}
          </Txt>
        ) : null}
      </View>
    </HeroCard>
  );
}

/**
 * With no rules there is nothing for the attention list to watch, so the
 * starter set is offered here — one sentence and a link — until it exists.
 */
function StarterRules({ analytics }: CardProps) {
  const router = useRouter();
  const { activeBike } = useGarage();
  if (analytics.maintenance.rules.length > 0) return null;

  return (
    <Card>
      <CardHeader title="Maintenance" />
      <Txt role="body" tone="mut">
        No rules yet.{' '}
        <Txt
          accessibilityRole="link"
          tone="acc"
          style={{ fontFamily: fontFamily[600] }}
          onPress={() => router.push('/maintenance')}
          testID="link-starter-rules"
        >
          {`Add the starter set for the ${activeBike?.model ?? 'your bike'}`}
        </Txt>{' '}
        — oil, chain, air filter.
      </Txt>
    </Card>
  );
}

/**
 * Figma `Bento`: two cards side by side — the mileage trend and this month's
 * spend. Before any mileage exists the left card becomes the first-fill
 * prompt, full width, because that is the one thing that would fill it.
 */
function Bento({ analytics }: CardProps) {
  const router = useRouter();
  const { units, currency, mileage } = analytics;

  const shown = mileage.latest ?? mileage.provisional;
  const series = monthlySeries(analytics, 7);
  const versus = monthOverMonth(series);
  const thisMonth = monthKey(analytics.today);

  const spendCard = (
    <BentoCard
      label={`Spent · ${formatMonthLabel(thisMonth)}`}
      value={formatCurrencySymbol(analytics.thisMonthMinor, currency)}
      chart={<MiniBars values={series.map((m) => m.totalMinor)} testID="chart-spend" />}
      foot={
        versus
          ? `${versus.lower ? '▼' : '▲'} ${versus.percent}% vs ${monthName(versus.previousKey)}`
          : 'Nothing to compare yet'
      }
      footTone={versus ? (versus.lower ? 'good' : 'warn') : 'mut'}
      onPress={() => router.push('/(tabs)/expenses')}
      testID="card-spend"
    />
  );

  if (shown === null) {
    return (
      <Stack>
        <EmptyState
          icon="fuel"
          title="Log your first fill"
          message={
            mileage.blockedBy === null || analytics.fuel.entries.length === 0
              ? 'Mileage is measured between two full-tank fills. Fill up, log it, and the second fill starts telling you the truth about your bike.'
              : mileageBlockerMessage(mileage.blockedBy)
          }
          primaryAction={{
            label: 'Log first fill',
            onPress: () => router.push('/fuel/add'),
            testID: 'cta-first-fill',
          }}
          testID="state-no-mileage"
        />
        {analytics.ledger.length > 0 ? spendCard : null}
      </Stack>
    );
  }

  const estimated = mileage.latest === null;
  const unitLabel = mileageUnitLabel(units.mileage);

  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <BentoCard
        label={estimated ? 'Mileage · estimated' : 'Mileage trend'}
        value={formatMileageValue(estimated ? shown.efficiency : (mileage.average ?? shown.efficiency), units.mileage)}
        unit={estimated ? unitLabel : `${unitLabel} avg`}
        chart={<Sparkline values={mileageSparkline(mileage.intervals, units.mileage)} testID="chart-mileage" />}
        foot={
          estimated
            ? mileage.blockedBy === null
              ? 'Two full fills measure it'
              : 'Not measured yet'
            : `${mileage.count} measured ${mileage.count === 1 ? 'fill' : 'fills'}`
        }
        onPress={() => router.push('/(tabs)/fuel')}
        testID="card-mileage"
      />
      {spendCard}
    </View>
  );
}

/**
 * One bento card (Figma `Mileage card`, `Spend card`): white, 24px radius,
 * `padding:16px; gap:6px` — a `500 12px` label, the `700 24px` figure, a
 * 44px chart and a `12px` line under it.
 */
function BentoCard({
  label,
  value,
  unit,
  chart,
  foot,
  footTone = 'mut',
  onPress,
  testID,
}: {
  label: string;
  value: string;
  unit?: string;
  chart: React.ReactNode;
  foot: string;
  footTone?: 'mut' | 'good' | 'warn';
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}. ${foot}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
    >
      <Card style={{ flex: 1, gap: 6 }}>
        <Txt role="tileLabel" tone="mut" numberOfLines={1}>
          {label}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Txt role="figureSmall" numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1 }}>
            {value}
          </Txt>
          {unit ? (
            <Txt role="tileLabel" tone="mut" numberOfLines={1}>
              {unit}
            </Txt>
          ) : null}
        </View>
        {chart}
        <Txt role={footTone === 'mut' ? 'micro' : 'smallStrong'} tone={footTone} numberOfLines={1}>
          {foot}
        </Txt>
      </Card>
    </Pressable>
  );
}

/** Figma `Recent activity`: the last things the rider logged, whatever kind they were. */
function ActivityCard({ analytics }: CardProps) {
  const router = useRouter();
  const { units, currency } = analytics;
  const recent = analytics.ledger.slice(0, 3);

  if (recent.length === 0) return null;

  const context = { fuelEntries: analytics.fuel.entries, services: analytics.services.all };

  return (
    <Card style={{ gap: 4 }} testID="card-activity">
      <CardHeader
        title="Recent activity"
        action={
          <LinkButton label="View all" onPress={() => router.push('/(tabs)/expenses')} testID="link-activity-all" />
        }
      />
      {recent.map((entry, index) => (
        <View key={entry.id}>
          {index > 0 ? <Divider /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 48 }}>
            <RowIcon
              icon={entry.source === 'fuel' ? 'fuel' : entry.source === 'service' ? 'wrench' : 'fileText'}
              tone={entry.source === 'fuel' ? 'accent' : entry.source === 'service' ? 'info' : 'neutral'}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt role="rowTitle" numberOfLines={1}>
                {activityTitle(entry)}
              </Txt>
              <Txt role="meta" tone="mut" numberOfLines={1}>
                {activityDetail(entry, context, units.distance)}
              </Txt>
            </View>
            <Txt role="value" numberOfLines={1}>
              {formatCurrencySymbol(entry.amountMinor, currency)}
            </Txt>
          </View>
        </View>
      ))}
    </Card>
  );
}
