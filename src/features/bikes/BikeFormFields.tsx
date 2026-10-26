import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Card, DateField, Eyebrow, Field, FieldRow, Icon, Input, InputRow, ListCard, Txt } from '@/components';
import { currencySymbol } from '@/calculations/money';
import { distanceUnitLabel, volumeUnitLabel } from '@/calculations/units';
import { HIT_SLOP, MAX_FONT_SCALE, fontFamily, useTheme } from '@/theme';
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
 * The Add motorcycle form (Figma `A5 Onboarding — Add your bike`).
 *
 * It asks for three things — manufacturer, model, and the reading on the
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
  /** The saved-offline state drops the optional block entirely. */
  showDetails?: boolean;
  /** …and the sentence under the odometer with it. */
  showOdometerNote?: boolean;
}) {
  const { c } = useTheme();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const set = <K extends keyof BikeFormState>(key: K, next: string) => onChange({ ...value, [key]: next });

  return (
    <View style={{ gap: 16 }}>
      <ListCard testID="card-bike-fields">
        <InputRow
          icon="factory"
          label="Manufacturer"
          value={value.manufacturer}
          onChangeText={(t) => set('manufacturer', t)}
          placeholder="Bajaj, Yamaha, Honda…"
          autoCapitalize="words"
          autoCorrect={false}
          invalid={Boolean(errors.manufacturer)}
          {...(errors.manufacturer ? { hint: errors.manufacturer, hintTone: 'bad' as const } : {})}
          testID="input-manufacturer"
        />
        <InputRow
          icon="bike"
          label="Model"
          value={value.model}
          onChangeText={(t) => set('model', t)}
          placeholder="e.g. Pulsar NS200"
          autoCapitalize="words"
          invalid={Boolean(errors.model)}
          {...(errors.model ? { hint: errors.model, hintTone: 'bad' as const } : {})}
          testID="input-model"
        />
      </ListCard>

      {/* Figma `Odometer card`: the soft-accent card with the big white field. */}
      <Card variant="tinted" tone="accent" style={{ gap: 12 }} testID="card-odometer">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="gauge" size={20} color={c.accBright} />
          <Eyebrow tone="acc">Current odometer</Eyebrow>
        </View>
        <View
          style={{
            height: 72,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 18,
            borderRadius: 20,
            backgroundColor: c.sur,
            borderWidth: 1.5,
            borderColor: errors.odometer ? c.badIcon : c.acc,
          }}
        >
          <TextInput
            value={value.odometer}
            onChangeText={(t) => set('odometer', t)}
            placeholder="12,500"
            placeholderTextColor={c.faint}
            keyboardType="decimal-pad"
            selectionColor={c.acc}
            cursorColor={c.acc}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel="Current odometer reading"
            testID="input-odometer"
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: fontFamily[700],
              fontSize: 36,
              letterSpacing: -0.72,
              color: c.ink,
              paddingVertical: 0,
              paddingHorizontal: 0,
            }}
          />
          <Txt role="cardTitle" tone="mut">
            {distanceUnitLabel(units.distance)}
          </Txt>
        </View>
        {errors.odometer ? (
          <Txt role="micro" tone="bad">
            {errors.odometer}
          </Txt>
        ) : null}
        {showOdometerNote ? (
          <Txt role="helper">
            Read it off the dial now. Revora never assumes a bike starts at 0 — every distance, mileage and cost figure
            is measured from this number.
          </Txt>
        ) : null}
      </Card>

      {!showDetails ? null : detailsOpen ? (
        <Card style={{ gap: 14 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More details, all optional"
            accessibilityState={{ expanded: true }}
            onPress={() => setDetailsOpen(false)}
            hitSlop={HIT_SLOP}
            testID="toggle-details"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
          >
            <DetailsLabel />
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <Icon name="chevronDown" size={20} color={c.faint} />
            </View>
          </Pressable>

          <Field label="Nickname" error={errors.nickname ?? null}>
            <Input
              value={value.nickname}
              onChangeText={(t) => set('nickname', t)}
              placeholder="The Red One"
              autoCapitalize="words"
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
                weight="regular"
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
            height: 56,
            borderRadius: 20,
            backgroundColor: c.sur,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <DetailsLabel />
          <Icon name="chevronDown" size={20} color={c.faint} />
        </Pressable>
      )}
    </View>
  );
}

/** Figma `More details` — the heading with its muted trailer. */
function DetailsLabel() {
  return (
    <Txt role="rowTitle">
      More details <Txt role="meta" tone="mut">· all optional</Txt>
    </Txt>
  );
}
