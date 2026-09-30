import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, DateField, Eyebrow, Field, FieldRow, Icon, Input, Txt } from '@/components';
import { currencySymbol } from '@/calculations/money';
import { distanceUnitLabel, volumeUnitLabel } from '@/calculations/units';
import { HIT_SLOP, fontFamily, useTheme } from '@/theme';
import type { UnitPreferences } from '@/types';

export type BikeFormState = {
  manufacturer: string;
  model: string;
  nickname: string;
  year: string;
  odometer: string;
  tankCapacity: string;
  purchasePrice: string;
  engineNumber: string;
  chassisNumber: string;
  /** `'YYYY-MM-DD'`, or blank. Optional so older callers keep compiling. */
  purchaseDate?: string;
};

export const emptyBikeForm: BikeFormState = {
  manufacturer: '',
  model: '',
  nickname: '',
  year: '',
  odometer: '',
  tankCapacity: '',
  purchasePrice: '',
  engineNumber: '',
  chassisNumber: '',
  purchaseDate: '',
};

export type BikeFormErrors = Partial<Record<keyof BikeFormState, string>>;

/**
 * The Add motorcycle form.
 *
 * The board asks for three things — manufacturer, model, and the reading on the
 * dial — and puts the odometer in a tinted card of its own with the sentence
 * that explains why it matters. Everything else is folded away behind "More
 * details · all optional", so the screen a rider meets thirty seconds after
 * installing is three fields, not nine.
 *
 * The opening odometer is the one number nothing else can recover: every
 * distance, mileage and running-cost figure is measured from it.
 */
export function BikeFormFields({
  value,
  onChange,
  errors,
  units,
  showDetails = true,
  showOdometerNote = true,
}: {
  value: BikeFormState;
  onChange: (next: BikeFormState) => void;
  errors: BikeFormErrors;
  units: UnitPreferences;
  /** The saved-offline board drops the optional block entirely. */
  showDetails?: boolean;
  /** …and the sentence under the odometer with it. */
  showOdometerNote?: boolean;
}) {
  const { c, radius } = useTheme();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const set = <K extends keyof BikeFormState>(key: K, next: string) => onChange({ ...value, [key]: next });

  return (
    <View style={{ gap: 16 }}>
      <Field label="Manufacturer" error={errors.manufacturer ?? null}>
        <Input
          value={value.manufacturer}
          onChangeText={(t) => set('manufacturer', t)}
          placeholder="Bajaj, Yamaha, Honda…"
          autoCapitalize="words"
          autoCorrect={false}
          invalid={Boolean(errors.manufacturer)}
          testID="input-manufacturer"
        />
      </Field>

      <Field label="Model" error={errors.model ?? null}>
        <Input
          value={value.model}
          onChangeText={(t) => set('model', t)}
          placeholder="e.g. Pulsar NS200"
          autoCapitalize="words"
          invalid={Boolean(errors.model)}
          testID="input-model"
        />
      </Field>

      <Card variant="tinted" tone="accent" style={{ gap: 10 }}>
        <Eyebrow>Current odometer</Eyebrow>
        <Input
          value={value.odometer}
          onChangeText={(t) => set('odometer', t)}
          placeholder="12,500"
          keyboardType="decimal-pad"
          size="hero"
          unit={distanceUnitLabel(units.distance)}
          invalid={Boolean(errors.odometer)}
          accessibilityLabel="Current odometer reading"
          testID="input-odometer"
        />
        {errors.odometer ? (
          <Txt role="helper" tone="bad">
            {errors.odometer}
          </Txt>
        ) : null}
        {showOdometerNote ? (
          <Txt style={{ fontFamily: fontFamily[500], fontSize: 11.5, lineHeight: 17.25, color: c.ink }}>
            Read it off the dial now. Revora never assumes a bike starts at 0 — every distance, mileage and
            cost figure is measured from this number.
          </Txt>
        ) : null}
      </Card>

      {!showDetails ? null : detailsOpen ? (
        <Card style={{ borderRadius: radius.listCard, gap: 14 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More details, all optional"
            accessibilityState={{ expanded: true }}
            onPress={() => setDetailsOpen(false)}
            hitSlop={HIT_SLOP}
            testID="toggle-details"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Txt style={{ fontFamily: fontFamily[600], fontSize: 13, color: c.ink }}>
              More details{' '}
              <Txt style={{ fontFamily: fontFamily[500], fontSize: 11.5, color: c.mut }}>· all optional</Txt>
            </Txt>
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <Icon name="chevronDown" size={18} color={c.mut} strokeWidth={2} />
            </View>
          </Pressable>

          <Field label="Nickname" error={errors.nickname ?? null}>
            <Input
              value={value.nickname}
              onChangeText={(t) => set('nickname', t)}
              placeholder="The Red One"
              autoCapitalize="words"
              size="compact"
              inset="bg"
              invalid={Boolean(errors.nickname)}
              testID="input-nickname"
            />
          </Field>

          <FieldRow>
            <Field label="Year" flex={1} error={errors.year ?? null}>
              <Input
                value={value.year}
                onChangeText={(t) => set('year', t)}
                placeholder="2022"
                keyboardType="number-pad"
                maxLength={4}
                size="compact"
                inset="bg"
                invalid={Boolean(errors.year)}
                testID="input-year"
              />
            </Field>
            <Field label="Tank capacity" flex={1} error={errors.tankCapacity ?? null}>
              <Input
                value={value.tankCapacity}
                onChangeText={(t) => set('tankCapacity', t)}
                placeholder="12"
                keyboardType="decimal-pad"
                size="compact"
                inset="bg"
                unit={volumeUnitLabel(units.volume)}
                invalid={Boolean(errors.tankCapacity)}
                testID="input-tank"
              />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Purchase price" flex={1} error={errors.purchasePrice ?? null}>
              <Input
                value={value.purchasePrice}
                onChangeText={(t) => set('purchasePrice', t)}
                placeholder="0"
                keyboardType="decimal-pad"
                size="compact"
                inset="bg"
                prefix={currencySymbol(units.currency)}
                invalid={Boolean(errors.purchasePrice)}
                testID="input-price"
              />
            </Field>
            <Field label="Purchase date" flex={1}>
              <DateField
                value={value.purchaseDate === undefined || value.purchaseDate === '' ? null : value.purchaseDate}
                onChange={(next) => set('purchaseDate', next)}
                placeholder="Pick a date"
                size="compact"
                weight="regular"
                inset="bg"
                trailingIcon="calendar"
                maximumDate={new Date()}
                accessibilityLabel="Purchase date"
                testID="input-purchase-date"
              />
            </Field>
          </FieldRow>
        </Card>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More details, all optional. Nickname, year, tank, purchase"
          accessibilityState={{ expanded: false }}
          onPress={() => setDetailsOpen(true)}
          testID="toggle-details"
          style={({ pressed }) => ({
            height: 52,
            borderRadius: radius.input,
            backgroundColor: c.sur,
            borderWidth: 1,
            borderColor: c.brd,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View>
            <Txt style={{ fontFamily: fontFamily[700], fontSize: 14, color: c.ink }}>
              More details{' '}
              <Txt style={{ fontFamily: fontFamily[500], fontSize: 11.5, color: c.mut }}>· all optional</Txt>
            </Txt>
            <Txt style={{ fontFamily: fontFamily[500], fontSize: 11.5, color: c.mut, marginTop: 2 }}>
              Nickname, year, tank, purchase
            </Txt>
          </View>
          <Icon name="chevronDown" size={18} color={c.mut} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}
