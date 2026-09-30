import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  BarChart,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Eyebrow,
  Footnote,
  InsufficientData,
  ProBadge,
  Screen,
  SkeletonList,
  SpendBar,
  Stack,
  StatRow,
  StatTile,
  TabHeader,
  TrendChart,
  Txt,
} from '@/components';
import { monthlySeries, type BikeAnalytics } from '@/calculations/analytics';
import { currencyEntry } from '@/calculations/currencies';
import { mileageBlockerMessage, RELIABLE_INTERVALS_REQUIRED } from '@/calculations/mileage';
import { intervalsToReliable, mileageIntervalTotals } from '@/calculations/mileageStats';
import { efficiencyToDisplay, mileageUnitLabel } from '@/calculations/units';
import { useGarageData } from '@/features/bikes/useGarageData';
import { ProUpsellSheet, useProGate } from '@/features/premium/ProUpsell';
import { formatMonthLabel, formatShortDate } from '@/utils/date';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDistance,
  formatDistanceValue,
  formatMileage,
  formatMileageValue,
  formatRate,
  formatVolume,
  formatVolumeValue,
  NO_VALUE,
} from '@/utils/format';

/**
 * Analytics — the working behind every figure.
 *
 * Built from the redesign's four boards: the arithmetic of the latest fill,
 * the interval stats, the trend, the monthly bars. Every panel refuses to draw
 * on data it does not have; "not enough data yet" is a first-class state here,
 * because a chart of one point, or a zero standing in for an unknown, would be
 * worse than nothing (requirement 31).
 */
export default function Analytics() {
  const router = useRouter();
  const { analytics, isPending, error, refetch } = useGarageData();
  const proGate = useProGate();

  if (error) {
    return (
      <Screen testID="screen-analytics" contentStyle={{ paddingHorizontal: 20 }}>
        <TabHeader title="Analytics" />
        <ErrorState
          message={error.message}
          onRetry={() => void refetch()}
          variant="page"
          testID="error-analytics"
        />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-analytics" contentStyle={{ paddingHorizontal: 20 }}>
        <TabHeader title="Analytics" />
        <SkeletonList count={4} height={140} />
      </Screen>
    );
  }

  if (!analytics) return null;

  if (analytics.isEmpty) {
    return (
      <Screen testID="screen-analytics" contentStyle={{ paddingHorizontal: 20 }}>
        <TabHeader title="Analytics" />
        <EmptyState
          icon="dashboard"
          title="Nothing to analyse yet"
          message="Log a fill-up or a service and the numbers start here. Revora only ever shows figures it can calculate from what you logged."
          primaryAction={{
            label: 'Log a fill-up',
            onPress: () => router.push('/fuel/add'),
            testID: 'cta-analytics-first-fill',
          }}
          variant="page"
          testID="empty-analytics"
        />
      </Screen>
    );
  }

  // Board "Analytics · Free account": the whole screen is the case for Pro.
  // Nothing is drawn faintly behind a lock — the rider is told exactly what
  // they would get and sent to the plans.
  if (!proGate.isPro) {
    return (
      <Screen testID="screen-analytics" contentStyle={{ paddingHorizontal: 20 }}>
        <TabHeader title="Analytics" />
        <EmptyState
          badge={<ProBadge wide />}
          title="The working behind every figure"
          message="Best and worst intervals, spending breakdowns, ownership cost — computed from the log you already keep."
          primaryAction={{
            label: 'See Pro plans',
            onPress: () => proGate.open('Analytics'),
            testID: 'cta-pro-reports',
          }}
          testID="upsell-analytics"
        />
        <ProUpsellSheet gate={proGate} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refetch} testID="screen-analytics" contentStyle={{ paddingHorizontal: 20 }}>
      <TabHeader title="Analytics" action={<ProBadge wide />} />

      <Stack gap={12}>
        <LatestCalculationCard analytics={analytics} />
        <MileageStatsCard analytics={analytics} />
        <TrendCard analytics={analytics} />
        <MonthlySpendingCard analytics={analytics} />
        <BreakdownCard analytics={analytics} />
        <OwnershipCard analytics={analytics} />
      </Stack>

      <Footnote style={{ marginTop: 12 }} testID="footnote-analytics">
        Best / worst and the rolling average unlock at five measured intervals. Below that, this screen says
        how many more are needed instead of drawing a chart the data can&rsquo;t hold.
      </Footnote>

      <ProUpsellSheet gate={proGate} />
    </Screen>
  );
}

