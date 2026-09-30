import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Footnote,
  Screen,
  Segmented,
  SkeletonList,
  StatRow,
  StatTile,
  TabHeader,
  Txt,
  type BadgeTone,
} from '@/components';
import { ledgerRowTag } from '@/calculations/costs';
import { SETTLED_DISTANCE_FOR_COST_PER_UNIT } from '@/calculations/ownership';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatMonthLong, formatShortDate, monthKey } from '@/utils/date';
import { costPerDistanceHint, formatCurrency, formatRate } from '@/utils/format';
import type { LedgerEntry, LedgerSource } from '@/types';
import { useTheme } from '@/theme';

type Range = 'month' | 'all';

/**
 * The ledger — the Costs tab of the redesign (`costs-tab--01/02/03`).
 *
 * Every line here comes from a real record, and each record contributes exactly
 * one line — a part fitted during a service is inside that service's total and
 * has no line of its own (requirement 28). The footnote says so, and the
 * calculation guarantees it.
 *
 * The board draws the whole history as one `--sur` card with hairlines between
 * its rows. A `FlatList` cannot wrap only its data rows in a card, so each row
 * carries the card's own chrome: side borders always, the top edge and top
 * radii on the first row, the bottom edge and bottom radii on the last. The
 * hairline sits on the row's inner content box, so it is inset by the card's
 * 16px padding exactly as the artboard draws it.
 */
export default function ExpensesTab() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
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

  const addExpense = (
    <Button
      label="Add expense"
      icon="plus"
      size="compact"
      onPress={() => router.push('/expenses/add')}
      testID="cta-add-expense"
    />
  );

  if (error) {
    return (
      <Screen variant="tab" testID="screen-expenses">
        <TabHeader title="Costs" action={addExpense} />
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen variant="tab" testID="screen-expenses">
        <TabHeader title="Costs" action={addExpense} />
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

  // Nothing logged at all: the board drops the figures and the filter with
  // them — there is nothing to filter and no figure that is not a dash.
  if (analytics.ledger.length === 0) {
    return (
      <Screen variant="tab" testID="screen-expenses">
        <TabHeader title="Costs" action={addExpense} />
        <EmptyState
          icon="wallet"
          title="Every taka, one line each"
          message="Fuel fills, services, parts and accessories add their own lines here automatically. Add expense is for everything else — parking, a wash, a fine, insurance paid separately."
          testID="empty-expenses"
        />
      </Screen>
    );
  }

  const header = (
    <View>
      <TabHeader title="Costs" action={addExpense} />

      <Card style={{ gap: 10 }}>
        <StatRow>
          <StatTile
            label={analytics.ownership.costBasis === 'total' ? 'ALL-IN' : 'TOTAL SPENT'}
            value={formatCurrency(analytics.ownership.headlineCostMinor, analytics.currency)}
            testID="tile-total-spent"
          />
          <StatTile
            label={`COST / ${analytics.units.distance.toUpperCase()}`}
            value={formatRate(analytics.ownership.costPerDistanceScaled, analytics.currency)}
            testID="tile-cost-per-distance"
          />
          <StatTile
            label="THIS MONTH"
            value={formatCurrency(analytics.thisMonthMinor, analytics.currency)}
            testID="tile-this-month"
          />
        </StatRow>

        {analytics.ownership.costBasis === 'total' ? (
          <Txt role="helper" tone="mut" testID="hint-cost-basis">
            All-in includes the purchase price — set in Settings › Cost basis.
          </Txt>
        ) : null}

        {costHint ? (
          <Txt role="helper" tone="mut" testID="hint-cost-per-distance">
            {costHint}
          </Txt>
        ) : null}
      </Card>

      <Segmented
        options={[
          { value: 'month' as const, label: 'This month' },
          { value: 'all' as const, label: 'All time' },
        ]}
        value={range}
        onChange={setRange}
        size="compact"
        style={{ marginTop: 14, marginBottom: 14 }}
        testID="segment-costs-range"
      />
    </View>
  );

  const footer =
    lines.length > 0 ? (
      <Footnote style={{ marginTop: 12 }} testID="footnote-ledger">
        Parts fitted during a service are inside that service&apos;s total. Accessories count in totals but
        not in cost / km — a one-off would make that figure swing.
      </Footnote>
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
          <Card style={{ alignItems: 'center', paddingVertical: 28 }} testID="empty-expenses-month">
            <Txt role="cardTitle" align="center">
              Nothing spent in {formatMonthLong(thisMonth)}
            </Txt>
            <Txt role="body" tone="mut" align="center" style={{ marginTop: 6 }}>
              Switch to All time to see the full ledger.
            </Txt>
          </Card>
        }
        renderItem={({ item, index }) => (
          <LedgerRow
            entry={item}
            first={index === 0}
            last={index === lines.length - 1}
            onPress={() => openLedgerEntry(router, item)}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 }}
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

/**
 * The board tags fuel in the accent and a hand-entered expense in green; the
 * blue it gives a service and the teal it gives an accessory have no token in
 * the palette, so those tags take the neutral pill. The tag's own word carries
 * the category either way — colour is never the only signal.
 */
const TAG_TONE: Record<LedgerSource, BadgeTone> = {
  fuel: 'accent',
  manual: 'good',
  service: 'neutral',
  part: 'neutral',
  accessory: 'neutral',
  maintenance: 'neutral',
};

function LedgerRow({
  entry,
  first,
  last,
  onPress,
}: {
  entry: LedgerEntry;
  first: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const { c, radius } = useTheme();
  const tag = ledgerRowTag(entry.source);
  const amount = formatCurrency(entry.amountMinor, entry.currency);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.label}, ${formatShortDate(entry.date)}, ${tag}, ${amount}`}
      onPress={onPress}
      testID={`ledger-row-${entry.id}`}
      style={({ pressed }) => ({
        backgroundColor: c.sur,
        borderColor: c.brd,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderTopWidth: first ? 1 : 0,
        borderBottomWidth: last ? 1 : 0,
        borderTopLeftRadius: first ? radius.listCard : 0,
        borderTopRightRadius: first ? radius.listCard : 0,
        borderBottomLeftRadius: last ? radius.listCard : 0,
        borderBottomRightRadius: last ? radius.listCard : 0,
        paddingHorizontal: 15,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 13,
          minHeight: 44,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: c.brd,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt role="rowTitle" numberOfLines={2}>
            {entry.label}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <Txt role="meta" tone="mut">
              {formatShortDate(entry.date)}
            </Txt>
            <Badge label={tag} tone={TAG_TONE[entry.source]} size="tag" />
          </View>
        </View>
        <Txt role="rowTitle" numberOfLines={1}>
          {amount}
        </Txt>
      </View>
    </Pressable>
  );
}
