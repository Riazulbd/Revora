import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Banner,
  Button,
  Card,
  ChipGroup,
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
import { formatMonthLabel, formatMonthLong, formatShortDate, monthKey } from '@/utils/date';
import { formatCurrency, formatPricePerVolume } from '@/utils/format';
import { useTheme } from '@/theme';

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

  const monthLabel = analytics ? formatMonthLabel(monthKey(analytics.today)).toUpperCase() : '';

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
          message="You're offline. Everything still works — logs save here and sync when a connection returns."
          style={{ marginBottom: 14 }}
          testID="banner-offline"
        />
      ) : null}

      {analytics && entries.length > 0 ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <SummaryTile
              label={`${monthLabel} SPEND`}
              value={formatCurrency(analytics.fuel.thisMonthSpendMinor, analytics.currency)}
            />
            <SummaryTile label={`${monthLabel} FILLS`} value={String(analytics.fuel.thisMonthFills)} />
            <SummaryTile
              label="AVG PRICE"
              value={formatPricePerVolume(analytics.fuel.averagePricePerLitreMinor, analytics.currency)}
              suffix={`/${volumeUnitLabel(units.volume)}`}
            />
          </View>

          {/* Two tiles read the calendar month and the third reads the whole
              log, so an empty month sits above a list of fills and looks like
              the app lost them. Say which month is empty, and when the last
              fill actually was. */}
          {analytics.fuel.thisMonthFills === 0 && analytics.fuel.latest ? (
            <Txt role="meta" tone="mut" style={{ marginBottom: 14 }} testID="hint-empty-month">
              {`No fills logged in ${formatMonthLong(monthKey(analytics.today))}. `}
              {`Your last was ${formatShortDate(analytics.fuel.latest.date)}, and the ${entries.length} `}
              {`fill${entries.length === 1 ? '' : 's'} below are all still counted.`}
            </Txt>
          ) : null}

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
            <EmptyState
              icon="fuel"
              title="No fuel logs yet"
              message="Your first fill sets the baseline. Mileage appears after the second full-tank fill."
              primaryAction={{ label: 'Log a fill-up', onPress: () => router.push('/fuel/add') }}
              variant="page"
              testID="empty-fuel"
            />
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
              <Txt role="mediumStrong" align="center">
                No fills match this filter
              </Txt>
              <Txt role="metaSmall" tone="mut" align="center" style={{ marginTop: 6 }}>
                Switch back to All fills to see the whole log.
              </Txt>
            </Card>
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
