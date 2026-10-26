import React from 'react';
import { useRouter } from 'expo-router';

import {
  Banner,
  EmptyState,
  ErrorState,
  HeroCard,
  HeroFigure,
  HeroHead,
  IconSquareButton,
  ListCard,
  RecordRow,
  RowIcon,
  Screen,
  ScreenHeader,
  SkeletonList,
  StatRow,
  StatTile,
} from '@/components';
import { accessoryTotals } from '@/calculations/accessorySpend';
import { accessoryTotalMinor } from '@/calculations/expenses';
import { distanceUnitLabel } from '@/calculations/units';
import { accessoryGlyph } from '@/features/parts/ui/PartsGlyph';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatCurrencySymbol } from '@/utils/format';
import { formatShortDate } from '@/utils/date';

/**
 * Accessories (Figma `C6 Accessories — List`) — everything bought once and
 * left on the bike.
 *
 * They are counted in your totals and kept out of cost per distance, and the
 * note under the list says exactly that. Charging a one-off purchase against
 * the kilometres ridden since would make cost / km lurch every time one was
 * added, which is a figure nobody could act on.
 */
export default function Accessories() {
  const router = useRouter();
  const { activeBike } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();

  const accessories = analytics?.accessories.all ?? [];
  const distanceLabel = distanceUnitLabel(analytics?.units.distance ?? 'km');
  const currency = analytics?.currency ?? 'BDT';
  const totals = accessoryTotals(accessories);

  const header = (
    <ScreenHeader
      title="Accessories"
      action={<IconSquareButton icon="plus" variant="primary" accessibilityLabel="Add accessory" onPress={() => router.push('/accessories/add')} testID="cta-add-accessory" />}
      style={{ marginBottom: 0 }}
    />
  );

  if (error) {
    return (
      <Screen testID="screen-accessories" contentStyle={{ gap: 16 }}>
        {header}
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-accessories" contentStyle={{ gap: 16 }}>
        {header}
        <SkeletonList count={3} height={72} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refetch} testID="screen-accessories" contentStyle={{ gap: 16 }}>
      {header}

      {accessories.length === 0 ? (
        <EmptyState
          icon="package"
          title="No accessories yet"
          message="Top boxes, crash guards, phone mounts — log what you've fitted and what it cost."
          primaryAction={{
            label: 'Add an accessory',
            onPress: () => router.push('/accessories/add'),
            testID: 'cta-empty-add-accessory',
          }}
          variant="page"
          testID="empty-accessories"
        />
      ) : (
        <>
          {/* Figma `Total card`. */}
          <HeroCard gap={6} testID="hero-accessories">
            <HeroHead eyebrow={`Fitted to ${activeBike?.nickname ?? 'your bike'}`} />
            <HeroFigure value={formatCurrencySymbol(totals.totalMinor, currency)} />
            <StatRow style={{ marginTop: 10 }}>
              <StatTile variant="hero" valueSize="md" label="Items" value={String(totals.count)} />
              <StatTile variant="hero" valueSize="md" label="Purchase" value={formatCurrencySymbol(totals.purchaseMinor, currency)} />
              <StatTile variant="hero" valueSize="md" label="Fitting" value={formatCurrencySymbol(totals.fittingMinor, currency)} />
            </StatRow>
          </HeroCard>

          <ListCard style={{ paddingVertical: 4 }} testID="list-accessories">
            {accessories.map((accessory) => (
              <RecordRow
                key={accessory.id}
                variant="flush"
                leading={<RowIcon icon={accessoryGlyph(accessory.name)} tone="accent" size={44} />}
                title={accessory.name}
                subtitle={`${formatShortDate(accessory.date)} · ${formatCurrencySymbol(accessory.purchaseCostMinor, accessory.currency)}${
                  accessory.installationCostMinor > 0 ? ` + ${formatCurrencySymbol(accessory.installationCostMinor, accessory.currency)} fitting` : ''
                }`}
                amount={formatCurrencySymbol(accessoryTotalMinor(accessory), accessory.currency)}
                onPress={() => router.push({ pathname: '/accessories/add', params: { id: accessory.id } })}
                testID={`accessory-${accessory.id}`}
              />
            ))}
          </ListCard>

          <Banner
            tone="neutral"
            message={`Accessories stay in your totals but out of cost / ${distanceLabel} — charging a one-off against the distance since would make that figure swing. Converted parts keep the whole amount as purchase cost; no split is invented.`}
            testID="note-accessories-rule"
          />
        </>
      )}
    </Screen>
  );
}
