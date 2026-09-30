import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  Card,
  DateField,
  Divider,
  Input,
  MenuRow,
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
import { useRecategorise } from '@/features/parts/useRecategorise';
import { PartsDialog } from '@/features/parts/ui/PartsDialog';
import { PartsField } from '@/features/parts/ui/PartsField';
import { PartsLinkRow } from '@/features/parts/ui/PartsLinkRow';
import { PartsTypeSwitch } from '@/features/parts/ui/PartsTypeSwitch';
import { partToAccessoryBullets } from '@/features/parts/ui/PartsConversionBullets';
import { useNewPartId, useSavePart } from '@/features/parts/usePartMutations';
import { fromMetres, fromMinor, toMetres, toMinor, toTrimmed } from '@/features/shared/formValues';
import { useStableId } from '@/features/shared/useStableId';
import { fontFamily } from '@/theme';
import type { BikeAnalytics } from '@/calculations/analytics';
import type { Part, UnitPreferences } from '@/types';
import { partSchema } from '@/validation/schemas';
import { formatCurrency } from '@/utils/format';
import { formatLongDate, formatShortDate, todayIso } from '@/utils/date';

/**
 * Add / edit a part.
 *
 * The route waits for data and the form is keyed on the record id, so every
 * field initialises from its final value on the first render — there is no
 * hydration effect anywhere in here.
 *
 * Linking a part to a service is how the ledger stays honest: a linked part's
 * cost lives on the service and produces no second line.
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
  const router = useRouter();
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
  const [convertOpen, setConvertOpen] = useState(false);
  const recategorise = useRecategorise({ onDone: () => setConvertOpen(false) });

  const savePart = useSavePart();
  const services = analytics.services.all;
  const linkedService = services.find((s) => s.id === linkedServiceId) ?? null;

  const paid =
    existing === null || existing.costMinor === 0
      ? 'Nothing was recorded as paid for this part, so Costs is unchanged.'
      : `The ${formatCurrency(existing.costMinor, existing.currency)} you paid stays in Costs — as an accessory it leaves cost / ${distanceLabel}.`;

  /** Switching kind: a new part just changes form, an existing one has to be moved. */
  const chooseType = (next: 'part' | 'accessory') => {
    if (next === 'part') return;
    if (existing) {
      setConvertOpen(true);
      return;
    }
    router.replace('/accessories/add');
  };

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

      <PartsTypeSwitch
        value="part"
        pending={convertOpen ? 'accessory' : null}
        onChange={chooseType}
        testID="segmented-record-type"
      />

      <PartsField label="Name" error={errors.name ?? null} style={{ marginTop: 16 }}>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="e.g. DID chain kit"
          autoCapitalize="sentences"
          padX={14}
          invalid={Boolean(errors.name)}
          testID="input-part-name"
        />
      </PartsField>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
        <PartsField label="Installed odometer" flex={1} error={errors.installedOdometer ?? null}>
          <Input
            value={installedOdometer}
            onChangeText={setInstalledOdometer}
            keyboardType="decimal-pad"
            unit={distanceLabel}
            padX={14}
            invalid={Boolean(errors.installedOdometer)}
            testID="input-installed-odometer"
          />
        </PartsField>
        <PartsField label="Installed date" flex={1}>
          <DateField
            value={installedDate}
            onChange={setInstalledDate}
            maximumDate={new Date()}
            todayLabel={null}
            format={formatShortDate}
            padX={14}
            testID="field-part-date"
          />
        </PartsField>
      </View>

      <Txt role="helper" tone="mut" style={{ marginTop: 8 }}>
        Required — wear is measured from this reading. A guessed one makes the life projection worthless.
      </Txt>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
        <PartsField label="Expected life" optional flex={1} error={errors.expectedLife ?? null}>
          <Input
            value={expectedLife}
            onChangeText={setExpectedLife}
            placeholder="8,000"
            keyboardType="decimal-pad"
            unit={distanceLabel}
            padX={14}
            invalid={Boolean(errors.expectedLife)}
            testID="input-expected-life"
          />
        </PartsField>
        <PartsField label="Cost" optional flex={1}>
          <Input
            value={cost}
            onChangeText={setCost}
            placeholder="0"
            keyboardType="decimal-pad"
            prefix={currencySymbol(currency)}
            padX={14}
            testID="input-part-cost"
          />
        </PartsField>
      </View>

      <PartsLinkRow
        value={
          linkedService ? `${linkedService.title} · ${formatLongDate(linkedService.date)}` : null
        }
        onPress={() => setLinkOpen(true)}
        disabled={services.length === 0}
        style={{ marginTop: 14 }}
        testID="field-link-service"
      />

      {/* Not on the Add board — a part only acquires a fitter and notes once it
          exists, and the detail screen reads both back. */}
      {existing ? (
        <>
          <PartsField label="Fitted by" optional style={{ marginTop: 14 }}>
            <Input
              value={fittedBy}
              onChangeText={setFittedBy}
              placeholder="Rahim Moto Care"
              autoCapitalize="words"
              padX={14}
              testID="input-fitted-by"
            />
          </PartsField>
          <PartsField label="Notes" optional style={{ marginTop: 14 }}>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Batch number, supplier…"
              padX={14}
              testID="input-part-notes"
            />
          </PartsField>
        </>
      ) : null}

      <Button
        label={existing ? 'Save changes' : 'Save part'}
        onPress={submit}
        loading={savePart.isPending}
        style={{ marginTop: 18 }}
        testID="cta-save-part"
      />

      {existing ? (
        <PartsDialog
          visible={convertOpen}
          onClose={() => setConvertOpen(false)}
          title="Move to accessories?"
          confirmLabel="Move it"
          cancelLabel="Keep as part"
          busy={recategorise.isPending}
          onConfirm={() => void recategorise.submit({ direction: 'partToAccessory', part: existing })}
          testID="dialog-convert-part"
        >
          <Txt role="body" tone="mut" style={{ marginTop: 8, lineHeight: 20.15 }}>
            An accessory doesn&rsquo;t wear, so these are{' '}
            <Txt role="body" tone="bad" style={{ fontFamily: fontFamily[700] }}>
              discarded
            </Txt>
            :
          </Txt>
          <View style={{ gap: 8, marginTop: 12 }}>
            {partToAccessoryBullets(existing, units.distance).map((bullet) => (
              <Txt key={bullet} role="body">
                &bull; {bullet}
              </Txt>
            ))}
          </View>
          <Txt role="body" tone="mut" style={{ marginTop: 12, lineHeight: 19.5 }}>
            {paid}
          </Txt>
        </PartsDialog>
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
