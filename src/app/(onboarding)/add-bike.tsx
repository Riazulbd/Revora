import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Screen, ScreenHeader, Txt } from '@/components';
import { BikeFormFields, emptyBikeForm } from '@/features/bikes/BikeFormFields';
import { useBikeForm } from '@/features/bikes/useBikeForm';
import { useAddBike } from '@/features/bikes/useBikeMutations';
import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { todayIso } from '@/utils/date';

/**
 * Onboarding step 2 — add the first motorcycle.
 *
 * Only the odometer is required. Nothing optional blocks a rider from reaching
 * the dashboard (requirement 9).
 */
export default function AddBike() {
  const router = useRouter();
  const { user } = useAuth();
  const { units, bikes } = useGarage();
  const form = useBikeForm(emptyBikeForm, units);

  const addBike = useAddBike({
    onAdded: () => router.replace('/(tabs)/dashboard'),
  });

  const isFirstBike = bikes.length === 0;

  const submit = async () => {
    const parsed = form.parse();
    if (!parsed) return;
    await addBike.submit({
      manufacturer: parsed.manufacturer,
      model: parsed.model,
      nickname: parsed.nickname,
      year: parsed.year,
      tankCapacityMl: parsed.tankCapacityMl,
      purchasePriceMinor: parsed.purchasePriceMinor,
      purchaseDate: parsed.purchasePriceMinor !== null ? todayIso() : null,
      engineNumber: null,
      chassisNumber: null,
      odometerMetres: parsed.odometerMetres,
      currency: units.currency,
    });
  };

  return (
    <Screen testID="screen-onboarding">
      {isFirstBike ? <View style={{ height: 10 }} /> : <ScreenHeader title="" style={{ marginBottom: 0 }} />}

      <View style={{ gap: 6, marginTop: 8, marginBottom: 20 }}>
        <Txt role="fieldLabel" tone="acc" style={{ letterSpacing: 0.96 }}>
          {isFirstBike ? 'STEP 2 OF 2' : 'ADD A MOTORCYCLE'}
        </Txt>
        <Txt role="authTitle">Add your motorcycle</Txt>
        <Txt role="subtitle" tone="mut">
          {user?.displayName ? `Nearly there, ${user.displayName}. ` : ''}You can edit everything later in
          Garage.
        </Txt>
      </View>

      <BikeFormFields value={form.value} onChange={form.setValue} errors={form.errors} units={units} />

      <View style={{ gap: 10, marginTop: 20 }}>
        <Button
          label="Add to garage"
          onPress={submit}
          loading={addBike.isPending}
          testID="cta-add-bike"
        />
        <Txt role="metaSmall" tone="mut" align="center">
          One motorcycle on Free · add more with Pro
        </Txt>
      </View>
    </Screen>
  );
}
