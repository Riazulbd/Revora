import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import {
  Banner,
  Button,
  Card,
  CheckRow,
  DateField,
  Divider,
  Eyebrow,
  Field,
  FieldRow,
  Input,
  Screen,
  ScreenHeader,
  Segmented,
  SkeletonList,
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
import { useNewFuelId, useSaveFuel, type AdjustmentDraft } from '@/features/fuel/useFuelMutations';
import { fromMetres, fromMinor, fromMl, toMetres, toMinor, toMl, toTrimmed } from '@/features/shared/formValues';
import { PhotoField } from '@/features/shared/PhotoField';
import { useGarageContext } from '@/features/shared/useGarageContext';
import { useStableId } from '@/features/shared/useStableId';
import { uploadImageOrKeepLocal } from '@/services/storage';
import { useConnectivity } from '@/services/connectivity';
import type { FuelAdjustmentReason, FuelEntry, UnitPreferences } from '@/types';
import { fuelEntrySchema } from '@/validation/schemas';
import { formatDistance, formatVolume } from '@/utils/format';
import { todayIso } from '@/utils/date';

/**
 * Add / edit a fuel log — the screen that has to work with cold hands, gloves on,
 * one bar of signal.
 *
 * Three properties it guarantees:
 *  · Litres, price and total stay consistent: fill in any two and the third is
 *    derived exactly, in integers (requirement 14).
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
        <ScreenHeader title={editingId ? 'Edit fuel log' : 'Add fuel'} />
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
  const connectivity = useConnectivity();
  const toast = useToast();

  const newId = useNewFuelId();
  const generatedId = useStableId(newId);
  const recordId = existing?.id ?? generatedId;

  const currency = existing?.currency ?? analytics.currency;
  const decimals = currencyDecimals(currency);
  const currentOdometer = analytics.odometer.currentMetres;

  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [odometer, setOdometer] = useState(
    existing ? fromMetres(existing.odometerMetres, units.distance) : '',
  );
  const [litres, setLitres] = useState(existing ? fromMl(existing.litresMl, units.volume) : '');
  // A new fill starts at the price of the last one — at a pump it is almost
  // always the same, and pre-filling removes a step without inventing anything.
  const [price, setPrice] = useState(
    existing
      ? fromMinor(existing.pricePerLitreMinor, decimals)
      : analytics.fuel.latest
        ? fromMinor(analytics.fuel.latest.pricePerLitreMinor, decimals)
        : '',
  );
  const [total, setTotal] = useState(existing ? fromMinor(existing.totalCostMinor, decimals) : '');
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
  const lastEdited = useRef<'litres' | 'price' | 'total' | null>(null);

  /** Derive whichever money field the rider has not just typed into. */
  const recalculate = (
    source: 'litres' | 'price' | 'total',
    values: { litres: string; price: string; total: string },
  ) => {
    lastEdited.current = source;
    const derived = deriveFuelAmounts(
      {
        litresMl: toMl(values.litres, units.volume),
        pricePerLitreMinor: toMinor(values.price, currency),
        totalCostMinor: toMinor(values.total, currency),
      },
      source,
    );

    if (source !== 'total' && derived.totalCostMinor !== null) {
      setTotal(fromMinor(derived.totalCostMinor, decimals));
    }
    if (source === 'total' && derived.pricePerLitreMinor !== null) {
      setPrice(fromMinor(derived.pricePerLitreMinor, decimals));
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

  const odometerMetres = toMetres(odometer, units.distance);
  const odometerCheck =
    odometerMetres === null ? null : validateOdometer(odometerMetres, existing ? null : currentOdometer);

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
      // again. Say what is wrong where the thumb already is.
      const first = FIELD_ORDER.find((key) => next[key] !== undefined);
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
    <Screen testID="screen-fuel-add">
      <ScreenHeader title={existing ? 'Edit fuel log' : 'Add fuel'} />

      <View style={{ gap: 14 }}>
        <FieldRow>
          <Field label="Date" flex={1}>
            <DateField
              value={date}
              onChange={setDate}
              maximumDate={new Date()}
              accessibilityLabel="Date of this fill"
              testID="field-date"
            />
          </Field>
          <Field
            label={`Odometer (${distanceUnitLabel(units.distance)})`}
            flex={1}
            error={errors.odometer ?? null}
          >
            <Input
              value={odometer}
              onChangeText={setOdometer}
              placeholder={
                currentOdometer === null ? '0' : `${fromMetres(currentOdometer, units.distance)} last`
              }
              keyboardType="decimal-pad"
              size="compact"
              invalid={Boolean(errors.odometer)}
              testID="input-odometer"
            />
          </Field>
        </FieldRow>

        {odometerCheck && !odometerCheck.ok ? (
          <Banner
            icon="alert"
            message={
              odometerCheck.reason === 'below_current'
                ? `That is below your last reading of ${formatDistance(odometerCheck.currentMetres, units.distance)}. Revora keeps the higher figure as the current odometer.`
                : `That is more than 5,000 ${distanceUnitLabel(units.distance)} past your last reading — worth double-checking.`
            }
            testID="banner-odometer"
          />
        ) : null}

        <FieldRow>
          <Field
            label={volumeUnitLabel(units.volume) === 'L' ? 'Litres' : 'Volume'}
            flex={1}
            error={errors.litres ?? null}
          >
            <Input
              value={litres}
              onChangeText={(t) => {
                setLitres(t);
                recalculate('litres', { litres: t, price, total });
              }}
              placeholder="0.0"
              keyboardType="decimal-pad"
              size="numeric"
              invalid={Boolean(errors.litres)}
              testID="input-litres"
            />
          </Field>
          <Field label={`Price / ${volumeUnitLabel(units.volume)} (${currencySymbol(currency)})`} flex={1}>
            <Input
              value={price}
              onChangeText={(t) => {
                setPrice(t);
                recalculate('price', { litres, price: t, total });
              }}
              placeholder="0"
              keyboardType="decimal-pad"
              size="numeric"
              testID="input-price"
            />
          </Field>
          <Field label={`Total (${currencySymbol(currency)})`} flex={1} error={errors.total ?? null}>
            <Input
              value={total}
              onChangeText={(t) => {
                setTotal(t);
                recalculate('total', { litres, price, total: t });
              }}
              placeholder="auto"
              keyboardType="decimal-pad"
              size="numeric"
              inset
              invalid={Boolean(errors.total)}
              testID="input-total"
            />
          </Field>
        </FieldRow>

        <View style={{ gap: 8 }}>
          <Txt role="fieldLabel" tone="mut">
            Fill type
          </Txt>
          <Segmented options={FILL_OPTIONS} value={fillType} onChange={setFillType} testID="segment-fill" />
          <Txt role="helper" tone="mut">
            Mark a fill Full when you filled the tank to the top. Revora measures between two full tanks;
            until it has a pair it shows an estimate across everything you have logged.
          </Txt>
        </View>

        <Card variant="flush" style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
          <Eyebrow>ADJUSTMENTS · OPTIONAL</Eyebrow>
          <View style={{ height: 4 }} />
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
                        if (removed?.id) setRemovedAdjustmentIds((ids) => [...ids, removed.id!]);
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
                      placeholder={`How much fuel (${volumeUnitLabel(units.volume)})`}
                      keyboardType="decimal-pad"
                      size="compact"
                      accessibilityLabel={`${row.label} amount`}
                      testID={`adjust-amount-${row.reason}`}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
          {errors.adjustments ? (
            <Txt role="helper" tone="bad" style={{ paddingBottom: 12 }}>
              {errors.adjustments}
            </Txt>
          ) : null}
        </Card>

        {adjustmentMlTotal !== 0 && litresMl !== null ? (
          <Banner
            tone="neutral"
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

        <Field label="Station (optional)">
          <Input
            value={station}
            onChangeText={setStation}
            placeholder="Padma Oil, Mirpur 10"
            autoCapitalize="words"
            size="compact"
            testID="input-station"
          />
        </Field>

        <Field label="Notes (optional)">
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything worth remembering"
            size="compact"
            testID="input-notes"
          />
        </Field>

        <PhotoField
          label="Attach pump receipt"
          uri={receiptUri}
          onChange={setReceiptUri}
          testID="field-receipt"
        />

        <Button
          label={existing ? 'Save changes' : 'Save fuel log'}
          onPress={submit}
          loading={saveFuel.isPending}
          style={{ height: 54 }}
          testID="cta-save-fuel"
        />

        <Txt role="helper" tone="mut" align="center">
          {connectivity.isOnline
            ? 'Saves instantly and syncs to your account.'
            : "You're offline — this saves on your phone now and syncs by itself later."}
        </Txt>
      </View>
    </Screen>
  );
}
