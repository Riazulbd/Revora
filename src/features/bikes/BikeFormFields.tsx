import React from 'react';
import { View } from 'react-native';

import { Field, FieldRow, Input } from '@/components';
import { currencySymbol } from '@/calculations/money';
import { distanceUnitLabel, volumeUnitLabel } from '@/calculations/units';
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
};

export type BikeFormErrors = Partial<Record<keyof BikeFormState, string>>;

/**
 * The motorcycle form, shared by onboarding and by editing an existing bike so
 * the two can never drift apart.
 *
 * Field order, the two-up rows and their 1 : 1.4 widths are the design's.
 */
export function BikeFormFields({
  value,
  onChange,
  errors,
  units,
  showIdentifiers = false,
  showOdometer = true,
}: {
  value: BikeFormState;
  onChange: (next: BikeFormState) => void;
  errors: BikeFormErrors;
  units: UnitPreferences;
  /** Engine and chassis numbers only appear when editing a saved bike. */
  showIdentifiers?: boolean;
  /** The opening odometer is set once, at onboarding. */
  showOdometer?: boolean;
}) {
  const set = <K extends keyof BikeFormState>(key: K, next: string) =>
    onChange({ ...value, [key]: next });

  return (
    <View style={{ gap: 14 }}>
      <FieldRow>
        <Field label="Manufacturer" flex={1} error={errors.manufacturer ?? null}>
          <Input
            value={value.manufacturer}
            onChangeText={(t) => set('manufacturer', t)}
            placeholder="Honda"
            autoCapitalize="words"
            testID="input-manufacturer"
          />
        </Field>
        <Field label="Model" flex={1} error={errors.model ?? null}>
          <Input
            value={value.model}
            onChangeText={(t) => set('model', t)}
            placeholder="Hornet 2.0"
            autoCapitalize="words"
            testID="input-model"
          />
        </Field>
      </FieldRow>

      <Field label="Nickname" error={errors.nickname ?? null}>
        <Input
          value={value.nickname}
          onChangeText={(t) => set('nickname', t)}
          placeholder="Honda Hornet"
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
            placeholder="2025"
            keyboardType="number-pad"
            maxLength={4}
            invalid={Boolean(errors.year)}
            testID="input-year"
          />
        </Field>
        {showOdometer ? (
          <Field
            label={`Odometer (${distanceUnitLabel(units.distance)})`}
            flex={1.4}
            error={errors.odometer ?? null}
          >
            <Input
              value={value.odometer}
              onChangeText={(t) => set('odometer', t)}
              placeholder="5180"
              keyboardType="decimal-pad"
              invalid={Boolean(errors.odometer)}
              testID="input-odometer"
            />
          </Field>
        ) : null}
      </FieldRow>

      <FieldRow>
        <Field
          label={`Tank capacity (${volumeUnitLabel(units.volume)})`}
          flex={1}
          error={errors.tankCapacity ?? null}
        >
          <Input
            value={value.tankCapacity}
            onChangeText={(t) => set('tankCapacity', t)}
            placeholder="12"
            keyboardType="decimal-pad"
            invalid={Boolean(errors.tankCapacity)}
            testID="input-tank"
          />
        </Field>
        <Field
          label={`Purchase price (${currencySymbol(units.currency)})`}
          flex={1.4}
          error={errors.purchasePrice ?? null}
        >
          <Input
            value={value.purchasePrice}
            onChangeText={(t) => set('purchasePrice', t)}
            placeholder="285000"
            keyboardType="decimal-pad"
            invalid={Boolean(errors.purchasePrice)}
            testID="input-price"
          />
        </Field>
      </FieldRow>

      {showIdentifiers ? (
        <>
          <Field label="Engine no." error={errors.engineNumber ?? null}>
            <Input
              value={value.engineNumber}
              onChangeText={(t) => set('engineNumber', t)}
              placeholder="HA10EFL2P05432"
              autoCapitalize="characters"
              autoCorrect={false}
              testID="input-engine"
            />
          </Field>
          <Field label="Chassis no." error={errors.chassisNumber ?? null}>
            <Input
              value={value.chassisNumber}
              onChangeText={(t) => set('chassisNumber', t)}
              placeholder="MBLHA10AWP9K01277"
              autoCapitalize="characters"
              autoCorrect={false}
              testID="input-chassis"
            />
          </Field>
        </>
      ) : null}
    </View>
  );
}
