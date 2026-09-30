import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Banner,
  Button,
  Card,
  ChipGroup,
  Divider,
  Eyebrow,
  EmptyState,
  ErrorState,
  MenuRow,
  ProBadge,
  Screen,
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
import { buildFuelLog, filterFuelLog, type FuelLogFilter } from '@/calculations/fuellog';
import { volumeUnitLabel } from '@/calculations/units';
import { monthName } from '@/utils/date';
import { formatCurrency, formatDistance, formatPricePerVolume, formatVolume } from '@/utils/format';
import { useTheme } from '@/theme';
import type { CurrencyCode, UnitPreferences } from '@/types';

const FILTERS = [
  { value: 'all' as const, label: 'All fills' },
  { value: 'full' as const, label: 'Full' },
  { value: 'partial' as const, label: 'Partial' },
  { value: 'adjusted' as const, label: 'Adjustments' },
];

/**
 * The fuel log.
 *
 * One timeline carries fills and adjustments together, because an adjustment is
 * fuel that left the tank without covering distance: hiding it here would make
 * the mileage figures look arbitrary. The merge, the ordering and the filters
 * are `src/calculations/fuellog.ts` — this screen only draws them.
 */
export default function FuelTab() {
  const router = useRouter();
  const { c, radius } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();
  const connectivity = useConnectivity();
  const proGate = useProGate();
  const [filter, setFilter] = useState<FuelLogFilter>('all');
  const [explainOpen, setExplainOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const entries = useMemo(() => analytics?.fuel.entries ?? [], [analytics]);

  const log = useMemo(
    () =>
      buildFuelLog(
        analytics?.fuel.entries ?? [],
        analytics?.fuel.adjustments ?? [],
        analytics?.mileage.intervals ?? [],
      ),
    [analytics],
  );

  const filtered = useMemo(() => filterFuelLog(log, filter), [log, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const hasLog = analytics !== null && log.length > 0;
  // The board that draws a filter matching nothing drops the summary card with
  // it: what is left on screen is the filter and the sentence explaining it.
  const showSummary = hasLog && filtered.length > 0;

  const header = (
    <View>
      <TabHeader
        title="Fuel"
        action={
          <Button
            label="Add fuel"
            icon="plus"
            size="compact"
            onPress={() => router.push('/fuel/add')}
            testID="cta-add-fuel"
          />
        }
        style={{ marginBottom: connectivity.isOnline ? 16 : 14 }}
      />

      {!connectivity.isOnline ? (
        <Banner
          icon="wifiOff"
          lead="You're offline."
          message="Fills you log now are saved on this phone and sync later."
          style={{ marginBottom: 12 }}
          testID="banner-offline"
        />
      ) : null}

      {showSummary && analytics ? (
        <Card style={{ gap: 12 }} testID="card-fuel-summary">
          <Eyebrow>{monthName(analytics.today)}</Eyebrow>
          <StatRow>
            <StatTile
              label="Spend"
              value={formatCurrency(analytics.fuel.thisMonthSpendMinor, analytics.currency)}
            />
            <StatTile label="Fills" value={String(analytics.fuel.thisMonthFills)} />
            <StatTile label="Fuel" value={formatVolume(analytics.fuel.thisMonthLitresMl, units.volume)} />
          </StatRow>
          <Divider />
          <Eyebrow>All time</Eyebrow>
          <StatRow>
            <StatTile
              label="Spend"
              value={formatCurrency(analytics.fuel.allTime.spendMinor, analytics.currency)}
            />
            <StatTile label="Fills" value={String(analytics.fuel.allTime.fills)} />
            <StatTile
              label="Avg price"
              value={formatPricePerVolume(analytics.fuel.averagePricePerLitreMinor, analytics.currency)}
              suffix={`/${volumeUnitLabel(units.volume)}`}
            />
          </StatRow>
        </Card>
      ) : null}

      {hasLog ? (
        <ChipGroup
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          style={{ marginTop: showSummary ? 14 : 0, marginBottom: 14 }}
          testID="filter-fuel"
        />
      ) : null}
    </View>
  );

  const footer =
    analytics && entries.length > 0 ? (
      <View style={{ gap: 12, marginTop: 16 }}>
        <Card variant="flush" style={{ paddingHorizontal: 15, paddingVertical: 2 }}>
          <MenuRow label="How mileage is calculated" onPress={() => setExplainOpen(true)} />
        </Card>
        <Card variant="flush" style={{ paddingHorizontal: 15, paddingVertical: 2 }}>
          <MenuRow
            label="Export fuel history (CSV)"
            badge={proGate.isPro ? undefined : <ProBadge />}
            onPress={() => {
              if (!proGate.isPro) {
                proGate.open('Export fuel history');
                return;
              }
              toast.show('Preparing your CSV…');
              void proGate
                .exportFuelCsv(entries, analytics.fuel.adjustments, analytics.currency, units)
                .catch(() => undefined);
            }}
            testID="row-export"
          />
        </Card>
      </View>
    ) : null;

  if (error) {
    return (
      <Screen variant="tab" testID="screen-fuel">
        <TabHeader title="Fuel" />
        <ErrorState
          title="Couldn't load fuel history"
          message={error.message}
          onRetry={() => void refetch()}
          variant="page"
        />
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

  /** The list is one card: only its ends are rounded, every row shares the surface. */
  const slice = (index: number) => {
    const first = index === 0;
    const last = index === filtered.length - 1;
    return {
      backgroundColor: c.sur,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderTopWidth: first ? 1 : 0,
      borderBottomWidth: last ? 1 : 0,
      borderColor: c.brd,
      borderTopLeftRadius: first ? radius.listCard : 0,
      borderTopRightRadius: first ? radius.listCard : 0,
      borderBottomLeftRadius: last ? radius.listCard : 0,
      borderBottomRightRadius: last ? radius.listCard : 0,
      paddingHorizontal: 16,
    } as const;
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <FlatList
        testID="screen-fuel"
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          log.length === 0 ? (
            <>
              <EmptyState
                icon="fuel"
                title="Your fills will live here"
                message="Log every fill — litres, price, and whether the tank was full. Two full-tank fills in a row is what unlocks a measured km/L."
                testID="empty-fuel"
              />
              <ExampleFill units={units} currency={analytics?.currency ?? units.currency} />
            </>
          ) : (
            <FilteredEmpty filter={filter} onShowAll={() => setFilter('all')} />
          )
        }
        renderItem={({ item, index }) => (
          <View style={slice(index)}>
            {item.kind === 'fill' ? (
              <FuelRow
                entry={item.entry}
                interval={item.interval}
                units={units}
                onPress={() => router.push({ pathname: '/fuel/[id]', params: { id: item.entry.id } })}
                testID={`fuel-row-${item.entry.id}`}
              />
            ) : (
              <FuelAdjustmentRow
                adjustment={item.adjustment}
                units={units}
                testID={`fuel-adjustment-${item.adjustment.id}`}
              />
            )}
          </View>
        )}
        ItemSeparatorComponent={() => (
          <View style={{ backgroundColor: c.sur, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.brd }}>
            <Divider inset={16} />
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 100 }}
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
      <SectionEyebrow top={20}>What a fill looks like</SectionEyebrow>
      <Card
        variant="dashed"
        accessibilityLabel="Example fill: 8.2 litres, full tank"
        testID="example-fill"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Txt role="rowTitle" tone="mut">
              {`16 Sep · ${formatDistance(6_214_000, units.distance)}`}
            </Txt>
            <Txt role="meta" tone="mut">
              {`${formatVolume(8_200, units.volume)} · Full tank`}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Txt role="rowTitle" tone="mut">
              {formatCurrency(100_400, currency)}
            </Txt>
            <Badge label="km/L later" tone="neutral" />
          </View>
        </View>
      </Card>
    </View>
  );
}

/**
 * A filter that matched nothing.
 *
 * The distinction that matters: an empty "Partial" filter is not a gap in the
 * log, it is a fact about the bike — every fill was a full tank, which is the
 * best case for mileage. Saying "no results" would read as a failure.
 */
function FilteredEmpty({ filter, onShowAll }: { filter: FuelLogFilter; onShowAll: () => void }) {
  const copy: Record<Exclude<FuelLogFilter, 'all'>, { title: string; message: string }> = {
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
  const { title, message } = copy[filter === 'all' ? 'partial' : filter];

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
