import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  DateField,
  Dialog,
  Field,
  FieldRow,
  Input,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  Txt,
} from '@/components';
import { currencySymbol, currencyDecimals } from '@/calculations/money';
import { formatDistance } from '@/utils/format';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useRecategorise } from '@/features/parts/useRecategorise';
import { conversionLosses } from '@/calculations/recategorise';
import {
  useDeleteAccessory,
  useNewAccessoryId,
  useSaveAccessory,
} from '@/features/accessories/useAccessoryMutations';
import { PhotoField } from '@/features/shared/PhotoField';
import { fromMinor, toMinor, toTrimmed } from '@/features/shared/formValues';
import { useGarageContext } from '@/features/shared/useGarageContext';
import { useStableId } from '@/features/shared/useStableId';
import { uploadImageOrKeepLocal } from '@/services/storage';
import type { BikeAnalytics } from '@/calculations/analytics';
import type { Accessory } from '@/types';
import { accessorySchema } from '@/validation/schemas';
import { todayIso } from '@/utils/date';

export default function AccessoryEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const { analytics } = useGarageData();

  if (analytics === null) {
    return (
      <Screen testID="screen-accessory-add">
        <ScreenHeader title={editingId ? 'Edit accessory' : 'Add accessory'} />
        <SkeletonList count={3} height={64} />
      </Screen>
    );
  }

  const existing = editingId ? (analytics.accessories.all.find((a) => a.id === editingId) ?? null) : null;

  return <AccessoryForm key={existing?.id ?? 'new'} existing={existing} analytics={analytics} />;
}

function AccessoryForm({
  existing,
  analytics,
}: {
  existing: Accessory | null;
  analytics: BikeAnalytics;
}) {
  const router = useRouter();
  const garage = useGarageContext();

  const newAccessoryId = useNewAccessoryId();
  const generatedId = useStableId(newAccessoryId);
  const recordId = existing?.id ?? generatedId;

  const currency = existing?.currency ?? analytics.currency;
  const decimals = currencyDecimals(currency);

  const [name, setName] = useState(existing?.name ?? '');
  const [purchaseCost, setPurchaseCost] = useState(
    existing ? fromMinor(existing.purchaseCostMinor, decimals) : '',
  );
  const [installCost, setInstallCost] = useState(
    existing ? fromMinor(existing.installationCostMinor, decimals) : '',
  );
  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(existing?.photoPath ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const recategorise = useRecategorise({ onDone: () => setConvertOpen(false) });
  const currentOdometer = analytics.odometer.currentMetres;

  const saveAccessory = useSaveAccessory();
  const deleteAccessory = useDeleteAccessory({
    onDeleted: () => {
      setDeleteOpen(false);
      if (router.canGoBack()) router.back();
      else router.replace('/accessories');
    },
  });

  const submit = async () => {
    const result = accessorySchema.safeParse({
      name: name.trim(),
      purchaseCostMinor: toMinor(purchaseCost, currency) ?? 0,
      installationCostMinor: toMinor(installCost, currency) ?? 0,
      date,
      notes: toTrimmed(notes),
    });

    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) next[String(issue.path[0] ?? 'form')] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});

    // Keep the local URI if the upload fails — the photo stays on this device.
    let photoPath = photoUri;
    if (photoUri && photoUri.startsWith('file://') && garage) {
      photoPath = (await uploadImageOrKeepLocal({
        uid: garage.uid,
        kind: 'accessory',
        recordId,
        localUri: photoUri,
      })).path;
    }

    await saveAccessory.submit({
      id: recordId,
      name: result.data.name,
      purchaseCostMinor: result.data.purchaseCostMinor,
      installationCostMinor: result.data.installationCostMinor,
      date: result.data.date,
      notes: result.data.notes,
      photoPath,
      linkedServiceId: existing?.linkedServiceId ?? null,
      ...(existing ? { existing } : {}),
    });
  };

  return (
    <Screen testID="screen-accessory-add">
      <ScreenHeader title={existing ? 'Edit accessory' : 'Add accessory'} />

      <Stack gap={14}>
        <Field label="Accessory" error={errors.name ?? null}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Givi 27L tail box"
            autoCapitalize="sentences"
            invalid={Boolean(errors.name)}
            testID="input-accessory-name"
          />
        </Field>

        <FieldRow>
          <Field label={`Purchase (${currencySymbol(currency)})`} flex={1}>
            <Input
              value={purchaseCost}
              onChangeText={setPurchaseCost}
              placeholder="0"
              keyboardType="decimal-pad"
              size="compact"
              testID="input-purchase-cost"
            />
          </Field>
          <Field label={`Fitting (${currencySymbol(currency)})`} flex={1}>
            <Input
              value={installCost}
              onChangeText={setInstallCost}
              placeholder="0"
              keyboardType="decimal-pad"
              size="compact"
              testID="input-install-cost"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Added on" flex={1}>
            <DateField value={date} onChange={setDate} maximumDate={new Date()} testID="field-accessory-date" />
          </Field>
        </FieldRow>

        <Field label="Notes (optional)">
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Fitted with the original brackets"
            size="compact"
            testID="input-accessory-notes"
          />
        </Field>

        <PhotoField label="Add a photo (optional)" uri={photoUri} onChange={setPhotoUri} testID="field-accessory-photo" />

        <Button
          label={existing ? 'Save changes' : 'Save accessory'}
          onPress={submit}
          loading={saveAccessory.isPending}
          testID="cta-save-accessory"
        />

        {existing ? (
          <Button
            label="Remove accessory"
            variant="secondary"
            size="medium"
            onPress={() => setDeleteOpen(true)}
            testID="cta-delete-accessory"
          />
        ) : null}

        <Txt role="helper" tone="mut" align="center">
          Purchase and fitting are added together in your ledger, once.
        </Txt>
      </Stack>

      {existing ? (
        <>
          <Button
            label="This is a part, not an accessory"
            variant="ghost"
            size="medium"
            onPress={() => setConvertOpen(true)}
            testID="cta-convert-to-part"
          />

          <Dialog
            visible={convertOpen}
            onClose={() => setConvertOpen(false)}
            title="Move to parts?"
            message={
              currentOdometer === null
                ? 'A part measures wear from the odometer reading it was fitted at, and this motorcycle has no reading yet. Add one first.'
                : `It will be recorded as fitted at ${formatDistance(currentOdometer, analytics.units.distance)}, today's reading — edit that afterwards if it went on earlier.${
                    conversionLosses('accessoryToPart', existing).length > 0
                      ? ` This discards ${conversionLosses('accessoryToPart', existing).join(', ')}.`
                      : ''
                  }`
            }
            confirmLabel={currentOdometer === null ? 'Close' : 'Move'}
            busy={recategorise.isPending}
            onConfirm={() => {
              if (currentOdometer === null) { setConvertOpen(false); return; }
              void recategorise.submit({
                direction: 'accessoryToPart',
                accessory: existing,
                odometerMetres: currentOdometer,
              });
            }}
            testID="dialog-convert-accessory"
          />
        </>
      ) : null}

      <Dialog
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Remove this accessory?"
        message="Its cost comes out of your ledger. This can't be undone."
        confirmLabel="Remove"
        destructive
        busy={deleteAccessory.isPending}
        onConfirm={() => existing && deleteAccessory.submit(existing.id)}
        testID="dialog-delete-accessory"
      />
    </Screen>
  );
}
