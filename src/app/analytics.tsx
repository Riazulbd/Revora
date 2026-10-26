import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Eyebrow,
  Footnote,
  HeroCard,
  IconSquareButton,
  InsufficientData,
  ProBadge,
  Screen,
  SkeletonList,
  Sparkline,
  MiniBars,
  Txt,
} from '@/components';
import { monthlySeries, type BikeAnalytics } from '@/calculations/analytics';
import { costPerDistanceTrend } from '@/calculations/costTrend';
import { mileageSparkline, monthOverMonth } from '@/calculations/dashboard';
import { RELIABLE_INTERVALS_REQUIRED } from '@/calculations/mileage';
import { intervalsToReliable, mileageIntervalTotals } from '@/calculations/mileageStats';
import { currencySymbol } from '@/calculations/money';
import { efficiencyToDisplay, mileageUnitLabel } from '@/calculations/units';
import { formatRateSymbol } from '@/features/analytics/format';
import { MileageTrendChart, ProChip, SpendColumns } from '@/features/analytics/ui/AnalyticsCharts';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { ProUpsellSheet, useProGate } from '@/features/premium/ProUpsell';
import { fontFamily, useTheme } from '@/theme';
import { formatMonthLabel, formatShortDate, monthName } from '@/utils/date';
import {
  formatCurrencySymbol,
  formatDistance,
  formatMileageValue,
  formatVolume,
  NO_VALUE,
} from '@/utils/format';

/**
 * Analytics (Figma `B4 Analytics — Pro statistics`): the working behind every
 * figure.
 *
 * The bento, the trend, the monthly columns and the ownership tiles are all
 * read from `analyseBike()` and the calculations beside it. Every panel
 * refuses to draw on data it does not have; "not enough data yet" is a
 * first-class state here, because a chart of one point, or a zero standing in
 * for an unknown, would be worse than nothing (requirement 31).
 */
