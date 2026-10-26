import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
  Donut,
  EmptyState,
  ErrorState,
  Footnote,
  HeroCard,
  HeroFigure,
  HeroHead,
  Icon,
  IconSquareButton,
  LinkButton,
  PageWash,
  RowIcon,
  Screen,
  SkeletonList,
  StatRow,
  StatTile,
  TabHeader,
  Txt,
  type BadgeTone,
  type IconName,
  type RowTone,
} from '@/components';
import {
  daysInMonth,
  earliestMonthKey,
  ledgerRowTag,
  monthCosts,
  nextMonthKey,
  previousMonthKey,
  type CostCategory,
} from '@/calculations/costs';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatMonthLabel, formatMonthLong, formatShortDate, monthKey, monthName, todayIso } from '@/utils/date';
import { formatCurrencySymbol, formatRateSymbol } from '@/utils/format';
import type { ExpenseCategory, LedgerEntry, LedgerSource } from '@/types';
import { useTheme } from '@/theme';

/**
 * The ledger (Figma `B1 Expenses — Costs tab`).
 *
 * One month at a time: the switcher picks it, the hero totals it and breaks it
 * into categories, and the list carries its lines. Every line comes from a
 * real record, and each record contributes exactly one line — a part fitted
 * during a service is inside that service's total and has no line of its own
 * (requirement 28). The footnote says so, and the calculation guarantees it.
 *
 * The list is one white card. A `FlatList` cannot wrap only its data rows in
 * a card, so the header draws the card's top (with its heading), each row
 * continues the surface, and the footer closes it.
 */
