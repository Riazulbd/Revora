import React, { useState } from 'react';
import { View } from 'react-native';

import { Divider, MenuRow, Sheet, Txt } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { profileRepository } from '@/repositories';
import { currencySymbol } from '@/calculations/money';
import type { CurrencyCode, DistanceUnit, MileageUnit, UnitPreferences, VolumeUnit } from '@/types';

/**
 * Unit and currency preferences.
 *
 * Changing a unit re-renders every figure in the app immediately, because nothing
 * is stored pre-formatted — storage is canonical (metres, millilitres, minor
 * units) and formatting happens at the edge (requirement 65 / 66).
 */

const CURRENCIES: readonly { value: CurrencyCode; label: string }[] = [
  { value: 'BDT', label: 'Bangladeshi taka' },
  { value: 'INR', label: 'Indian rupee' },
  { value: 'PKR', label: 'Pakistani rupee' },
  { value: 'LKR', label: 'Sri Lankan rupee' },
  { value: 'NPR', label: 'Nepalese rupee' },
  { value: 'USD', label: 'US dollar' },
  { value: 'EUR', label: 'Euro' },
  { value: 'GBP', label: 'Pound sterling' },
];

const DISTANCES: readonly { value: DistanceUnit; label: string }[] = [
  { value: 'km', label: 'Kilometres' },
  { value: 'mi', label: 'Miles' },
];

const VOLUMES: readonly { value: VolumeUnit; label: string }[] = [
  { value: 'L', label: 'Litres' },
  { value: 'gal_us', label: 'US gallons' },
  { value: 'gal_uk', label: 'UK gallons' },
];

const MILEAGES: readonly { value: MileageUnit; label: string }[] = [
  { value: 'km_per_l', label: 'km/L' },
  { value: 'l_per_100km', label: 'L/100km' },
  { value: 'mpg_us', label: 'MPG (US)' },
  { value: 'mpg_uk', label: 'MPG (UK)' },
];

type Kind = 'currency' | 'distance' | 'volume' | 'mileage' | null;

export function useUnitsSettings() {
  const { user } = useAuth();
  const { units } = useGarage();
  const [open, setOpen] = useState<Kind>(null);

  const apply = async (changes: Partial<UnitPreferences>) => {
    if (!user) return;
    await profileRepository.setUnits(user.uid, { ...units, ...changes });
    setOpen(null);
  };

  const title =
    open === 'currency'
      ? 'Currency'
      : open === 'distance'
        ? 'Distance'
        : open === 'volume'
          ? 'Fuel volume'
          : 'Mileage';

  const sheet = (
    <Sheet visible={open !== null} onClose={() => setOpen(null)} title={title} testID="sheet-units">
      <View>
        {open === 'currency'
          ? CURRENCIES.map((option, index) => (
              <View key={option.value}>
                {index > 0 ? <Divider /> : null}
                <MenuRow
                  label={`${option.label} (${currencySymbol(option.value)})`}
                  onPress={() => void apply({ currency: option.value })}
                  right={
                    units.currency === option.value ? (
                      <Txt role="metaSmall" tone="acc">
                        Selected
                      </Txt>
                    ) : undefined
                  }
                  testID={`unit-currency-${option.value}`}
                />
              </View>
            ))
          : null}

        {open === 'distance'
          ? DISTANCES.map((option, index) => (
              <View key={option.value}>
                {index > 0 ? <Divider /> : null}
                <MenuRow
                  label={option.label}
                  onPress={() => void apply({ distance: option.value })}
                  right={
                    units.distance === option.value ? (
                      <Txt role="metaSmall" tone="acc">
                        Selected
                      </Txt>
                    ) : undefined
                  }
                  testID={`unit-distance-${option.value}`}
                />
              </View>
            ))
          : null}

        {open === 'volume'
          ? VOLUMES.map((option, index) => (
              <View key={option.value}>
                {index > 0 ? <Divider /> : null}
                <MenuRow
                  label={option.label}
                  onPress={() => void apply({ volume: option.value })}
                  right={
                    units.volume === option.value ? (
                      <Txt role="metaSmall" tone="acc">
                        Selected
                      </Txt>
                    ) : undefined
                  }
                  testID={`unit-volume-${option.value}`}
                />
              </View>
            ))
          : null}

        {open === 'mileage'
          ? MILEAGES.map((option, index) => (
              <View key={option.value}>
                {index > 0 ? <Divider /> : null}
                <MenuRow
                  label={option.label}
                  onPress={() => void apply({ mileage: option.value })}
                  right={
                    units.mileage === option.value ? (
                      <Txt role="metaSmall" tone="acc">
                        Selected
                      </Txt>
                    ) : undefined
                  }
                  testID={`unit-mileage-${option.value}`}
                />
              </View>
            ))
          : null}

        <Txt role="helper" tone="mut" style={{ marginTop: 12 }}>
          Changing a unit only changes how figures are shown. Everything you have logged is stored in a single
          canonical form and converted for display.
        </Txt>
      </View>
    </Sheet>
  );

  return {
    sheet,
    openCurrency: () => setOpen('currency'),
    openDistance: () => setOpen('distance'),
    openVolume: () => setOpen('volume'),
    openMileage: () => setOpen('mileage'),
  };
}
