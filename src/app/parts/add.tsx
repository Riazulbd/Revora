import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import {
  Button,
  Card,
  Dialog,
  DateField,
  Divider,
  Field,
  FieldRow,
  Input,
  MenuRow,
  PickerField,
  Screen,
  ScreenHeader,
  Sheet,
  SkeletonList,
  Stack,
  Txt,
} from '@/components';
import { currencySymbol, currencyDecimals } from '@/calculations/money';
import { distanceUnitLabel } from '@/calculations/units';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useRecategorise } from '@/features/parts/useRecategorise';
import { conversionLosses } from '@/calculations/recategorise';
import { useNewPartId, useSavePart } from '@/features/parts/usePartMutations';
import { fromMetres, fromMinor, toMetres, toMinor, toTrimmed } from '@/features/shared/formValues';
import { useStableId } from '@/features/shared/useStableId';
import type { BikeAnalytics } from '@/calculations/analytics';
import type { Part, UnitPreferences } from '@/types';
import { partSchema } from '@/validation/schemas';
import { formatCurrency } from '@/utils/format';
import { formatLongDate, todayIso } from '@/utils/date';

/**
 * Add / edit a part.
 *
 * Linking a part to a service is how the ledger stays honest: a linked part's
 * cost lives on the service and produces no second line (requirement 28).
 */
export default function PartEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const { units } = useGarage();
  const { analytics } = useGarageData();

  if (analytics === null) {
    return (
      <Screen testID="screen-part-add">
        <ScreenHeader title={editingId ? 'Edit part' : 'Add part'} />
        <SkeletonList count={4} height={64} />
      </Screen>
    );
  }

  const existing = editingId
    ? ([...analytics.parts.active, ...analytics.parts.removed].find((p) => p.part.id === editingId)?.part ??
      null)
    : null;

  return <PartForm key={existing?.id ?? 'new'} existing={existing} analytics={analytics} units={units} />;
}

