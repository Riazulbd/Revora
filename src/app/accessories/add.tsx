import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Banner,
  Button,
  DateField,
  Dialog,
  Field,
  Icon,
  Input,
  InputRow,
  ListCard,
  PickerRow,
  Screen,
  ScreenHeader,
  Segmented,
  SkeletonList,
  Txt,
} from '@/components';
import { accessorySpendMinor } from '@/calculations/accessorySpend';
import { currencySymbol, currencyDecimals } from '@/calculations/money';
import { distanceUnitLabel } from '@/calculations/units';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useRecategorise } from '@/features/parts/useRecategorise';
import { PartsDialog } from '@/features/parts/ui/PartsDialog';
import { useDeleteAccessory, useNewAccessoryId, useSaveAccessory } from '@/features/accessories/useAccessoryMutations';
import { fromMinor, toMetres, toMinor, toTrimmed } from '@/features/shared/formValues';
import { useGarageContext } from '@/features/shared/useGarageContext';
import { useImagePicker } from '@/features/shared/useImagePicker';
import { useStableId } from '@/features/shared/useStableId';
import { uploadImageOrKeepLocal } from '@/services/storage';
import type { BikeAnalytics } from '@/calculations/analytics';
import type { Accessory } from '@/types';
import { accessorySchema } from '@/validation/schemas';
import { formatCurrencySymbol } from '@/utils/format';
import { formatLongDate, todayIso } from '@/utils/date';
import { useTheme } from '@/theme';

const TYPE_OPTIONS = [
  { value: 'part' as const, label: 'Part' },
  { value: 'accessory' as const, label: 'Accessory' },
];

/**
 * Add / edit an accessory (Figma `C7 Accessories — Add`).
 *
 * Purchase and fitting are two rows and one figure: they are added together
 * once in Costs, and the helper under them prints that total as it is typed so
 * nobody has to wonder whether both were counted.
 */
