import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Badge,
  Button,
  Card,
  DateField,
  Dialog,
  DividedList,
  Field,
  FieldRow,
  Input,
  KeyValueRow,
  Screen,
  ScreenHeader,
  Sheet,
  SkeletonList,
  Stack,
  ToggleRow,
  Txt,
  Segmented,
  type SegmentedOption,
} from '@/components';
import type { BikeAnalytics, RuleWithStatus } from '@/calculations/analytics';
import { defaultWarnAheadDays, defaultWarnAheadMetres, STATUS_LABEL } from '@/calculations/maintenance';
import { distanceUnitLabel } from '@/calculations/units';
import { currencySymbol } from '@/calculations/money';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { describeLastCompleted } from '@/features/maintenance/describeRule';
import type { CompletionReason } from '@/features/maintenance/useMaintenanceMutations';
import { useCompleteRule, useDeleteRule, useNewRuleId, useSaveRule } from '@/features/maintenance/useMaintenanceMutations';
import { fromMetres, toInteger, toMetres, toMinor, toTrimmed } from '@/features/shared/formValues';
import { useStableId } from '@/features/shared/useStableId';
import type { UnitPreferences } from '@/types';
import { maintenanceRuleSchema } from '@/validation/schemas';
import { formatDistance } from '@/utils/format';
import { todayIso } from '@/utils/date';

/**
 * Add / edit a maintenance rule, and mark it complete.
 *
 * Marking complete writes a completion row *and* moves the rule's next due
 * point. A cost entered here lands in the ledger exactly once, because the
 * completion is not linked to a service (requirement 23).
 */
const REASON_OPTIONS: readonly SegmentedOption<CompletionReason>[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'unscheduled', label: 'Off-schedule' },
];

