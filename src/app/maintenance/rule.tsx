import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { View } from 'react-native';

import {
  Button,
  Callout,
  Card,
  Dialog,
  Divider,
  Eyebrow,
  Field,
  FieldRow,
  Input,
  KeyValueRow,
  ListCard,
  RowIcon,
  Screen,
  ScreenHeader,
  SkeletonList,
  TextArea,
  Toggle,
  Txt,
} from '@/components';
import type { BikeAnalytics, RuleWithStatus } from '@/calculations/analytics';
import { brandChoices } from '@/calculations/brandChoices';
import { defaultWarnAheadDays, defaultWarnAheadMetres } from '@/calculations/maintenance';
import { currencySymbol } from '@/calculations/money';
import { placeholdersFor } from '@/calculations/products';
import { distanceUnitLabel, volumeUnitLabel } from '@/calculations/units';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { describeLastCompleted, describeStatusBanner } from '@/features/maintenance/describeRule';
import { glyphForRule, isFluidGlyph } from '@/features/maintenance/ui/MaintenanceGlyph';
import {
  MaintenanceCompletionSheet,
  type CompletionPlace,
} from '@/features/maintenance/ui/MaintenanceCompletionSheet';
import type { PickerOption } from '@/features/maintenance/ui/MaintenancePicker';
import { useCompleteRule, useDeleteRule, useNewRuleId, useSaveRule } from '@/features/maintenance/useMaintenanceMutations';
import { fromMetres, toInteger, toMetres, toMinor, toMl, toTrimmed } from '@/features/shared/formValues';
import { useStableId } from '@/features/shared/useStableId';
import type { ServiceItemUnit, UnitPreferences } from '@/types';
import { maintenanceRuleSchema } from '@/validation/schemas';
import { formatDistance } from '@/utils/format';
import { formatShortDate, todayIso } from '@/utils/date';

/**
 * Add / edit a maintenance rule, and mark it complete (Figma `D3 Maintenance
 * — Rule editor`).
 *
 * Marking complete writes a completion row *and* moves the rule's next due
 * point. A cost entered here lands in the ledger exactly once, because the
 * completion is not linked to a service (requirement 23).
 */
export default function RuleEditorRoute() {
  const { id: editingId, complete } = useLocalSearchParams<{ id?: string; complete?: string }>();
  const { units } = useGarage();
  const { analytics } = useGarageData();

  if (analytics === null) {
    return (
      <Screen testID="screen-rule" contentStyle={{ gap: 16 }}>
        <ScreenHeader title={editingId ? 'Maintenance rule' : 'New rule'} icon="x" style={{ marginBottom: 0 }} />
        <SkeletonList count={4} height={64} />
      </Screen>
    );
  }

  // Look in both lists: a disabled rule must still open for editing, or it can
  // never be turned back on.
  const entry = editingId
    ? ([...analytics.maintenance.rules, ...analytics.maintenance.disabled].find(
        (r) => r.rule.id === editingId,
      ) ?? null)
    : null;

  return (
    <RuleForm
      key={entry?.rule.id ?? 'new'}
      entry={entry}
      analytics={analytics}
      units={units}
      openCompletion={complete === '1' && entry !== null}
    />
  );
}