export default function Analytics() {
  const router = useRouter();
  const { activeBike } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();
  const proGate = useProGate();

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/more');
  };

  const header = (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconSquareButton icon="chevronLeft" accessibilityLabel="Back" onPress={back} testID="back-analytics" />
        {proGate.isPro ? <ProChip testID="chip-analytics-pro" /> : <ProBadge wide />}
      </View>
      <View style={{ gap: 2 }}>
        <Txt role="tabTitle">Analytics</Txt>
        <Txt role="subtitle" tone="mut" numberOfLines={1}>
          {`${activeBike?.nickname ?? 'Your bike'}${
            analytics ? ` · ${analytics.mileage.count} measured interval${analytics.mileage.count === 1 ? '' : 's'}` : ''
          }`}
        </Txt>
      </View>
    </View>
  );

  if (error) {
    return (
      <Screen wash testID="screen-analytics" contentStyle={{ gap: 16 }}>
        {header}
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" testID="error-analytics" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen wash testID="screen-analytics" contentStyle={{ gap: 16 }}>
        {header}
        <SkeletonList count={4} height={140} />
      </Screen>
    );
  }

  if (!analytics) return null;

  if (analytics.isEmpty) {
    return (
      <Screen wash testID="screen-analytics" contentStyle={{ gap: 16 }}>
        {header}
        <EmptyState
          icon="chart"
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

  // Free account: the whole screen is the case for Pro. Nothing is drawn
  // faintly behind a lock — the rider is told exactly what they would get and
  // sent to the plans.
  if (!proGate.isPro) {
    return (
      <Screen wash testID="screen-analytics" contentStyle={{ gap: 16 }}>
        {header}
        <EmptyState
          badge={<ProBadge wide />}
          title="The working behind every figure"
          message="Best and worst intervals, the mileage trend, monthly spending and ownership cost — computed from the log you already keep."
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
    <Screen wash onRefresh={refetch} testID="screen-analytics" contentStyle={{ gap: 16 }}>
      {header}

      <Bento analytics={analytics} />
      <TrendCard analytics={analytics} />
      <SpendingCard analytics={analytics} />
      <OwnershipCard analytics={analytics} />

      <Footnote style={{ marginTop: 0 }} testID="footnote-analytics">
        Best / worst and the rolling average unlock at five measured intervals. Below that, this screen says
        how many more are needed instead of drawing a chart the data can&rsquo;t hold.
      </Footnote>

      <ProUpsellSheet gate={proGate} />
    </Screen>
  );
}

type Props = { analytics: BikeAnalytics };

/**
 * Figma `Bento`: average on the dark card, best / worst beside it, then cost
 * per distance and the measured distance. Best / worst and the rolling
 * average stay as dashes until five intervals are measured.
 */
function Bento({ analytics }: Props) {
  const { c } = useTheme();
  const { mileage, units, currency, ownership } = analytics;
  const unit = mileageUnitLabel(units.mileage);
  const reliable = mileage.count >= RELIABLE_INTERVALS_REQUIRED;
  const toGo = intervalsToReliable(mileage.count);
  const totals = mileageIntervalTotals(mileage.intervals);
  const spark = mileageSparkline(mileage.intervals, units.mileage, 12);
  const trend = costPerDistanceTrend({
    ledger: analytics.ledger,
    points: analytics.odometer.points,
    today: analytics.today,
    distanceUnit: units.distance,
  });
  const deltaKnown = trend.deltaScaled !== null;
  const cheaper = (trend.deltaScaled ?? 0) <= 0;

  return (
    <View style={{ gap: 10 }} testID="card-mileage-stats">
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {/* Figma `Avg`. */}
        <HeroCard padding={16} gap={6} style={{ flex: 1, borderRadius: 24 }} testID="tile-average">
          <Eyebrow color={c.heroMut}>Average</Eyebrow>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Txt role="authTitle" color={mileage.average ? c.heroInk : c.heroMut} numberOfLines={1}>
              {formatMileageValue(mileage.average, units.mileage)}
            </Txt>
            <Txt role="mediumStrong" color={c.heroMut} style={{ fontFamily: fontFamily[500] }}>
              {unit}
            </Txt>
          </View>
          <Sparkline values={spark} height={40} dotFill={c.heroAcc} />
        </HeroCard>

        {/* Figma `Best worst`. */}
        <Card style={{ flex: 1, gap: 6 }} testID="tile-best-worst">
          <Eyebrow>Best / worst</Eyebrow>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Badge label="▲ Best" tone="good" size="chip" />
            <Txt role="tileValueLarge" tone={reliable && mileage.best ? 'ink' : 'mut'} numberOfLines={1}>
              {reliable ? formatMileageValue(mileage.best?.efficiency, units.mileage) : NO_VALUE}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Badge label="▼ Worst" tone="bad" size="chip" />
            <Txt role="tileValueLarge" tone={reliable && mileage.worst ? 'ink' : 'mut'} numberOfLines={1}>
              {reliable ? formatMileageValue(mileage.worst?.efficiency, units.mileage) : NO_VALUE}
            </Txt>
          </View>
          <Txt role="meta" tone="mut" numberOfLines={2}>
            {reliable
              ? `${unit} · rolling avg ${formatMileageValue(mileage.lastFive, units.mileage)}`
              : `Unlocks at ${RELIABLE_INTERVALS_REQUIRED} intervals · ${toGo} to go`}
          </Txt>
        </Card>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {/* Figma `Cost km`. */}
        <Card style={{ flex: 1, gap: 6 }} testID="tile-cost-per-distance">
          <Eyebrow>{`Cost / ${units.distance}`}</Eyebrow>
          <Txt role="figureSmall" tone={ownership.costPerDistanceScaled === null ? 'mut' : 'ink'} numberOfLines={1}>
            {formatRateSymbol(ownership.costPerDistanceScaled, currency)}
          </Txt>
          <MiniBars
            values={trend.months.map((m) => m.scaled ?? 0)}
            height={36}
            color={c.sur2}
            highlightColor={c.accBright}
            gapRatio={0.5}
          />
          <Txt role="smallStrong" tone={deltaKnown ? (cheaper ? 'good' : 'bad') : 'mut'} numberOfLines={1}>
            {deltaKnown
              ? `${cheaper ? '▼' : '▲'} ${formatRateSymbol(Math.abs(trend.deltaScaled ?? 0), currency)} vs last quarter`
              : 'Needs six ridden months to compare'}
          </Txt>
        </Card>

        {/* Figma `Distance`. */}
        <Card style={{ flex: 1, gap: 6 }} testID="tile-distance">
          <Eyebrow>Distance</Eyebrow>
          <Txt role="figureSmall" tone={totals.count > 0 ? 'ink' : 'mut'} numberOfLines={1}>
            {totals.count > 0 ? formatDistance(totals.distanceMetres, units.distance) : NO_VALUE}
          </Txt>
          <View style={{ borderTopWidth: 1, borderTopColor: c.div, paddingTop: 8, gap: 4 }}>
            <Txt role="tileLabel" tone="mut">
              {units.volume === 'L' ? 'Litres' : 'Gallons'}
            </Txt>
            <Txt role="inputNumeric" tone={totals.count > 0 ? 'ink' : 'mut'} numberOfLines={1}>
              {totals.count > 0 ? formatVolume(totals.fuelMl, units.volume) : NO_VALUE}
            </Txt>
          </View>
        </Card>
      </View>
    </View>
  );
}

/** Figma `Trend card`: the last twelve intervals, the average dashed through them, the best one ringed. */
function TrendCard({ analytics }: Props) {
  const { c } = useTheme();
  const { mileage, units } = analytics;
  const intervals = mileage.intervals.slice(-12);
  const values = intervals.map((interval) => efficiencyToDisplay(interval.efficiency, units.mileage));
  const average = mileage.average === null ? null : efficiencyToDisplay(mileage.average, units.mileage);
  const bestIndex = mileage.best ? intervals.findIndex((i) => i.toEntryId === mileage.best?.toEntryId) : -1;
  const latest = intervals[intervals.length - 1];
  const unit = mileageUnitLabel(units.mileage);

  // Four dates along the bottom: the first, two spaced through, and the last.
  const labelAt = (share: number) => intervals[Math.round(share * (intervals.length - 1))];
  const xLabels = intervals.length >= 2 ? [labelAt(0), labelAt(1 / 3), labelAt(2 / 3), labelAt(1)] : [];

  return (
    <Card style={{ gap: 12 }} testID="card-mileage-trend">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ gap: 2, flexShrink: 1 }}>
          <Txt role="cardTitle">Mileage trend</Txt>
          <Txt role="meta" tone="mut">{`${unit} per interval · last ${intervals.length}`}</Txt>
        </View>
        {latest ? <Badge label={`Latest ${formatMileageValue(latest.efficiency, units.mileage)}`} tone="accent" size="wide" /> : null}
      </View>

      {intervals.length >= 3 ? (
        <>
          <MileageTrendChart values={values} average={average} bestIndex={bestIndex >= 0 ? bestIndex : null} testID="chart-mileage-line" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {xLabels.map((interval, index) => (
              <Txt key={`${interval?.toEntryId ?? index}-${index}`} role="micro" tone="faint">
                {interval ? formatShortDate(interval.date) : ''}
              </Txt>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: c.accBright }} />
              <Txt role="micro" tone="mut">
                Interval mileage
              </Txt>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: c.faint }} />
              <Txt role="micro" tone="mut">{`Average ${formatMileageValue(mileage.average, units.mileage)} (dashed)`}</Txt>
            </View>
          </View>
        </>
      ) : (
        <InsufficientData
          title="Not enough intervals for a trend"
          message={`A trend needs at least 3 full-to-full intervals — you have ${intervals.length}.`}
        />
      )}
    </Card>
  );
}

