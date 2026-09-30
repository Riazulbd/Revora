import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Banner,
  Button,
  Card,
  Dialog,
  Eyebrow,
  Input,
  KeyValueRow,
  ListCard,
  Screen,
  ScreenHeader,
  Txt,
} from '@/components';
import { bikeDescriptor } from '@/calculations/garage';
import { validateOdometer } from '@/calculations/odometer';
import { distanceUnitLabel } from '@/calculations/units';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useAddOdometerReading } from '@/features/odometer/useOdometerMutations';
import { OwnershipHub } from '@/features/bikes/OwnershipHub';
import { GarageCopyRow } from '@/features/bikes/ui/GarageSpecRow';
import { useRemoveBike } from '@/features/settings/useAccountMutations';
import { fromMetres, toMetres } from '@/features/shared/formValues';
import { formatCurrency, formatDistance, formatVolume, NO_VALUE } from '@/utils/format';
import { formatLongDate } from '@/utils/date';
import { fontFamily, useTheme } from '@/theme';

/**
 * The motorcycle profile, which the boards draw as the ownership hub.
 *
 * Two artboards describe this one screen. The Account board shows the top: the
 * bike's own facts, the identifiers with their copy squares, and the odometer
 * field in its refused state. The Navigation board shows the rest: Papers,
 * Health and The machine, the three groups a rider actually thinks in.
 *
 * The header is the motorcycle's name rather than "Motorcycle profile",
 * because the screen is about one bike and a rider with three of them needs to
 * know which one they opened.
 */
export default function BikeProfile() {
  const router = useRouter();
  const { c } = useTheme();
  const { activeBike, units, bikes } = useGarage();
  const { analytics } = useGarageData();

  const [reading, setReading] = useState('');
  const [refused, setRefused] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const removeBike = useRemoveBike({ onRemoved: () => router.replace('/(tabs)/garage') });

  const bikeCount = bikes.length;
  const current = analytics?.odometer.currentMetres ?? null;
  const addReading = useAddOdometerReading({
    onSaved: () => {
      setReading('');
      setRefused(false);
    },
  });

  if (!activeBike) return null;

  const parsed = toMetres(reading, units.distance);
  const check = parsed === null ? null : validateOdometer(parsed, current);
  const belowCurrent = check !== null && !check.ok && check.reason === 'below_current';

  // A lower figure is either a fresh mistake or a correction to an old one.
  // Saying only "it moves forward" leaves a rider who mistyped 6,000 with
  // nowhere to go, so the refusal points at the history, where corrections
  // are made.
  const submitReading = async () => {
    if (parsed === null || belowCurrent) {
      setRefused(true);
      return;
    }
    setRefused(false);
    await addReading.submit({ metres: parsed, source: 'manual' });
  };

  const purchase =
    activeBike.purchasePriceMinor === null && activeBike.purchaseDate === null
      ? NO_VALUE
      : [
          activeBike.purchasePriceMinor === null
            ? null
            : formatCurrency(activeBike.purchasePriceMinor, activeBike.currency),
          activeBike.purchaseDate === null ? null : formatLongDate(activeBike.purchaseDate),
        ]
          .filter((part) => part !== null)
          .join(' · ');

  const descriptor = bikeDescriptor(activeBike);

  return (
    <Screen testID="screen-bike-profile">
      <ScreenHeader title={activeBike.nickname} style={{ marginBottom: 0 }} />
      <Txt role="meta" tone="mut" style={{ marginHorizontal: 4 }}>
        Everything the bike owns lives here. Garage › bike card opens it.
      </Txt>

      <ListCard style={{ marginTop: 14 }}>
        <KeyValueRow label="Make & model" value={descriptor === '' ? NO_VALUE : descriptor} />
        <KeyValueRow label="Tank" value={formatVolume(activeBike.tankCapacityMl, units.volume)} />
        <GarageCopyRow
          label="Engine no."
          value={activeBike.engineNumber}
          copyLabel="Engine number"
          testID="row-engine"
        />
        <GarageCopyRow
          label="Chassis no."
          value={activeBike.chassisNumber}
          copyLabel="Chassis number"
          testID="row-chassis"
        />
        <KeyValueRow label="Purchase" value={purchase} />
      </ListCard>

      <Card style={{ marginTop: 14, gap: 10 }}>
        <Eyebrow>UPDATE ODOMETER</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Input
            value={reading}
            onChangeText={(next) => {
              setReading(next);
              setRefused(false);
            }}
            placeholder={current === null ? '' : fromMetres(current, units.distance)}
            keyboardType="decimal-pad"
            size="numeric"
            inset="bg"
            unit={distanceUnitLabel(units.distance)}
            invalid={refused}
            style={{ flex: 1 }}
            testID="input-odometer"
          />
          <Button
            label="Update"
            variant="subtle"
            size="large"
            tone="mut"
            onPress={submitReading}
            loading={addReading.isPending}
            style={{ width: 110 }}
            testID="cta-update-odometer"
          />
        </View>

        {refused && belowCurrent && check !== null && !check.ok && check.reason === 'below_current' ? (
          <Txt role="meta" tone="bad" style={{ lineHeight: 18 }}>
            {`Lower than the current ${formatDistance(check.currentMetres, units.distance)} — the odometer only moves forward. If an earlier reading is wrong, `}
            <Txt
              accessibilityRole="link"
              onPress={() => router.push('/garage/odometer')}
              style={{ fontFamily: fontFamily[700], color: c.acc }}
              testID="cta-correct-reading"
            >
              correct it in Odometer history
            </Txt>
            .
          </Txt>
        ) : refused ? (
          <Txt role="meta" tone="bad" style={{ lineHeight: 18 }}>
            Enter the current reading.
          </Txt>
        ) : (
          <Txt role="helper" tone="mut">
            Odometer only moves forward — a lower reading gets flagged, never silently accepted.
          </Txt>
        )}
      </Card>

      {check !== null && !check.ok && check.reason === 'implausible_jump' ? (
        <Banner
          tone="warn"
          message={`That is more than 5,000 ${distanceUnitLabel(units.distance)} past your last reading. Double-check before saving.`}
          style={{ marginTop: 12 }}
          testID="banner-odometer-jump"
        />
      ) : null}

      <OwnershipHub />

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Button
          label="Edit details"
          variant="secondary"
          size="medium"
          flex
          onPress={() => router.push('/garage/edit')}
          testID="cta-edit-details"
        />
        <Button
          label="Delete motorcycle"
          variant="ghost"
          tone="bad"
          size="medium"
          flex
          onPress={() => setConfirmRemove(true)}
          testID="cta-delete-bike"
        />
      </View>

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