function PartForm({
  existing,
  analytics,
  units,
}: {
  existing: Part | null;
  analytics: BikeAnalytics;
  units: UnitPreferences;
}) {
  const newPartId = useNewPartId();
  const generatedId = useStableId(newPartId);
  const recordId = existing?.id ?? generatedId;

  const currency = existing?.currency ?? analytics.currency;
  const decimals = currencyDecimals(currency);

  const [name, setName] = useState(existing?.name ?? '');
  const [installedOdometer, setInstalledOdometer] = useState(
    fromMetres(existing?.installedOdometerMetres ?? analytics.odometer.currentMetres, units.distance),
  );
  const [installedDate, setInstalledDate] = useState(existing?.installedDate ?? todayIso());
  const [expectedLife, setExpectedLife] = useState(
    fromMetres(existing?.expectedLifeMetres ?? null, units.distance),
  );
  const [cost, setCost] = useState(existing ? fromMinor(existing.costMinor, decimals) : '');
  const [fittedBy, setFittedBy] = useState(existing?.fittedBy ?? '');
  const [linkedServiceId, setLinkedServiceId] = useState<string | null>(existing?.linkedServiceId ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [linkOpen, setLinkOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const recategorise = useRecategorise({ onDone: () => setConvertOpen(false) });

  const savePart = useSavePart();
  const services = analytics.services.all;
  const linkedService = services.find((s) => s.id === linkedServiceId) ?? null;

  const submit = async () => {
    const next: Record<string, string> = {};

    const installed = toMetres(installedOdometer, units.distance);
    if (installed === null) next.installedOdometer = 'Enter the reading it was fitted at.';

    const life = expectedLife.trim() === '' ? null : toMetres(expectedLife, units.distance);
    if (expectedLife.trim() !== '' && life === null) next.expectedLife = 'Enter a distance.';

    const costMinor = toMinor(cost, currency) ?? 0;

    const result = partSchema.safeParse({
      name: name.trim(),
      installedOdometerMetres: installed ?? 0,
      installedDate,
      expectedLifeMetres: life,
      costMinor,
      fittedBy: toTrimmed(fittedBy),
      linkedServiceId,
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        next[
          key === 'installedOdometerMetres'
            ? 'installedOdometer'
            : key === 'expectedLifeMetres'
              ? 'expectedLife'
              : key
        ] = issue.message;
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    await savePart.submit({
      id: recordId,
      name: name.trim(),
      installedOdometerMetres: installed ?? 0,
      installedDate,
      expectedLifeMetres: life,
      costMinor,
      fittedBy: toTrimmed(fittedBy),
      linkedServiceId,
      notes: toTrimmed(notes),
      ...(existing ? { existing } : {}),
    });
  };

  return (
    <Screen testID="screen-part-add">
      <ScreenHeader title={existing ? 'Edit part' : 'Add part'} />

      <Stack gap={14}>
        <Field label="Part name" error={errors.name ?? null}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="e.g. DID chain kit"
            autoCapitalize="sentences"
            invalid={Boolean(errors.name)}
            testID="input-part-name"
          />
        </Field>

        <FieldRow>
          <Field
            label={`Installed at (${distanceUnitLabel(units.distance)})`}
            flex={1}
            error={errors.installedOdometer ?? null}
          >
            <Input
              value={installedOdometer}
              onChangeText={setInstalledOdometer}
              keyboardType="decimal-pad"
              size="compact"
              invalid={Boolean(errors.installedOdometer)}
              testID="input-installed-odometer"
            />
          </Field>
          <Field
            label={`Expected life (${distanceUnitLabel(units.distance)})`}
            flex={1}
            error={errors.expectedLife ?? null}
          >
            <Input
              value={expectedLife}
              onChangeText={setExpectedLife}
              placeholder="8000"
              keyboardType="decimal-pad"
              size="compact"
              invalid={Boolean(errors.expectedLife)}
              testID="input-expected-life"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Fitted on" flex={1}>
            <DateField
              value={installedDate}
              onChange={setInstalledDate}
              maximumDate={new Date()}
              testID="field-part-date"
            />
          </Field>
          <Field label={`Cost (${currencySymbol(currency)})`} flex={1}>
            <Input
              value={cost}
              onChangeText={setCost}
              placeholder="0"
              keyboardType="decimal-pad"
              size="compact"
              testID="input-part-cost"
            />
          </Field>
        </FieldRow>

        <Field label="Fitted by (optional)">
          <Input
            value={fittedBy}
            onChangeText={setFittedBy}
            placeholder="Rahim Moto Care"
            autoCapitalize="words"
            size="compact"
            testID="input-fitted-by"
          />
        </Field>

        <Field
          label="Link to a service (optional)"
          helper="Linking keeps the cost on that service so it is never counted twice."
        >
          <PickerField
            value={
              linkedService
                ? `${linkedService.title} · ${formatLongDate(linkedService.date)}`
                : null
            }
            placeholder={services.length === 0 ? 'No services recorded yet' : 'Not linked'}
            onPress={() => services.length > 0 && setLinkOpen(true)}
            accessibilityLabel="Link this part to a service"
            testID="field-link-service"
          />
        </Field>

        <Field label="Notes (optional)">
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Batch number, supplier…"
            size="compact"
            testID="input-part-notes"
          />
        </Field>

        <Button
          label={existing ? 'Save changes' : 'Save part'}
          onPress={submit}
          loading={savePart.isPending}
          testID="cta-save-part"
        />

        <Txt role="helper" tone="mut" align="center">
          Linked part costs appear once in the ledger — never double counted.
        </Txt>

        {existing ? (
          <Button
            label="This is an accessory, not a part"
            variant="ghost"
            size="medium"
            onPress={() => setConvertOpen(true)}
            testID="cta-convert-to-accessory"
          />
        ) : null}
      </Stack>

      {existing ? (
        <Dialog
          visible={convertOpen}
          onClose={() => setConvertOpen(false)}
          title="Move to accessories?"
          message={`An accessory is bought once and stays on the bike, so it is left out of cost per distance and of part-wear tracking. This discards ${conversionLosses('partToAccessory', existing).join(', ')}. The cost stays in your history.`}
          confirmLabel="Move"
          busy={recategorise.isPending}
          onConfirm={() => void recategorise.submit({ direction: 'partToAccessory', part: existing })}
          testID="dialog-convert-part"
        />
      ) : null}

      <Sheet visible={linkOpen} onClose={() => setLinkOpen(false)} title="Link to a service">
        <Card variant="flush">
          <MenuRow
            label="Not linked"
            onPress={() => {
              setLinkedServiceId(null);
              setLinkOpen(false);
            }}
            testID="link-none"
          />
          {services.map((service) => (
            <View key={service.id}>
              <Divider />
              <MenuRow
                label={`${service.title} · ${formatLongDate(service.date)}`}
                right={
                  <Txt role="metaSmall" tone="mut">
                    {formatCurrency(service.totalCostMinor, service.currency)}
                  </Txt>
                }
                onPress={() => {
                  setLinkedServiceId(service.id);
                  setLinkOpen(false);
                }}
                testID={`link-service-${service.id}`}
              />
            </View>
          ))}
        </Card>
      </Sheet>
    </Screen>
  );
}
