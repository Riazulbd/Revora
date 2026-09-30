import React, { useMemo, useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  ButtonRow,
  Card,
  Dialog,
  DividedList,
  ErrorState,
  KeyValueRow,
  Screen,
  ScreenHeader,
  SkeletonList,
  StatRow,
  StatTile,
  Txt,
} from '@/components';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import {
  FuelAdjustmentsCard,
  FuelMileageBreakdown,
  FuelNoMileageCard,
  FuelReceiptRow,
} from '@/features/fuel/ui/FuelBreakdown';
import { useDeleteFuel } from '@/features/fuel/useFuelMutations';
import { useImageUrl } from '@/features/shared/useImageUrl';
import { formatShortDate } from '@/utils/date';
import {
  formatCurrency,
  formatDistance,
  formatMileage,
  formatPricePerVolume,
  formatVolume,
  NO_VALUE,
} from '@/utils/format';
import { volumeUnitLabel } from '@/calculations/units';

const FILL_LABEL = { full: 'Full tank', partial: 'Partial', unknown: 'Unknown level' } as const;

/**
 * One fill.
 *
 * The board's order is the argument it makes: the three figures first, then —
 * immediately — how the mileage figure was reached, or why there isn't one. A
 * number a rider can't audit is a number they won't trust, so the arithmetic is
 * not hidden behind a link.
 */
export default function FuelDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { units } = useGarage();
  const { analytics, isPending, error } = useGarageData();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const entry = useMemo(
    () => analytics?.fuel.entries.find((e) => e.id === id) ?? null,
    [analytics, id],
  );

  const interval = useMemo(
    () => analytics?.mileage.intervals.find((i) => i.toEntryId === id) ?? null,
    [analytics, id],
  );

  const receiptUrl = useImageUrl(entry?.receiptPath ?? null);

  /** Adjustments logged alongside this fill (stamped with its id). */
  const ownAdjustments = useMemo(
    () => (analytics?.fuel.adjustments ?? []).filter((a) => entry && a.clientRef.startsWith(`${entry.id}:`)),
    [analytics, entry],
  );

  const deleteFuel = useDeleteFuel({
    onDeleted: () => {
      setConfirmDelete(false);
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/fuel');
    },
  });

  if (error) {
    return (
      <Screen testID="screen-fuel-detail">
        <ScreenHeader title="Fill" />
        <ErrorState message={error.message} onRetry={undefined} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-fuel-detail">
        <ScreenHeader title="Fill" />
        <SkeletonList count={3} height={120} />
      </Screen>
    );
  }

  if (!entry) {
    return (
      <Screen testID="screen-fuel-detail">
        <ScreenHeader title="Fill" />
        <ErrorState
          title="This fuel log is gone"
          message="It may have been deleted on another device. Your remaining logs are unaffected."
          onRetry={() => router.replace('/(tabs)/fuel')}
          variant="page"
        />
      </Screen>
    );
  }

  return (
    <Screen testID="screen-fuel-detail">
      <ScreenHeader title="Fill" titleSuffix={`· ${formatShortDate(entry.date)}`} />

      <StatRow>
        <StatTile
          label="Odometer"
          variant="outlined"
          value={formatDistance(entry.odometerMetres, units.distance)}
        />
        <StatTile
          label="Distance"
          variant="outlined"
          value={interval ? formatDistance(interval.distanceMetres, units.distance) : NO_VALUE}
        />
        {interval ? (
          <StatTile
            label="Mileage"
            variant="accent"
            value={formatMileage(interval.efficiency, units.mileage)}
          />
        ) : (
          <StatTile label="Mileage" variant="outlined" value={NO_VALUE} />
        )}
      </StatRow>

      {interval ? (
        <FuelMileageBreakdown entry={entry} interval={interval} units={units} style={{ marginTop: 12 }} />
      ) : (
        <FuelNoMileageCard entry={entry} units={units} style={{ marginTop: 12 }} />
      )}

      {ownAdjustments.length > 0 ? (
        <FuelAdjustmentsCard adjustments={ownAdjustments} units={units} style={{ marginTop: 12 }} />
      ) : null}

      <Card variant="list" style={{ marginTop: 12 }}>
        <DividedList>
          <KeyValueRow
            label={volumeUnitLabel(units.volume) === 'L' ? 'Litres' : 'Volume'}
            value={`${formatVolume(entry.litresMl, units.volume)} · ${FILL_LABEL[entry.fillType]}`}
          />
          <KeyValueRow
            label="Price"
            value={`${formatPricePerVolume(entry.pricePerLitreMinor, entry.currency)} / ${volumeUnitLabel(
              units.volume,
            )} · ${formatCurrency(entry.totalCostMinor, entry.currency)} total`}
          />
          {entry.station ? <KeyValueRow label="Station" value={entry.station} /> : null}
          {entry.notes ? <KeyValueRow label="Notes" value={entry.notes} /> : null}
          {entry.receiptPath ? (
            <FuelReceiptRow uri={receiptUrl} onPress={() => setViewerOpen(true)} testID="row-receipt" />
          ) : null}
        </DividedList>
      </Card>

      <ButtonRow style={{ marginTop: 16 }}>
        <Button
          label="Edit"
          variant="secondary"
          size="medium"
          flex
          onPress={() => router.push({ pathname: '/fuel/add', params: { id: entry.id } })}
          testID="cta-edit"
        />
        <Button
          label="Delete"
          variant="ghost"
          tone="bad"
          size="medium"
          flex
          onPress={() => setConfirmDelete(true)}
          testID="cta-delete"
        />
      </ButtonRow>

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this fuel log?"
        message={`The ${formatShortDate(entry.date)} entry will be removed and mileage for the surrounding interval recalculated. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        busy={deleteFuel.isPending}
        onConfirm={() => deleteFuel.submit({ id: entry.id, adjustmentIds: ownAdjustments.map((a) => a.id) })}
        testID="dialog-delete-fuel"
      />

      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close receipt"
          onPress={() => setViewerOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}
        >
          {receiptUrl ? (
            <Image
              source={{ uri: receiptUrl }}
              accessibilityLabel="Pump receipt"
              accessibilityIgnoresInvertColors
              style={{ width: '92%', height: '80%' }}
              resizeMode="contain"
            />
          ) : (
            <View>
              <Txt role="body" color="#FFFFFF">
                That receipt is not available offline yet.
              </Txt>
            </View>
          )}
        </Pressable>
      </Modal>
    </Screen>
  );
}
