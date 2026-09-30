import React, { useState } from 'react';
import { View } from 'react-native';
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
  TextArea,
  Txt,
} from '@/components';
import { currencySymbol, currencyDecimals } from '@/calculations/money';
import { distanceUnitLabel } from '@/calculations/units';
import { estimateSeverity } from '@/calculations/estimateGuard';
import { serviceMoney } from '@/calculations/serviceMoney';
import { matchingWorkshops } from '@/calculations/workshops';
import { ServiceItemRows, type ItemDraft } from '@/features/services/ServiceItemRows';
import { ServiceChip, ServiceChipRow } from '@/features/services/ui/ServiceChips';
import {
  ServiceDisclosureCard,
  ServiceDisclosureList,
  ServiceDisclosureRow,
} from '@/features/services/ui/ServiceDisclosure';
import { ServiceMoneyField } from '@/features/services/ui/ServiceMoneyField';
import { ServiceTick } from '@/features/services/ui/ServiceTick';
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
import { formatCurrencySymbol } from '@/utils/format';
import { todayIso } from '@/utils/date';

/**
 * Log a service.
 *
 * The board draws the form twice — minimal, with both optional sections closed,
 * and with both open — and both are real states here. Closed, the estimate
 * guard and the maintenance items are two rows in one card; opened, each becomes
 * a card of its own.
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
        <ScreenHeader title={editingId ? 'Service record' : 'Log a service'} />
        <SkeletonList count={4} height={64} />
      </Screen>
    );
  }

  const existing = editingId ? (analytics.services.all.find((s) => s.id === editingId) ?? null) : null;

  return <ServiceForm key={existing?.id ?? 'new'} existing={existing} analytics={analytics} units={units} />;
}

type OpenSection = 'estimate' | 'items' | 'notes';

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
  const garage = useGarageContext();

  const newServiceId = useNewServiceId();
  const generatedId = useStableId(newServiceId);
  const recordId = existing?.id ?? generatedId;

  const currency = existing?.currency ?? analytics.currency;
  const symbol = currencySymbol(currency);
  const decimals = currencyDecimals(currency);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [selfService, setSelfService] = useState(existing?.selfService ?? false);
  const [workshop, setWorkshop] = useState(existing?.workshop ?? '');
  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [odometer, setOdometer] = useState(
    fromMetres(existing?.odometerMetres ?? analytics.odometer.currentMetres, units.distance),
  );
  const [labour, setLabour] = useState(existing ? fromMinor(existing.labourCostMinor, decimals) : '');
  const [total, setTotal] = useState(existing ? fromMinor(existing.totalCostMinor, decimals) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [completedRuleIds, setCompletedRuleIds] = useState<string[]>(existing?.completedRuleIds ?? []);
  const [itemDrafts, setItemDrafts] = useState<Record<string, ItemDraft>>({});
  const [receiptUri, setReceiptUri] = useState<string | null>(existing?.receiptPaths[0] ?? null);
  const [quote, setQuote] = useState(
    existing?.estimate ? fromMinor(existing.estimate.quoteMinor, decimals) : '',
  );
  // The invoice IS the service total: it is what the workshop actually charged.
  const [invoice, setInvoice] = useState(
    existing?.estimate?.quoteMinor != null ? fromMinor(existing.totalCostMinor, decimals) : '',
  );
  const [askBeforeReplacing, setAskBeforeReplacing] = useState(
    existing?.estimate?.askBeforeReplacing ?? true,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [open, setOpen] = useState<readonly OpenSection[]>([]);

  const isOpen = (section: OpenSection) => open.includes(section);
  const openSection = (section: OpenSection) =>
    setOpen((prev) => (prev.includes(section) ? prev : [...prev, section]));
  const closeSection = (section: OpenSection) =>
    setOpen((prev) => prev.filter((entry) => entry !== section));

  // Offered from the rider's own service history, narrowing as they type. The
  // exact match is dropped: once it is typed there is nothing left to suggest.
  const workshopSuggestions = matchingWorkshops(analytics.workshops, workshop).slice(0, 4);
  const fromHistory =
    workshop.trim() !== '' &&
    analytics.workshops.some((name) => name.trim().toLowerCase() === workshop.trim().toLowerCase());

  const rules = analytics.maintenance.rules.map(({ rule }) => ({ id: rule.id, name: rule.name }));

  /**
   * Every figure on this screen is recomputed here on each render — there is no
   * stored total to disagree with its own breakdown (requirement 3).
   */
  const labourMinor = toMinor(labour, currency) ?? 0;
  const quoteMinor = quote.trim() === '' ? null : toMinor(quote, currency);
  const invoiceMinor = invoice.trim() === '' ? null : toMinor(invoice, currency);
  const money = serviceMoney({
    labourMinor,
    itemCostsMinor: completedRuleIds.map((id) => toMinor(itemDrafts[id]?.cost ?? '', currency)),
    invoiceMinor,
    typedTotalMinor: toMinor(total, currency),
  });

  const overrun =
    quoteMinor === null || invoiceMinor === null ? 'neutral' : estimateSeverity(quoteMinor, invoiceMinor);

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

    const odometerMetres = odometer.trim() === '' ? null : toMetres(odometer, units.distance);
    if (odometer.trim() !== '' && odometerMetres === null) next.odometer = 'Enter the reading.';

    const chosenRules = analytics.maintenance.rules
      .filter((r) => completedRuleIds.includes(r.rule.id))
      .map((r) => r.rule);

    // Only lines the rider actually filled in become records; ticking an item
    // without naming a product is a completed job, not a product.
    const items = chosenRules.flatMap((rule) => {
      const draft = itemDrafts[rule.id];
      if (!draft) return [];
      const brand = draft.brand.trim(), product = draft.product.trim(), spec = draft.spec.trim();
      const costMinor = toMinor(draft.cost, currency);
      if (brand === '' && product === '' && spec === '' && costMinor === null) return [];
      return [{
        ruleId: rule.id,
        category: rule.name,
        brand: brand || null,
        product: product || null,
        spec: spec || null,
        quantity: Number(draft.quantity.trim()) > 0 ? Number(draft.quantity.trim()) : 1,
        unit: draft.unit,
        costMinor,
      }];
    });
    const itemsSummary = chosenRules.length > 0 ? chosenRules.map((r) => r.name).join(', ') : null;

    const result = serviceSchema.safeParse({
      title: title.trim(),
      workshop: toTrimmed(workshop),
      selfService,
      date,
      odometerMetres,
      labourCostMinor: money.itemised ? labourMinor : 0,
      partsCostMinor: money.partsMinor,
      totalCostMinor: money.totalMinor,
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
      labourCostMinor: money.itemised ? labourMinor : 0,
      partsCostMinor: money.partsMinor,
      totalCostMinor: money.totalMinor,
      notes: toTrimmed(notes),
      itemsSummary,
      completedRules: chosenRules,
      items,
      existingItems: existing
        ? analytics.serviceItems.filter((item) => item.serviceId === existing.id)
        : undefined,
      receiptPaths: receiptPath ? [receiptPath] : [],
      estimate: selfService
        ? null
        : {
            quoteMinor,
            // Not drawn on the redesign; an existing record keeps what it had.
            odometerInMetres: existing?.estimate?.odometerInMetres ?? null,
            odometerOutMetres: existing?.estimate?.odometerOutMetres ?? null,
            askBeforeReplacing,
            approvedWork: chosenRules.map((r) => r.name),
            declinedWork: [],
          },
      ...(existing ? { existing } : {}),
    });
  };

  const saveLabel =
    money.knownTotalMinor === null
      ? existing
        ? 'Save changes'
        : 'Save service'
      : `${existing ? 'Save changes' : 'Save service'} · ${formatCurrencySymbol(money.knownTotalMinor, currency)}`;

  return (
    <Screen testID="screen-service-add">
      <ScreenHeader title={existing ? 'Service record' : 'Log a service'} backTestID="back-service-add" />

      <Stack gap={14}>
        <FieldRow>
          <Field label="Date" flex={1}>
            <DateField
              value={date}
              onChange={setDate}
              maximumDate={new Date()}
              padX={14}
              testID="field-service-date"
            />
          </Field>
          <Field label="Odometer" flex={1} error={errors.odometer ?? null}>
            <Input
              value={odometer}
              onChangeText={setOdometer}
              keyboardType="decimal-pad"
              unit={distanceUnitLabel(units.distance)}
              padX={14}
              invalid={Boolean(errors.odometer)}
              testID="input-service-odometer"
            />
          </Field>
        </FieldRow>

        <Field label="Workshop" error={errors.workshop ?? null}>
          <Input
            value={selfService ? 'Self-service' : workshop}
            onChangeText={setWorkshop}
            placeholder="Rahim Motors"
            autoCapitalize="words"
            editable={!selfService}
            padX={14}
            {...(fromHistory && !selfService
              ? {
                  trailing: (
                    <Txt role="metaSmall" tone="mut" style={{ marginRight: 14 }}>
                      from your history
                    </Txt>
                  ),
                }
              : {})}
            testID="input-workshop"
          />
          <ServiceChipRow style={{ marginTop: 2 }}>
            {workshopSuggestions.map((name) => (
              <ServiceChip
                key={name}
                label={name}
                onPress={() => {
                  setSelfService(false);
                  setWorkshop(name);
                }}
                testID={`chip-workshop-${name}`}
              />
            ))}
            {/* Work the rider did themselves is a workshop choice, not a
                separate switch — the board draws it as one more chip. */}
            <ServiceChip
              label="Self-service"
              kind={selfService ? 'selected' : 'suggestion'}
              accessibilityLabel="Self-service — work you did yourself"
              onPress={() => {
                setSelfService(!selfService);
                if (!selfService) {
                  setWorkshop('');
                  closeSection('estimate');
                }
              }}
              testID="toggle-self-service"
            />
          </ServiceChipRow>
        </Field>

        <FieldRow>
          <Field label="What was done" flex={1.5} error={errors.title ?? null}>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="Oil change"
              autoCapitalize="sentences"
              padX={14}
              invalid={Boolean(errors.title)}
              testID="input-service-title"
            />
          </Field>
          {/* Priced items and a recorded invoice both answer "what did it come
              to", so the box stops asking for the total and asks for labour. */}
          {money.itemised ? (
            <Field label="Labour" flex={1}>
              <Input
                value={labour}
                onChangeText={setLabour}
                placeholder="0"
                keyboardType="decimal-pad"
                prefix={symbol}
                padX={14}
                testID="input-labour"
              />
            </Field>
          ) : (
            <Field label="Total cost" flex={1} error={errors.totalCostMinor ?? null}>
              <Input
                value={total}
                onChangeText={setTotal}
                placeholder="0"
                keyboardType="decimal-pad"
                prefix={symbol}
                padX={14}
                testID="input-service-total"
              />
            </Field>
          )}
        </FieldRow>

        {/* Closed, the optional sections are rows in one card; opened, each is a
            card of its own. Both shapes are on the boards. */}
        <ServiceDisclosureList testID="service-sections">
          {!selfService && !isOpen('estimate') ? (
            <ServiceDisclosureRow
              title="Estimate guard"
              subtitle="Record the quote, compare the invoice"
              onPress={() => openSection('estimate')}
              testID="open-estimate-guard"
            />
          ) : null}
          {rules.length > 0 && !isOpen('items') ? (
            <ServiceDisclosureRow
              title="Maintenance items completed"
              subtitle="Ticks reset the rules"
              onPress={() => openSection('items')}
              testID="open-maintenance-items"
            />
          ) : null}
          {!isOpen('notes') ? (
            <ServiceDisclosureRow
              title="Notes and receipt"
              subtitle="Kept with this service"
              onPress={() => openSection('notes')}
              testID="open-service-notes"
            />
          ) : null}
        </ServiceDisclosureList>

        {!selfService && isOpen('estimate') ? (
          <ServiceDisclosureCard
            eyebrow="ESTIMATE GUARD"
            onClose={() => closeSection('estimate')}
            testID="card-estimate-guard"
          >
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ServiceMoneyField
                label="Quoted"
                value={quote}
                onChangeText={setQuote}
                prefix={symbol}
                size="compact"
                inset
                testID="input-quote"
              />
              <ServiceMoneyField
                label="Invoice"
                value={invoice}
                onChangeText={setInvoice}
                prefix={symbol}
                size="compact"
                inset
                tone={overrun === 'neutral' ? 'ink' : overrun}
                testID="input-invoice"
              />
            </View>
            <ServiceTick
              label="Ask before replacing parts"
              checked={askBeforeReplacing}
              onChange={setAskBeforeReplacing}
              testID="toggle-ask-parts"
            />
            {overrun === 'bad' || overrun === 'warn' ? (
              <Txt role="helper" tone={overrun}>
                {overrun === 'bad'
                  ? 'The invoice is well over the quote — worth asking what changed.'
                  : 'The invoice is a little over the quote.'}
              </Txt>
            ) : null}
          </ServiceDisclosureCard>
        ) : null}

        {rules.length > 0 && isOpen('items') ? (
          <ServiceDisclosureCard
            eyebrow="MAINTENANCE ITEMS COMPLETED"
            onClose={() => closeSection('items')}
            gap={12}
            testID="card-maintenance-items"
          >
            <ServiceItemRows
              rules={rules}
              completedRuleIds={completedRuleIds}
              onToggle={toggleRule}
              drafts={itemDrafts}
              onChange={(ruleId, draft) => setItemDrafts((prev) => ({ ...prev, [ruleId]: draft }))}
              products={analytics.products}
              currencySymbol={symbol}
            />
            <Txt role="helper" tone="mut">
              Each tick resets that rule&rsquo;s next due point from today&rsquo;s odometer.
            </Txt>
          </ServiceDisclosureCard>
        ) : null}

        {isOpen('notes') ? (
          <ServiceDisclosureCard
            eyebrow="NOTES AND RECEIPT"
            onClose={() => closeSection('notes')}
            gap={12}
            testID="card-service-notes"
          >
            <TextArea
              value={notes}
              onChangeText={setNotes}
              placeholder="Pads bedded in, front rotor OK…"
              rows={3}
              testID="input-service-notes"
            />
            <PhotoField
              label="Attach receipt"
              uri={receiptUri}
              onChange={setReceiptUri}
              testID="field-service-receipt"
            />
          </ServiceDisclosureCard>
        ) : null}

        <Button
          label={saveLabel}
          size="xlarge"
          onPress={submit}
          loading={saveService.isPending}
          style={{ marginTop: 4 }}
          testID="cta-save-service"
        />

        {existing ? (
          <Button
            label="Delete service"
            variant="dangerSubtle"
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
