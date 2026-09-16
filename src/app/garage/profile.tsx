import React, { useState } from 'react';
import { View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  CopyableRow,
  Dialog,
  DividedList,
  Eyebrow,
  Input,
  KeyValueRow,
  Screen,
  ScreenHeader,
  Stack,
  Txt,
} from '@/components';
import { validateOdometer } from '@/calculations/odometer';
import { distanceUnitLabel } from '@/calculations/units';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useAddOdometerReading } from '@/features/odometer/useOdometerMutations';
import { OwnershipHub } from '@/features/bikes/OwnershipHub';
import { useRemoveBike } from '@/features/settings/useAccountMutations';
import { fromMetres, toMetres } from '@/features/shared/formValues';
import { formatCurrency, formatDistance, formatVolume, NO_VALUE } from '@/utils/format';
import { formatLongDate } from '@/utils/date';
import { useRouter } from 'expo-router';

export default function BikeProfile() {
  const router = useRouter();
  const { activeBike, units, bikes } = useGarage();
  const { analytics } = useGarageData();

  const [reading, setReading] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const removeBike = useRemoveBike({ onRemoved: () => router.replace('/(tabs)/garage') });

  const bikeCount = bikes.length;
  const current = analytics?.odometer.currentMetres ?? null;
  const addReading = useAddOdometerReading({
    onSaved: () => {
      setReading('');
      setError(null);
    },
  });

  if (!activeBike) return null;

  const parsed = toMetres(reading, units.distance);
  const check = parsed === null ? null : validateOdometer(parsed, current);

  const submitReading = async () => {
    if (parsed === null) {
      setError('Enter the current reading.');
      return;
    }
    if (check && !check.ok && check.reason === 'below_current') {
      // A lower figure is either a fresh mistake or a correction to an old one.
      // Saying only "it moves forward" leaves a rider who mistyped 6,000 with
      // nowhere to go, so point at the history, where corrections are made.
      setError(
        `That is below your last reading of ${formatDistance(check.currentMetres, units.distance)}. The odometer only moves forward — if the last reading was a mistake, correct it in the history.`,
      );
      return;
    }
    setError(null);
    await addReading.submit({ metres: parsed, source: 'manual' });
  };

  return (
    <Screen testID="screen-bike-profile">
      <ScreenHeader title="Motorcycle profile" />

      <Stack>
        <Card variant="list">
          <DividedList>
            <KeyValueRow label="Manufacturer" value={activeBike.manufacturer || NO_VALUE} />
            <KeyValueRow label="Model" value={activeBike.model || NO_VALUE} />
            <KeyValueRow label="Nickname" value={activeBike.nickname} />
            <KeyValueRow label="Year" value={activeBike.year === null ? NO_VALUE : String(activeBike.year)} />
            <CopyableRow
              label="Engine no."
              value={activeBike.engineNumber}
              copyLabel="Engine number"
              testID="row-engine"
            />
            <CopyableRow
              label="Chassis no."
              value={activeBike.chassisNumber}
              copyLabel="Chassis number"
              testID="row-chassis"
            />
            <KeyValueRow label="Tank capacity" value={formatVolume(activeBike.tankCapacityMl, units.volume)} />
            <KeyValueRow
              label="Purchase price"
              value={
                activeBike.purchasePriceMinor === null
                  ? NO_VALUE
                  : formatCurrency(activeBike.purchasePriceMinor, activeBike.currency)
              }
            />
            <KeyValueRow
              label="Purchased"
              value={activeBike.purchaseDate ? formatLongDate(activeBike.purchaseDate) : NO_VALUE}
            />
          </DividedList>
        </Card>

        <Card variant="list" style={{ paddingVertical: 16 }}>
          <Eyebrow>UPDATE ODOMETER</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Input
              value={reading}
              onChangeText={setReading}
              placeholder={
                current === null
                  ? `Current reading (${distanceUnitLabel(units.distance)})`
                  : `${fromMetres(current, units.distance)} current`
              }
              keyboardType="decimal-pad"
              size="compact"
              invalid={Boolean(error)}
              style={{ flex: 1 }}
              testID="input-odometer"
            />
            <Button
              label="Update"
              size="small"
              onPress={submitReading}
              loading={addReading.isPending}
              style={{ height: 48, paddingHorizontal: 18 }}
              testID="cta-update-odometer"
            />
          </View>
          {error ? (
            <>
              <Txt role="helper" tone="bad" style={{ marginTop: 8 }}>
                {error}
              </Txt>
              {check && !check.ok && check.reason === 'below_current' ? (
                <Button
                  label="Correct a reading"
                  variant="secondary"
                  size="small"
                  onPress={() => router.push('/garage/odometer')}
                  style={{ marginTop: 10, alignSelf: 'flex-start' }}
                  testID="cta-correct-reading"
                />
              ) : null}
            </>
          ) : (
            <Txt role="micro" tone="mut" style={{ marginTop: 8 }}>
              Odometer only moves forward — a lower reading gets flagged, never silently accepted.
            </Txt>
          )}
        </Card>

        {check && !check.ok && check.reason === 'implausible_jump' ? (
          <Banner
            icon="alert"
            message={`That is more than 5,000 ${distanceUnitLabel(units.distance)} past your last reading. Double-check before saving.`}
          />
        ) : null}

        <Txt role="helper" tone="mut">
          Everything this motorcycle owns lives here.
        </Txt>

        <OwnershipHub />

        <Button
          label="Delete this motorcycle"
          variant="ghost"
          size="medium"
          onPress={() => setConfirmRemove(true)}
          testID="cta-delete-bike"
        />
      </Stack>

      <Dialog
        visible={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`Delete ${activeBike.nickname}?`}
        message={`Every fuel log, service, part, accessory, expense, document and reading for this motorcycle is deleted with it. ${bikeCount === 1 ? 'It is the only motorcycle in your garage, so you will start again from an empty garage. ' : ''}This can't be undone.`}
        confirmLabel="Delete"
        destructive
        busy={removeBike.isPending}
        onConfirm={() => void removeBike.submit(activeBike.id)}
        testID="dialog-delete-bike"
      />
    </Screen>
  );
}
