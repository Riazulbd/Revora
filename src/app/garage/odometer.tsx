import React, { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Banner,
  Button,
  Dialog,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Screen,
  ScreenHeader,
  Sheet,
  SkeletonList,
  Txt,
} from '@/components';
import {
  INITIAL_ODOMETER_POINT_ID,
  odometerSourceLabel,
  previewOdometerCorrection,
  type OdometerPoint,
} from '@/calculations/odometer';
import { distanceUnitLabel } from '@/calculations/units';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useCorrectOdometerReading } from '@/features/odometer/useOdometerMutations';
import { fromMetres, toMetres } from '@/features/shared/formValues';
import { formatShortDate } from '@/utils/date';
import { formatDistance } from '@/utils/format';
import { useTheme } from '@/theme';

/**
 * Odometer history.
 *
 * Readings from fuel logs, services and parts are derived from those records
 * rather than copied, so a deleted fuel log takes its reading with it and the
 * history can never disagree with the log (requirement 63).
 *
 * A reading the rider entered by hand is theirs to correct — tapping it opens
 * the editor below. A derived one is not: it is corrected by editing the record
 * it came from, which is what keeps the two in agreement.
 *
 * The list is virtualised: a rider with a few years of fuel logs has well over a
 * thousand readings here, and rendering them all at once would jank (requirement 59).
 */
