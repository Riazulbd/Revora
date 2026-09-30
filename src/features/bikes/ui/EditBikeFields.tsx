import React from 'react';
import { View } from 'react-native';

import { Field, FieldRow, Input, Txt } from '@/components';
import { currencySymbol } from '@/calculations/money';
import { volumeUnitLabel } from '@/calculations/units';
import type { BikeFormErrors, BikeFormState } from '@/features/bikes/BikeFormFields';
import { fontFamily, useTheme } from '@/theme';
import type { UnitPreferences } from '@/types';

/**
 * The Edit motorcycle board's own field layout.
 *
 * It is not the onboarding form with the odometer hidden: the board draws
 * different widths (nickname 1.4 against year 0.6), puts the identifiers on
 * taller fields of their own, and hangs the "case-sensitive" warning off the
 * engine-number label rather than under the field, where a rider reads it
 * after typing instead of before.
 *
 * Tank capacity and purchase price are not on that artboard, but the Garage
 * board sends riders here for exactly one of them — "add it in Edit details to
 * unlock all-in cost" — so leaving them out would break the other board's
 * promise.
 */
export function EditBikeFields({
  value,
  onChange,
  errors,
  units,
}: {
  value: BikeFormState;
  onChange: (next: BikeFormState) => void;
  errors: BikeFormErrors;
  units: UnitPreferences;
}) {
  const { c } = useTheme();
  const set = <K extends keyof BikeFormState>(key: K, next: string) => onChange({ ...value, [key]: next });

  return (
    <View style={{ gap: 12 }}>
      <FieldRow>
        <Field label="Manufacturer" flex={1} error={errors.manufacturer ?? null}>
          <Input
            value={value.manufacturer}
            onChangeText={(t) => set('manufacturer', t)}
            placeholder="Bajaj"
            autoCapitalize="words"
            size="compact"
            invalid={Boolean(errors.manufacturer)}
            testID="input-manufacturer"
          />
        </Field>
        <Field label="Model" flex={1} error={errors.model ?? null}>
          <Input
            value={value.model}
            onChangeText={(t) => set('model', t)}
            placeholder="Pulsar NS200"
            autoCapitalize="words"
            size="compact"
            invalid={Boolean(errors.model)}
            testID="input-model"
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Nickname" flex={1.4} error={errors.nickname ?? null}>
          <Input
            value={value.nickname}
            onChangeText={(t) => set('nickname', t)}
            placeholder="The Red One"
            autoCapitalize="words"
            size="compact"
            invalid={Boolean(errors.nickname)}
            testID="input-nickname"
          />
        </Field>
        <Field label="Year" flex={0.6} error={errors.year ?? null}>
          <Input
            value={value.year}
            onChangeText={(t) => set('year', t)}
            placeholder="2022"
            keyboardType="number-pad"
            maxLength={4}
            size="compact"
            invalid={Boolean(errors.year)}
            testID="input-year"
          />
        </Field>
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
            size="compact"
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
            size="compact"
            invalid={Boolean(errors.purchasePrice)}
            testID="input-price"
          />
        </Field>
      </FieldRow>

      <View style={{ gap: 7 }}>
        <Txt role="smallStrong" tone="mut">
          Engine no.{' '}
          <Txt style={{ fontFamily: fontFamily[500], fontSize: 11, color: c.mut }}>
            · case-sensitive, exactly as printed
          </Txt>
        </Txt>
        <Input
          value={value.engineNumber}
          onChangeText={(t) => set('engineNumber', t)}
          placeholder="PFZWJF12904"
          autoCapitalize="characters"
          autoCorrect={false}
          invalid={Boolean(errors.engineNumber)}
          testID="input-engine"
        />
        {errors.engineNumber ? (
          <Txt role="helper" tone="bad" style={{ marginTop: 1 }}>
            {errors.engineNumber}
          </Txt>
        ) : null}
      </View>

      <Field label="Chassis no." error={errors.chassisNumber ?? null}>
        <Input
          value={value.chassisNumber}
          onChangeText={(t) => set('chassisNumber', t)}
          placeholder="MD2A36FZ8NCM10482"
          autoCapitalize="characters"
          autoCorrect={false}
          invalid={Boolean(errors.chassisNumber)}
          testID="input-chassis"
        />
      </Field>
    </View>
  );
}