export default function ExpensesTab() {
  const router = useRouter();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeBike } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const [range, setRange] = useState<'month' | 'all'>('month');
  const [refreshing, setRefreshing] = useState(false);

  const today = analytics?.today ?? todayIso();
  const currentMonth = monthKey(today);
  const month = pickedMonth ?? currentMonth;
  const earliest = useMemo(() => (analytics ? earliestMonthKey(analytics.ledger) : null) ?? currentMonth, [analytics, currentMonth]);

  const costs = useMemo(
    () => (analytics ? monthCosts(analytics.ledger, analytics.currency, month, today) : null),
    [analytics, month, today],
  );
  const lines = useMemo(() => {
    if (!analytics || !costs) return [];
    return range === 'month' ? costs.lines : analytics.ledger;
  }, [analytics, costs, range]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const addExpense = (
    <Button label="Add expense" icon="plus" size="medium" onPress={() => router.push('/expenses/add')} testID="cta-add-expense" />
  );
  const subtitle = `${activeBike?.nickname ?? 'Your bike'} · every taka, one line each`;

  if (error) {
    return (
      <Screen variant="tab" testID="screen-expenses">
        <TabHeader title="Costs" subtitle={subtitle} action={addExpense} />
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen variant="tab" testID="screen-expenses">
        <TabHeader title="Costs" subtitle={subtitle} action={addExpense} />
        <SkeletonList count={4} height={120} />
      </Screen>
    );
  }

  if (!analytics || !costs) return null;

  // Nothing logged at all: no month to switch between and no figure that is
  // not a dash, so the screen is the explanation and the one button.
  if (analytics.ledger.length === 0) {
    return (
      <Screen variant="tab" testID="screen-expenses">
        <TabHeader title="Costs" subtitle={subtitle} action={addExpense} />
        <EmptyState
          icon="wallet"
          title="Every taka, one line each"
          message="Fuel fills, services, parts and accessories add their own lines here automatically. Add expense is for everything else — parking, a wash, a fine, insurance paid separately."
          testID="empty-expenses"
        />
      </Screen>
    );
  }

  const { currency, units } = analytics;
  const versus = costs.versusPrevious;
  const palette = [c.accBright, c.accLight, c.faint, c.slate];
  const heroPalette = [c.heroAcc, c.accLight, c.heroMut, c.slate];
  // The donut shows at most four slices; anything past the third folds into "Other".
  const slices =
    costs.categories.length <= 4
      ? costs.categories
      : [
          ...costs.categories.slice(0, 3),
          {
            key: 'rest',
            label: 'Other',
            source: 'manual' as const,
            amountMinor: costs.categories.slice(3).reduce((sum, cat) => sum + cat.amountMinor, 0),
            share: costs.categories.slice(3).reduce((sum, cat) => sum + cat.share, 0),
          },
        ];

  const header = (
    <View style={{ gap: 16 }}>
      <TabHeader title="Costs" subtitle={subtitle} action={addExpense} style={{ marginBottom: 0 }} />

      <MonthSwitcher
        title={`${monthName(`${month}-01`)} ${month.slice(0, 4)}`}
        detail={`1 – ${daysInMonth(month)} ${formatMonthLabel(month)} · ${costs.lines.length} ${costs.lines.length === 1 ? 'line' : 'lines'}`}
        onPrevious={month > earliest ? () => setPickedMonth(previousMonthKey(month)) : null}
        onNext={month < currentMonth ? () => setPickedMonth(nextMonthKey(month)) : null}
      />

      <HeroCard gap={16} testID="hero-month">
        <HeroHead
          eyebrow={`Spent in ${monthName(`${month}-01`)}`}
          {...(versus ? { chip: `${versus.lower ? '▼' : '▲'} ${versus.percent}% vs ${monthName(`${versus.previousKey}-01`)}` } : {})}
        />
        <HeroFigure value={formatCurrencySymbol(costs.totalMinor, currency)} testID="hero-month-total" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          <Donut
            slices={slices.map((cat, index) => ({ value: cat.amountMinor, color: heroPalette[index] ?? c.slate }))}
            track={c.heroTile}
            accessibilityLabel={slices.map((cat) => `${cat.label} ${sharePercent(cat.share)}`).join(', ')}
            testID="chart-month-donut"
          />
          <View style={{ flex: 1, gap: 10 }}>
            {slices.length === 0 ? (
              <Txt role="mediumStrong" color={c.heroMut}>
                Nothing spent this month
              </Txt>
            ) : (
              slices.map((cat, index) => (
                <View key={cat.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: heroPalette[index] ?? c.slate }} />
                  <Txt role="mediumStrong" color={c.heroChipInk} numberOfLines={1} style={{ flex: 1, fontWeight: undefined }}>
                    {cat.label}
                  </Txt>
                  <Txt role="mediumStrong" color={c.heroInk}>
                    {sharePercent(cat.share)}
                  </Txt>
                </View>
              ))
            )}
          </View>
        </View>
        <StatRow>
          <StatTile
            variant="hero"
            valueSize="sm"
            label={analytics.ownership.costBasis === 'total' ? 'All-in' : 'Total spent'}
            value={formatCurrencySymbol(analytics.ownership.headlineCostMinor, currency)}
            testID="tile-total-spent"
          />
          <StatTile
            variant="hero"
            valueSize="sm"
            label={`Cost / ${units.distance}`}
            value={formatRateSymbol(analytics.ownership.costPerDistanceScaled, currency)}
            testID="tile-cost-per-distance"
          />
          <StatTile
            variant="hero"
            valueSize="sm"
            label="Per day"
            {...(costs.perDayMinor === null ? {} : { value: formatCurrencySymbol(costs.perDayMinor, currency) })}
            testID="tile-per-day"
          />
        </StatRow>
      </HeroCard>

      {costs.categories.length > 0 ? (
        <Card style={{ gap: 14 }} testID="card-by-category">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Txt role="cardTitle">By category</Txt>
            <Txt role="meta" tone="mut">
              {monthName(`${month}-01`)}
            </Txt>
          </View>
          {costs.categories.map((cat, index) => (
            <CategoryBar key={cat.key} category={cat} color={palette[index] ?? c.slate} accent={index === 0} currency={currency} />
          ))}
        </Card>
      ) : null}

      {/* The top of the Transactions card; the rows below continue its surface. */}
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
          title="Transactions"
          style={{ paddingBottom: 4 }}
          action={
            <LinkButton
              label={range === 'month' ? 'All time' : monthName(`${month}-01`)}
              onPress={() => setRange((r) => (r === 'month' ? 'all' : 'month'))}
              testID="link-costs-range"
            />
          }
        />
      </View>
    </View>
  );

  const cardSide = { backgroundColor: c.sur, paddingHorizontal: 16 } as const;
  const footer = (
    <View>
      <View style={{ ...cardSide, height: 4, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card }} />
      <Footnote testID="footnote-ledger">
        Parts fitted during a service are inside that service&apos;s total. Accessories count in totals but not in
        cost / {units.distance}.
      </Footnote>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <PageWash />
      <FlatList
        testID="screen-expenses"
        data={lines}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          <View style={{ ...cardSide, paddingVertical: 20, alignItems: 'center', gap: 6 }} testID="empty-expenses-month">
            <Txt role="rowTitleLarge" align="center">
              Nothing spent in {formatMonthLong(month)}
            </Txt>
            <Txt role="meta" tone="mut" align="center">
              Switch to All time to see the full ledger.
            </Txt>
          </View>
        }
        renderItem={({ item }) => (
          <View style={cardSide}>
            <LedgerRow entry={item} onPress={() => openLedgerEntry(router, item)} />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.acc} colors={[c.acc]} progressBackgroundColor={c.sur} />
        }
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
      />
    </View>
  );
}

