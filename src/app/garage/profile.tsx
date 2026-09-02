import React, { useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  Banner,
  Button,
  Card,
  DividedList,
  Eyebrow,
  Icon,
  Input,
  KeyValueRow,
  Screen,
  ScreenHeader,
  Stack,
  Txt,
  useToast,
} from '@/components';
import { validateOdometer } from '@/calculations/odometer';
import { distanceUnitLabel } from '@/calculations/units';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useAddOdometerReading } from '@/features/odometer/useOdometerMutations';
import { fromMetres, toMetres } from '@/features/shared/formValues';
import { formatCurrency, formatDistance, formatVolume, NO_VALUE } from '@/utils/format';
import { formatLongDate } from '@/utils/date';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme';

export default function BikeProfile() {
  const router = useRouter();
  const { c } = useTheme();
  const toast = useToast();
  const { activeBike, units } = useGarage();
  const { analytics } = useGarageData();

  const [reading, setReading] = useState('');
  const [error, setError] = useState<string | null>(null);

  const current = analytics?.odometer.currentMetres ?? null;
  const addReading = useAddOdometerReading({
    onSaved: () => {
      setReading('');
      setError(null);
    },
  });

  if (!activeBike) return null;

  const copy = async (label: string, value: string | null) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    toast.show(`${label} copied`);
  };

  const parsed = toMetres(reading, units.distance);
  const check = parsed === null ? null : validateOdometer(parsed, current);

  const submitReading = async () => {
    if (parsed === null) {
      setError('Enter the current reading.');
      return;
    }
    if (check && !check.ok && check.reason === 'below_current') {
      setError(
        `That is below your last reading of ${formatDistance(check.currentMetres, units.distance)}. The odometer only moves forward.`,
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
            <KeyValueRow
              label="Engine no."
              value={activeBike.engineNumber ?? NO_VALUE}
              onPress={
                activeBike.engineNumber ? () => void copy('Engine number', activeBike.engineNumber) : undefined
              }
              trailing={
                activeBike.engineNumber ? <Icon name="copy" size={14} color={c.acc} strokeWidth={2} /> : undefined
              }
              testID="row-engine"
            />
            <KeyValueRow
              label="Chassis no."
              value={activeBike.chassisNumber ?? NO_VALUE}
              onPress={
                activeBike.chassisNumber
                  ? () => void copy('Chassis number', activeBike.chassisNumber)
                  : undefined
              }
              trailing={
                activeBike.chassisNumber ? <Icon name="copy" size={14} color={c.acc} strokeWidth={2} /> : undefined
              }
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
            <Txt role="helper" tone="bad" style={{ marginTop: 8 }}>
              {error}
            </Txt>
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

        <Button
          label="Edit details"
          variant="secondary"
          size="medium"
          onPress={() => router.push('/garage/edit')}
          testID="cta-edit-bike"
        />
      </Stack>
    </Screen>
  );
}
