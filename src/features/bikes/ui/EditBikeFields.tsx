import React from 'react';
import { View } from 'react-native';

import { InputRow, ListCard, SectionEyebrow } from '@/components';
import { currencySymbol } from '@/calculations/money';
import { volumeUnitLabel } from '@/calculations/units';
import type { BikeFormErrors, BikeFormState } from '@/features/bikes/BikeFormFields';
import type { UnitPreferences } from '@/types';

/**
 * The Edit motorcycle fields (Figma `C3 Garage — Edit bike`): three cards of
 * rows — the bike, ownership, identifiers — each row a glyph, a label and the
 * value.
 *
 * The opening odometer is not here: readings are history, and editing the
 * first one retroactively would silently rewrite every distance since. The
 * screen says so under the cards and links to where a reading is corrected.
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
  const set = <K extends keyof BikeFormState>(key: K, next: string) => onChange({ ...value, [key]: next });
  const problem = (key: keyof BikeFormErrors) =>
    errors[key] ? { invalid: true, hint: errors[key] as string, hintTone: 'bad' as const } : { invalid: false };

  return (
    <View>
      <SectionEyebrow first>The bike</SectionEyebrow>
      <ListCard testID="card-bike">
        <InputRow
          icon="tag"
          label="Manufacturer"
          value={value.manufacturer}
          onChangeText={(t) => set('manufacturer', t)}
          placeholder="Bajaj"
          autoCapitalize="words"
          {...problem('manufacturer')}
          testID="input-manufacturer"
        />
        <InputRow
          icon="bike"
          label="Model"
          value={value.model}
          onChangeText={(t) => set('model', t)}
          placeholder="Pulsar NS200"
          autoCapitalize="words"
          {...problem('model')}
          testID="input-model"
        />
        <InputRow
          icon="heart"
          label="Nickname"
          value={value.nickname}
          onChangeText={(t) => set('nickname', t)}
          placeholder="The Red One"
          autoCapitalize="words"
          {...problem('nickname')}
          testID="input-nickname"
        />
        <InputRow
          icon="calendar"
          label="Year"
          value={value.year}
          onChangeText={(t) => set('year', t)}
          placeholder="2022"
          keyboardType="number-pad"
          maxLength={4}
          {...problem('year')}
          testID="input-year"
        />
      </ListCard>

      <SectionEyebrow>Ownership</SectionEyebrow>
      <ListCard testID="card-ownership">
        <InputRow
          icon="fuel"
          label="Tank capacity"
          value={value.tankCapacity}
          onChangeText={(t) => set('tankCapacity', t)}
          placeholder="12"
          keyboardType="decimal-pad"
          unit={volumeUnitLabel(units.volume)}
          {...problem('tankCapacity')}
          testID="input-tank"
        />
        <InputRow
          icon="banknote"
          label="Purchase price"
          value={value.purchasePrice}
          onChangeText={(t) => set('purchasePrice', t)}
          placeholder="285000"
          keyboardType="decimal-pad"
          unit={currencySymbol(units.currency)}
          {...problem('purchasePrice')}
          testID="input-price"
        />
      </ListCard>

      <SectionEyebrow>Identifiers</SectionEyebrow>
      <ListCard testID="card-identifiers">
        <InputRow
          icon="hash"
          label="Engine no. · case-sensitive, exactly as printed"
          value={value.engineNumber}
          onChangeText={(t) => set('engineNumber', t)}
          placeholder="PFZWJF12904"
          autoCapitalize="characters"
          autoCorrect={false}
          {...problem('engineNumber')}
          testID="input-engine"
        />
        <InputRow
          icon="hash"
          label="Chassis no."
          value={value.chassisNumber}
          onChangeText={(t) => set('chassisNumber', t)}
          placeholder="MD2A36FZ8NCM10482"
          autoCapitalize="characters"
          autoCorrect={false}
          {...problem('chassisNumber')}
          testID="input-chassis"
        />
      </ListCard>
    </View>
  );
}
