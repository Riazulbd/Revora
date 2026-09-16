import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Banner,
  Button,
  Card,
  ChipGroup,
  Eyebrow,
  EmptyState,
  ErrorState,
  MenuRow,
  ProBadge,
  Screen,
  SkeletonList,
  TabHeader,
  Txt,
  useToast,
} from '@/components';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { FuelRow } from '@/features/fuel/FuelRow';
import { MileageExplainSheet } from '@/features/fuel/MileageExplainSheet';
import { ProUpsellSheet, useProGate } from '@/features/premium/ProUpsell';
import { useConnectivity } from '@/services/connectivity';
import { volumeUnitLabel } from '@/calculations/units';
import { monthName } from '@/utils/date';
import { formatCurrency, formatDistance, formatPricePerVolume, formatVolume } from '@/utils/format';
import { useTheme } from '@/theme';
import type { CurrencyCode, UnitPreferences } from '@/types';

type Filter = 'all' | 'full' | 'partial' | 'adjusted';

const FILTERS = [
  { value: 'all' as const, label: 'All fills' },
  { value: 'full' as const, label: 'Full' },
  { value: 'partial' as const, label: 'Partial' },
  { value: 'adjusted' as const, label: 'Adjustments' },
];

export default function FuelTab() {
  const router = useRouter();
  const { c } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();
  const connectivity = useConnectivity();
  const proGate = useProGate();
  const [filter, setFilter] = useState<Filter>('all');
  const [explainOpen, setExplainOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const entries = useMemo(() => analytics?.fuel.entries ?? [], [analytics]);

  /** Which entry closed which interval — computed once, not per row. */
  const intervalByEntryId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof analytics>['mileage']['intervals'][number]>();
    for (const interval of analytics?.mileage.intervals ?? []) map.set(interval.toEntryId, interval);
    return map;
  }, [analytics]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'full':
        return entries.filter((e) => e.fillType === 'full');
      case 'partial':
        return entries.filter((e) => e.fillType !== 'full');
      case 'adjusted':
        return entries.filter((e) => intervalByEntryId.get(e.id)?.hasAdjustments === true);
      default:
        return entries;
    }
  }, [entries, filter, intervalByEntryId]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const header = (
    <View>
      <TabHeader
        title="Fuel"
        action={
          <Button
            label="Add fuel"
            icon="plus"
            size="small"
            onPress={() => router.push('/fuel/add')}
            testID="cta-add-fuel"
          />
        }
      />

      {!connectivity.isOnline ? (
        <Banner
          icon="wifiOff"
          message="You're offline. Fills you log now are saved on this phone and sync later."
          style={{ marginBottom: 14 }}
          testID="banner-offline"
        />
      ) : null}

      {analytics && entries.length > 0 ? (
        <>
          {/* Two scopes, each under its own heading. Before this, spend and
              fill count read the calendar month while average price read the
              whole log, and nothing on screen said so — a rider whose fills
              were dated last month saw "FILLS 0" sitting above those fills. */}
          <Eyebrow style={{ marginBottom: 8 }}>{monthName(analytics.today)}</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <SummaryTile
              label="SPEND"
              value={formatCurrency(analytics.fuel.thisMonthSpendMinor, analytics.currency)}
            />
            <SummaryTile label="FILLS" value={String(analytics.fuel.thisMonthFills)} />
            <SummaryTile
              label="FUEL"
              value={formatVolume(analytics.fuel.thisMonthLitresMl, units.volume)}
            />
          </View>

          <Eyebrow style={{ marginBottom: 8 }}>All time</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <SummaryTile
              label="SPEND"
              value={formatCurrency(analytics.fuel.allTime.spendMinor, analytics.currency)}
            />
            <SummaryTile label="FILLS" value={String(analytics.fuel.allTime.fills)} />
            <SummaryTile
              label="AVG PRICE"
              value={formatPricePerVolume(analytics.fuel.averagePricePerLitreMinor, analytics.currency)}
              suffix={`/${volumeUnitLabel(units.volume)}`}
            />
          </View>

          <ChipGroup options={FILTERS} value={filter} onChange={setFilter} style={{ marginBottom: 14 }} />
        </>
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

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <FlatList
        testID="screen-fuel"
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          entries.length === 0 ? (
            <>
              <EmptyState
                icon="fuel"
                title="Your fills will live here"
                message="Log every fill — litres, price, and whether the tank was full. Two full-tank fills in a row is what unlocks a measured km/L."
                primaryAction={{ label: 'Log a fill-up', onPress: () => router.push('/fuel/add') }}
                variant="page"
                testID="empty-fuel"
              />
              <ExampleFill units={units} currency={analytics?.currency ?? units.currency} />
            </>
          ) : (
            <FilteredEmpty filter={filter} onShowAll={() => setFilter('all')} />
          )
        }
        renderItem={({ item }) => (
          <FuelRow
            entry={item}
            interval={intervalByEntryId.get(item.id) ?? null}
            units={units}
            onPress={() => router.push({ pathname: '/fuel/[id]', params: { id: item.id } })}
            testID={`fuel-row-${item.id}`}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 100 }}
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

function SummaryTile({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  const { c, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: c.brd,
        borderRadius: radius.smallCard,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 2,
      }}
    >
      <Txt role="tileLabel" tone="mut" uppercase numberOfLines={1}>
        {label}
      </Txt>
      <Txt role="tileValueLarge" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
        {suffix ? (
          <Txt role="micro" tone="mut">
            {suffix}
          </Txt>
        ) : null}
      </Txt>
    </View>
  );
}

/**
 * A worked example under the empty state.
 *
 * A rider who has logged nothing has no idea what a fill record contains or
 * why the app keeps asking whether the tank was full. One example row answers
 * both in less space than a paragraph — and it is unmistakably an example,
 * greyed and captioned, never passed off as their data.
 */
function ExampleFill({ units, currency }: { units: UnitPreferences; currency: CurrencyCode }) {
  const { c, radius } = useTheme();

  return (
    <View style={{ gap: 8, marginTop: 20 }}>
      <Eyebrow>WHAT A FILL LOOKS LIKE</Eyebrow>
      <View
        style={{
          borderRadius: radius.listCard,
          borderWidth: 1,
          borderColor: c.brd,
          borderStyle: 'dashed',
          backgroundColor: 'transparent',
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: 0.75,
        }}
        accessibilityLabel="Example fill: 8.2 litres, full tank"
        testID="example-fill"
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Txt role="rowTitleDense" tone="mut">
            {`16 Sep · ${formatDistance(6_214_000, units.distance)}`}
          </Txt>
          <Txt role="metaSmall" tone="mut">
            {`${formatVolume(8_200, units.volume)} · Full tank`}
          </Txt>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Txt role="value" tone="mut">
            {formatCurrency(100_400, currency)}
          </Txt>
          <Txt role="micro" tone="mut">
            km/L later
          </Txt>
        </View>
      </View>
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
function FilteredEmpty({ filter, onShowAll }: { filter: Filter; onShowAll: () => void }) {
  const copy: Record<Exclude<Filter, 'all'>, { title: string; message: string }> = {
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
    <Card style={{ alignItems: 'center', paddingVertical: 26, gap: 6 }}>
      <Txt role="mediumStrong" align="center">
        {title}
      </Txt>
      <Txt role="metaSmall" tone="mut" align="center">
        {message}
      </Txt>
      <Button
        label="Show all fills"
        variant="secondary"
        size="small"
        onPress={onShowAll}
        style={{ marginTop: 8 }}
        testID="cta-show-all-fills"
      />
    </Card>
  );
}