export default function AccessoryEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const { analytics } = useGarageData();

  if (analytics === null) {
    return (
      <Screen testID="screen-accessory-add">
        <ScreenHeader title={editingId ? 'Edit accessory' : 'Add accessory'} icon="x" />
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
  const picker = useImagePicker();
  const { c } = useTheme();

  const newAccessoryId = useNewAccessoryId();
  const generatedId = useStableId(newAccessoryId);
  const recordId = existing?.id ?? generatedId;

  const currency = existing?.currency ?? analytics.currency;
  const decimals = currencyDecimals(currency);
  const symbol = currencySymbol(currency);
  const distanceLabel = distanceUnitLabel(analytics.units.distance);

  const [name, setName] = useState(existing?.name ?? '');
  const [purchaseCost, setPurchaseCost] = useState(existing ? fromMinor(existing.purchaseCostMinor, decimals) : '');
  const [installCost, setInstallCost] = useState(existing ? fromMinor(existing.installationCostMinor, decimals) : '');
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
      : `Added together once in Costs — ${formatCurrencySymbol(spendMinor, currency)}, never counted twice.`;

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

  const choosePhoto = async () => {
    const next = await picker.choose('Accessory photo');
    if (next) setPhotoUri(next);
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
      photoPath = (await uploadImageOrKeepLocal({ uid: garage.uid, kind: 'accessory', recordId, localUri: photoUri })).path;
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
    <Screen testID="screen-accessory-add" contentStyle={{ flexGrow: 1, gap: 16 }}>
      <ScreenHeader title={existing ? existing.name : 'Add accessory'} icon="x" style={{ marginBottom: 0 }} />

      <Segmented options={TYPE_OPTIONS} value={convertOpen ? 'part' : 'accessory'} onChange={chooseType} testID="segmented-record-type" />

      <ListCard testID="card-fields">
        <InputRow
          icon="tag"
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Givi 27L tail box"
          autoCapitalize="sentences"
          invalid={Boolean(errors.name)}
          {...(errors.name ? { hint: errors.name, hintTone: 'bad' as const } : {})}
          testID="input-accessory-name"
        />
        <InputRow
          icon="banknote"
          label="Purchase"
          value={purchaseCost}
          onChangeText={setPurchaseCost}
          placeholder="0"
          keyboardType="decimal-pad"
          unit={symbol}
          invalid={Boolean(errors.purchaseCostMinor)}
          {...(errors.purchaseCostMinor ? { hint: errors.purchaseCostMinor, hintTone: 'bad' as const } : {})}
          testID="input-purchase-cost"
        />
        <InputRow
          icon="wrench"
          label="Fitting (optional)"
          value={installCost}
          onChangeText={setInstallCost}
          placeholder="0"
          keyboardType="decimal-pad"
          unit={symbol}
          testID="input-install-cost"
        />
      </ListCard>

      {/* Figma `Sum helper`. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: c.accS }} testID="note-accessory-total">
        <Icon name="plus" size={20} color={c.accBright} />
        <Txt role="mediumStrong" tone="acc" style={{ flex: 1 }}>
          {spendHelper}
        </Txt>
      </View>

      <ListCard testID="card-details">
        <DateField
          variant="row"
          icon="calendar"
          label="Added on"
          value={date}
          onChange={setDate}
          maximumDate={new Date()}
          todayLabel={null}
          format={formatLongDate}
          testID="field-accessory-date"
        />
        <PickerRow
          icon="camera"
          label="Photo (optional)"
          value={photoUri ? 'Photo added · tap to change' : 'Add a photo'}
          valueTone="acc"
          placeholder="Add a photo"
          onPress={() => void choosePhoto()}
          disabled={picker.busy}
          {...(photoUri
            ? {
                trailing: (
                  <Image source={{ uri: photoUri }} accessibilityIgnoresInvertColors style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.sur2 }} resizeMode="cover" />
                ),
              }
            : {})}
          testID="field-accessory-photo"
        />
        <InputRow icon="fileText" label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Givi, fitted at Bike Point" testID="input-accessory-notes" />
      </ListCard>

      {photoUri ? (
        <Button label="Remove photo" variant="ghost" tone="mut" size="compact" onPress={() => setPhotoUri(null)} testID="cta-remove-photo" />
      ) : null}

      <Banner
        tone="neutral"
        message={`Counts in your totals, stays out of cost / ${distanceLabel} — a one-off charged against distance would make that figure swing.`}
        testID="note-accessory-rule"
      />

      <View style={{ flex: 1, minHeight: 8 }} />

      <Button label={existing ? 'Save changes' : 'Save accessory'} icon="check" size="xlarge" onPress={submit} loading={saveAccessory.isPending} testID="cta-save-accessory" />

      {existing ? (
        <Button label="Remove accessory" icon="trash" variant="dangerSubtle" size="large" onPress={() => setDeleteOpen(true)} testID="cta-delete-accessory" />
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
          <Txt role="body" tone="mut" style={{ marginTop: 8 }}>
            A part wears, so it needs one thing an accessory never had:
          </Txt>
          <Field label="Fitted at odometer — required" error={fittedError} style={{ marginTop: 12 }}>
            <Input
              value={fittedOdometer}
              onChangeText={(next) => {
                setFittedOdometer(next);
                if (fittedError !== null) setFittedError(null);
              }}
              placeholder="Reading when fitted"
              keyboardType="decimal-pad"
              unit={distanceLabel}
              invalid={fittedError !== null}
              testID="input-fitted-odometer"
            />
          </Field>
          <Txt role="body" tone="mut" style={{ marginTop: 12 }}>
            {`It also joins cost / ${distanceLabel} from that reading, and you can give it an expected life. ${
              paidSoFar === null || paidSoFar === 0
                ? 'Nothing was recorded as paid, so Costs is unchanged either way.'
                : `The ${formatCurrencySymbol(paidSoFar, currency)} you paid stays in Costs either way.`
            }`}
          </Txt>
          {existing.photoPath === null ? null : (
            <Txt role="body" tone="mut" style={{ marginTop: 8 }}>
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
            : `The ${formatCurrencySymbol(paidSoFar, currency)} stays in Costs — you paid it, so it stays counted.`
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
