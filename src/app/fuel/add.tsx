import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Banner,
  Button,
  Card,
  CheckRow,
  DateField,
  Divider,
  Field,
  FieldRow,
  Input,
  Screen,
  ScreenHeader,
  Segmented,
  SkeletonList,
  TextArea,
  Txt,
  useToast,
} from '@/components';
import type { BikeAnalytics } from '@/calculations/analytics';
import { currencyDecimals, currencySymbol } from '@/calculations/money';
import { deriveFuelAmounts } from '@/calculations/fuel';
import { validateOdometer } from '@/calculations/odometer';
import { distanceUnitLabel, volumeUnitLabel } from '@/calculations/units';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { FuelDisclosure } from '@/features/fuel/ui/FuelDisclosure';
import { useNewFuelId, useSaveFuel, type AdjustmentDraft } from '@/features/fuel/useFuelMutations';
import { fromMetres, fromMinor, fromMl, toMetres, toMinor, toMl, toTrimmed } from '@/features/shared/formValues';
import { PhotoField } from '@/features/shared/PhotoField';
import { useGarageContext } from '@/features/shared/useGarageContext';
import { useStableId } from '@/features/shared/useStableId';
import { uploadImageOrKeepLocal } from '@/services/storage';
import { useConnectivity } from '@/services/connectivity';
import type { FuelAdjustmentReason, FuelEntry, UnitPreferences } from '@/types';
import { fuelEntrySchema } from '@/validation/schemas';
import { formatDistance, formatDistanceValue, formatVolume, NO_VALUE } from '@/utils/format';
import { formatShortDate, todayIso } from '@/utils/date';

/**
 * Add / edit a fuel log — the screen that has to work with cold hands, gloves on,
 * one bar of signal.
 *
 * Three properties it guarantees:
 *  · Litres, price and total stay consistent: fill in any two and the third is
 *    derived exactly, in integers (requirement 14). The derived box says so, in
 *    the board's inset grey with a "⟳ derived" line, so nobody retypes it.
 *  · The raw litres the rider paid for are stored untouched; adjustments are a
 *    separate list (requirement 16).
 *  · Nothing is lost. The save is accepted locally the moment it is made, and if
 *    the write fails the form stays open with every value intact (requirement 38).
 */

/**
 * The design's adjustment rows, mapped onto the shared schema's reason enum.
 * `added_unlogged` is the one that ADDS fuel; every other row removes it.
 */
const ADJUSTMENT_ROWS: readonly { reason: FuelAdjustmentReason; label: string; adds: boolean }[] = [
  { reason: 'other', label: 'Spillage / waste', adds: false },
  { reason: 'leak', label: 'Suspected leak', adds: false },
  { reason: 'maintenance_loss', label: 'Service / idle use (not ridden)', adds: false },
  { reason: 'transferred', label: 'Drained or transferred out', adds: false },
  { reason: 'added_unlogged', label: 'Fuel added but not logged', adds: true },
];

/** Top to bottom on the form, so the toast names the first thing they will see. */
const FIELD_ORDER = ['odometer', 'litres', 'total', 'adjustments', 'form'] as const;

/**
 * The board's failure banner: a bold red opening that names what stopped the
 * save, then the sentence that gets the rider out of it.
 */
const FAILURE_COPY: Record<(typeof FIELD_ORDER)[number], { lead: string; message: string }> = {
  odometer: {
    lead: 'Not saved — the odometer is empty.',
    message: 'Enter the reading at the pump, exactly as it shows.',
  },
  litres: {
    lead: 'Not saved — litres is empty.',
    message: 'Enter litres, or litres will be worked out if you give price and total.',
  },
  total: {
    lead: 'Not saved — the money does not add up.',
    message: 'Give any two of litres, price and total; the third is worked out.',
  },
  adjustments: {
    lead: 'Not saved — an adjustment has no amount.',
    message: 'Enter how much fuel each adjustment accounts for, or clear it.',
  },
  form: {
    lead: 'Not saved.',
    message: 'Check the highlighted fields and try again.',
  },
};

const FILL_OPTIONS = [
  { value: 'full' as const, label: 'Full tank' },
  { value: 'partial' as const, label: 'Partial' },
  { value: 'unknown' as const, label: 'Unknown' },
];

type Adjustments = Partial<Record<FuelAdjustmentReason, { value: string; id?: string }>>;

const EMPTY_ADJUSTMENTS: Adjustments = {};

/**
 * The route waits for the garage data before mounting the form, then keys the
 * form on the record it is editing. That is what lets every field initialise
 * from its final value on first render — no hydration effect, no flash of an
 * empty form, and no cascading re-render (mistake 20 / 24).
 */
