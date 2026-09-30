import React, { useState } from 'react';
import { useRouter } from 'expo-router';

import { Banner, Button, Screen, ScreenHeader } from '@/components';
import { EditBikeFields } from '@/features/bikes/ui/EditBikeFields';
import { useBikeForm } from '@/features/bikes/useBikeForm';
import { useUpdateBike } from '@/features/bikes/useBikeMutations';
import { useGarage } from '@/features/bikes/GarageProvider';
import { fromMinor, fromMl } from '@/features/shared/formValues';
import { currencyDecimals } from '@/calculations/money';
import { useConnectivity } from '@/services/connectivity';

/**
 * Editing a saved motorcycle.
 *
 * The opening odometer is not a field here — readings are history, and editing
 * the first one retroactively would silently rewrite every distance since. The
 * board says so in the card above Save, and links to where a wrong reading is
 * actually corrected.
 *
 * Deleting the bike lives on the Motorcycle profile, beside the rest of the
 * facts about it, exactly where the board puts it.
 */
export default function EditBike() {
  const router = useRouter();
  const { activeBike, units } = useGarage();
  const { isOnline } = useConnectivity();
  const [savedOffline, setSavedOffline] = useState(false);

  const decimals = currencyDecimals(activeBike?.currency ?? units.currency);

  const form = useBikeForm(
    {
      manufacturer: activeBike?.manufacturer ?? '',
      model: activeBike?.model ?? '',
      nickname: activeBike?.nickname ?? '',
      year: activeBike?.year === null || activeBike?.year === undefined ? '' : String(activeBike.year),
      // Not shown when editing; the schema still needs a value it can accept.
      odometer: '0',
      tankCapacity: fromMl(activeBike?.tankCapacityMl ?? null, units.volume),
      purchasePrice: fromMinor(activeBike?.purchasePriceMinor ?? null, decimals),
      engineNumber: activeBike?.engineNumber ?? '',
      chassisNumber: activeBike?.chassisNumber ?? '',
    },
    units,
  );

  // Offline the write is queued rather than lost, and the board says so on this
  // screen — so the screen has to still be here to say it.
  const updateBike = useUpdateBike({
    stayOnScreen: !isOnline,
    onSaved: () => setSavedOffline(!isOnline),
  });

  if (!activeBike) return null;

  const submit = async () => {
    const parsed = form.parse();
    if (!parsed) return;
    await updateBike.submit({
      manufacturer: parsed.manufacturer,
      model: parsed.model,
      nickname: parsed.nickname,
      year: parsed.year,
      tankCapacityMl: parsed.tankCapacityMl,
      purchasePriceMinor: parsed.purchasePriceMinor,
      engineNumber: parsed.engineNumber,
      chassisNumber: parsed.chassisNumber,
    });
  };

  return (
    <Screen testID="screen-edit-bike">
      <ScreenHeader title="Edit motorcycle" />

      <EditBikeFields value={form.value} onChange={form.setValue} errors={form.errors} units={units} />

      <Banner
        variant="plain"
        compact
        message="The current odometer isn't edited here — it's derived from readings."
        link={{
          label: 'Correct a reading in Odometer history',
          onPress: () => router.push('/garage/odometer'),
          testID: 'cta-odometer-history',
        }}
        action="instead."
        style={{ marginTop: 14 }}
        testID="banner-odometer-derived"
      />

      <Button
        label="Save changes"
        onPress={submit}
        loading={updateBike.isPending}
        style={{ marginTop: 16 }}
        testID="cta-save-bike"
      />

      {savedOffline ? (
        <Banner
          tone="good"
          compact
          message="Saved on this phone — offline, syncs when you're back."
          style={{ marginTop: 10 }}
          testID="banner-saved-offline"
        />
      ) : null}
    </Screen>
  );
}
