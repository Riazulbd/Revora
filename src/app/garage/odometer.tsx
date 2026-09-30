import React, { useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  Dialog,
  Divider,
  EmptyState,
  ErrorState,
  Eyebrow,
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
import { buildOdometerRows } from '@/calculations/odometerHistory';
import { distanceUnitLabel } from '@/calculations/units';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import {
  OdometerCorrectionPanel,
  OdometerReadingRow,
} from '@/features/fuel/ui/FuelOdometerHistory';
import { useCorrectOdometerReading } from '@/features/odometer/useOdometerMutations';
import { fromMetres, toMetres } from '@/features/shared/formValues';
import { formatShortDate } from '@/utils/date';
import { formatDistance, formatDistanceValue, NO_VALUE } from '@/utils/format';
import { useTheme } from '@/theme';

/**
 * Odometer history.
 *
 * Readings from fuel logs, services and parts are derived from those records
 * rather than copied, so a deleted fuel log takes its reading with it and the
 * history can never disagree with the log (requirement 63).
 *
 * A reading the rider entered by hand is theirs to correct — tapping it opens
 * the editor at the foot of the list. A derived one is not: it is corrected by
 * editing the record it came from, which is what keeps the two in agreement.
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
  const listRef = useRef<FlatList<ReturnType<typeof buildOdometerRows>[number]>>(null);

  const points = useMemo(() => analytics?.odometer.points ?? [], [analytics]);
  const rows = useMemo(() => buildOdometerRows(points), [points]);
  const current = analytics?.odometer.latest ?? null;

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

  if (rows.length === 0) {
    return (
      <Screen testID="screen-odometer">
        <ScreenHeader title="Odometer history" />
        <EmptyState
          icon="odometer"
          title="No readings yet"
          message="Readings appear here from fuel logs, services and manual updates."
          primaryAction={{ label: 'Log a fill-up', onPress: () => router.push('/fuel/add') }}
          testID="empty-odometer"
        />
        <Txt role="helper" tone="mut" style={{ marginTop: 12 }}>
          No readings yet? The odometer you entered at setup is the first one.
        </Txt>
      </Screen>
    );
  }

  /** The list is one card: only its ends are rounded, every row shares the surface. */
  const slice = (index: number) => {
    const first = index === 0;
    const last = index === rows.length - 1;
    return {
      backgroundColor: c.sur,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderTopWidth: first ? 1 : 0,
      borderBottomWidth: last ? 1 : 0,
      borderColor: c.brd,
      borderTopLeftRadius: first ? radius.listCard : 0,
      borderTopRightRadius: first ? radius.listCard : 0,
      borderBottomLeftRadius: last ? radius.listCard : 0,
      borderBottomRightRadius: last ? radius.listCard : 0,
      paddingHorizontal: 16,
    } as const;
  };

  const heldByLine =
    current === null
      ? 'No reading is on record yet.'
      : current.id === INITIAL_ODOMETER_POINT_ID
        ? 'Held by the reading you entered at setup. The odometer only moves forward — correct a wrong reading below.'
        : `Held by the ${odometerSourceLabel(current.source)} of ${formatShortDate(current.date)}. The odometer only moves forward — correct a wrong reading below.`;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <ScreenHeader title="Odometer history" />
      </View>

      <FlatList
        ref={listRef}
        testID="screen-odometer"
        data={rows}
        keyExtractor={(item) => item.point.id}
        ListHeaderComponent={
          <Card style={{ marginBottom: 12 }} testID="card-current-odometer">
            <Eyebrow>Current odometer</Eyebrow>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <Txt role="figure" style={{ fontSize: 28 }} numberOfLines={1} adjustsFontSizeToFit>
                {current === null
                  ? NO_VALUE
                  : formatDistanceValue(current.metres, units.distance)}
              </Txt>
              <Txt role="linkLarge" tone="mut">
                {distanceUnitLabel(units.distance)}
              </Txt>
            </View>
            <Txt role="meta" tone="mut" style={{ marginTop: 4, lineHeight: 18 }}>
              {heldByLine}
            </Txt>
          </Card>
        }
        renderItem={({ item, index }) => (
          <View style={slice(index)}>
            <OdometerReadingRow
              row={item}
              unit={units.distance}
              selected={editing?.id === item.point.id}
              onPress={() => {
                if (item.correctable) {
                  setEditing(item.point);
                  requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
                } else {
                  setHint(item.point);
                }
              }}
              testID={`odometer-row-${item.point.id}`}
            />
          </View>
        )}
        ItemSeparatorComponent={() => (
          <View style={{ backgroundColor: c.sur, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.brd }}>
            <Divider inset={16} />
          </View>
        )}
        ListFooterComponent={
          <View>
            {editing?.readingId ? (
              <CorrectReading
                key={editing.readingId}
                point={editing}
                readingId={editing.readingId}
                points={points}
                onClose={() => setEditing(null)}
              />
            ) : null}
            <Txt role="helper" tone="mut" style={{ marginTop: 12 }}>
              No readings yet? The odometer you entered at setup is the first one.
            </Txt>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={16}
        maxToRenderPerBatch={20}
        windowSize={9}
      />

      <Sheet
        visible={hint !== null}
        onClose={() => setHint(null)}
        title="Where this reading comes from"
        testID="sheet-odometer-source"
      >
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
function CorrectReading({
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
  const dateLabel = formatShortDate(point.date);

  const heldBy = preview?.heldBy ?? null;
  const previewLine =
    preview === null
      ? 'Enter the reading as it should have been — nothing changes until you commit.'
      : heldBy === null
        ? `After this change the current odometer reads ${formatDistance(preview.resultingMetres, units.distance)}. Every figure derived after ${dateLabel} is recalculated.`
        : heldBy.id === INITIAL_ODOMETER_POINT_ID
          ? `After this change the current odometer stays ${formatDistance(preview.resultingMetres, units.distance)}, still held by the reading you entered at setup. Every figure derived after ${dateLabel} is recalculated.`
          : `After this change the current odometer stays ${formatDistance(preview.resultingMetres, units.distance)}, still held by the ${odometerSourceLabel(heldBy.source)} of ${formatShortDate(heldBy.date)}. Every figure derived after ${dateLabel} is recalculated.`;

  return (
    <>
      <OdometerCorrectionPanel
        dateLabel={dateLabel}
        originalLabel={formatDistanceValue(point.metres, units.distance)}
        value={value}
        onChange={setValue}
        invalid={parsed === null && value.trim() !== ''}
        preview={previewLine}
        busy={correct.isPending}
        unitLabel={distanceUnitLabel(units.distance)}
        // A null here would mean "delete", so never let an empty field through
        // on the strength of the disabled prop alone.
        onCommit={() => {
          if (parsed !== null) void correct.submit({ readingId, metres: parsed });
        }}
        onCancel={onClose}
        onDelete={() => setConfirmDelete(true)}
        style={{ marginTop: 14 }}
      />

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
