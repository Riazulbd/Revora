import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Button,
  Card,
  DateField,
  Dialog,
  Eyebrow,
  Field,
  FieldRow,
  Icon,
  Input,
  Screen,
  ScreenHeader,
  SkeletonList,
  Stack,
  TextArea,
  ToggleRow,
  Txt,
} from '@/components';
import { currencySymbol, currencyDecimals } from '@/calculations/money';
import { distanceUnitLabel } from '@/calculations/units';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useGarageData } from '@/features/bikes/useGarageData';
import { useDeleteService, useNewServiceId, useSaveService } from '@/features/services/useServiceMutations';
import { PhotoField } from '@/features/shared/PhotoField';
import { fromMetres, fromMinor, toMetres, toMinor, toTrimmed } from '@/features/shared/formValues';
import { useGarageContext } from '@/features/shared/useGarageContext';
import { useStableId } from '@/features/shared/useStableId';
import { uploadImageOrKeepLocal } from '@/services/storage';
import type { BikeAnalytics } from '@/calculations/analytics';
import type { ServiceRecord, UnitPreferences } from '@/types';
import { serviceSchema } from '@/validation/schemas';
import { todayIso } from '@/utils/date';
import { useTheme } from '@/theme';

/**
 * Add / edit a service.
 *
 * Ticking a maintenance item resets that rule and records a completion linked to
 * this service — so the work shows in the rule's history while the money stays on
 * the service alone and is counted exactly once (requirement 24 / 28).
 */
export default function ServiceEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const { units } = useGarage();
  const { analytics } = useGarageData();

  if (analytics === null) {
    return (
      <Screen testID="screen-service-add">
        <ScreenHeader title={editingId ? 'Service record' : 'Add service'} />
        <SkeletonList count={4} height={64} />
      </Screen>
    );
  }

  const existing = editingId ? (analytics.services.all.find((s) => s.id === editingId) ?? null) : null;

  return <ServiceForm key={existing?.id ?? 'new'} existing={existing} analytics={analytics} units={units} />;
}

