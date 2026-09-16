import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  LinkButton,
  Screen,
  SkeletonList,
  StatTile,
  TabHeader,
  Txt,
} from '@/components';
import { ledgerTag } from '@/calculations/expenses';
import { SETTLED_DISTANCE_FOR_COST_PER_UNIT } from '@/calculations/ownership';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatMonthLong, formatShortDate, monthKey } from '@/utils/date';
import { costPerDistanceHint, formatCurrency, formatRate } from '@/utils/format';
import type { LedgerEntry } from '@/types';
import { useTheme } from '@/theme';

type Range = 'month' | 'all';

/**
 * The ledger.
 *
 * Every line here comes from a real record, and each record contributes exactly
 * one line — a part fitted during a service is inside that service's total and
 * has no line of its own (requirement 28). The footnote says so, and the
 * calculation guarantees it.
 */
export default function ExpensesTab() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeBike } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();
  const [range, setRange] = useState<Range>('month');
  const [refreshing, setRefreshing] = useState(false);

  const thisMonth = analytics ? monthKey(analytics.today) : '';

  const lines = useMemo(() => {
    if (!analytics) return [];
    return range === 'month'
      ? analytics.ledger.filter((l) => monthKey(l.date) === thisMonth)
      : analytics.ledger;
  }, [analytics, range, thisMonth]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (error) {
    return (
      <Screen variant="tab" testID="screen-expenses">
        <TabHeader title="Costs" />
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen variant="tab" testID="screen-expenses">
        <TabHeader title="Expenses" />
        <SkeletonList count={5} height={64} />
      </Screen>
    );
  }

  if (!analytics) return null;

  const costHint = costPerDistanceHint(
    analytics.ownership.distanceMetres,
    SETTLED_DISTANCE_FOR_COST_PER_UNIT,
    analytics.units.distance,
  );

  const header = (
    <View>
      <TabHeader
        title="Expenses"
        action={
          <Button
            label="Add expense"
            icon="plus"
            size="small"
            onPress={() => router.push('/expenses/add')}
            testID="cta-add-expense"
          />
        }
      />

      <Txt role="helper" tone="mut" style={{ marginBottom: 10 }}>
        Every taka, one line each.
      </Txt>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <StatTile
          label={analytics.ownership.costBasis === 'total' ? 'ALL-IN' : 'TOTAL SPENT'}
          value={formatCurrency(analytics.ownership.headlineCostMinor, analytics.currency)}
        />
        <StatTile
          label={`COST / ${analytics.units.distance.toUpperCase()}`}
          value={formatRate(analytics.ownership.costPerDistanceScaled, analytics.currency)}
        />
        <StatTile label="THIS MONTH" value={formatCurrency(analytics.thisMonthMinor, analytics.currency)} />
      </View>

      {analytics.ownership.costBasis === 'total' ? (
        <Txt role="helper" tone="mut" style={{ marginBottom: 10 }} testID="hint-cost-basis">
          All-in includes the purchase price — set in Settings › Cost basis.
        </Txt>
      ) : null}

      {costHint ? (
        <Txt role="helper" tone="mut" style={{ marginBottom: 14 }} testID="hint-cost-per-distance">
          {costHint}
        </Txt>
      ) : null}

      {activeBike?.company.enabled ? (
        <Card variant="flush" style={{ paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <Txt role="smallStrong" tone="mut" style={{ flexShrink: 1 }}>
              After {activeBike.company.companyName || 'company'} allowance
            </Txt>
            <Txt role="smallStrong" numberOfLines={1}>
              Rider cost{' '}
              {formatCurrency(
                Math.max(0, analytics.thisMonthMinor - analytics.allowance.usedMinor),
                analytics.currency,
              )}
            </Txt>
          </View>
        </Card>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Txt role="eyebrow" tone="mut" uppercase>
          {range === 'month' ? `LEDGER · ${formatMonthLong(thisMonth)}` : 'LEDGER · ALL TIME'}
        </Txt>
        <LinkButton label="Analytics" onPress={() => router.push('/analytics')} />
      </View>

      <ChipGroup
        options={[
          { value: 'month' as const, label: 'This month' },
          { value: 'all' as const, label: 'All time' },
        ]}
        value={range}
        onChange={setRange}
        style={{ marginBottom: 12 }}
      />
    </View>
  );

  const footer =
    lines.length > 0 ? (
      <Txt role="helper" tone="mut" style={{ marginTop: 16 }}>
        Parts fitted during a service are inside that service&apos;s total. Accessories count in totals but
        not in cost / km — a one-off would make that figure swing.
      </Txt>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <FlatList
        testID="screen-expenses"
        data={lines}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          analytics.ledger.length === 0 ? (
            <EmptyState
              icon="expenses"
              title="Nothing logged yet"
              message="Fuel, services, parts and accessories add themselves here. Anything else — parking, tolls, insurance — you can add by hand."
              primaryAction={{ label: 'Add an expense', onPress: () => router.push('/expenses/add') }}
              variant="page"
              testID="empty-expenses"
            />
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
              <Txt role="mediumStrong" align="center">
                Nothing spent in {formatMonthLong(thisMonth)}
              </Txt>
              <Txt role="metaSmall" tone="mut" align="center" style={{ marginTop: 6 }}>
                Switch to All time to see the full ledger.
              </Txt>
            </Card>
          )
        }
        renderItem={({ item }) => <LedgerRow entry={item} onPress={() => openLedgerEntry(router, item)} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
      />
    </View>
  );
}

function openLedgerEntry(router: ReturnType<typeof useRouter>, entry: LedgerEntry) {
  switch (entry.source) {
    case 'fuel':
      router.push({ pathname: '/fuel/[id]', params: { id: entry.sourceId } });
      break;
    case 'service':
      router.push({ pathname: '/services/add', params: { id: entry.sourceId } });
      break;
    case 'part':
      router.push({ pathname: '/parts/[id]', params: { id: entry.sourceId } });
      break;
    case 'accessory':
      router.push('/accessories');
      break;
    case 'manual':
      router.push({ pathname: '/expenses/add', params: { id: entry.sourceId } });
      break;
    default:
      router.push('/maintenance');
      break;
  }
}

function LedgerRow({ entry, onPress }: { entry: LedgerEntry; onPress: () => void }) {
  const { c, radius } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.label}, ${formatShortDate(entry.date)}, ${formatCurrency(
        entry.amountMinor,
        entry.currency,
      )}`}
      onPress={onPress}
      testID={`ledger-row-${entry.id}`}
      style={({ pressed }) => ({
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: c.brd,
        borderRadius: radius.smallCard,
        paddingHorizontal: 15,
        paddingVertical: 13,
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt role="mediumStrong" numberOfLines={2}>
          {entry.label}
        </Txt>
        <Txt role="metaSmall" tone="mut">
          {formatShortDate(entry.date)}
        </Txt>
      </View>
      <Badge label={ledgerTag(entry.source)} tone={entry.source === 'manual' ? 'neutral' : 'accent'} />
      <Txt role="mediumStrong" numberOfLines={1}>
        {formatCurrency(entry.amountMinor, entry.currency)}
      </Txt>
    </Pressable>
  );
}
