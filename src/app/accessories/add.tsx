import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  DateField,
  Dialog,
  Input,
  Screen,
  ScreenHeader,
  SkeletonList,
  Txt,
} from '@/components';
import { accessorySpendMinor } from '@/calculations/accessorySpend';
import { currencySymbol, currencyDecimals } from '@/calculations/money';
import { distanceUnitLabel } from '@/calculations/units';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useRecategorise } from '@/features/parts/useRecategorise';
import { PartsDialog } from '@/features/parts/ui/PartsDialog';
import { PartsField } from '@/features/parts/ui/PartsField';
import { PartsTypeSwitch } from '@/features/parts/ui/PartsTypeSwitch';
import { AccessoryPhotoField } from '@/features/accessories/ui/AccessoryPhotoField';
import {
  useDeleteAccessory,
  useNewAccessoryId,
  useSaveAccessory,
} from '@/features/accessories/useAccessoryMutations';
import { fromMinor, toMetres, toMinor, toTrimmed } from '@/features/shared/formValues';
import { useGarageContext } from '@/features/shared/useGarageContext';
import { useStableId } from '@/features/shared/useStableId';
import { uploadImageOrKeepLocal } from '@/services/storage';
import type { BikeAnalytics } from '@/calculations/analytics';
import type { Accessory } from '@/types';
import { accessorySchema } from '@/validation/schemas';
import { formatCurrency } from '@/utils/format';
import { formatShortDate, todayIso } from '@/utils/date';

/**
 * Add / edit an accessory.
 *
 * Purchase and fitting are two fields and one figure: they are added together
 * once in Costs, and the helper under them prints that total as it is typed so
 * nobody has to wonder whether both were counted.
 */
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

