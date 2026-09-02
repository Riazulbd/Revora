import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Dialog, Screen, ScreenHeader, Txt } from '@/components';
import { BikeFormFields } from '@/features/bikes/BikeFormFields';
import { useBikeForm } from '@/features/bikes/useBikeForm';
import { useDeleteBike, useUpdateBike } from '@/features/bikes/useBikeMutations';
import { useGarage } from '@/features/bikes/GarageProvider';
import { fromMinor, fromMl } from '@/features/shared/formValues';
import { currencyDecimals } from '@/calculations/money';
import { useRouter } from 'expo-router';

/**
 * Editing a saved motorcycle.
 *
 * The opening odometer is not editable here — readings are history, and changing
 * the first one retroactively would silently rewrite every distance. Corrections
 * go through Odometer history instead.
 */
export default function EditBike() {
  const router = useRouter();
  const { activeBike, units, bikes } = useGarage();
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const updateBike = useUpdateBike();
  const deleteBike = useDeleteBike({
    onDeleted: () => {
      setConfirmDelete(false);
      router.replace('/');
    },
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

      <BikeFormFields
        value={form.value}
        onChange={form.setValue}
        errors={form.errors}
        units={units}
        showIdentifiers
        showOdometer={false}
      />

      <View style={{ gap: 10, marginTop: 20 }}>
        <Button
          label="Save changes"
          onPress={submit}
          loading={updateBike.isPending}
          testID="cta-save-bike"
        />
        <Txt role="helper" tone="mut" align="center">
          The odometer is a history, not a field — correct a reading from Odometer history.
        </Txt>

        {bikes.length > 1 ? (
          <Button
            label="Remove this motorcycle"
            variant="secondary"
            size="medium"
            onPress={() => setConfirmDelete(true)}
            style={{ marginTop: 12 }}
            testID="cta-delete-bike"
          />
        ) : null}
      </View>

      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Remove ${activeBike.nickname}?`}
        message="Every fuel log, service, part and expense for this motorcycle is deleted with it. This can't be undone."
        confirmLabel="Remove"
        destructive
        busy={deleteBike.isPending}
        onConfirm={() => deleteBike.submit(activeBike.id)}
        testID="dialog-delete-bike"
      />
    </Screen>
  );
}