/** Figma `Spending card`: six months of columns, the current one in the accent and named in bold. */
function SpendingCard({ analytics }: Props) {
  const series = monthlySeries(analytics, 6);
  const hasAny = series.some((m) => m.totalMinor > 0);
  const current = series[series.length - 1];
  const change = monthOverMonth(series);
  const symbol = currencySymbol(analytics.currency);

  const subtitle = current
    ? `${monthName(`${current.key}-01`).slice(0, 3)} ${formatCurrencySymbol(current.totalMinor, analytics.currency)}${
        change ? ` · ${change.lower ? '▼' : '▲'} ${change.percent}% vs ${formatMonthLabel(change.previousKey)}` : ''
      }`
    : 'Nothing spent yet';

  return (
    <Card style={{ gap: 12 }} testID="card-monthly-spending">
      <View style={{ gap: 2 }}>
        <Txt role="cardTitle">{`Monthly spending · ${symbol}`}</Txt>
        <Txt role="meta" tone="mut">
          {subtitle}
        </Txt>
      </View>
      {hasAny ? (
        <>
          <SpendColumns values={series.map((m) => m.totalMinor)} testID="chart-spend-bars" />
          <View style={{ flexDirection: 'row' }}>
            {series.map((month, index) => {
              const last = index === series.length - 1;
              return (
                <Txt
                  key={month.key}
                  role="micro"
                  tone={last ? 'ink' : 'faint'}
                  align="center"
                  style={{ flex: 1, fontFamily: fontFamily[last ? 700 : 500] }}
                >
                  {formatMonthLabel(month.key)}
                </Txt>
              );
            })}
          </View>
        </>
      ) : (
        <InsufficientData title="Nothing spent yet" message="Monthly spending appears once you have logged a cost." />
      )}
    </Card>
  );
}

/** Figma `Ownership card`: purchase, running and the total, the total on the soft accent. */
function OwnershipCard({ analytics }: Props) {
  const { c } = useTheme();
  const { ownership, currency } = analytics;

  const tile = (label: string, value: string, accent = false) => (
    <View style={{ flex: 1, borderRadius: 16, padding: 12, gap: 4, backgroundColor: accent ? c.accS : c.field }}>
      <Txt role="tileLabel" color={accent ? c.accText : c.mut} numberOfLines={1}>
        {label}
      </Txt>
      <Txt role="rowTitleLarge" tone={value === NO_VALUE ? 'mut' : 'ink'} numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fontFamily[700] }}>
        {value}
      </Txt>
    </View>
  );

  return (
    <Card style={{ gap: 12 }} testID="card-ownership-cost">
      <Txt role="cardTitle">Ownership cost</Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {tile('Purchase', ownership.purchasePriceMinor === null ? NO_VALUE : formatCurrencySymbol(ownership.purchasePriceMinor, currency))}
        {tile('Running', formatCurrencySymbol(ownership.runningCostMinor, currency))}
        {tile('Total', ownership.totalOwnershipMinor === null ? NO_VALUE : formatCurrencySymbol(ownership.totalOwnershipMinor, currency), true)}
      </View>
      {ownership.purchasePriceMinor === null ? (
        <Txt role="helper" tone="mut">
          Add a purchase price in Garage to see total ownership cost.
        </Txt>
      ) : null}
    </Card>
  );
}