/** `48%` — a 0–1 share as the whole-number percentage the design prints. */
function sharePercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/**
 * Figma `Month switcher`: a white pill (`padding:4px`) with 48px inset arrows
 * at each end and the month (`600 16px`) over its span and line count
 * (`400 12px`) in the middle. An arrow with nowhere to go is disabled.
 */
function MonthSwitcher({
  title,
  detail,
  onPrevious,
  onNext,
}: {
  title: string;
  detail: string;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 4,
        borderRadius: 999,
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: c.brd,
      }}
      testID="month-switcher"
    >
      <IconSquareButton
        icon="chevronLeft"
        variant="inset"
        accessibilityLabel="Previous month"
        onPress={onPrevious ?? (() => undefined)}
        disabled={onPrevious === null}
        testID="cta-month-previous"
      />
      <View style={{ alignItems: 'center', flexShrink: 1 }}>
        <Txt role="cardTitle" numberOfLines={1} testID="text-month">
          {title}
        </Txt>
        <Txt role="meta" tone="mut" numberOfLines={1}>
          {detail}
        </Txt>
      </View>
      <IconSquareButton
        icon="chevronRight"
        variant="inset"
        accessibilityLabel="Next month"
        onPress={onNext ?? (() => undefined)}
        disabled={onNext === null}
        testID="cta-month-next"
      />
    </View>
  );
}

/** Figma `Cat`: glyph, label, share and amount over an 8px track. */
function CategoryBar({
  category,
  color,
  accent,
  currency,
}: {
  category: CostCategory;
  color: string;
  accent: boolean;
  currency: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name={categoryIcon(category.source, category.key)} size={20} color={accent ? c.accBright : c.mut} />
        <Txt role="rowTitle" numberOfLines={1} style={{ flex: 1 }}>
          {category.label}
        </Txt>
        <Txt role="micro" tone="mut">
          {sharePercent(category.share)}
        </Txt>
        <Txt role="value">{formatCurrencySymbol(category.amountMinor, currency as never)}</Txt>
      </View>
      <View style={{ height: 8, borderRadius: 999, backgroundColor: c.sur2, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round(category.share * 100)}%`, height: '100%', borderRadius: 999, backgroundColor: color }} />
      </View>
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

const TAG_TONE: Record<LedgerSource, BadgeTone> = {
  fuel: 'accent',
  manual: 'good',
  service: 'neutral',
  part: 'neutral',
  accessory: 'neutral',
  maintenance: 'warn',
};

const ROW_TONE: Record<LedgerSource, RowTone> = {
  fuel: 'accent',
  manual: 'good',
  service: 'info',
  part: 'neutral',
  accessory: 'neutral',
  maintenance: 'warn',
};

const EXPENSE_ICON: Record<ExpenseCategory, IconName> = {
  registration: 'fileText',
  insurance: 'shieldCheck',
  parking: 'squareParking',
  toll: 'receipt',
  wash: 'droplets',
  fine: 'triangleAlert',
  gear: 'shield',
  modification: 'wrench',
  other: 'tag',
};

/** The glyph for a ledger line or a category: by source, or by the rider's category on an expense. */
function categoryIcon(source: LedgerSource, key: string): IconName {
  switch (source) {
    case 'fuel':
      return 'fuel';
    case 'service':
    case 'maintenance':
      return 'wrench';
    case 'part':
    case 'accessory':
      return 'package';
    default: {
      const category = key.startsWith('manual:') ? key.slice('manual:'.length) : key;
      return EXPENSE_ICON[category as ExpenseCategory] ?? 'tag';
    }
  }
}

/** Figma `Row`: a tone tile, the label (`600 15px`), the date and a tag, the amount. */
function LedgerRow({ entry, onPress }: { entry: LedgerEntry; onPress: () => void }) {
  const tag = ledgerRowTag(entry.source);
  const amount = formatCurrencySymbol(entry.amountMinor, entry.currency);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.label}, ${formatShortDate(entry.date)}, ${tag}, ${amount}`}
      onPress={onPress}
      testID={`ledger-row-${entry.id}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        minHeight: 48,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <RowIcon icon={categoryIcon(entry.source, `manual:${entry.category ?? 'other'}`)} tone={ROW_TONE[entry.source]} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Txt role="rowTitleLarge" numberOfLines={1}>
          {entry.label}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt role="meta" tone="mut">
            {formatShortDate(entry.date)}
          </Txt>
          <Badge label={tag} tone={TAG_TONE[entry.source]} size="chip" />
        </View>
      </View>
      <Txt role="rowTitleLarge" numberOfLines={1}>
        {amount}
      </Txt>
    </Pressable>
  );
}
