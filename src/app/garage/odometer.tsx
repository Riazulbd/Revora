import React, { useMemo, useRef, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  Card,
  Dialog,
  Divider,
  EmptyState,
  ErrorState,
  Eyebrow,
  Icon,
  Screen,
  ScreenHeader,
  Sheet,
  SkeletonList,
  Txt,
  type IconName,
} from '@/components';
import {
  INITIAL_ODOMETER_POINT_ID,
  odometerSourceLabel,
  previewOdometerCorrection,
  validateOdometer,
  type OdometerPoint,
} from '@/calculations/odometer';
import { buildOdometerRows } from '@/calculations/odometerHistory';
import { distanceUnitLabel } from '@/calculations/units';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { OdometerCorrectionPanel, OdometerReadingRow } from '@/features/fuel/ui/FuelOdometerHistory';
import { useAddOdometerReading, useCorrectOdometerReading } from '@/features/odometer/useOdometerMutations';
import { fromMetres, toMetres } from '@/features/shared/formValues';
import { formatShortDate, todayIso } from '@/utils/date';
import { formatDistance, formatDistanceValue, NO_VALUE } from '@/utils/format';
import { MAX_FONT_SCALE, fontFamily, useTheme } from '@/theme';
import type { OdometerSource } from '@/types';

const SOURCE_ICON: Record<OdometerSource, IconName> = { manual: 'penLine', fuel: 'fuel', service: 'wrench', expense: 'receipt' };

/**
 * Odometer history (Figma `C4 Garage — Update odometer`): the current reading
 * and what holds it, a card to log a new reading, and every reading on record.
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
  const today = analytics?.today ?? todayIso();

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
        <SkeletonList count={5} height={60} />
      </Screen>
    );
  }

  if (rows.length === 0) {
    return (
      <Screen testID="screen-odometer">
        <ScreenHeader title="Odometer history" />
        <EmptyState
          icon="gauge"
          title="No readings yet"
          message="Readings appear here from fuel logs, services and manual updates."
          primaryAction={{ label: 'Log a fill-up', onPress: () => router.push('/fuel/add') }}
          testID="empty-odometer"
        />
      </Screen>
    );
  }

  const heldBy =
    current === null
      ? 'No reading on record yet'
      : current.id === INITIAL_ODOMETER_POINT_ID
        ? 'Held by the reading you entered at setup'
        : `Held by the ${odometerSourceLabel(current.source)} of ${formatShortDate(current.date)}`;

  const cardSide = { backgroundColor: c.sur, paddingHorizontal: 16 } as const;

  const header = (
    <View style={{ gap: 16 }}>
      {/* Figma `Hero`. */}
      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4, gap: 6 }}>
        <Txt style={{ fontFamily: fontFamily[500], fontSize: 13, lineHeight: 16, color: c.mut }}>Current odometer</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Txt role="hero" color={current === null ? c.mut : c.ink} numberOfLines={1} adjustsFontSizeToFit testID="hero-odometer">
            {current === null ? NO_VALUE : formatDistanceValue(current.metres, units.distance)}
          </Txt>
          <Txt role="heroUnit" tone="mut">
            {units.distance}
          </Txt>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 10,
            paddingRight: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: c.sur,
            borderWidth: 1,
            borderColor: c.brd,
          }}
        >
          <Icon name={current === null ? 'gauge' : SOURCE_ICON[current.source]} size={16} color={c.accBright} />
          <Txt role="micro" tone="mut">
            {heldBy}
          </Txt>
        </View>
      </View>

      <NewReading currentMetres={current?.metres ?? null} currentDate={current?.date ?? null} today={today} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
        <Eyebrow>Readings</Eyebrow>
        <Txt role="meta" tone="mut">
          Tap a manual reading to correct it
        </Txt>
      </View>
      <View style={{ ...cardSide, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, height: 4 }} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
        <ScreenHeader title="Odometer history" style={{ marginBottom: 0 }} />
      </View>

      <FlatList
        ref={listRef}
        testID="screen-odometer"
        data={rows}
        keyExtractor={(item) => item.point.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={cardSide}>
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
          <View style={cardSide}>
            <Divider />
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: 16 }}>
            <View style={{ ...cardSide, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card, height: 4 }} />
            {editing?.readingId ? (
              <CorrectReading key={editing.readingId} point={editing} readingId={editing.readingId} points={points} onClose={() => setEditing(null)} />
            ) : null}
            <Txt role="helper" tone="mut" align="center">
              Readings appear here from fuel logs, services and manual updates.
            </Txt>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={16}
        maxToRenderPerBatch={20}
        windowSize={9}
      />

      <Sheet visible={hint !== null} onClose={() => setHint(null)} title="Where this reading comes from" testID="sheet-odometer-source">
        <Txt role="body" tone="mut">
          {hint === null
            ? ''
            : hint.id === INITIAL_ODOMETER_POINT_ID
              ? 'This is the reading you started the motorcycle with. Change it in Motorcycle profile → Edit details.'
              : `This reading is part of a ${odometerSourceLabel(hint.source)}. Edit that record and this updates with it — that is what stops the two disagreeing.`}
        </Txt>
        <Button label="Close" variant="secondary" size="large" onPress={() => setHint(null)} style={{ marginTop: 16 }} />
      </Sheet>
    </View>
  );
}

