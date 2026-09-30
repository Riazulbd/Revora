import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Banner, Button, Screen, ScreenHeader, Txt } from '@/components';
import { BikeFormFields, emptyBikeForm } from '@/features/bikes/BikeFormFields';
import { useBikeForm } from '@/features/bikes/useBikeForm';
import { useAddBike } from '@/features/bikes/useBikeMutations';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useConnectivity } from '@/services/connectivity';
import { todayIso } from '@/utils/date';

/**
 * Add your motorcycle.
 *
 * Three things start a garage: manufacturer, model, and the reading on the
 * dial. Until all three are there the board draws "Start tracking" inert and
 * says what is missing, rather than letting a tap fail.
 *
 * Saved while offline, the screen does not pretend the rider is done and move
 * on — it says the motorcycle is on the phone and will sync, because a rider
 * who sees nothing happen re-enters the bike and ends up with two.
 */
export default function AddBike() {
  const router = useRouter();
  const { units } = useGarage();
  const { isOnline } = useConnectivity();
  const form = useBikeForm(emptyBikeForm, units);
  const [savedOffline, setSavedOffline] = useState(false);

  const addBike = useAddBike({
    onAdded: () => {
      if (isOnline) router.replace('/(tabs)/dashboard');
      else setSavedOffline(true);
    },
  });

  // The board's own rule for the inert button, printed under it verbatim.
  const ready =
    form.value.manufacturer.trim() !== '' &&
    form.value.model.trim() !== '' &&
    form.value.odometer.trim() !== '';

  const submit = async () => {
    const parsed = form.parse();
    if (!parsed) return;
    const purchaseDate =
      form.value.purchaseDate !== undefined && form.value.purchaseDate !== ''
        ? form.value.purchaseDate
        : parsed.purchasePriceMinor !== null
          ? todayIso()
          : null;

    await addBike.submit({
      manufacturer: parsed.manufacturer,
      model: parsed.model,
      nickname: parsed.nickname,
      year: parsed.year,
      tankCapacityMl: parsed.tankCapacityMl,
      purchasePriceMinor: parsed.purchasePriceMinor,
      purchaseDate,
      engineNumber: null,
      chassisNumber: null,
      odometerMetres: parsed.odometerMetres,
      currency: units.currency,
    });
  };

  return (
    <Screen contentStyle={{ flexGrow: 1, paddingTop: 12 }} testID="screen-onboarding">
      <ScreenHeader title="Add your motorcycle" style={{ marginBottom: 0 }} />
      <Txt role="subtitle" tone="mut" style={{ marginTop: 6 }}>
        Three things to start. Everything else can wait.
      </Txt>

      <View
        pointerEvents={savedOffline ? 'none' : 'auto'}
        style={{ marginTop: 22, opacity: savedOffline ? 0.55 : 1 }}
      >
        <BikeFormFields
          value={form.value}
          onChange={form.setValue}
          errors={form.errors}
          units={units}
          showDetails={!savedOffline}
          showOdometerNote={!savedOffline}
        />
      </View>

      <View style={{ flex: 1, minHeight: 24 }} />

      {savedOffline ? (
        <>
          <Banner
            tone="good"
            lead="Motorcycle saved on this phone."
            message="You’re offline, so it’ll sync to your account when you’re back — nothing to redo."
            style={{ marginBottom: 12 }}
            testID="banner-saved-offline"
          />
          <Button
            label="Go to Dashboard"
            onPress={() => router.replace('/(tabs)/dashboard')}
            testID="cta-go-dashboard"
          />
        </>
      ) : (
        <>
          <Button
            label="Start tracking"
            onPress={submit}
            loading={addBike.isPending}
            disabled={!ready}
            testID="cta-add-bike"
          />
          {ready ? null : (
            <Txt role="helper" tone="mut" align="center" style={{ marginTop: 10 }}>
              Needs manufacturer, model and the odometer reading.
            </Txt>
          )}
        </>
      )}
    </Screen>
  );
}
