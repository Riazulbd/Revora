import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Banner,
  Button,
  Card,
  CardHeader,
  ChipGroup,
  Divider,
  EmptyState,
  ErrorState,
  HeroCard,
  HeroFigure,
  HeroHead,
  IconSquareButton,
  LinkButton,
  MiniBars,
  PageWash,
  Screen,
  Segmented,
  SectionEyebrow,
  SkeletonList,
  StatRow,
  StatTile,
  TabHeader,
  Txt,
  useToast,
} from '@/components';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { FuelRow } from '@/features/fuel/FuelRow';
import { FuelAdjustmentRow } from '@/features/fuel/ui/FuelAdjustmentRow';
import { MileageExplainSheet } from '@/features/fuel/MileageExplainSheet';
import { ProUpsellSheet, useProGate } from '@/features/premium/ProUpsell';
import { useConnectivity } from '@/services/connectivity';
import {
  FUEL_RANGE_LABEL,
  buildFuelLog,
  filterFuelLog,
  filterFuelLogByRange,
  fuelRangeSummary,
  type FuelLogFilter,
  type FuelRange,
} from '@/calculations/fuellog';
import { efficiencyToDisplay, mileageUnitLabel, volumeUnitLabel } from '@/calculations/units';
import { formatCurrencySymbol, formatDistance, formatMileageValue, formatPricePerVolumeSymbol, formatVolume } from '@/utils/format';
import { todayIso } from '@/utils/date';
import { useTheme } from '@/theme';
import type { CurrencyCode, UnitPreferences } from '@/types';

const RANGES = [
  { value: '3m' as const, label: '3 months' },
  { value: 'year' as const, label: 'Year' },
  { value: 'all' as const, label: 'All time' },
];

const FILTERS = [
  { value: 'all' as const, label: 'All fills' },
  { value: 'full' as const, label: 'Full' },
  { value: 'partial' as const, label: 'Partial' },
  { value: 'adjusted' as const, label: 'Adjustments' },
];

/** How many intervals the hero's bars show. */
const HERO_BARS = 13;

/**
 * The fuel log (Figma `03 Fuel — tab`).
 *
 * The range switch drives everything under it: the hero's average mileage,
 * spend, fills and price, and the list. One timeline carries fills and
 * adjustments together, because an adjustment is fuel that left the tank
 * without covering distance: hiding it would make the mileage figures look
 * arbitrary. Ranges, merging, ordering and filters are
 * `src/calculations/fuellog.ts` — this screen only draws them.
 */