type Props = { analytics: BikeAnalytics };

/** `display:flex; justify-content:space-between` — the board's calculation line. */
function SumRow({
  label,
  value,
  muted = false,
  accent = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Txt role="body" tone={muted ? 'mut' : 'ink'} style={{ flexShrink: 1 }} numberOfLines={2}>
        {label}
      </Txt>
      <Txt role="rowTitleDense" tone={accent ? 'acc' : 'ink'} numberOfLines={1}>
        {value}
      </Txt>
    </View>
  );
}

/**
 * "Latest fuel calculation" — the board shows the division itself, because a
 * mileage figure a rider cannot check is a figure they cannot trust.
 */
function LatestCalculationCard({ analytics }: Props) {
  const latest = analytics.mileage.latest;
  const units = analytics.units;

  if (!latest) {
    return (
      <Card testID="card-latest-calculation">
        <Eyebrow>Latest fuel calculation</Eyebrow>
        <InsufficientData
          title="No complete interval yet"
          message={mileageBlockerMessage(analytics.mileage.blockedBy ?? 'no_fills')}
          style={{ marginTop: 10 }}
        />
      </Card>
    );
  }

  return (
    <Card style={{ gap: 10 }} testID="card-latest-calculation">
      <Eyebrow>Latest fuel calculation</Eyebrow>

      <SumRow
        label={`Full tank ${formatShortDate(latest.fromDate)} → full tank ${formatShortDate(latest.date)}`}
        value={formatDistance(latest.distanceMetres, units.distance)}
      />
      <SumRow label="Fuel used in between" value={formatVolume(latest.fuelMl, units.volume)} />

      <Divider />

      <SumRow
        label={`${formatDistanceValue(latest.distanceMetres, units.distance)} ÷ ${formatVolumeValue(
          latest.fuelMl,
          units.volume,
        )}`}
        value={`= ${formatMileage(latest.efficiency, units.mileage)}`}
        muted
        accent
      />

      <Txt role="helper" tone="mut">
        Method: distance between two full tanks ÷ fuel used in between. Check it yourself — that&rsquo;s the
        point.
      </Txt>
    </Card>
  );
}

/**
 * "Mileage stats". Above five measured intervals the board draws four tiles;
 * below it, two em dashes and a sentence that counts down — never an average
 * dressed up as a best and a worst.
 */
function MileageStatsCard({ analytics }: Props) {
  const { mileage, units } = analytics;

  if (mileage.count < RELIABLE_INTERVALS_REQUIRED) {
    const toGo = intervalsToReliable(mileage.count);
    return (
      <Card style={{ gap: 10 }} testID="card-mileage-stats">
        <Eyebrow>Mileage stats</Eyebrow>
        <StatRow>
          <StatTile label="Best / worst" value={NO_VALUE} />
          <StatTile label="Rolling avg" value={NO_VALUE} />
        </StatRow>
        <Txt role="meta" tone="mut">
          Unlocks at {RELIABLE_INTERVALS_REQUIRED} measured intervals — you have {mileage.count}, so {toGo} to
          go.
        </Txt>
      </Card>
    );
  }

  const totals = mileageIntervalTotals(mileage.intervals);

  return (
    <Card style={{ gap: 10 }} testID="card-mileage-stats">
      <Eyebrow>
        Mileage stats · {mileage.count} interval{mileage.count === 1 ? '' : 's'}
      </Eyebrow>

      <StatRow>
        <StatTile label="Average" value={formatMileageValue(mileage.average, units.mileage)} />
        <StatTile
          label="Best / worst"
          value={
            mileage.best && mileage.worst
              ? `${formatMileageValue(mileage.best.efficiency, units.mileage)} / ${formatMileageValue(
                  mileage.worst.efficiency,
                  units.mileage,
                )}`
              : NO_VALUE
          }
        />
      </StatRow>
      <StatRow>
        <StatTile label="Distance" value={formatDistance(totals.distanceMetres, units.distance)} />
        <StatTile
          label={units.volume === 'L' ? 'Litres' : 'Gallons'}
          value={formatVolume(totals.fuelMl, units.volume)}
        />
      </StatRow>
    </Card>
  );
}