/**
 * Figma `Entry card`: a new manual reading. The big field, the distance since
 * the last reading as it is typed (green going up, red going down — the
 * odometer only moves forward, and a lower figure is flagged rather than
 * silently accepted), and the Update button.
 */
function NewReading({ currentMetres, currentDate, today }: { currentMetres: number | null; currentDate: string | null; today: string }) {
  const { c } = useTheme();
  const { units } = useGarage();
  const [value, setValue] = useState('');
  const [refused, setRefused] = useState(false);
  const [focused, setFocused] = useState(false);
  const addReading = useAddOdometerReading({
    onSaved: () => {
      setValue('');
      setRefused(false);
    },
  });

  const parsed = toMetres(value, units.distance);
  const check = parsed === null ? null : validateOdometer(parsed, currentMetres);
  const delta = parsed === null || currentMetres === null ? null : parsed - currentMetres;
  const lower = check !== null && !check.ok && check.reason === 'below_current';

  const submit = async () => {
    if (parsed === null || lower) {
      setRefused(true);
      return;
    }
    setRefused(false);
    await addReading.submit({ metres: parsed, source: 'manual' });
  };

  return (
    <Card style={{ gap: 12 }} testID="card-new-reading">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Eyebrow>Update odometer</Eyebrow>
        <Txt role="micro" tone="mut">
          {`Today, ${formatShortDate(today)}`}
        </Txt>
      </View>
      <View
        style={{
          height: 76,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 18,
          borderRadius: 20,
          backgroundColor: c.field,
          borderWidth: 2,
          borderColor: refused ? c.badIcon : focused || value !== '' ? c.acc : c.brd,
        }}
      >
        <TextInput
          value={value}
          onChangeText={(next) => {
            setValue(next);
            setRefused(false);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={currentMetres === null ? '0' : fromMetres(currentMetres, units.distance)}
          placeholderTextColor={c.faint}
          keyboardType="decimal-pad"
          selectionColor={c.acc}
          cursorColor={c.acc}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel={`New odometer reading in ${distanceUnitLabel(units.distance)}`}
          testID="input-odometer"
          style={{ flex: 1, minWidth: 0, fontFamily: fontFamily[700], fontSize: 34, letterSpacing: -0.68, color: c.ink, paddingVertical: 0, paddingHorizontal: 0 }}
        />
        <Txt role="heroUnit" tone="mut">
          {units.distance}
        </Txt>
      </View>

      {delta !== null && currentDate !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Badge label={`${delta >= 0 ? '+' : '−'}${formatDistance(Math.abs(delta), units.distance)}`} tone={delta >= 0 ? 'good' : 'bad'} />
          <Txt role="meta" tone="mut" style={{ flex: 1 }} numberOfLines={2}>
            {delta >= 0 ? `since your last reading on ${formatShortDate(currentDate)}` : `lower than your last reading on ${formatShortDate(currentDate)}`}
          </Txt>
        </View>
      ) : null}

      <Txt role="helper" tone={refused ? 'bad' : 'mut'}>
        {refused && parsed === null
          ? 'Enter the current reading.'
          : refused
            ? 'Lower than the current reading — correct the wrong reading below instead.'
            : check !== null && !check.ok && check.reason === 'implausible_jump'
              ? `That is more than 5,000 ${distanceUnitLabel(units.distance)} past your last reading — double-check before saving.`
              : 'Odometer only moves forward — a lower reading gets flagged, never silently accepted.'}
      </Txt>

      <Button label="Update odometer" icon="check" size="xlarge" onPress={submit} loading={addReading.isPending} testID="cta-update-odometer" />
    </Card>
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
