import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  ErrorState,
  BarChart,
  Card,
  CardHeader,
  EmptyState,
  Eyebrow,
  Icon,
  InsufficientData,
  ProBadge,
  Screen,
  ScreenHeader,
  SkeletonList,
  SpendBar,
  Stack,
  StatTile,
  TrendChart,
  Txt,
} from '@/components';
import { monthlySeries, type BikeAnalytics } from '@/calculations/analytics';
import { mileageBlockerMessage, RELIABLE_INTERVALS_REQUIRED } from '@/calculations/mileage';
import { efficiencyToDisplay, mileageUnitLabel } from '@/calculations/units';
import { useGarageData } from '@/features/bikes/useGarageData';
import { ProUpsellSheet, useProGate } from '@/features/premium/ProUpsell';
import { formatMonthLabel, formatShortDate } from '@/utils/date';
import {
  formatCurrency,
  formatDistance,
  formatMileageValue,
  formatPricePerVolume,
  formatRate,
  formatVolume,
  NO_VALUE,
} from '@/utils/format';
import { useTheme } from '@/theme';

/**
 * Analytics.
 *
 * Every panel refuses to draw on data it does not have. "Not enough data yet" is
 * a first-class state here, not an afterthought — a chart of one point, or a zero
 * standing in for an unknown, would be worse than nothing (requirement 31).
 */
export default function Analytics() {
  const router = useRouter();
  const { analytics, isPending, error, refetch } = useGarageData();
  const proGate = useProGate();

  if (error) {
    return (
      <Screen testID="screen-analytics">
        <ScreenHeader title="Analytics" />
        <ErrorState
          message={error.message}
          onRetry={() => void refetch()}
          variant="page"
        />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-analytics">
        <ScreenHeader title="Analytics" />
        <SkeletonList count={4} height={140} />
      </Screen>
    );
  }

  if (!analytics) return null;

  if (analytics.isEmpty) {
    return (
      <Screen testID="screen-analytics">
        <ScreenHeader title="Analytics" />
        <EmptyState
          icon="dashboard"
          title="Nothing to analyse yet"
          message="Log a fill-up or a service and the numbers start here. Revora only ever shows figures it can calculate from what you logged."
          primaryAction={{ label: 'Log a fill-up', onPress: () => router.push('/fuel/add') }}
          variant="page"
          testID="empty-analytics"
        />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refetch} testID="screen-analytics">
      <ScreenHeader title="Analytics" />

      <Stack>
        <LatestCalculationCard analytics={analytics} />
        {proGate.isPro ? <MileageStatsCard analytics={analytics} /> : null}
        {proGate.isPro ? <TrendPanel analytics={analytics} /> : null}
        <MonthlySpendingCard analytics={analytics} />
        <BreakdownCard analytics={analytics} />
        <OwnershipCard analytics={analytics} />
        {proGate.isPro ? <FuelPriceCard analytics={analytics} /> : null}

        {proGate.isPro ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() => proGate.open('Detailed consumption reports')}
            testID="cta-pro-reports"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <ProReportsCard />
          </Pressable>
        )}
      </Stack>

      <ProUpsellSheet gate={proGate} />
    </Screen>
  );
}

type Props = { analytics: BikeAnalytics };