function RuleForm({
  openCompletion = false,
  entry,
  analytics,
  units,
}: {
  /** Open the completion sheet on arrival — the attention card's Mark done. */
  openCompletion?: boolean;
  entry: RuleWithStatus | null;
  analytics: BikeAnalytics;
  units: UnitPreferences;
}) {
  const router = useRouter();
  const existing = entry?.rule ?? null;

  const newRuleId = useNewRuleId();
  const generatedId = useStableId(newRuleId);
  const recordId = existing?.id ?? generatedId;

  const currency = analytics.currency;
  const currentOdometer = analytics.odometer.currentMetres;
  const ruleName = existing?.name ?? '';
  const glyph = glyphForRule(ruleName);

  // Everything offered in the completion sheet comes from the rider's own
  // history — the workshops they have used and the products they have fitted.
  // There is no catalogue behind either list, which is what lets the sheet
  // promise that nothing is suggested that they have not used.
  const workshopOptions: PickerOption[] = analytics.workshops.map((name) => ({
    key: name,
    label: name,
    note: 'from your history',
  }));
  const brandOptions = brandChoices(analytics.products, ruleName, analytics.today);

  const [name, setName] = useState(existing?.name ?? '');
  const [intervalDistance, setIntervalDistance] = useState(
    fromMetres(existing?.intervalMetres ?? null, units.distance),
  );
  const [intervalDays, setIntervalDays] = useState(
    existing?.intervalDays === null || existing?.intervalDays === undefined ? '' : String(existing.intervalDays),
  );
  const [warnDistance, setWarnDistance] = useState(
    existing ? fromMetres(existing.warnAheadMetres, units.distance) : '',
  );
  const [warnDays, setWarnDays] = useState(existing ? String(existing.warnAheadDays) : '');
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [completeOpen, setCompleteOpen] = useState(openCompletion);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [completionDate, setCompletionDate] = useState(todayIso());
  const [completionOdometer, setCompletionOdometer] = useState(
    fromMetres(currentOdometer, units.distance),
  );
  const [completionCost, setCompletionCost] = useState('');
  const [completionQuantity, setCompletionQuantity] = useState('');
  const [place, setPlace] = useState<CompletionPlace>(workshopOptions.length > 0 ? 'workshop' : 'self');
  const [workshopKey, setWorkshopKey] = useState<string | null>(workshopOptions[0]?.key ?? null);
  const [workshopCustom, setWorkshopCustom] = useState('');
  const [brandKey, setBrandKey] = useState<string | null>(brandOptions[0]?.key ?? null);
  const [brandCustom, setBrandCustom] = useState('');

  const saveRule = useSaveRule();
  const deleteRule = useDeleteRule({
    onDeleted: () => {
      setDeleteOpen(false);
      if (router.canGoBack()) router.back();
      else router.replace('/maintenance');
    },
  });
  const completeRule = useCompleteRule({ onCompleted: () => setCompleteOpen(false) });

  const submit = async () => {
    const next: Record<string, string> = {};

    const intervalMetres = intervalDistance.trim() === '' ? null : toMetres(intervalDistance, units.distance);
    if (intervalDistance.trim() !== '' && intervalMetres === null) next.intervalDistance = 'Enter a distance.';

    const days = intervalDays.trim() === '' ? null : toInteger(intervalDays);
    if (intervalDays.trim() !== '' && days === null) next.intervalDays = 'Enter a number of days.';

    // A rule with neither interval can never fall due, so marking it complete
    // changes nothing a rider can see — which reads as a broken button. There
    // is no such thing as a schedule without an interval.
    if (intervalMetres === null && days === null) {
      next.intervalDistance = 'Set a distance or a time interval — a rule needs at least one.';
    }

    const warnMetres = warnDistance.trim() === '' ? null : toMetres(warnDistance, units.distance);
    if (warnDistance.trim() !== '' && warnMetres === null) next.warnDistance = 'Enter a distance.';

    const warnDayCount = warnDays.trim() === '' ? null : toInteger(warnDays);
    if (warnDays.trim() !== '' && warnDayCount === null) next.warnDays = 'Enter a number of days.';

    const result = maintenanceRuleSchema.safeParse({
      name: name.trim(),
      intervalMetres,
      intervalDays: days,
      warnAheadMetres: warnMetres ?? (intervalMetres !== null ? defaultWarnAheadMetres(intervalMetres) : 0),
      warnAheadDays: warnDayCount ?? (days !== null ? defaultWarnAheadDays(days) : 0),
      enabled,
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        next[key === 'intervalMetres' ? 'intervalDistance' : key] = issue.message;
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    await saveRule.submit({
      id: recordId,
      name: name.trim(),
      intervalMetres,
      intervalDays: days,
      warnAheadMetres: warnMetres,
      warnAheadDays: warnDayCount,
      enabled,
      notes: toTrimmed(notes),
      ...(existing ? { existing } : {}),
    });
  };

  // Fluids are recorded in litres, everything else in pieces — the unit the
  // rider would write on the receipt.
  const fluid = isFluidGlyph(glyph);
  const itemUnit: ServiceItemUnit = fluid ? 'litre' : 'piece';
  const quantityUnit = fluid ? volumeUnitLabel(units.volume) : 'pcs';

  const chosenBrand = brandOptions.find((choice) => choice.key === brandKey) ?? null;

  const confirmComplete = async () => {
    if (!existing) return;
    const metres = toMetres(completionOdometer, units.distance);
    const costMinor = toMinor(completionCost, currency);

    const workshop = place === 'self' ? null : (workshopKey ?? toTrimmed(workshopCustom));

    const typedBrand = toTrimmed(brandCustom);
    const item =
      chosenBrand !== null
        ? {
            brand: chosenBrand.product.brand,
            product: chosenBrand.product.product,
            spec: chosenBrand.product.spec,
          }
        : typedBrand !== null
          ? { brand: typedBrand, product: null, spec: null }
          : null;

    const quantity = fluid
      ? (toMl(completionQuantity, units.volume) ?? 0) / 1000
      : (toInteger(completionQuantity) ?? 0);

    await completeRule.submit({
      rule: existing,
      date: completionDate,
      odometerMetres: metres ?? currentOdometer ?? 0,
      costMinor,
      workshop,
      notes: null,
      serviceId: null,
      items:
        item === null
          ? []
          : [
              {
                ruleId: existing.id,
                category: existing.name,
                brand: item.brand,
                product: item.product,
                spec: item.spec,
                quantity: quantity > 0 ? quantity : 1,
                unit: itemUnit,
                costMinor,
              },
            ],
    });
  };

  const nextDueLine = (() => {
    if (!existing || !entry) return null;
    const metres = toMetres(completionOdometer, units.distance) ?? currentOdometer;
    if (metres === null || existing.intervalMetres === null) return null;
    return `The next due point moves to ${formatDistance(metres + existing.intervalMetres, units.distance)}.`;
  })();


  const banner = entry ? describeStatusBanner(entry.rule, entry.status, units, currentOdometer) : null;
  const distanceUnit = distanceUnitLabel(units.distance);

  return (
    <Screen testID="screen-rule" contentStyle={{ gap: 16 }}>
      <ScreenHeader title={existing ? 'Maintenance rule' : 'New rule'} icon="x" style={{ marginBottom: 0 }} />

      {/* Figma `Status banner`: where the rule stands, in its own colour. */}
      {banner ? (
        <Callout
          tone={banner.tone === 'neutral' ? 'neutral' : banner.tone}
          icon={banner.tone === 'bad' ? 'circleAlert' : banner.tone === 'warn' ? 'clock' : banner.tone === 'good' ? 'circleCheck' : 'calendar'}
          title={banner.title}
          body={banner.body}
          bodyTone="tone"
          style={{ padding: 14 }}
          testID="banner-rule-status"
        />
      ) : null}

      {/* Figma `Name card`. */}
      <Card style={{ gap: 6 }}>
        <Field label="Rule name" error={errors.name ?? null}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Engine oil & filter"
            autoCapitalize="sentences"
            invalid={Boolean(errors.name)}
            testID="input-rule-name"
          />
        </Field>
      </Card>

      {/* Figma `Interval card`: the interval pair, then the warn-ahead pair. */}
      <Card style={{ gap: 12 }} testID="card-interval">
        <Eyebrow>Interval</Eyebrow>
        <FieldRow gap={10}>
          <Field label={`Every (${distanceUnit})`} flex={1} error={errors.intervalDistance ?? null}>
            <Input
              value={intervalDistance}
              onChangeText={setIntervalDistance}
              placeholder="3,000"
              keyboardType="decimal-pad"
              weight="bold"
              unit={distanceUnit}
              invalid={Boolean(errors.intervalDistance)}
              testID="input-interval-distance"
            />
          </Field>
          <Field label="Or every (days)" flex={1} error={errors.intervalDays ?? null}>
            <Input
              value={intervalDays}
              onChangeText={setIntervalDays}
              placeholder="180"
              keyboardType="number-pad"
              weight="bold"
              unit="days"
              invalid={Boolean(errors.intervalDays)}
              testID="input-interval-days"
            />
          </Field>
        </FieldRow>
        <Txt role="helper" tone="mut">
          Whichever comes first. A rule needs at least one.
        </Txt>
        <Divider />
        <Eyebrow>Warn ahead</Eyebrow>
        <FieldRow gap={10}>
          <Field label={`Warn ahead (${distanceUnit})`} flex={1} error={errors.warnDistance ?? null}>
            <Input
              value={warnDistance}
              onChangeText={setWarnDistance}
              placeholder="300"
              keyboardType="decimal-pad"
              weight="bold"
              unit={distanceUnit}
              testID="input-warn-distance"
            />
          </Field>
          <Field label="Warn ahead (days)" flex={1} error={errors.warnDays ?? null}>
            <Input
              value={warnDays}
              onChangeText={setWarnDays}
              placeholder="14"
              keyboardType="number-pad"
              weight="bold"
              unit="days"
              testID="input-warn-days"
            />
          </Field>
        </FieldRow>
      </Card>

      {/* Figma `Reminder card`. */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} testID="card-reminders">
        <RowIcon icon="bell" tone="accent" />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt role="rowTitleLarge">{enabled ? 'Reminders on' : 'Reminders off'}</Txt>
          <Txt role="meta" tone="mut">
            Turn a rule off without deleting its history
          </Txt>
        </View>
        <Toggle value={enabled} onChange={setEnabled} accessibilityLabel="Reminders" testID="toggle-rule-enabled" />
      </Card>

      {/* Figma `History card`. */}
      {existing ? (
        <ListCard testID="card-rule-history">
          <KeyValueRow label="Last completed" value={describeLastCompleted(existing, units)} />
          {entry?.status.dueAtMetres !== null && entry?.status.dueAtMetres !== undefined ? (
            <KeyValueRow
              label="Next due at"
              value={`${formatDistance(entry.status.dueAtMetres, units.distance)}${
                entry.status.dueOnDate ? ` or ${formatShortDate(entry.status.dueOnDate)}` : ''
              }`}
              valueTone={entry.status.kind === 'overdue' ? 'bad' : entry.status.kind === 'due_soon' ? 'warn' : 'ink'}
            />
          ) : entry?.status.dueOnDate ? (
            <KeyValueRow
              label="Next due"
              value={formatShortDate(entry.status.dueOnDate)}
              valueTone={entry.status.kind === 'overdue' ? 'bad' : entry.status.kind === 'due_soon' ? 'warn' : 'ink'}
            />
          ) : null}
        </ListCard>
      ) : null}

      {/* Figma `Notes card`. */}
      <Card style={{ gap: 6 }}>
        <Field label="Notes (optional)">
          <TextArea
            value={notes}
            onChangeText={setNotes}
            placeholder="Which oil, which filter…"
            rows={2}
            testID="input-rule-notes"
          />
        </Field>
      </Card>

      {existing ? (
        <Button
          label="Mark completed"
          icon="check"
          variant="secondary"
          size="xlarge"
          onPress={() => setCompleteOpen(true)}
          testID="cta-mark-done"
        />
      ) : null}

      <Button label="Save rule" size="xlarge" onPress={submit} loading={saveRule.isPending} testID="cta-save-rule" />

      {existing ? (
        <Button
          label="Delete rule"
          icon="trash"
          variant="ghost"
          tone="bad"
          size="medium"
          onPress={() => setDeleteOpen(true)}
          testID="cta-delete-rule"
        />
      ) : null}

      <Dialog
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this rule?"
        message="The rule and its schedule go away. Completions already recorded stay in your history."
        confirmLabel="Delete"
        destructive
        busy={deleteRule.isPending}
        onConfirm={() => existing && deleteRule.submit(existing.id)}
        testID="dialog-delete-rule"
      />

      <MaintenanceCompletionSheet
        visible={completeOpen}
        onClose={() => setCompleteOpen(false)}
        ruleName={ruleName}
        glyph={glyph}
        date={completionDate}
        onDateChange={setCompletionDate}
        odometer={completionOdometer}
        onOdometerChange={setCompletionOdometer}
        distanceLabel={distanceUnitLabel(units.distance)}
        place={place}
        onPlaceChange={setPlace}
        workshopOptions={workshopOptions}
        workshopKey={workshopKey}
        onWorkshopKeyChange={setWorkshopKey}
        workshopCustom={workshopCustom}
        onWorkshopCustomChange={setWorkshopCustom}
        brandOptions={brandOptions}
        brandKey={brandKey}
        onBrandKeyChange={setBrandKey}
        brandCustom={brandCustom}
        onBrandCustomChange={setBrandCustom}
        brandPlaceholder={placeholdersFor(ruleName).brand}
        quantity={completionQuantity}
        onQuantityChange={setCompletionQuantity}
        quantityUnit={quantityUnit}
        cost={completionCost}
        onCostChange={setCompletionCost}
        currencyLabel={currencySymbol(currency)}
        nextDueLine={nextDueLine}
        busy={completeRule.isPending}
        onConfirm={confirmComplete}
      />
    </Screen>
  );
}
