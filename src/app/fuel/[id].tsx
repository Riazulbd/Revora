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
  HeroCard,
  HeroFigure,
  HeroHead,
  IconSquareButton,
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
import { formatCurrencySymbol, formatDistance, formatMileageValue, formatPricePerVolumeSymbol, formatVolume, NO_VALUE } from '@/utils/format';
import { efficiencyToDisplay, mileageUnitLabel, volumeUnitLabel } from '@/calculations/units';
import { useTheme } from '@/theme';

const FILL_LABEL = { full: 'Full tank', partial: 'Partial', unknown: 'Unknown level' } as const;

/**
 * One fill (Figma `B3 Fuel — Fill detail`).
 *
 * The order is the argument it makes: the mileage figure first, in the dark
 * hero with how it stands against the average, then — immediately — how it was
 * reached, or why there isn't one. A number a rider can't audit is a number
 * they won't trust, so the arithmetic is not hidden behind a link.
 */
export default function FuelDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const { units } = useGarage();
  const { analytics, isPending, error } = useGarageData();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const entry = useMemo(() => analytics?.fuel.entries.find((e) => e.id === id) ?? null, [analytics, id]);

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

  const edit = () => router.push({ pathname: '/fuel/add', params: { id: entry.id } });
  const unitLabel = mileageUnitLabel(units.mileage);
  const average = analytics?.mileage.average ?? null;
  // The hero's second line: this interval against the log's average, in the
  // rider's unit. On L/100km a lower figure is the better one.
  const versus =
    interval && average
      ? efficiencyToDisplay(interval.efficiency, units.mileage) - efficiencyToDisplay(average, units.mileage)
      : null;
  const better = versus === null ? null : units.mileage === 'l_per_100km' ? versus < 0 : versus > 0;

  return (
    <Screen testID="screen-fuel-detail" contentStyle={{ gap: 16 }}>
      <ScreenHeader
        title="Fill"
        titleSuffix={`· ${formatShortDate(entry.date)}`}
        action={<IconSquareButton icon="penLine" accessibilityLabel="Edit fill" onPress={edit} testID="cta-edit-top" />}
        style={{ marginBottom: 0 }}
      />

      <HeroCard gap={14} testID="hero-fill">
        <HeroHead eyebrow="Mileage" chip={FILL_LABEL[entry.fillType]} />
        <HeroFigure
          value={interval ? formatMileageValue(interval.efficiency, units.mileage) : undefined}
          unit={unitLabel}
          testID="hero-fill-mileage"
        />
        {versus !== null && Math.abs(versus) >= 0.05 ? (
          <Txt role="mediumStrong" color={better ? c.heroGood : c.heroAcc} testID="hero-fill-versus">
            {`${versus > 0 ? '▲' : '▼'} ${Math.abs(versus).toFixed(1)} ${unitLabel} ${
              versus > 0 ? 'above' : 'below'
            } your ${formatMileageValue(average, units.mileage)} average`}
          </Txt>
        ) : interval === null ? (
          <Txt role="mediumStrong" color={c.heroMut}>
            No interval closed by this fill
          </Txt>
        ) : null}
        <StatRow>
          <StatTile variant="hero" label="Odometer" value={formatDistance(entry.odometerMetres, units.distance)} />
          <StatTile
            variant="hero"
            label="Distance"
            value={interval ? formatDistance(interval.distanceMetres, units.distance) : NO_VALUE}
          />
        </StatRow>
      </HeroCard>

      {interval ? (
        <FuelMileageBreakdown entry={entry} interval={interval} units={units} />
      ) : (
        <FuelNoMileageCard entry={entry} units={units} />
      )}

      {ownAdjustments.length > 0 ? <FuelAdjustmentsCard adjustments={ownAdjustments} units={units} /> : null}

      <Card variant="list" style={{ paddingVertical: 4 }}>
        <DividedList>
          <KeyValueRow
            label={volumeUnitLabel(units.volume) === 'L' ? 'Litres' : 'Volume'}
            value={`${formatVolume(entry.litresMl, units.volume)} · ${FILL_LABEL[entry.fillType]}`}
          />
          <KeyValueRow
            label="Price"
            value={`${formatPricePerVolumeSymbol(entry.pricePerLitreMinor, entry.currency)} / ${volumeUnitLabel(
              units.volume,
            )} · ${formatCurrencySymbol(entry.totalCostMinor, entry.currency)} total`}
          />
          {entry.station ? <KeyValueRow label="Station" value={entry.station} /> : null}
          {entry.notes ? <KeyValueRow label="Notes" value={entry.notes} /> : null}
          {entry.receiptPath ? (
            <FuelReceiptRow uri={receiptUrl} onPress={() => setViewerOpen(true)} testID="row-receipt" />
          ) : null}
        </DividedList>
      </Card>

      <ButtonRow>
        <Button label="Edit" icon="penLine" variant="secondary" size="large" flex onPress={edit} testID="cta-edit" />
        <Button
          label="Delete"
          icon="trash"
          variant="dangerSubtle"
          size="large"
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