function LatestCalculationCard({ analytics }: Props) {
  const { c, radius } = useTheme();
  const latest = analytics.mileage.latest;
  const units = analytics.units;

  if (!latest) {
    return (
      <Card>
        <Eyebrow>LATEST FUEL CALCULATION</Eyebrow>
        <InsufficientData
          title="No complete interval yet"
          message={mileageBlockerMessage(analytics.mileage.blockedBy ?? 'no_fills')}
          style={{ marginTop: 12 }}
        />
      </Card>
    );
  }

  return (
    <Card>
      <Eyebrow>LATEST FUEL CALCULATION · {formatShortDate(latest.date).toUpperCase()}</Eyebrow>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          backgroundColor: c.sur2,
          borderRadius: radius.input,
          paddingVertical: 16,
          marginTop: 12,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <Figure
          value={formatDistance(latest.distanceMetres, units.distance).replace(` ${units.distance}`, '')}
          label={`${units.distance.toUpperCase()} RIDDEN`}
        />
        <Txt role="cardTitle" tone="mut">
          ÷
        </Txt>
        <Figure value={formatVolume(latest.fuelMl, units.volume).replace(/ .*/, '')} label="LITRES" />
        <Txt role="cardTitle" tone="mut">
          =
        </Txt>
        <Figure
          value={formatMileageValue(latest.efficiency, units.mileage)}
          label={mileageUnitLabel(units.mileage).toUpperCase()}
          accent
        />
      </View>

      <Txt role="helper" tone="mut">
        Distance between two full tanks ÷ fuel used in between.{' '}
        {latest.confidence === 'high'
          ? 'High confidence — both fills were full and nothing sat between them.'
          : latest.confidence === 'medium'
            ? `Medium confidence — ${latest.partialFills} partial fill${latest.partialFills === 1 ? '' : 's'} counted into this interval.`
            : 'Estimated — a fill of unknown level is counted into this interval.'}
        {latest.hasAdjustments
          ? ` Adjustments of ${formatVolume(latest.rawFuelMl - latest.fuelMl, units.volume)} were excluded.`
          : ''}
      </Txt>
    </Card>
  );
}

function Figure({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 2, minWidth: 64 }}>
      <Txt role="figureSmall" tone={accent ? 'acc' : 'ink'} numberOfLines={1}>
        {value}
      </Txt>
      <Txt role="tileLabel" tone="mut" uppercase numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

function MileageStatsCard({ analytics }: Props) {
  const units = analytics.units;
  const { mileage } = analytics;

  return (
    <Card>
      <Eyebrow>MILEAGE STATS</Eyebrow>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <StatTile
          variant="centered"
          label="AVERAGE"
          value={formatMileageValue(mileage.average, units.mileage)}
        />
        <StatTile
          variant="centered"
          label="LAST 5 AVG"
          value={formatMileageValue(mileage.lastFive, units.mileage)}
        />
        <StatTile
          variant="centered"
          label="BEST / WORST"
          value={
            mileage.best && mileage.worst
              ? `${formatMileageValue(mileage.best.efficiency, units.mileage)} / ${formatMileageValue(
                  mileage.worst.efficiency,
                  units.mileage,
                )}`
              : NO_VALUE
          }
        />
      </View>

      {mileage.count < RELIABLE_INTERVALS_REQUIRED ? (
        <Txt role="helper" tone="mut" style={{ marginTop: 12 }}>
          Best, worst and last-5 need at least {RELIABLE_INTERVALS_REQUIRED} reliable intervals — you have{' '}
          {mileage.count}. No estimates, ever.
        </Txt>
      ) : (
        <Txt role="helper" tone="mut" style={{ marginTop: 12 }}>
          Built from {mileage.count} full-to-full intervals. The average is total distance ÷ total fuel, not a
          mean of the individual figures.
        </Txt>
      )}
    </Card>
  );
}

function TrendPanel({ analytics }: Props) {
  const units = analytics.units;
  const intervals = analytics.mileage.intervals.slice(-8);

  return (
    <Card>
      <Eyebrow>MILEAGE TREND</Eyebrow>
      <View style={{ marginTop: 12 }}>
        {intervals.length >= 3 ? (
          <TrendChart
            points={intervals.map((interval) => ({
              value: efficiencyToDisplay(interval.efficiency, units.mileage),
              label: formatShortDate(interval.date),
            }))}
            formatValue={(v) => v.toFixed(1)}
          />
        ) : (
          <InsufficientData
            title="Not enough intervals for a trend"
            message={`A trend needs at least 3 full-to-full intervals — you have ${intervals.length}.`}
          />
        )}
      </View>
    </Card>
  );
}

