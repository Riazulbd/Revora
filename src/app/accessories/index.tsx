import React from 'react';
import { useRouter } from 'expo-router';

import {
  Button,
  EmptyState,
  ErrorState,
  Footnote,
  ListCard,
  RecordRow,
  RowIcon,
  Screen,
  SkeletonList,
  TabHeader,
  Txt,
} from '@/components';
import { accessoryTotalMinor } from '@/calculations/expenses';
import { distanceUnitLabel } from '@/calculations/units';
import { accessoryGlyph } from '@/features/parts/ui/PartsGlyph';
import { useGarageData } from '@/features/bikes/useGarageData';
import { formatCurrency } from '@/utils/format';
import { formatShortDate } from '@/utils/date';

/**
 * Accessories — everything bought once and left on the bike.
 *
 * They are counted in your totals and kept out of cost per distance, and the
 * note under the list says exactly that. Charging a one-off purchase against
 * the kilometres ridden since would make cost / km lurch every time one was
 * added, which is a figure nobody could act on.
 */
export default function Accessories() {
  const router = useRouter();
  const { analytics, isPending, error, refetch } = useGarageData();

  const accessories = analytics?.accessories.all ?? [];
  const distanceLabel = distanceUnitLabel(analytics?.units.distance ?? 'km');

  const header = (
    <TabHeader
      title="Accessories"
      action={
        <Button
          label="Add"
          icon="plus"
          size="compact"
          onPress={() => router.push('/accessories/add')}
          testID="cta-add-accessory"
        />
      }
    />
  );

  if (error) {
    return (
      <Screen testID="screen-accessories" contentStyle={{ paddingHorizontal: 20 }}>
        {header}
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-accessories" contentStyle={{ paddingHorizontal: 20 }}>
        {header}
        <SkeletonList count={3} height={72} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refetch} testID="screen-accessories" contentStyle={{ paddingHorizontal: 20 }}>
      {header}

      {accessories.length === 0 ? (
        <EmptyState
          icon="shield"
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
          <ListCard testID="list-accessories">
            {accessories.map((accessory) => (
              <RecordRow
                key={accessory.id}
                variant="flush"
                leading={<RowIcon icon={accessoryGlyph(accessory.name)} tone="accent" size={44} />}
                title={accessory.name}
                subtitleContent={
                  <Txt role="meta" tone="mut" numberOfLines={2}>
                    {formatShortDate(accessory.date)} ·{' '}
                    {formatCurrency(accessory.purchaseCostMinor, accessory.currency)} +{' '}
                    {formatCurrency(accessory.installationCostMinor, accessory.currency)} fitting
                  </Txt>
                }
                amount={formatCurrency(accessoryTotalMinor(accessory), accessory.currency)}
                onPress={() =>
                  router.push({ pathname: '/accessories/add', params: { id: accessory.id } })
                }
                testID={`accessory-${accessory.id}`}
              />
            ))}
          </ListCard>

          <Footnote testID="note-accessories-rule">
            {`Accessories stay in your totals but out of cost / ${distanceLabel} — charging a one-off against the distance since would make that figure swing. Converted parts keep the whole amount as purchase cost; no split is invented.`}
          </Footnote>
        </>
      )}
    </Screen>
  );
}