function ServiceForm({
  existing,
  analytics,
  units,
}: {
  existing: ServiceRecord | null;
  analytics: BikeAnalytics;
  units: UnitPreferences;
}) {
  const router = useRouter();
  const { c } = useTheme();
  const garage = useGarageContext();

  const newServiceId = useNewServiceId();
  const generatedId = useStableId(newServiceId);
  const recordId = existing?.id ?? generatedId;

  const currency = existing?.currency ?? analytics.currency;
  const decimals = currencyDecimals(currency);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [selfService, setSelfService] = useState(existing?.selfService ?? false);
  const [workshop, setWorkshop] = useState(existing?.workshop ?? '');
  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [odometer, setOdometer] = useState(
    fromMetres(existing?.odometerMetres ?? analytics.odometer.currentMetres, units.distance),
  );
  const [labour, setLabour] = useState(existing ? fromMinor(existing.labourCostMinor, decimals) : '');
  const [partsCost, setPartsCost] = useState(existing ? fromMinor(existing.partsCostMinor, decimals) : '');
  const [total, setTotal] = useState(existing ? fromMinor(existing.totalCostMinor, decimals) : '');
  const [totalTouched, setTotalTouched] = useState(existing !== null);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [completedRuleIds, setCompletedRuleIds] = useState<string[]>(existing?.completedRuleIds ?? []);
  const [receiptUri, setReceiptUri] = useState<string | null>(existing?.receiptPaths[0] ?? null);
  const [quote, setQuote] = useState(
    existing?.estimate ? fromMinor(existing.estimate.quoteMinor, decimals) : '',
  );
  const [odometerIn, setOdometerIn] = useState(
    fromMetres(existing?.estimate?.odometerInMetres ?? null, units.distance),
  );
  const [odometerOut, setOdometerOut] = useState(
    fromMetres(existing?.estimate?.odometerOutMetres ?? null, units.distance),
  );
  const [askBeforeReplacing, setAskBeforeReplacing] = useState(
    existing?.estimate?.askBeforeReplacing ?? true,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  /**
   * The total follows labour + parts until the rider types their own figure —
   * derived during render rather than pushed in by an effect, so there is no
   * extra render pass and no chance of the two disagreeing.
   */
  const labourMinor = toMinor(labour, currency) ?? 0;
  const partsMinor = toMinor(partsCost, currency) ?? 0;
  const totalValue = totalTouched
    ? total
    : labourMinor + partsMinor > 0
      ? fromMinor(labourMinor + partsMinor, decimals)
      : total;

  const rules = analytics.maintenance.rules;

  const saveService = useSaveService();
  const deleteService = useDeleteService({
    onDeleted: () => {
      setDeleteOpen(false);
      if (router.canGoBack()) router.back();
      else router.replace('/services');
    },
  });

  const toggleRule = (ruleId: string) => {
    setCompletedRuleIds((prev) =>
      prev.includes(ruleId) ? prev.filter((id) => id !== ruleId) : [...prev, ruleId],
    );
  };

  const submit = async () => {
    const next: Record<string, string> = {};

    const totalMinor = toMinor(totalValue, currency) ?? labourMinor + partsMinor;
    const odometerMetres = odometer.trim() === '' ? null : toMetres(odometer, units.distance);
    if (odometer.trim() !== '' && odometerMetres === null) next.odometer = 'Enter the reading.';

    const chosenRules = rules.filter((r) => completedRuleIds.includes(r.rule.id)).map((r) => r.rule);
    const itemsSummary = chosenRules.length > 0 ? chosenRules.map((r) => r.name).join(', ') : null;

    const result = serviceSchema.safeParse({
      title: title.trim(),
      workshop: toTrimmed(workshop),
      selfService,
      date,
      odometerMetres,
      labourCostMinor: labourMinor,
      partsCostMinor: partsMinor,
      totalCostMinor: totalMinor,
      notes: toTrimmed(notes),
      completedRuleIds,
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        next[String(issue.path[0] ?? 'form')] = issue.message;
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // A failed upload keeps the local URI so the photo stays on this device and
    // the service record itself is never blocked by it.
    let receiptPath = receiptUri;
    if (receiptUri && receiptUri.startsWith('file://') && garage) {
      receiptPath = (await uploadImageOrKeepLocal({
        uid: garage.uid,
        kind: 'receipt',
        recordId,
        localUri: receiptUri,
      })).path;
    }

    await saveService.submit({
      id: recordId,
      title: title.trim(),
      workshop: toTrimmed(workshop),
      selfService,
      date,
      odometerMetres,
      labourCostMinor: labourMinor,
      partsCostMinor: partsMinor,
      totalCostMinor: totalMinor,
      notes: toTrimmed(notes),
      itemsSummary,
      completedRules: chosenRules,
      receiptPaths: receiptPath ? [receiptPath] : [],
      estimate: selfService
        ? null
        : {
            quoteMinor: toMinor(quote, currency),
            odometerInMetres: odometerIn.trim() === '' ? null : toMetres(odometerIn, units.distance),
            odometerOutMetres: odometerOut.trim() === '' ? null : toMetres(odometerOut, units.distance),
            askBeforeReplacing,
            approvedWork: chosenRules.map((r) => r.name),
            declinedWork: [],
          },
      ...(existing ? { existing } : {}),
    });
  };

  return (
    <Screen testID="screen-service-add">
      <ScreenHeader title={existing ? 'Service record' : 'Add service'} />

      <Stack gap={14}>
        <Field label="What was done" error={errors.title ?? null}>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="Engine oil & filter change"
            autoCapitalize="sentences"
            invalid={Boolean(errors.title)}
            testID="input-service-title"
          />
        </Field>

        <Card variant="list" style={{ paddingVertical: 4 }}>
          <ToggleRow
            title="Self-service"
            description="Work you did yourself"
            value={selfService}
            onChange={setSelfService}
            testID="toggle-self-service"
          />
        </Card>

        {!selfService ? (
          <Field label="Workshop" error={errors.workshop ?? null}>
            <Input
              value={workshop}
              onChangeText={setWorkshop}
              placeholder="Rahim Moto Care"
              autoCapitalize="words"
              testID="input-workshop"
            />
          </Field>
        ) : null}

        <FieldRow>
          <Field label="Date" flex={1}>
            <DateField value={date} onChange={setDate} maximumDate={new Date()} testID="field-service-date" />
          </Field>
          <Field
            label={`Odometer (${distanceUnitLabel(units.distance)})`}
            flex={1}
            error={errors.odometer ?? null}
          >
            <Input
              value={odometer}
              onChangeText={setOdometer}
              keyboardType="decimal-pad"
              size="compact"
              invalid={Boolean(errors.odometer)}
              testID="input-service-odometer"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label={`Labour (${currencySymbol(currency)})`} flex={1}>
            <Input
              value={labour}
              onChangeText={setLabour}
              placeholder="0"
              keyboardType="decimal-pad"
              size="compact"
              testID="input-labour"
            />
          </Field>
          <Field label={`Parts (${currencySymbol(currency)})`} flex={1}>
            <Input
              value={partsCost}
              onChangeText={setPartsCost}
              placeholder="0"
              keyboardType="decimal-pad"
              size="compact"
              testID="input-parts-cost"
            />
          </Field>
          <Field label={`Total (${currencySymbol(currency)})`} flex={1} error={errors.totalCostMinor ?? null}>
            <Input
              value={totalValue}
              onChangeText={(t) => {
                setTotal(t);
                setTotalTouched(true);
              }}
              placeholder="auto"
              keyboardType="decimal-pad"
              size="compact"
              inset
              testID="input-service-total"
            />
          </Field>
        </FieldRow>

        {rules.length > 0 ? (
          <Card variant="flush" style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <Eyebrow>MAINTENANCE ITEMS COMPLETED</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {rules.map(({ rule }) => {
                const selected = completedRuleIds.includes(rule.id);
                return (
                  <Pressable
                    key={rule.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={rule.name}
                    onPress={() => toggleRule(rule.id)}
                    testID={`service-rule-${rule.id}`}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: selected ? c.acc : c.brd,
                      backgroundColor: selected ? c.accS : c.sur,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    {selected ? <Icon name="check" size={13} color={c.acc} strokeWidth={3} /> : null}
                    <Txt role="kv" color={selected ? c.acc : c.ink}>
                      {rule.name}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
            <Txt role="helper" tone="mut" style={{ marginTop: 10 }}>
              Ticked items reset their maintenance rules automatically. Their cost stays on this service — it is
              never counted twice.
            </Txt>
          </Card>
        ) : null}

        {!selfService ? (
          <Card variant="flush" style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <Eyebrow>ESTIMATE GUARD · OPTIONAL</Eyebrow>
            <Txt role="helper" tone="mut" style={{ marginTop: 6, marginBottom: 12 }}>
              Record the quote so the invoice can be checked against it, and note the odometer in and out.
            </Txt>
            <FieldRow>
              <Field label={`Quote (${currencySymbol(currency)})`} flex={1}>
                <Input
                  value={quote}
                  onChangeText={setQuote}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  size="compact"
                  testID="input-quote"
                />
              </Field>
              <Field label={`Odo in (${distanceUnitLabel(units.distance)})`} flex={1}>
                <Input
                  value={odometerIn}
                  onChangeText={setOdometerIn}
                  keyboardType="decimal-pad"
                  size="compact"
                  testID="input-odo-in"
                />
              </Field>
              <Field label={`Odo out (${distanceUnitLabel(units.distance)})`} flex={1}>
                <Input
                  value={odometerOut}
                  onChangeText={setOdometerOut}
                  keyboardType="decimal-pad"
                  size="compact"
                  testID="input-odo-out"
                />
              </Field>
            </FieldRow>
            <ToggleRow
              title="Ask before replacing parts"
              description="Workshop must confirm extra work with you"
              value={askBeforeReplacing}
              onChange={setAskBeforeReplacing}
              testID="toggle-ask-parts"
            />
          </Card>
        ) : null}

        <Field label="Notes (optional)">
          <TextArea
            value={notes}
            onChangeText={setNotes}
            placeholder="Pads bedded in, front rotor OK…"
            rows={3}
            testID="input-service-notes"
          />
        </Field>

        <PhotoField label="Attach receipt" uri={receiptUri} onChange={setReceiptUri} testID="field-service-receipt" />

        <Button
          label={existing ? 'Save changes' : 'Save service'}
          onPress={submit}
          loading={saveService.isPending}
          testID="cta-save-service"
        />

        {existing ? (
          <Button
            label="Delete service"
            variant="secondary"
            size="medium"
            onPress={() => setDeleteOpen(true)}
            testID="cta-delete-service"
          />
        ) : null}
      </Stack>

      <Dialog
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this service?"
        message="The record and its cost are removed from your ledger. Maintenance rules keep the completion dates they already have."
        confirmLabel="Delete"
        destructive
        busy={deleteService.isPending}
        onConfirm={() => existing && deleteService.submit(existing.id)}
        testID="dialog-delete-service"
      />
    </Screen>
  );
}