/** "Mileage trend · km/L per interval". */
function TrendCard({ analytics }: Props) {
  const units = analytics.units;
  const intervals = analytics.mileage.intervals.slice(-12);

  return (
    <Card style={{ gap: 10 }} testID="card-mileage-trend">
      <Eyebrow>Mileage trend · {mileageUnitLabel(units.mileage)} per interval</Eyebrow>
      {intervals.length >= 3 ? (
        <TrendChart
          points={intervals.map((interval) => ({
            value: efficiencyToDisplay(interval.efficiency, units.mileage),
            label: formatShortDate(interval.date),
          }))}
          formatValue={(v) => v.toFixed(0)}
        />
      ) : (
        <InsufficientData
          title="Not enough intervals for a trend"
          message={`A trend needs at least 3 full-to-full intervals — you have ${intervals.length}.`}
        />
      )}
    </Card>
  );
}

/** "Monthly spending · ৳" — the current month in the accent, the rest inset. */
function MonthlySpendingCard({ analytics }: Props) {
  const series = monthlySeries(analytics, 6);
  const hasAny = series.some((m) => m.totalMinor > 0);
  const symbol = currencyEntry(analytics.currency)?.symbol ?? analytics.currency;
  const peak = Math.max(...series.map((m) => m.totalMinor), 0);

  return (
    <Card style={{ gap: 10 }} testID="card-monthly-spending">
      <Eyebrow>Monthly spending · {symbol}</Eyebrow>
      {hasAny ? (
        <BarChart
          data={series.map((month) => ({
            label: formatMonthLabel(month.key),
            value: month.totalMinor,
            caption: formatCurrency(month.totalMinor, analytics.currency),
          }))}
          topLabel={formatCurrencyCompact(peak, analytics.currency).replace(`${analytics.currency} `, '')}
        />
      ) : (
        <InsufficientData
          title="Nothing spent yet"
          message="Monthly spending appears once you have logged a cost."
        />
      )}
    </Card>
  );
}

/**
 * "Spending breakdowns" — named by the Pro board's own promise, so it stays on
 * the screen that promise sends the rider to.
 */
function BreakdownCard({ analytics }: Props) {
  const spend = analytics.spend;
  const max = Math.max(spend.fuel, spend.services, spend.parts, spend.accessories, spend.other, 1);

  const rows = [
    { category: 'Services', amount: spend.services, opacity: 1 },
    { category: 'Fuel', amount: spend.fuel, opacity: 0.85 },
    { category: 'Parts', amount: spend.parts, opacity: 0.7 },
    { category: 'Extras', amount: spend.accessories, opacity: 0.55 },
    { category: 'Other', amount: spend.other, opacity: 0.4 },
  ];

  return (
    <Card style={{ gap: 10 }} testID="card-spending-breakdown">
      <Eyebrow>Spending breakdown</Eyebrow>
      {rows.map((row) => (
        <SpendBar
          key={row.category}
          category={row.category}
          amount={formatCurrency(row.amount, analytics.currency)}
          fraction={row.amount / max}
          opacity={row.opacity}
        />
      ))}
    </Card>
  );
}

/** "Ownership cost" — the third thing the upsell promises. */
function OwnershipCard({ analytics }: Props) {
  const { ownership, currency, units } = analytics;

  return (
    <Card style={{ gap: 10 }} testID="card-ownership-cost">
      <Eyebrow>Ownership cost</Eyebrow>

      <StatRow>
        <StatTile
          label="Purchase"
          value={
            ownership.purchasePriceMinor === null
              ? NO_VALUE
              : formatCurrency(ownership.purchasePriceMinor, currency)
          }
        />
        <StatTile label="Running" value={formatCurrency(ownership.runningCostMinor, currency)} />
        <StatTile
          label="Total"
          value={
            ownership.totalOwnershipMinor === null
              ? NO_VALUE
              : formatCurrency(ownership.totalOwnershipMinor, currency)
          }
        />
      </StatRow>

      <StatRow>
        <StatTile
          label={`Cost / ${units.distance}`}
          value={formatRate(ownership.costPerDistanceScaled, currency)}
        />
        <StatTile label="Distance" value={formatDistance(ownership.distanceMetres, units.distance)} />
      </StatRow>

      <Txt role="helper" tone="mut">
        {ownership.purchasePriceMinor === null
          ? 'Add a purchase price in Garage to see total ownership cost. '
          : ''}
        Cost per {units.distance} uses running cost only — what you paid for the bike is capital, not an
        operating expense.
      </Txt>
    </Card>
  );
}
