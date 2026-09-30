import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { Divider, Input, MenuRow, Sheet, Txt } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { bikeRepository, profileRepository } from '@/repositories';
import { searchCurrencies } from '@/calculations/currencies';
import { mileageUnitForChoice, type MileageChoice } from '@/calculations/unitChoices';
import type { CostBasis, DistanceUnit, MileageUnit, UnitPreferences, VolumeUnit } from '@/types';

/**
 * Unit and currency preferences.
 *
 * Changing a unit re-renders every figure in the app immediately, because nothing
 * is stored pre-formatted — storage is canonical (metres, millilitres, minor
 * units) and formatting happens at the edge (requirement 65 / 66).
 */

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

const COST_BASES: readonly { value: CostBasis; label: string; helper: string }[] = [
  { value: 'running', label: 'Running costs', helper: 'Fuel, servicing, parts, accessories and expenses — what it costs to keep on the road.' },
  { value: 'total', label: 'Including purchase price', helper: 'Running costs plus what you paid for the motorcycle.' },
];

type Kind = 'currency' | 'distance' | 'volume' | 'mileage' | 'costBasis' | null;

export function useUnitsSettings() {
  const { user } = useAuth();
  const { units, activeBike } = useGarage();
  const [open, setOpen] = useState<Kind>(null);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const matches = useMemo(() => searchCurrencies(currencyQuery), [currencyQuery]);

  const apply = async (changes: Partial<UnitPreferences>) => {
    if (!user) return;
    await profileRepository.setUnits(user.uid, { ...units, ...changes });
    // A motorcycle's records are denominated in *its* currency — that is what
    // every figure is formatted with. Changing the preference alone left the
    // setting doing nothing visible, so the active bike moves with it. Amounts
    // are relabelled, never converted: there is no exchange rate in Revora, and
    // inventing one would silently rewrite what the rider actually paid.
    if (changes.currency && activeBike && activeBike.currency !== changes.currency) {
      await bikeRepository.patch(user.uid, activeBike.id, { currency: changes.currency });
    }
    setCurrencyQuery('');
    setOpen(null);
  };

  const title =
    open === 'currency'
      ? 'Currency'
      : open === 'distance'
        ? 'Distance'
        : open === 'volume'
          ? 'Fuel volume'
          : open === 'costBasis'
            ? 'Cost basis'
            : 'Mileage';

  const close = () => {
    setCurrencyQuery('');
    setOpen(null);
  };

  const sheet = (
    <Sheet visible={open !== null} onClose={close} title={title} testID="sheet-units">
      <View>
        {open === 'currency' ? (
          <>
            <Input
              value={currencyQuery}
              onChangeText={setCurrencyQuery}
              placeholder="Search currency, code or symbol"
              autoCorrect={false}
              size="compact"
              style={{ marginBottom: 8 }}
              testID="input-currency-search"
            />
            {matches.length === 0 ? (
              <Txt role="helper" tone="mut" style={{ paddingVertical: 16 }}>
                No currency matches “{currencyQuery}”.
              </Txt>
            ) : (
              // Virtualised: the full ISO list is far too long to mount at once.
              <FlatList
                data={matches}
                keyExtractor={(entry) => entry.code}
                style={{ maxHeight: 380 }}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={12}
                windowSize={7}
                renderItem={({ item, index }) => (
                  <View>
                    {index > 0 ? <Divider /> : null}
                    <MenuRow
                      label={`${item.name} · ${item.code} (${item.symbol})`}
                      onPress={() => void apply({ currency: item.code })}
                      right={
                        units.currency === item.code ? (
                          <Txt role="metaSmall" tone="acc">
                            Selected
                          </Txt>
                        ) : undefined
                      }
                      testID={`unit-currency-${item.code}`}
                    />
                  </View>
                )}
              />
            )}
          </>
        ) : null}

        {open === 'costBasis' ? (
          <>
            <Txt role="helper" tone="mut" style={{ marginBottom: 10 }}>
              Which figure Revora headlines as what this motorcycle costs, and what cost per {units.distance} divides.
            </Txt>
            {COST_BASES.map((option, index) => (
              <View key={option.value}>
                {index > 0 ? <Divider /> : null}
                <MenuRow
                  label={option.label}
                  onPress={() => void apply({ costBasis: option.value })}
                  right={
                    units.costBasis === option.value ? (
                      <Txt role="metaSmall" tone="acc">
                        Selected
                      </Txt>
                    ) : undefined
                  }
                  testID={`unit-costbasis-${option.value}`}
                />
                <Txt role="micro" tone="mut" style={{ paddingBottom: 8 }}>
                  {option.helper}
                </Txt>
              </View>
            ))}
          </>
        ) : null}

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
    openCostBasis: () => setOpen('costBasis'),
    // The Settings board puts the common choices inline, on a segmented track
    // per row, and only falls back to the sheets for the ones a three-way
    // control cannot hold.
    setDistance: (distance: DistanceUnit) => void apply({ distance }),
    setCostBasis: (costBasis: CostBasis) => void apply({ costBasis }),
    setMileageChoice: (choice: MileageChoice) =>
      void apply({ mileage: mileageUnitForChoice(choice, units.volume) }),
  };
}
