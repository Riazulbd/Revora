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
import { useTheme } from '@/theme';

/**
 * Add your motorcycle (Figma `A5 Onboarding — Add your bike`), step two of
 * three: account, bike, then tracking.
 *
 * Three things start a garage: manufacturer, model, and the reading on the
 * dial. Until all three are there "Start tracking" is inert and the line under
 * it says what is missing, rather than letting a tap fail.
 *
 * Saved while offline, the screen does not pretend the rider is done and move
 * on — it says the motorcycle is on the phone and will sync, because a rider
 * who sees nothing happen re-enters the bike and ends up with two.
 */
const STEPS = ['Account', 'Your bike', 'Start tracking'] as const;

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

  // The rule for the inert button, printed under it.
  const ready = form.value.manufacturer.trim() !== '' && form.value.model.trim() !== '' && form.value.odometer.trim() !== '';

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
    <Screen contentStyle={{ flexGrow: 1, gap: 16 }} testID="screen-onboarding">
      <ScreenHeader title={`Step 2 of ${STEPS.length}`} style={{ marginBottom: 0 }} />

      <StepIndicator steps={STEPS} current={1} />

      <View style={{ paddingTop: 4, gap: 6 }}>
        <Txt role="tabTitle" style={{ letterSpacing: -0.28 }}>
          Add your motorcycle
        </Txt>
        <Txt role="body" tone="mut">
          Three things to start. Everything else can wait.
        </Txt>
      </View>

      <View pointerEvents={savedOffline ? 'none' : 'auto'} style={{ opacity: savedOffline ? 0.55 : 1 }}>
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
            testID="banner-saved-offline"
          />
          <Button label="Go to Dashboard" size="xlarge" onPress={() => router.replace('/(tabs)/dashboard')} testID="cta-go-dashboard" />
        </>
      ) : (
        <View style={{ gap: 10 }}>
          <Button
            label="Start tracking"
            icon="arrowRight"
            iconPosition="right"
            size="xlarge"
            onPress={submit}
            loading={addBike.isPending}
            disabled={!ready}
            testID="cta-add-bike"
          />
          <Txt role="helper" tone="mut" align="center">
            {ready
              ? 'Nickname, year, tank and purchase details can be added any time from Garage.'
              : 'Needs manufacturer, model and the odometer reading.'}
          </Txt>
        </View>
      )}
    </Screen>
  );
}

/**
 * Figma `Step indicator`: a 6px bar per step (done and current in the
 * accent, the rest the hairline colour) with the step names under them — the
 * current one in the accent, the ones ahead faint.
 */
function StepIndicator({ steps, current }: { steps: readonly string[]; current: number }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }} accessibilityLabel={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {steps.map((step, index) => (
          <View key={step} style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: index <= current ? c.acc : c.brd }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {steps.map((step, index) => (
          <Txt
            key={step}
            role={index === current ? 'smallStrong' : 'micro'}
            color={index === current ? c.accText : index < current ? c.mut : c.faint}
          >
            {step}
          </Txt>
        ))}
      </View>
    </View>
  );
}