function MonthlySpendingCard({ analytics }: Props) {
  const series = monthlySeries(analytics, 6);
  const hasAny = series.some((m) => m.totalMinor > 0);

  return (
    <Card>
      <Eyebrow>MONTHLY SPENDING</Eyebrow>
      <View style={{ marginTop: 14 }}>
        {hasAny ? (
          <BarChart
            data={series.map((month) => ({
              label: formatMonthLabel(month.key),
              value: month.totalMinor,
              caption: formatCurrency(month.totalMinor, analytics.currency).replace(
                `${analytics.currency} `,
                '',
              ),
            }))}
          />
        ) : (
          <InsufficientData
            title="Nothing spent yet"
            message="Monthly spending appears once you have logged a cost."
          />
        )}
      </View>
    </Card>
  );
}

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
    <Card>
      <Eyebrow>SPENDING BREAKDOWN</Eyebrow>
      <View style={{ gap: 10, marginTop: 12 }}>
        {rows.map((row) => (
          <SpendBar
            key={row.category}
            category={row.category}
            amount={formatCurrency(row.amount, analytics.currency)}
            fraction={row.amount / max}
            opacity={row.opacity}
          />
        ))}
      </View>
    </Card>
  );
}

function OwnershipCard({ analytics }: Props) {
  const { ownership, currency, units } = analytics;

  return (
    <Card>
      <Eyebrow>OWNERSHIP COST</Eyebrow>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <StatTile
          label="PURCHASE"
          value={
            ownership.purchasePriceMinor === null
              ? NO_VALUE
              : formatCurrency(ownership.purchasePriceMinor, currency)
          }
        />
        <StatTile label="RUNNING" value={formatCurrency(ownership.runningCostMinor, currency)} />
        <StatTile
          label="TOTAL"
          value={
            ownership.totalOwnershipMinor === null
              ? NO_VALUE
              : formatCurrency(ownership.totalOwnershipMinor, currency)
          }
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <StatTile
          label={`COST / ${units.distance.toUpperCase()}`}
          value={formatRate(ownership.costPerDistanceScaled, currency)}
        />
        <StatTile label="DISTANCE" value={formatDistance(ownership.distanceMetres, units.distance)} />
      </View>

      <Txt role="helper" tone="mut" style={{ marginTop: 12 }}>
        {ownership.purchasePriceMinor === null
          ? 'Add a purchase price in Garage to see total ownership cost. '
          : ''}
        Cost per {units.distance} uses running cost only — what you paid for the bike is capital, not an
        operating expense.
      </Txt>
    </Card>
  );
}

function FuelPriceCard({ analytics }: Props) {
  const points = analytics.fuel.priceTrend;
  const units = analytics.units;

  return (
    <Card>
      <CardHeader title="FUEL PRICE TREND" style={{ marginBottom: 12 }} />
      {points.length >= 3 ? (
        <>
          <TrendChart
            points={points.slice(-8).map((point) => ({
              value: point.pricePerLitreMinor / 100,
              label: formatShortDate(point.date),
            }))}
            formatValue={(v) => v.toFixed(0)}
          />
          <Txt role="helper" tone="mut" style={{ marginTop: 8 }}>
            Average paid: {formatPricePerVolume(analytics.fuel.averagePricePerLitreMinor, analytics.currency)}{' '}
            per {units.volume}
          </Txt>
        </>
      ) : (
        <InsufficientData
          title="Not enough fills for a price trend"
          message={`Price movement needs at least 3 fills — you have ${points.length}.`}
        />
      )}
    </Card>
  );
}

function ProReportsCard() {
  const { c } = useTheme();

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 13,
          backgroundColor: c.accS,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="lock" size={20} color={c.acc} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt role="rowTitle">Detailed consumption reports</Txt>
          <ProBadge />
        </View>
        <Txt role="metaSmall" tone="mut">
          Per-month km/L, price sensitivity, CSV export
        </Txt>
      </View>
      <Icon name="chevronRight" size={16} color={c.mut} strokeWidth={2.2} />
    </Card>
  );
}