export default function OdometerHistory() {
  const router = useRouter();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { units } = useGarage();
  const { analytics, isPending, error, refetch } = useGarageData();
  const [editing, setEditing] = useState<OdometerPoint | null>(null);
  const [hint, setHint] = useState<OdometerPoint | null>(null);

  const points = analytics?.odometer.points ?? [];

  if (error) {
    return (
      <Screen testID="screen-odometer">
        <ScreenHeader title="Odometer history" />
        <ErrorState message={error.message} onRetry={() => void refetch()} variant="page" />
      </Screen>
    );
  }

  if (isPending && analytics === null) {
    return (
      <Screen testID="screen-odometer">
        <ScreenHeader title="Odometer history" />
        <SkeletonList count={5} height={52} />
      </Screen>
    );
  }

  if (points.length === 0) {
    return (
      <Screen testID="screen-odometer">
        <ScreenHeader title="Odometer history" />
        <EmptyState
          icon="dashboard"
          title="No readings yet"
          message="Readings appear here from fuel logs, services and manual updates."
          primaryAction={{ label: 'Log a fill-up', onPress: () => router.push('/fuel/add') }}
          variant="page"
          testID="empty-odometer"
        />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        <ScreenHeader title="Odometer history" />
      </View>

      <FlatList
        testID="screen-odometer"
        data={points}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          // The design shows one card containing every row. Virtualising means
          // building that card out of the rows themselves: the surface runs
          // through all of them and only the ends are rounded.
          const first = index === 0;
          const last = index === points.length - 1;
          const correctable = item.readingId !== null;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${formatDistance(item.metres, units.distance)}, ${formatShortDate(item.date)}, ${odometerSourceLabel(item.source)}`}
              accessibilityHint={correctable ? 'Correct or delete this reading' : 'Shows where this reading comes from'}
              onPress={() => (correctable ? setEditing(item) : setHint(item))}
              style={({ pressed }) => ({
                backgroundColor: pressed ? c.sur2 : c.sur,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderTopWidth: first ? 1 : 0,
                borderBottomWidth: last ? 1 : 0,
                borderColor: c.brd,
                borderTopLeftRadius: first ? radius.listCard : 0,
                borderTopRightRadius: first ? radius.listCard : 0,
                borderBottomLeftRadius: last ? radius.listCard : 0,
                borderBottomRightRadius: last ? radius.listCard : 0,
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingHorizontal: 16,
              })}
            >
              <Txt role="rowTitle">{formatDistance(item.metres, units.distance)}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                <Txt role="meta" tone="mut" numberOfLines={1}>
                  {formatShortDate(item.date)} · {odometerSourceLabel(item.source)}
                </Txt>
                {correctable ? <Icon name="pencil" size={13} color={c.acc} strokeWidth={2} /> : null}
              </View>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => (
          <View style={{ backgroundColor: c.sur, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.brd }}>
            <Divider inset={16} />
          </View>
        )}
        ListFooterComponent={
          <Txt role="helper" tone="mut" style={{ marginTop: 14 }}>
            Readings come from fuel logs, services and manual updates — every source is kept so distances stay
            auditable. Tap a manual reading to correct it.
          </Txt>
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={16}
        maxToRenderPerBatch={20}
        windowSize={9}
      />

      {editing?.readingId ? (
        <CorrectReadingSheet
          key={editing.readingId}
          point={editing}
          readingId={editing.readingId}
          points={points}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <Sheet visible={hint !== null} onClose={() => setHint(null)} title="Where this reading comes from" testID="sheet-odometer-source">
        <Txt role="body" tone="mut">
          {hint === null
            ? ''
            : hint.id === INITIAL_ODOMETER_POINT_ID
              ? 'This is the reading you started the motorcycle with. Change it in Motorcycle profile → Edit details.'
              : `This reading is part of a ${odometerSourceLabel(hint.source)}. Edit that record and this updates with it — that is what stops the two disagreeing.`}
        </Txt>
        <Button label="Close" variant="secondary" onPress={() => setHint(null)} style={{ marginTop: 16 }} />
      </Sheet>
    </View>
  );
}

/**
 * The correction editor.
 *
 * Keyed on the reading id by its caller, so the field starts at the reading's
 * own value on first render and there is no hydration effect.
 */
function CorrectReadingSheet({
  point,
  readingId,
  points,
  onClose,
}: {
  point: OdometerPoint;
  /** Narrowed by the caller: only a stored reading can be corrected. */
  readingId: string;
  points: readonly OdometerPoint[];
  onClose: () => void;
}) {
  const { units } = useGarage();
  const [value, setValue] = useState(() => fromMetres(point.metres, units.distance));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const correct = useCorrectOdometerReading({ onSaved: onClose });

  const parsed = toMetres(value, units.distance);
  const preview = parsed === null ? null : previewOdometerCorrection(points, readingId, parsed);
  const removal = previewOdometerCorrection(points, readingId, null);

  return (
    <>
      <Sheet visible onClose={onClose} title="Correct this reading" testID="sheet-correct-odometer">
        <Txt role="helper" tone="mut">
          Recorded {formatShortDate(point.date)}. Correcting it recalculates mileage, running cost and everything
          due — nothing keeps a stale copy.
        </Txt>

        <Input
          value={value}
          onChangeText={setValue}
          placeholder={`Reading (${distanceUnitLabel(units.distance)})`}
          keyboardType="decimal-pad"
          invalid={parsed === null && value.trim() !== ''}
          style={{ marginTop: 14 }}
          testID="input-correct-odometer"
        />

        {preview !== null && preview.heldBy !== null ? (
          <Banner
            icon="alert"
            message={
              preview.heldBy.id === INITIAL_ODOMETER_POINT_ID
                ? `Your starting reading is ${formatDistance(preview.heldBy.metres, units.distance)}, so the odometer will stay there. Lower the starting reading in Edit details if that is the mistake.`
                : `Your ${odometerSourceLabel(preview.heldBy.source)} on ${formatShortDate(preview.heldBy.date)} already records ${formatDistance(preview.heldBy.metres, units.distance)}, so the odometer will stay there until that record is corrected too.`
            }
            style={{ marginTop: 12 }}
            testID="banner-odometer-held"
          />
        ) : null}

        {preview !== null && preview.heldBy === null && parsed !== point.metres ? (
          <Txt role="helper" tone="mut" style={{ marginTop: 12 }} testID="preview-odometer">
            The odometer will read {formatDistance(preview.resultingMetres, units.distance)}.
          </Txt>
        ) : null}

        <Button
          label="Save correction"
          disabled={parsed === null || parsed === point.metres}
          loading={correct.isPending}
          style={{ marginTop: 16 }}
          // A null here would mean "delete", so never let an empty field through
          // on the strength of the disabled prop alone.
          onPress={() => {
            if (parsed !== null) void correct.submit({ readingId, metres: parsed });
          }}
          testID="cta-save-correction"
        />
        <Button
          label="Delete this reading"
          variant="secondary"
          style={{ marginTop: 10 }}
          onPress={() => setConfirmDelete(true)}
          testID="cta-delete-reading"
        />
        <Button label="Cancel" variant="ghost" style={{ marginTop: 10 }} onPress={onClose} />
      </Sheet>

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this reading?"
        message={
          removal.resultingMetres === null
            ? 'This is the only reading on record. The odometer will have no value until you add another.'
            : `The odometer will fall back to ${formatDistance(removal.resultingMetres, units.distance)}, from your ${removal.heldBy ? odometerSourceLabel(removal.heldBy.source) : 'remaining records'}. This can't be undone.`
        }
        confirmLabel="Delete"
        destructive
        busy={correct.isPending}
        onConfirm={() => void correct.submit({ readingId, metres: null })}
        testID="dialog-delete-reading"
      />
    </>
  );
}