export default function FuelTab() {
  const router = useRouter();
  const { c, radius } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { units, activeBike } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();
  const connectivity = useConnectivity();
  const proGate = useProGate();
  const [range, setRange] = useState<FuelRange>('3m');
  const [filter, setFilter] = useState<FuelLogFilter>('all');
  const [explainOpen, setExplainOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const today = analytics?.today ?? todayIso();
  const entries = useMemo(() => analytics?.fuel.entries ?? [], [analytics]);
  const intervals = useMemo(() => analytics?.mileage.intervals ?? [], [analytics]);

  const log = useMemo(
    () => buildFuelLog(entries, analytics?.fuel.adjustments ?? [], intervals),
    [entries, analytics, intervals],
  );
  const ranged = useMemo(() => filterFuelLogByRange(log, range, today), [log, range, today]);
  const filtered = useMemo(() => filterFuelLog(ranged, filter), [ranged, filter]);
  const summary = useMemo(() => fuelRangeSummary(entries, intervals, range, today), [entries, intervals, range, today]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const exportCsv = () => {
    if (!analytics) return;
    if (!proGate.isPro) {
      proGate.open('Export fuel history');
      return;
    }
    toast.show('Preparing your CSV…');
    void proGate.exportFuelCsv(entries, analytics.fuel.adjustments, analytics.currency, units).catch(() => undefined);
  };

  const subtitle = `${activeBike?.nickname ?? 'Your bike'} · ${FUEL_RANGE_LABEL[range]}`;
  const hasLog = analytics !== null && log.length > 0;

  if (error) {
    return (
      <Screen variant="tab" testID="screen-fuel">
        <TabHeader title="Fuel" />
        <ErrorState title="Couldn't load fuel history" message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen variant="tab" testID="screen-fuel">
        <TabHeader title="Fuel" />
        <SkeletonList count={4} />
      </Screen>
    );
  }

  const header = (
    <View style={{ gap: 16 }}>
      <TabHeader
        title="Fuel"
        subtitle={subtitle}
        action={
          entries.length > 0 ? (
            <IconSquareButton
              icon="download"
              accessibilityLabel={proGate.isPro ? 'Export fuel history (CSV)' : 'Export fuel history (CSV), Pro'}
              onPress={exportCsv}
              testID="row-export"
            />
          ) : undefined
        }
        style={{ marginBottom: 0 }}
      />

      {!connectivity.isOnline ? (
        <Banner
          icon="wifiOff"
          lead="You're offline."
          message="Fills you log now are saved on this phone and sync later."
          testID="banner-offline"
        />
      ) : null}

      {hasLog ? (
        <>
          <Segmented options={RANGES} value={range} onChange={setRange} size="compact" testID="range-fuel" />
          <MileageHero
            summary={summary}
            units={units}
            currency={analytics.currency}
            onExplain={() => setExplainOpen(true)}
          />
        </>
      ) : null}

      <Button
        label="Add fuel"
        icon="plus"
        size="xlarge"
        onPress={() => router.push('/fuel/add')}
        testID="cta-add-fuel"
      />

      {hasLog ? (
        <ChipGroup options={FILTERS} value={filter} onChange={setFilter} size="compact" testID="filter-fuel" />
      ) : null}

      {hasLog ? (
        // The top of the "All fills" card; the rows below continue its surface.
        <View
          style={{
            backgroundColor: c.sur,
            borderTopLeftRadius: radius.card,
            borderTopRightRadius: radius.card,
            paddingTop: 16,
            paddingHorizontal: 16,
          }}
        >
          <CardHeader
            title="All fills"
            style={{ paddingBottom: 2 }}
            {...(range !== 'all'
              ? { action: <LinkButton label="Show all" onPress={() => setRange('all')} testID="cta-show-all-time" /> }
              : {})}
          />
        </View>
      ) : null}
    </View>
  );

  const cardSide = { backgroundColor: c.sur, paddingHorizontal: 16 } as const;
  const footer = hasLog ? (
    <View
      style={{
        ...cardSide,
        height: 8,
        borderBottomLeftRadius: radius.card,
        borderBottomRightRadius: radius.card,
      }}
    />
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <PageWash />
      <FlatList
        testID="screen-fuel"
        data={hasLog ? filtered : []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          !hasLog ? (
            <View style={{ marginTop: 16 }}>
              <EmptyState
                icon="fuel"
                title="Your fills will live here"
                message="Log every fill — litres, price, and whether the tank was full. Two full-tank fills in a row is what unlocks a measured km/L."
                testID="empty-fuel"
              />
              <ExampleFill units={units} currency={analytics?.currency ?? units.currency} />
            </View>
          ) : (
            <View style={cardSide}>
              <FilteredEmpty
                filter={filter}
                range={range}
                onShowAll={() => {
                  setFilter('all');
                  setRange('all');
                }}
              />
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={cardSide}>
            {item.kind === 'fill' ? (
              <FuelRow
                entry={item.entry}
                interval={item.interval}
                units={units}
                onPress={() => router.push({ pathname: '/fuel/[id]', params: { id: item.entry.id } })}
                testID={`fuel-row-${item.entry.id}`}
              />
            ) : (
              <FuelAdjustmentRow adjustment={item.adjustment} units={units} testID={`fuel-adjustment-${item.adjustment.id}`} />
            )}
          </View>
        )}
        ItemSeparatorComponent={() => (
          <View style={cardSide}>
            <Divider />
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 112 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.acc}
            colors={[c.acc]}
            progressBackgroundColor={c.sur}
          />
        }
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={7}
      />

      <MileageExplainSheet visible={explainOpen} onClose={() => setExplainOpen(false)} analytics={analytics} />
      <ProUpsellSheet gate={proGate} />
    </View>
  );
}

/**
 * Figma `Hero — mileage`: the range's distance-weighted average, a bar per
 * interval that closed in it (the latest in orange, a dashed rule at the
 * average), and spend, fills and price for the same range.
 */
function MileageHero({
  summary,
  units,
  currency,
  onExplain,
}: {
  summary: ReturnType<typeof fuelRangeSummary>;
  units: UnitPreferences;
  currency: CurrencyCode;
  onExplain: () => void;
}) {
  const { c } = useTheme();
  const bars = summary.intervals.slice(-HERO_BARS).map((i) => efficiencyToDisplay(i.efficiency, units.mileage));
  // On L/100km a short bar is the good one; the chart still plots the figure
  // as printed, so the dashed average sits where the number says.
  const average = summary.average ? efficiencyToDisplay(summary.average, units.mileage) : undefined;

  return (
    <HeroCard gap={14} testID="card-fuel-summary">
      <HeroHead eyebrow="Average mileage" chip="How it's calculated" chipIcon="info" onChipPress={onExplain} chipTestID="link-explain" />
      <HeroFigure
        value={summary.average ? formatMileageValue(summary.average, units.mileage) : undefined}
        unit={mileageUnitLabel(units.mileage)}
        testID="hero-mileage"
      />
      {bars.length > 0 ? (
        <MiniBars
          values={bars}
          height={80}
          color={c.heroLine}
          highlightColor={c.heroAcc}
          {...(average === undefined ? {} : { reference: average, referenceColor: c.heroAcc })}
          gapRatio={0.55}
          baseline="spread"
          testID="chart-fuel-bars"
        />
      ) : (
        <Txt role="helper" color={c.heroMut}>
          No interval closed in this range. Two full-tank fills in a row measure one.
        </Txt>
      )}
      <StatRow>
        <StatTile variant="hero" valueSize="md" label="Spend" value={formatCurrencySymbol(summary.totals.spendMinor, currency)} />
        <StatTile variant="hero" valueSize="md" label="Fills" value={String(summary.totals.fills)} />
        <StatTile
          variant="hero"
          valueSize="md"
          label="Avg price"
          value={formatPricePerVolumeSymbol(summary.averagePricePerLitreMinor, currency)}
          suffix={`/${volumeUnitLabel(units.volume)}`}
        />
      </StatRow>
    </HeroCard>
  );
}

/**
 * A worked example under the empty state.
 *
 * A rider who has logged nothing has no idea what a fill record contains or
 * why the app keeps asking whether the tank was full. One example row answers
 * both in less space than a paragraph — and it is unmistakably an example,
 * dashed and captioned, never passed off as their data.
 */
function ExampleFill({ units, currency }: { units: UnitPreferences; currency: CurrencyCode }) {
  return (
    <View>
      <SectionEyebrow>What a fill looks like</SectionEyebrow>
      <Card variant="dashed" accessibilityLabel="Example fill: 8.2 litres, full tank" testID="example-fill">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Txt role="rowTitleLarge" tone="mut">
              {`${formatVolume(8_200, units.volume)} · Full`}
            </Txt>
            <Txt role="meta" tone="mut">
              {`16 Sep · ${formatDistance(6_214_000, units.distance)}`}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Txt role="rowTitleLarge" tone="mut">
              {formatCurrencySymbol(100_400, currency)}
            </Txt>
            <Txt role="micro" tone="mut">
              {`${mileageUnitLabel(units.mileage)} later`}
            </Txt>
          </View>
        </View>
      </Card>
    </View>
  );
}

/**
 * A filter or range that matched nothing.
 *
 * The distinction that matters: an empty "Partial" filter is not a gap in the
 * log, it is a fact about the bike — every fill was a full tank, which is the
 * best case for mileage. Saying "no results" would read as a failure.
 */
function FilteredEmpty({
  filter,
  range,
  onShowAll,
}: {
  filter: FuelLogFilter;
  range: FuelRange;
  onShowAll: () => void;
}) {
  const copy: Record<FuelLogFilter, { title: string; message: string }> = {
    all: {
      title: 'No fills in this range',
      message: `Nothing was logged in the ${FUEL_RANGE_LABEL[range].toLowerCase()}.`,
    },
    full: {
      title: 'No full-tank fills',
      message: 'Mileage is measured between two full tanks, so marking your next one Full unlocks it.',
    },
    partial: {
      title: 'No partial fills',
      message: 'Every fill so far was a full tank — good news for mileage.',
    },
    adjusted: {
      title: 'No adjustments',
      message: 'Nothing has been logged as spilled, leaked or drained. That is the normal case.',
    },
  };
  const { title, message } = copy[filter];

  return (
    <EmptyState
      size="compact"
      title={title}
      message={message}
      secondaryAction={{ label: 'Show all fills', onPress: onShowAll, testID: 'cta-show-all-fills' }}
      testID="empty-fuel-filtered"
    />
  );
}