function AccessoryForm({ existing, analytics }: { existing: Accessory | null; analytics: BikeAnalytics }) {
  const router = useRouter();
  const garage = useGarageContext();

  const newAccessoryId = useNewAccessoryId();
  const generatedId = useStableId(newAccessoryId);
  const recordId = existing?.id ?? generatedId;

  const currency = existing?.currency ?? analytics.currency;
  const decimals = currencyDecimals(currency);
  const distanceLabel = distanceUnitLabel(analytics.units.distance);

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
  const [fittedOdometer, setFittedOdometer] = useState('');
  const [fittedError, setFittedError] = useState<string | null>(null);
  const recategorise = useRecategorise({ onDone: () => setConvertOpen(false) });

  const saveAccessory = useSaveAccessory();
  const deleteAccessory = useDeleteAccessory({
    onDeleted: () => {
      setDeleteOpen(false);
      if (router.canGoBack()) router.back();
      else router.replace('/accessories');
    },
  });

  // The one figure Costs counts, as it is typed. Null until something is.
  const spendMinor = accessorySpendMinor(toMinor(purchaseCost, currency), toMinor(installCost, currency));
  const spendHelper =
    spendMinor === null
      ? 'Added together once in Costs, never counted twice.'
      : `Added together once in Costs — ${formatCurrency(spendMinor, currency)}, never counted twice.`;

  const paidSoFar = existing === null ? null : existing.purchaseCostMinor + existing.installationCostMinor;

  const chooseType = (next: 'part' | 'accessory') => {
    if (next === 'accessory') return;
    if (existing) {
      setFittedError(null);
      setConvertOpen(true);
      return;
    }
    router.replace('/parts/add');
  };

  const convert = () => {
    if (!existing) return;
    const metres = toMetres(fittedOdometer, analytics.units.distance);
    if (metres === null) {
      setFittedError('Enter the reading it was fitted at.');
      return;
    }
    setFittedError(null);
    void recategorise.submit({ direction: 'accessoryToPart', accessory: existing, odometerMetres: metres });
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    const purchaseMinor = toMinor(purchaseCost, currency);
    if (purchaseMinor === null) next.purchaseCostMinor = 'Enter what it cost.';

    const result = accessorySchema.safeParse({
      name: name.trim(),
      purchaseCostMinor: purchaseMinor ?? 0,
      installationCostMinor: toMinor(installCost, currency) ?? 0,
      date,
      notes: toTrimmed(notes),
    });

    if (!result.success) {
      for (const issue of result.error.issues) next[String(issue.path[0] ?? 'form')] = issue.message;
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || !result.success) return;

    // Keep the local URI if the upload fails — the photo stays on this device.
    let photoPath = photoUri;
    if (photoUri && photoUri.startsWith('file://') && garage) {
      photoPath = (
        await uploadImageOrKeepLocal({
          uid: garage.uid,
          kind: 'accessory',
          recordId,
          localUri: photoUri,
        })
      ).path;
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
      <ScreenHeader title={existing ? existing.name : 'Add accessory'} />

      <PartsTypeSwitch
        value="accessory"
        pending={convertOpen ? 'part' : null}
        onChange={chooseType}
        testID="segmented-record-type"
      />

      <PartsField label="Name" error={errors.name ?? null} style={{ marginTop: 16 }}>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="Givi 27L tail box"
          autoCapitalize="sentences"
          padX={14}
          invalid={Boolean(errors.name)}
          testID="input-accessory-name"
        />
      </PartsField>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
        <PartsField label="Purchase" flex={1} error={errors.purchaseCostMinor ?? null}>
          <Input
            value={purchaseCost}
            onChangeText={setPurchaseCost}
            placeholder="0"
            keyboardType="decimal-pad"
            prefix={currencySymbol(currency)}
            padX={14}
            invalid={Boolean(errors.purchaseCostMinor)}
            testID="input-purchase-cost"
          />
        </PartsField>
        <PartsField label="Fitting" optional flex={1}>
          <Input
            value={installCost}
            onChangeText={setInstallCost}
            placeholder="0"
            keyboardType="decimal-pad"
            prefix={currencySymbol(currency)}
            padX={14}
            testID="input-install-cost"
          />
        </PartsField>
      </View>

      <Txt role="helper" tone="mut" style={{ marginTop: 8 }} testID="note-accessory-total">
        {spendHelper}
      </Txt>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
        <PartsField label="Added on" flex={1}>
          <DateField
            value={date}
            onChange={setDate}
            maximumDate={new Date()}
            todayLabel={null}
            format={formatShortDate}
            padX={14}
            testID="field-accessory-date"
          />
        </PartsField>
        <PartsField label="Photo" optional flex={1}>
          <AccessoryPhotoField uri={photoUri} onChange={setPhotoUri} testID="field-accessory-photo" />
        </PartsField>
      </View>

      <PartsField label="Notes" optional style={{ marginTop: 14 }}>
        <Input
          value={notes}
          onChangeText={setNotes}
          placeholder="Givi, fitted at Bike Point"
          padX={14}
          testID="input-accessory-notes"
        />
      </PartsField>

      <Txt role="helper" tone="mut" style={{ marginTop: 12 }}>
        {`Counts in your totals, stays out of cost / ${distanceLabel} — a one-off charged against distance would make that figure swing.`}
      </Txt>

      <Button
        label={existing ? 'Save changes' : 'Save accessory'}
        onPress={submit}
        loading={saveAccessory.isPending}
        style={{ marginTop: 14 }}
        testID="cta-save-accessory"
      />

      {existing ? (
        <Button
          label="Remove accessory"
          variant="dangerSubtle"
          radius={13}
          onPress={() => setDeleteOpen(true)}
          style={{ marginTop: 14 }}
          testID="cta-delete-accessory"
        />
      ) : null}

      {existing ? (
        <PartsDialog
          visible={convertOpen}
          onClose={() => setConvertOpen(false)}
          title="Make this a part?"
          confirmLabel="Convert"
          cancelLabel="Keep accessory"
          busy={recategorise.isPending}
          onConfirm={convert}
          testID="dialog-convert-accessory"
        >
          <Txt role="body" tone="mut" style={{ marginTop: 8, lineHeight: 20.15 }}>
            A part wears, so it needs one thing an accessory never had:
          </Txt>
          <PartsField
            label="Fitted at odometer — required"
            error={fittedError}
            style={{ marginTop: 12 }}
          >
            <Input
              value={fittedOdometer}
              onChangeText={(next) => {
                setFittedOdometer(next);
                if (fittedError !== null) setFittedError(null);
              }}
              placeholder="Reading when fitted"
              keyboardType="decimal-pad"
              unit={distanceLabel}
              padX={14}
              invalid={fittedError !== null}
              testID="input-fitted-odometer"
            />
          </PartsField>
          <Txt role="body" tone="mut" style={{ marginTop: 12, lineHeight: 20.15 }}>
            {`It also joins cost / ${distanceLabel} from that reading, and you can give it an expected life. ${
              paidSoFar === null || paidSoFar === 0
                ? 'Nothing was recorded as paid, so Costs is unchanged either way.'
                : `The ${formatCurrency(paidSoFar, currency)} you paid stays in Costs either way.`
            }`}
          </Txt>
          {existing.photoPath === null ? null : (
            <Txt role="body" tone="mut" style={{ marginTop: 8, lineHeight: 20.15 }}>
              Its photo is discarded — a part has nowhere to keep one.
            </Txt>
          )}
        </PartsDialog>
      ) : null}

      <Dialog
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={existing ? `Remove ${existing.name}?` : 'Remove this accessory?'}
        message={`The record${existing?.photoPath ? ' and its photo are' : ' is'} deleted. ${
          paidSoFar === null || paidSoFar === 0
            ? 'Nothing was recorded as paid, so Costs is unchanged.'
            : `The ${formatCurrency(paidSoFar, currency)} stays in Costs — you paid it, so it stays counted.`
        } This can't be undone.`}
        confirmLabel="Remove"
        cancelLabel="Keep"
        destructive
        busy={deleteAccessory.isPending}
        onConfirm={() => existing && deleteAccessory.submit(existing.id)}
        testID="dialog-delete-accessory"
      />
    </Screen>
  );
}