export default function AddFuelRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const { analytics } = useGarageData();
  const { units } = useGarage();

  if (analytics === null) {
    return (
      <Screen testID="screen-fuel-add">
        <ScreenHeader title={editingId ? 'Edit fill' : 'Add fuel'} />
        <SkeletonList count={4} height={72} />
      </Screen>
    );
  }

  const existing = editingId ? (analytics.fuel.entries.find((e) => e.id === editingId) ?? null) : null;

  return (
    <FuelForm key={existing?.id ?? 'new'} existing={existing} analytics={analytics} units={units} />
  );
}

function FuelForm({
  existing,
  analytics,
  units,
}: {
  existing: FuelEntry | null;
  analytics: BikeAnalytics;
  units: UnitPreferences;
}) {
  const garage = useGarageContext();
  const router = useRouter();
  const connectivity = useConnectivity();
  const toast = useToast();

  const newId = useNewFuelId();
  const generatedId = useStableId(newId);
  const recordId = existing?.id ?? generatedId;

  const currency = existing?.currency ?? analytics.currency;
  const decimals = currencyDecimals(currency);
  const currentOdometer = analytics.odometer.currentMetres;
  const volumeLabel = volumeUnitLabel(units.volume);

  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [odometer, setOdometer] = useState(
    existing ? fromMetres(existing.odometerMetres, units.distance) : '',
  );
  const [litres, setLitres] = useState(existing ? fromMl(existing.litresMl, units.volume) : '');
  // A new fill starts at the price of the last one — at a pump it is almost
  // always the same, and pre-filling removes a step without inventing anything.
  // The board marks that box "last fill" so the rider knows where it came from.
  const [price, setPrice] = useState(
    existing
      ? fromMinor(existing.pricePerLitreMinor, decimals)
      : analytics.fuel.latest
        ? fromMinor(analytics.fuel.latest.pricePerLitreMinor, decimals)
        : '',
  );
  const [priceFromLastFill, setPriceFromLastFill] = useState(
    existing === null && analytics.fuel.latest !== null,
  );
  const [total, setTotal] = useState(existing ? fromMinor(existing.totalCostMinor, decimals) : '');
  // Which box the app filled in for the rider, so only that one is drawn inset
  // and captioned "⟳ derived".
  const [derived, setDerived] = useState<'price' | 'total' | null>(existing ? null : 'total');
  const [fillType, setFillType] = useState<'full' | 'partial' | 'unknown'>(existing?.fillType ?? 'full');
  // Adjustments logged with this fill are their own records on the timeline,
  // recognisable by a clientRef stamped with this entry's id.
  const [adjustments, setAdjustments] = useState<Adjustments>(() => {
    if (!existing) return EMPTY_ADJUSTMENTS;
    const next: Adjustments = {};
    for (const adjustment of analytics.fuel.adjustments) {
      if (!adjustment.clientRef.startsWith(`${existing.id}:`)) continue;
      next[adjustment.reason] = {
        value: fromMl(Math.abs(adjustment.millilitres), units.volume),
        id: adjustment.id,
      };
    }
    return next;
  });
  const [removedAdjustmentIds, setRemovedAdjustmentIds] = useState<string[]>([]);
  const [station, setStation] = useState(existing?.station ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [receiptUri, setReceiptUri] = useState<string | null>(existing?.receiptPath ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lastEdited = useRef<'litres' | 'price' | 'total' | null>(null);

  /** Derive whichever money field the rider has not just typed into. */
  const recalculate = (
    source: 'litres' | 'price' | 'total',
    values: { litres: string; price: string; total: string },
  ) => {
    lastEdited.current = source;
    const result = deriveFuelAmounts(
      {
        litresMl: toMl(values.litres, units.volume),
        pricePerLitreMinor: toMinor(values.price, currency),
        totalCostMinor: toMinor(values.total, currency),
      },
      source,
    );

    if (source !== 'total' && result.totalCostMinor !== null) {
      setTotal(fromMinor(result.totalCostMinor, decimals));
      setDerived('total');
    }
    if (source === 'total' && result.pricePerLitreMinor !== null) {
      setPrice(fromMinor(result.pricePerLitreMinor, decimals));
      setPriceFromLastFill(false);
      setDerived('price');
    }
  };

  /** Signed net effect of the rows the rider has filled in. */
  const adjustmentMlTotal = ADJUSTMENT_ROWS.reduce((sum, row) => {
    const raw = adjustments[row.reason];
    if (raw === undefined) return sum;
    const ml = toMl(raw.value, units.volume) ?? 0;
    return sum + (row.adds ? ml : -ml);
  }, 0);

  const litresMl = toMl(litres, units.volume);
  const effectiveMl = litresMl === null ? null : Math.max(0, litresMl + adjustmentMlTotal);
  const adjustmentCount = ADJUSTMENT_ROWS.filter((row) => adjustments[row.reason] !== undefined).length;

  const odometerMetres = toMetres(odometer, units.distance);
  const odometerCheck =
    odometerMetres === null ? null : validateOdometer(odometerMetres, existing ? null : currentOdometer);
  const odometerWarning = odometerCheck !== null && !odometerCheck.ok;

  const failureKey = FIELD_ORDER.find((key) => errors[key] !== undefined) ?? null;

  const detailSummary = [
    toTrimmed(station),
    toTrimmed(notes) === null ? null : 'notes',
    receiptUri === null ? null : '1 photo',
  ].filter((part): part is string => part !== null);

  const saveFuel = useSaveFuel();

  const submit = async () => {
    const next: Record<string, string> = {};

    const parsedOdometer = toMetres(odometer, units.distance);
    if (parsedOdometer === null) next.odometer = 'Enter the reading at the pump.';

    const parsedLitres = toMl(litres, units.volume);
    if (parsedLitres === null || parsedLitres <= 0) next.litres = 'Enter how much fuel you added.';

    const parsedPrice = toMinor(price, currency);
    const parsedTotal = toMinor(total, currency);

    const built: AdjustmentDraft[] = [];
    for (const row of ADJUSTMENT_ROWS) {
      const raw = adjustments[row.reason];
      if (raw === undefined) continue;
      const ml = toMl(raw.value, units.volume);
      if (ml === null || ml <= 0) {
        next.adjustments = 'Enter how much fuel each adjustment accounts for.';
        continue;
      }
      built.push({
        ...(raw.id === undefined ? {} : { id: raw.id }),
        reason: row.reason,
        millilitres: row.adds ? ml : -ml,
        approximate: false,
        note: row.label,
      });
    }

    const result = fuelEntrySchema.safeParse({
      date,
      odometerMetres: parsedOdometer ?? 0,
      litresMl: parsedLitres ?? 0,
      pricePerLitreMinor: parsedPrice,
      totalCostMinor: parsedTotal,
      fillType,
      adjustmentMl: built.reduce((sum, a) => sum + Math.max(0, -a.millilitres), 0),
      station: toTrimmed(station),
      notes: toTrimmed(notes),
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        const field =
          key === 'odometerMetres'
            ? 'odometer'
            : key === 'litresMl'
              ? 'litres'
              : key === 'totalCostMinor' || key === 'pricePerLitreMinor'
                ? 'total'
                : key === 'adjustmentMl'
                  ? 'adjustments'
                  : key;
        next[field] = issue.message;
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) {
      // The Save button sits below the fold, so the field it highlighted is
      // often off-screen: the rider taps, nothing visibly happens, and they tap
      // again. Say what is wrong where the thumb already is — in the toast and
      // in the banner directly above Save.
      const first = FIELD_ORDER.find((key) => next[key] !== undefined);
      if (next.adjustments !== undefined) setAdjustmentsOpen(true);
      toast.show(first === undefined ? 'Check the highlighted fields.' : (next[first] as string), 'error');
      return;
    }

    // Upload the receipt first so the stored record points at the final path.
    // A failed upload keeps the local URI: the photo stays visible on this device
    // and the fuel log itself is never blocked by it.
    let receiptPath = receiptUri;
    if (receiptUri && receiptUri.startsWith('file://') && garage) {
      const upload = await uploadImageOrKeepLocal({
        uid: garage.uid,
        kind: 'receipt',
        recordId,
        localUri: receiptUri,
      });
      receiptPath = upload.path;
    }

    await saveFuel.submit({
      id: recordId,
      date,
      odometerMetres: parsedOdometer ?? 0,
      litresMl: parsedLitres ?? 0,
      pricePerLitreMinor: parsedPrice,
      totalCostMinor: parsedTotal,
      fillType,
      missedPreviousFill: existing?.missedPreviousFill ?? false,
      adjustments: built,
      removedAdjustmentIds,
      station: toTrimmed(station),
      notes: toTrimmed(notes),
      receiptPath,
      ...(existing ? { existing } : {}),
    });
  };

  return (
    <Screen testID="screen-fuel-add" contentStyle={{ flexGrow: 1 }}>
      <ScreenHeader
        title={existing ? 'Edit fill' : 'Add fuel'}
        {...(existing ? { titleSuffix: `· ${formatShortDate(existing.date)}` } : {})}
      />

      <FieldRow gap={12}>
        <Field label="Date" icon="calendar" flex={1}>
          <DateField
            value={date}
            onChange={setDate}
            maximumDate={new Date()}
            size="numeric"
            format={formatShortDate}
            accessibilityLabel="Date of this fill"
            testID="field-date"
          />
        </Field>
        <Field label="Odometer" icon="odometer" flex={1.3} error={errors.odometer ?? null}>
          <Input
            value={odometer}
            onChangeText={setOdometer}
            placeholder={
              currentOdometer === null ? NO_VALUE : formatDistanceValue(currentOdometer, units.distance)
            }
            keyboardType="decimal-pad"
            size="numeric"
            unit={distanceUnitLabel(units.distance)}
            tone={odometerWarning ? 'warn' : 'default'}
            invalid={Boolean(errors.odometer)}
            accessibilityLabel={`Odometer reading in ${distanceUnitLabel(units.distance)}`}
            testID="input-odometer"
          />
        </Field>
      </FieldRow>

      {odometerCheck && !odometerCheck.ok ? (
        <Banner
          icon="alertTriangle"
          compact
          lead={
            odometerCheck.reason === 'below_current'
              ? `Below your last reading (${formatDistance(odometerCheck.currentMetres, units.distance)}).`
              : `More than 5,000 ${distanceUnitLabel(units.distance)} past your last reading.`
          }
          message={
            odometerCheck.reason === 'below_current'
              ? 'You can still save — if an earlier entry is the wrong one, fix it in'
              : 'You can still save — worth double-checking the reading, or fix an earlier entry in'
          }
          link={{
            label: 'Odometer history',
            onPress: () => router.push('/garage/odometer'),
            testID: 'link-odometer-history',
          }}
          style={{ marginTop: 10 }}
          testID="banner-odometer"
        />
      ) : null}

      <FieldRow gap={10} style={{ marginTop: 16 }}>
        <Field label={volumeLabel === 'L' ? 'Litres' : 'Volume'} icon="drop" flex={1}>
          <Input
            value={litres}
            onChangeText={(t) => {
              setLitres(t);
              recalculate('litres', { litres: t, price, total });
            }}
            placeholder={NO_VALUE}
            keyboardType="decimal-pad"
            size="numeric"
            invalid={Boolean(errors.litres)}
            accessibilityLabel={`How much fuel, in ${volumeLabel}`}
            testID="input-litres"
          />
        </Field>
        <Field label={`${currencySymbol(currency)} / ${volumeLabel.toLowerCase()}`} flex={1}>
          <Input
            value={price}
            onChangeText={(t) => {
              setPrice(t);
              setPriceFromLastFill(false);
              if (derived === 'price') setDerived(null);
              recalculate('price', { litres, price: t, total });
            }}
            placeholder={NO_VALUE}
            keyboardType="decimal-pad"
            size="numeric"
            inset={derived === 'price'}
            {...(derived === 'price'
              ? { hint: '⟳ derived' as const }
              : priceFromLastFill
                ? { hint: 'last fill' as const, hintTone: 'acc' as const }
                : {})}
            accessibilityLabel={`Price per ${volumeLabel}`}
            testID="input-price"
          />
        </Field>
        <Field label="Total" icon="banknote" flex={1} error={errors.total ?? null}>
          <Input
            value={total}
            onChangeText={(t) => {
              setTotal(t);
              if (derived === 'total') setDerived(null);
              recalculate('total', { litres, price, total: t });
            }}
            placeholder={NO_VALUE}
            keyboardType="decimal-pad"
            size="numeric"
            inset={derived === 'total'}
            {...(derived === 'total' ? { hint: '⟳ derived' as const } : {})}
            invalid={Boolean(errors.total)}
            accessibilityLabel={`Total paid, in ${currencySymbol(currency)}`}
            testID="input-total"
          />
        </Field>
      </FieldRow>

      <Txt role="helper" tone="mut" style={{ marginTop: 8 }}>
        Fill any two — the third is derived.
      </Txt>

      <View style={{ gap: 8, marginTop: 18 }}>
        <Field label="Fill type" icon="fuel">
          <Segmented options={FILL_OPTIONS} value={fillType} onChange={setFillType} testID="segment-fill" />
        </Field>
        <Txt role="helper" tone="mut">
          {existing
            ? 'Editing this fill recalculates every figure after it.'
            : 'Only a full tank can close a mileage interval.'}
        </Txt>
      </View>

      <Card variant="list" style={{ borderRadius: 13, marginTop: 18 }}>
        <FuelDisclosure
          title="Adjustment"
          summary={
            adjustmentCount === 0
              ? 'Spillage, leak, drained — its own record'
              : `${adjustmentCount} logged · kept as their own records`
          }
          open={adjustmentsOpen}
          onToggle={() => setAdjustmentsOpen((open) => !open)}
          testID="disclosure-adjustment"
        >
          {ADJUSTMENT_ROWS.map((row, index) => {
            const entry = adjustments[row.reason];
            const checked = entry !== undefined;
            return (
              <View key={row.reason}>
                {index > 0 ? <Divider /> : null}
                <CheckRow
                  label={row.label}
                  checked={checked}
                  onChange={(nextChecked) =>
                    setAdjustments((prev) => {
                      const copy = { ...prev };
                      if (nextChecked) {
                        copy[row.reason] = { value: '' };
                      } else {
                        const removed = copy[row.reason];
                        if (removed?.id !== undefined) {
                          const removedId = removed.id;
                          setRemovedAdjustmentIds((ids) => [...ids, removedId]);
                        }
                        delete copy[row.reason];
                      }
                      return copy;
                    })
                  }
                  testID={`adjust-${row.reason}`}
                />
                {checked ? (
                  <View style={{ paddingBottom: 12 }}>
                    <Input
                      value={entry?.value ?? ''}
                      onChangeText={(t) =>
                        setAdjustments((prev) => ({
                          ...prev,
                          [row.reason]: { ...(prev[row.reason] ?? {}), value: t },
                        }))
                      }
                      placeholder={`How much fuel (${volumeLabel})`}
                      keyboardType="decimal-pad"
                      size="mini"
                      padX={14}
                      accessibilityLabel={`${row.label} amount`}
                      testID={`adjust-amount-${row.reason}`}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}

          {errors.adjustments ? (
            <Txt role="helper" tone="bad">
              {errors.adjustments}
            </Txt>
          ) : null}

          {adjustmentMlTotal !== 0 && litresMl !== null ? (
            <Banner
              variant="inset"
              message={
                adjustmentMlTotal < 0
                  ? `Logged ${formatVolume(litresMl, units.volume)}, of which ${formatVolume(
                      -adjustmentMlTotal,
                      units.volume,
                    )} was adjusted out. Mileage for this interval will use ${formatVolume(
                      effectiveMl,
                      units.volume,
                    )}; your original entry is kept as-is.`
                  : `${formatVolume(adjustmentMlTotal, units.volume)} of unlogged fuel will be counted into this interval alongside the ${formatVolume(litresMl, units.volume)} you logged.`
              }
              testID="banner-adjusted"
            />
          ) : null}
        </FuelDisclosure>

        <Divider />

        <FuelDisclosure
          title="Details"
          summary={detailSummary.length === 0 ? 'Station, notes, receipt photo' : detailSummary.join(' · ')}
          open={detailsOpen}
          onToggle={() => setDetailsOpen((open) => !open)}
          testID="disclosure-details"
        >
          <Field label="Station">
            <Input
              value={station}
              onChangeText={setStation}
              placeholder="Padma Oil, Mirpur 10"
              autoCapitalize="words"
              size="compact"
              padX={14}
              testID="input-station"
            />
          </Field>

          <Field label="Notes">
            <TextArea
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything worth remembering"
              testID="input-notes"
            />
          </Field>

          <PhotoField
            label="Attach pump receipt"
            uri={receiptUri}
            onChange={setReceiptUri}
            testID="field-receipt"
          />
        </FuelDisclosure>
      </Card>

      {/* The board pins Save to the bottom of the screen, whatever the form
          above it happens to be tall enough to fill. */}
      <View style={{ flex: 1, minHeight: 24 }} />

      {failureKey !== null ? (
        <Banner
          tone="bad"
          icon="alertCircle"
          lead={FAILURE_COPY[failureKey].lead}
          message={FAILURE_COPY[failureKey].message}
          style={{ marginBottom: 12 }}
          testID="banner-save-failed"
        />
      ) : null}

      <Button
        label={existing ? 'Save changes' : 'Save fill'}
        size="xlarge"
        onPress={submit}
        loading={saveFuel.isPending}
        {...(connectivity.isOnline ? {} : { subLabel: 'offline — saves on phone, syncs later' })}
        testID="cta-save-fuel"
      />
    </Screen>
  );
}
