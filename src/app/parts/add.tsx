import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import {
  Banner,
  Button,
  Card,
  DateField,
  Divider,
  Field,
  FieldRow,
  Input,
  MenuRow,
  PickerRow,
  RowIcon,
  Screen,
  ScreenHeader,
  Sheet,
  SkeletonList,
  Txt,
} from '@/components';
import { currencySymbol, currencyDecimals } from '@/calculations/money';
import { distanceUnitLabel } from '@/calculations/units';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useNewPartId, useSavePart } from '@/features/parts/usePartMutations';
import { fromMetres, fromMinor, toMetres, toMinor, toTrimmed } from '@/features/shared/formValues';
import { useStableId } from '@/features/shared/useStableId';
import type { BikeAnalytics } from '@/calculations/analytics';
import type { Part, UnitPreferences } from '@/types';
import { partSchema } from '@/validation/schemas';
import { formatCurrencySymbol } from '@/utils/format';
import { formatFullDate, formatLongDate, formatShortDate, todayIso } from '@/utils/date';

/**
 * Add / edit a part (Figma `D8 Parts — Add part`).
 *
 * The route waits for data and the form is keyed on the record id, so every
 * field initialises from its final value on the first render — there is no
 * hydration effect anywhere in here.
 *
 * Linking a part to a service is how the ledger stays honest: a linked part's
 * cost lives on the service and produces no second line. Turning a part into
 * an accessory happens on the part itself, where what the move throws away can
 * be listed.
 */
export default function PartEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const { units } = useGarage();
  const { analytics } = useGarageData();

  if (analytics === null) {
    return (
      <Screen testID="screen-part-add" contentStyle={{ gap: 16 }}>
        <ScreenHeader title={editingId ? 'Edit part' : 'Add part'} icon="x" style={{ marginBottom: 0 }} />
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
  const distanceLabel = distanceUnitLabel(units.distance);

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
    <Screen testID="screen-part-add" contentStyle={{ gap: 16 }}>
      <ScreenHeader title={existing ? 'Edit part' : 'Add part'} icon="x" style={{ marginBottom: 0 }} />

      {/* Figma `Intro`: what makes this a part rather than an accessory. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <RowIcon icon="wrench" tone="accent" size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt role="cardTitle">A part that wears out</Txt>
          <Txt role="bodySmall" tone="mut">
            Give it an expected life and Revora tracks wear from the odometer.
          </Txt>
        </View>
      </View>

      {/* Figma `Form card`. */}
      <Card style={{ gap: 14 }} testID="card-part-form">
        <Field label="Name" error={errors.name ?? null}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="DID chain kit"
            autoCapitalize="sentences"
            invalid={Boolean(errors.name)}
            testID="input-part-name"
          />
        </Field>

        <FieldRow gap={10}>
          <Field label="Installed odometer" flex={1} error={errors.installedOdometer ?? null}>
            <Input
              value={installedOdometer}
              onChangeText={setInstalledOdometer}
              keyboardType="decimal-pad"
              unit={distanceLabel}
              invalid={Boolean(errors.installedOdometer)}
              testID="input-installed-odometer"
            />
          </Field>
          <Field label="Installed date" flex={1}>
            <DateField
              value={installedDate}
              onChange={setInstalledDate}
              maximumDate={new Date()}
              todayLabel={null}
              format={formatLongDate}
              weight="regular"
              trailingIcon="calendar"
              testID="field-part-date"
            />
          </Field>
        </FieldRow>

        <FieldRow gap={10}>
          <Field label="Expected life" optional flex={1} error={errors.expectedLife ?? null}>
            <Input
              value={expectedLife}
              onChangeText={setExpectedLife}
              placeholder="8,000"
              keyboardType="decimal-pad"
              unit={distanceLabel}
              invalid={Boolean(errors.expectedLife)}
              testID="input-expected-life"
            />
          </Field>
          <Field label="Cost" optional flex={1}>
            <Input
              value={cost}
              onChangeText={setCost}
              placeholder="0"
              keyboardType="decimal-pad"
              prefix={currencySymbol(currency)}
              testID="input-part-cost"
            />
          </Field>
        </FieldRow>

        <Txt role="helper" tone="mut">
          No expected life? Leave it blank — the part is still logged, just without a wear bar.
        </Txt>

        {/* Not on the Add board — a part only acquires a fitter and notes once it
            exists, and the detail screen reads both back. */}
        {existing ? (
          <>
            <Field label="Fitted by" optional>
              <Input
                value={fittedBy}
                onChangeText={setFittedBy}
                placeholder="Rahim Moto Care"
                autoCapitalize="words"
                testID="input-fitted-by"
              />
            </Field>
            <Field label="Notes" optional>
              <Input value={notes} onChangeText={setNotes} placeholder="Batch number, supplier…" testID="input-part-notes" />
            </Field>
          </>
        ) : null}
      </Card>

      {/* Figma `Link to a service`: the one control that decides where the cost is counted. */}
      <Card variant="list" style={{ paddingVertical: 4 }}>
        <PickerRow
          leading={<RowIcon icon="link2" tone="info" />}
          label="Link to a service"
          value={linkedService ? `${linkedService.title} · ${formatFullDate(linkedService.date)}` : null}
          placeholder={services.length === 0 ? 'No services logged yet' : 'Not linked'}
          onPress={() => setLinkOpen(true)}
          disabled={services.length === 0}
          accessibilityLabel="Link this part to a service"
          testID="field-link-service"
        />
      </Card>

      {/* Figma `Ledger note`. */}
      <Banner
        variant="soft"
        tone="neutral"
        message={
          linkedService
            ? 'Linked to a service, this part’s cost sits on that visit — it appears once in your ledger.'
            : 'Link it to a service and its cost sits on that visit; on its own, it is one line in your ledger.'
        }
        testID="note-part-ledger"
      />

      <Button
        label={existing ? 'Save changes' : 'Save part'}
        size="xlarge"
        onPress={submit}
        loading={savePart.isPending}
        testID="cta-save-part"
      />

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
                label={`${service.title} · ${formatShortDate(service.date)}`}
                right={
                  <Txt role="metaSmall" tone="mut">
                    {formatCurrencySymbol(service.totalCostMinor, service.currency)}
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