export default function RuleEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const { units } = useGarage();
  const { analytics } = useGarageData();

  if (analytics === null) {
    return (
      <Screen testID="screen-rule">
        <ScreenHeader title={editingId ? 'Maintenance rule' : 'New rule'} />
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

  return <RuleForm key={entry?.rule.id ?? 'new'} entry={entry} analytics={analytics} units={units} />;
}

function RuleForm({
  entry,
  analytics,
  units,
}: {
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

  const [completeOpen, setCompleteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [completionDate, setCompletionDate] = useState(todayIso());
  const [completionOdometer, setCompletionOdometer] = useState(
    fromMetres(currentOdometer, units.distance),
  );
  const [completionCost, setCompletionCost] = useState('');
  const [completionWorkshop, setCompletionWorkshop] = useState('');
  const [completionReason, setCompletionReason] = useState<CompletionReason>('routine');
  const [completionBrand, setCompletionBrand] = useState('');
  const [completionSpec, setCompletionSpec] = useState('');

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

  const confirmComplete = async () => {
    if (!existing) return;
    const metres = toMetres(completionOdometer, units.distance);
    await completeRule.submit({
      rule: existing,
      date: completionDate,
      odometerMetres: metres ?? currentOdometer ?? 0,
      costMinor: toMinor(completionCost, currency),
      workshop: toTrimmed(completionWorkshop),
      notes: null,
      serviceId: null,
      reason: completionReason,
      items:
        completionBrand.trim() === '' && completionSpec.trim() === ''
          ? []
          : [{
              ruleId: existing.id,
              category: existing.name,
              brand: completionBrand.trim() || null,
              product: null,
              spec: completionSpec.trim() || null,
              quantity: 1,
              unit: 'piece' as const,
              costMinor: toMinor(completionCost, currency),
            }],
    });
  };

  const nextDueLine = (() => {
    if (!existing || !entry) return null;
    const metres = toMetres(completionOdometer, units.distance) ?? currentOdometer;
    if (metres === null || existing.intervalMetres === null) return null;
    return `The next due point moves to ${formatDistance(metres + existing.intervalMetres, units.distance)}.`;
  })();

  return (
    <Screen testID="screen-rule">
      <ScreenHeader
        title={existing ? 'Maintenance rule' : 'New rule'}
        badge={entry ? <Badge label={STATUS_LABEL[entry.status.kind]} tone="neutral" /> : undefined}
      />

      <Stack gap={14}>
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

        <FieldRow>
          <Field
            label={`Every (${distanceUnitLabel(units.distance)})`}
            flex={1}
            error={errors.intervalDistance ?? null}
          >
            <Input
              value={intervalDistance}
              onChangeText={setIntervalDistance}
              placeholder="3000"
              keyboardType="decimal-pad"
              size="compact"
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
              size="compact"
              invalid={Boolean(errors.intervalDays)}
              testID="input-interval-days"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field
            label={`Warn ahead (${distanceUnitLabel(units.distance)})`}
            flex={1}
            error={errors.warnDistance ?? null}
          >
            <Input
              value={warnDistance}
              onChangeText={setWarnDistance}
              placeholder="300"
              keyboardType="decimal-pad"
              size="compact"
              testID="input-warn-distance"
            />
          </Field>
          <Field label="Warn ahead (days)" flex={1} error={errors.warnDays ?? null}>
            <Input
              value={warnDays}
              onChangeText={setWarnDays}
              placeholder="14"
              keyboardType="number-pad"
              size="compact"
              testID="input-warn-days"
            />
          </Field>
        </FieldRow>

        <Card variant="list" style={{ paddingVertical: 4 }}>
          <ToggleRow
            title="Reminders on"
            description="Turn a rule off without deleting its history"
            value={enabled}
            onChange={setEnabled}
            testID="toggle-rule-enabled"
          />
        </Card>

        {existing ? (
          <Card variant="list">
            <DividedList>
              <KeyValueRow label="Last completed" value={describeLastCompleted(existing, units)} />
              {entry?.status.dueAtMetres !== null && entry?.status.dueAtMetres !== undefined ? (
                <KeyValueRow
                  label="Next due at"
                  value={formatDistance(entry.status.dueAtMetres, units.distance)}
                />
              ) : null}
            </DividedList>
          </Card>
        ) : null}

        <Field label="Notes (optional)">
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Which oil, which filter…"
            size="compact"
            testID="input-rule-notes"
          />
        </Field>

        {existing ? (
          <Button
            label={
              currentOdometer === null
                ? 'Mark completed'
                : `Mark completed at ${formatDistance(currentOdometer, units.distance)}`
            }
            variant="secondary"
            onPress={() => setCompleteOpen(true)}
            testID="cta-mark-done"
          />
        ) : null}

        <Button
          label="Save rule"
          onPress={submit}
          loading={saveRule.isPending}
          testID="cta-save-rule"
        />

        {existing ? (
          <Button
            label="Delete rule"
            variant="secondary"
            size="medium"
            onPress={() => setDeleteOpen(true)}
            testID="cta-delete-rule"
          />
        ) : null}
      </Stack>

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

      <CompletionSheet
        visible={completeOpen}
        onClose={() => setCompleteOpen(false)}
        ruleName={existing?.name ?? ''}
        nextDueLine={nextDueLine}
        date={completionDate}
        onDateChange={setCompletionDate}
        odometer={completionOdometer}
        onOdometerChange={setCompletionOdometer}
        cost={completionCost}
        onCostChange={setCompletionCost}
        workshop={completionWorkshop}
        onWorkshopChange={setCompletionWorkshop}
        currencyLabel={currencySymbol(currency)}
        distanceLabel={distanceUnitLabel(units.distance)}
        busy={completeRule.isPending}
        reason={completionReason}
        onReasonChange={setCompletionReason}
        brand={completionBrand}
        onBrandChange={setCompletionBrand}
        spec={completionSpec}
        onSpecChange={setCompletionSpec}
        onConfirm={confirmComplete}
      />
    </Screen>
  );
}

function CompletionSheet(props: {
  visible: boolean;
  onClose: () => void;
  ruleName: string;
  nextDueLine: string | null;
  date: string;
  onDateChange: (next: string) => void;
  odometer: string;
  onOdometerChange: (next: string) => void;
  cost: string;
  onCostChange: (next: string) => void;
  workshop: string;
  onWorkshopChange: (next: string) => void;
  currencyLabel: string;
  distanceLabel: string;
  busy: boolean;
  reason: CompletionReason;
  onReasonChange: (next: CompletionReason) => void;
  brand: string;
  onBrandChange: (next: string) => void;
  spec: string;
  onSpecChange: (next: string) => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet visible={props.visible} onClose={props.onClose} title="Mark completed" testID="sheet-complete">
      <View style={{ gap: 14 }}>
        <Txt role="body" tone="mut">
          &ldquo;{props.ruleName}&rdquo; will be recorded as done.{' '}
          {props.nextDueLine ?? 'The next due point moves forward by the rule’s interval.'}
        </Txt>

        <FieldRow>
          <Field label="Date" flex={1}>
            <DateField value={props.date} onChange={props.onDateChange} maximumDate={new Date()} />
          </Field>
          <Field label={`Odometer (${props.distanceLabel})`} flex={1}>
            <Input
              value={props.odometer}
              onChangeText={props.onOdometerChange}
              keyboardType="decimal-pad"
              size="compact"
              testID="input-completion-odometer"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label={`Cost (${props.currencyLabel}, optional)`} flex={1}>
            <Input
              value={props.cost}
              onChangeText={props.onCostChange}
              placeholder="0"
              keyboardType="decimal-pad"
              size="compact"
              testID="input-completion-cost"
            />
          </Field>
          <Field label="Workshop (optional)" flex={1}>
            <Input
              value={props.workshop}
              onChangeText={props.onWorkshopChange}
              placeholder="Self-service"
              size="compact"
              testID="input-completion-workshop"
            />
          </Field>
        </FieldRow>

        <Field label="Why">
          <Segmented options={REASON_OPTIONS} value={props.reason} onChange={props.onReasonChange} testID="segmented-reason" />
        </Field>

        <FieldRow>
          <Field label="Brand (optional)" flex={1}>
            <Input value={props.brand} onChangeText={props.onBrandChange} placeholder="AMSOIL" size="compact" autoCapitalize="words" testID="input-completion-brand" />
          </Field>
          <Field label="Grade (optional)" flex={1}>
            <Input value={props.spec} onChangeText={props.onSpecChange} placeholder="10W-30" size="compact" testID="input-completion-spec" />
          </Field>
        </FieldRow>

        <Txt role="helper" tone="mut">
          This is saved to your service history, so an oil change done outside the schedule is recorded like any
          other work. Its cost appears once in the ledger.
        </Txt>

        <Button
          label="Mark done"
          onPress={props.onConfirm}
          loading={props.busy}
          testID="cta-confirm-complete"
        />
      </View>
    </Sheet>
  );
}
