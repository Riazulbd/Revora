import React, { useMemo, useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Badge,
  Button,
  ButtonRow,
  Card,
  Dialog,
  DividedList,
  ErrorState,
  Icon,
  KeyValueRow,
  LinkButton,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  StatTile,
  Txt,
} from '@/components';
import { ADJUSTMENT_REASON_LABEL } from '@/calculations/fuel';
import { confidenceLabel } from '@/calculations/mileage';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { MileageExplainSheet } from '@/features/fuel/MileageExplainSheet';
import { useDeleteFuel } from '@/features/fuel/useFuelMutations';
import { useImageUrl } from '@/features/shared/useImageUrl';
import { formatInstant, formatLongDate, formatShortDate } from '@/utils/date';
import {
  formatCurrency,
  formatDistance,
  formatMileage,
  formatPricePerVolume,
  formatVolume,
  NO_VALUE,
} from '@/utils/format';
import { volumeUnitLabel } from '@/calculations/units';
import { useTheme } from '@/theme';

const FILL_LABEL = { full: 'Full tank', partial: 'Partial fill', unknown: 'Unknown level' } as const;

export default function FuelDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c, radius } = useTheme();
  const { units } = useGarage();
  const { analytics, isPending, error } = useGarageData();
  const [explainOpen, setExplainOpen] = useState(false);
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
        <ScreenHeader title="Fuel log" />
        <ErrorState
          message={error.message}
          onRetry={undefined}
          variant="page"
        />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-fuel-detail">
        <ScreenHeader title="Fuel log" />
        <SkeletonList count={3} height={120} />
      </Screen>
    );
  }

  if (!entry) {
    return (
      <Screen testID="screen-fuel-detail">
        <ScreenHeader title="Fuel log" />
        <ErrorState
          title="This fuel log is gone"
          message="It may have been deleted on another device. Your remaining logs are unaffected."
          onRetry={() => router.replace('/(tabs)/fuel')}
          variant="page"
        />
      </Screen>
    );
  }

  const adjustedMl = ownAdjustments.reduce((sum, a) => sum + a.millilitres, 0);

  return (
    <Screen testID="screen-fuel-detail">
      <ScreenHeader title={`Fuel log · ${formatShortDate(entry.date)}`} style={{ marginBottom: 8 }} />

      <Stack>
        <Card style={{ paddingVertical: 20, alignItems: 'center' }}>
          <Txt role="figure" numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(entry.totalCostMinor, entry.currency)}
          </Txt>
          <Txt role="mediumStrong" tone="mut" align="center" style={{ marginTop: 4 }}>
            {formatVolume(entry.litresMl, units.volume)} ·{' '}
            {formatPricePerVolume(entry.pricePerLitreMinor, entry.currency)}/{volumeUnitLabel(units.volume)} ·{' '}
            {FILL_LABEL[entry.fillType]}
          </Txt>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' }}>
            <StatTile label="ODOMETER" value={formatDistance(entry.odometerMetres, units.distance)} />
            <StatTile
              label="DISTANCE"
              value={interval ? formatDistance(interval.distanceMetres, units.distance) : NO_VALUE}
            />
            <StatTile
              label="MILEAGE"
              variant="accent"
              value={interval ? formatMileage(interval.efficiency, units.mileage) : NO_VALUE}
            />
          </View>

          {interval ? (
            <View style={{ marginTop: 14 }}>
              <LinkButton
                label="How was this calculated?"
                size="large"
                onPress={() => setExplainOpen(true)}
                testID="link-explain"
              />
            </View>
          ) : (
            <Txt role="helper" tone="mut" align="center" style={{ marginTop: 12 }}>
              {entry.fillType === 'full'
                ? 'Mileage for this fill appears once there is a full tank before it to measure from.'
                : 'Partial fills carry their fuel into the next full-tank interval rather than reporting a figure of their own.'}
            </Txt>
          )}
        </Card>

        {entry.receiptPath ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View pump receipt"
            onPress={() => setViewerOpen(true)}
            testID="row-receipt"
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <Card variant="list" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  backgroundColor: c.sur2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {receiptUrl ? (
                  <Image source={{ uri: receiptUrl }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Icon name="document" size={22} color={c.mut} strokeWidth={1.8} />
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt role="mediumStrong">Pump receipt</Txt>
                <Txt role="metaSmall" tone="mut">
                  Attached {formatShortDate(entry.date)}
                </Txt>
              </View>
              <Txt role="smallStrong" tone="acc">
                View
              </Txt>
            </Card>
          </Pressable>
        ) : null}

        <Card variant="list">
          <DividedList>
            <KeyValueRow label="Date" value={formatLongDate(entry.date)} />
            <KeyValueRow label="Station" value={entry.station ?? 'Not recorded'} />
            <KeyValueRow
              label="Adjustments"
              value={
                adjustedMl === 0
                  ? 'None'
                  : `${adjustedMl > 0 ? '+' : '−'}${formatVolume(Math.abs(adjustedMl), units.volume)}`
              }
            />
            {interval ? (
              <KeyValueRow label="Confidence" value={confidenceLabel(interval.confidence)} />
            ) : null}
            {entry.notes ? <KeyValueRow label="Notes" value={entry.notes} /> : null}
            <KeyValueRow label="Logged" value={formatInstant(entry.createdAt)} />
          </DividedList>
        </Card>

        {ownAdjustments.length > 0 ? (
          <Card>
            <Txt role="eyebrow" tone="mut" uppercase>
              ADJUSTMENT DETAIL
            </Txt>
            <View style={{ gap: 10, marginTop: 12 }}>
              {ownAdjustments.map((adjustment) => (
                <View
                  key={adjustment.id}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                >
                  <Txt role="kv" tone="mut" style={{ flex: 1 }}>
                    {adjustment.note ?? ADJUSTMENT_REASON_LABEL[adjustment.reason]}
                  </Txt>
                  <Badge
                    label={`${adjustment.millilitres > 0 ? '+' : '−'}${formatVolume(
                      Math.abs(adjustment.millilitres),
                      units.volume,
                    )}`}
                    tone={adjustment.millilitres > 0 ? 'good' : 'warn'}
                  />
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <ButtonRow>
          <Button
            label="Edit"
            variant="secondary"
            size="medium"
            onPress={() => router.push({ pathname: '/fuel/add', params: { id: entry.id } })}
            style={{ flex: 1 }}
            testID="cta-edit"
          />
          <Button
            label="Delete"
            variant="secondary"
            size="medium"
            onPress={() => setConfirmDelete(true)}
            style={{ flex: 1, borderRadius: radius.input }}
            testID="cta-delete"
          />
        </ButtonRow>
      </Stack>

      <MileageExplainSheet visible={explainOpen} onClose={() => setExplainOpen(false)} analytics={analytics} />

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
              style={{ width: '92%', height: '80%' }}
              resizeMode="contain"
            />
          ) : (
            <Txt role="body" color="#FFFFFF">
              That receipt is not available offline yet.
            </Txt>
          )}
        </Pressable>
      </Modal>
    </Screen>
  );
}

