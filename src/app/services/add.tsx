import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  AmountHero,
  Button,
  Card,
  DateField,
  Dialog,
  IconSquareButton,
  Input,
  InputRow,
  ListCard,
  Screen,
  ScreenHeader,
  SkeletonList,
  TextArea,
  Txt,
} from '@/components';
import { currencySymbol, currencyDecimals } from '@/calculations/money';
import { distanceUnitLabel } from '@/calculations/units';
import { estimateSeverity } from '@/calculations/estimateGuard';
import { serviceMoney } from '@/calculations/serviceMoney';
import { matchingWorkshops } from '@/calculations/workshops';
import { describeTickLine } from '@/features/maintenance/describeRule';
import { ServiceItemRows, type ItemDraft, type ItemRule } from '@/features/services/ServiceItemRows';
import { WorkshopChip } from '@/features/services/ui/ServiceChips';
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
import { useImagePicker } from '@/features/shared/useImagePicker';
import { useStableId } from '@/features/shared/useStableId';
import { uploadImageOrKeepLocal } from '@/services/storage';
import type { BikeAnalytics } from '@/calculations/analytics';
import type { ServiceRecord, UnitPreferences } from '@/types';
import { serviceSchema } from '@/validation/schemas';
import { formatCurrencySymbol } from '@/utils/format';
import { formatShortDate, todayIso } from '@/utils/date';

/**
 * Log a service (Figma `D5 Services — Log a service`).
 *
 * The total sits at the top as the amount hero. Once the parts are itemised —
 * a maintenance item carries a price, or the estimate guard recorded an
 * invoice — the hero turns into a derived figure with a chip saying what it is
 * made of, and the fields card asks for labour instead; there is no second
 * "total" box to disagree with its own breakdown.
 *
 * The optional sections are two rows in one card while closed and a card of
 * their own while open — both shapes are on the board. Ticking a maintenance
 * item resets that rule and records a completion linked to this service, so
 * the work shows in the rule's history while the money stays on the service
 * alone and is counted exactly once (requirement 24 / 28).
 */
export default function ServiceEditorRoute() {
  const { id: editingId } = useLocalSearchParams<{ id?: string }>();
  const { units } = useGarage();
  const { analytics } = useGarageData();

  if (analytics === null) {
    return (
      <Screen testID="screen-service-add" contentStyle={{ gap: 16 }}>
        <ScreenHeader title={editingId ? 'Service record' : 'Log a service'} icon="x" style={{ marginBottom: 0 }} />
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
  const picker = useImagePicker();

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
  // The board opens with the maintenance items showing; a rider with no rules
  // has nothing to tick, so the section is simply absent.
  const [open, setOpen] = useState<readonly OpenSection[]>(() => {
    const sections: OpenSection[] = [];
    if (analytics.maintenance.rules.length > 0) sections.push('items');
    if (existing?.estimate?.quoteMinor != null) sections.push('estimate');
    if (existing?.notes || existing?.receiptPaths.length) sections.push('notes');
    return sections;
  });

  const isOpen = (section: OpenSection) => open.includes(section);
  const openSection = (section: OpenSection) =>
    setOpen((prev) => (prev.includes(section) ? prev : [...prev, section]));
  const closeSection = (section: OpenSection) =>
    setOpen((prev) => prev.filter((entry) => entry !== section));

  // Offered from the rider's own service history. While they type something
  // new the chips narrow to what still matches; once a chip is chosen the
  // whole short list stays, with that one lit.
  const fromHistory =
    workshop.trim() !== '' &&
    analytics.workshops.some((name) => name.trim().toLowerCase() === workshop.trim().toLowerCase());
  const workshopChips = (fromHistory || workshop.trim() === ''
    ? analytics.workshops
    : matchingWorkshops(analytics.workshops, workshop)
  ).slice(0, 4);

  const itemRules: ItemRule[] = analytics.maintenance.rules.map(({ rule, status }) => ({
    id: rule.id,
    name: rule.name,
    standing: describeTickLine(rule, status, units, false),
    resets: describeTickLine(rule, status, units, true).label,
  }));

  /**
   * Every figure on this screen is recomputed here on each render — there is no
   * stored total to disagree with its own breakdown (requirement 3).
   */
  const labourMinor = toMinor(labour, currency) ?? 0;
  const quoteMinor = quote.trim() === '' ? null : toMinor(quote, currency);
  const invoiceMinor = invoice.trim() === '' ? null : toMinor(invoice, currency);
  const pricedItems = completedRuleIds.map((id) => toMinor(itemDrafts[id]?.cost ?? '', currency));
  const money = serviceMoney({
    labourMinor,
    itemCostsMinor: pricedItems,
    invoiceMinor,
    typedTotalMinor: toMinor(total, currency),
  });
  const pricedCount = pricedItems.filter((cost) => cost !== null && cost > 0).length;

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

  const scanReceipt = async () => {
    const uri = await picker.choose('Receipt');
    if (!uri) return;
    setReceiptUri(uri);
    openSection('notes');
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

  // Figma `Calc chip`: what the derived total is made of.
  const calcChip =
    invoiceMinor !== null
      ? `Invoice ${formatCurrencySymbol(invoiceMinor, currency)}${quoteMinor === null ? '' : ` · quoted ${formatCurrencySymbol(quoteMinor, currency)}`}`
      : money.itemised
        ? `Labour ${formatCurrencySymbol(labourMinor, currency)} + ${pricedCount} item${pricedCount === 1 ? '' : 's'} ${formatCurrencySymbol(money.partsMinor, currency)}`
        : null;

  const totalError = errors.totalCostMinor;

  return (
    <Screen testID="screen-service-add" contentStyle={{ gap: 16 }}>
      <ScreenHeader
        title={existing ? 'Service record' : 'Log a service'}
        icon="x"
        backTestID="back-service-add"
        action={
          <IconSquareButton icon="camera" accessibilityLabel="Scan receipt" onPress={() => void scanReceipt()} testID="cta-scan-receipt" />
        }
        style={{ marginBottom: 0 }}
      />

      {/* Figma `Amount hero`: typed while nothing is itemised, derived once it is. */}
      <AmountHero
        label="Total cost"
        symbol={symbol}
        size="medium"
        value={money.itemised ? fromMinor(money.totalMinor, decimals) : total}
        onChangeText={setTotal}
        editable={!money.itemised}
        {...(calcChip === null ? {} : { chip: { label: calcChip, testID: 'chip-service-calc' } })}
        {...(totalError === undefined ? {} : { error: totalError })}
        accessibilityLabel="Total cost"
        testID="input-service-total"
      />

      {/* Figma `Fields`. */}
      <ListCard testID="card-service-fields">
        <DateField
          variant="row"
          icon="calendar"
          label="Date"
          value={date}
          onChange={setDate}
          maximumDate={new Date()}
          todayLabel="Today, "
          format={formatShortDate}
          testID="field-service-date"
        />
        <InputRow
          icon="gauge"
          label="Odometer"
          value={odometer}
          onChangeText={setOdometer}
          keyboardType="decimal-pad"
          unit={distanceUnitLabel(units.distance)}
          invalid={Boolean(errors.odometer)}
          {...(errors.odometer === undefined ? {} : { hint: errors.odometer, hintTone: 'bad' as const })}
          testID="input-service-odometer"
        />
        <InputRow
          icon="wrench"
          label="What was done"
          value={title}
          onChangeText={setTitle}
          placeholder="Brake pads"
          autoCapitalize="sentences"
          invalid={Boolean(errors.title)}
          {...(errors.title === undefined ? {} : { hint: errors.title, hintTone: 'bad' as const })}
          testID="input-service-title"
        />
        {/* Priced items and a recorded invoice both answer "what did it come
            to", so the card stops asking for the total and asks for labour. */}
        {money.itemised ? (
          <InputRow
            icon="banknote"
            label="Labour"
            value={labour}
            onChangeText={setLabour}
            placeholder="0"
            keyboardType="decimal-pad"
            prefix={symbol}
            testID="input-labour"
          />
        ) : null}
      </ListCard>

      {/* Figma `Workshop card`. */}
      <Card style={{ gap: 10 }} testID="card-workshop">
        <Txt role="fieldLabel" tone="mut">
          Workshop
        </Txt>
        <Input
          value={selfService ? 'Self-service' : workshop}
          onChangeText={(next) => {
            setSelfService(false);
            setWorkshop(next);
          }}
          placeholder="Rahim Motors"
          autoCapitalize="words"
          leadingIcon="building"
          editable={!selfService}
          invalid={Boolean(errors.workshop)}
          {...(fromHistory && !selfService
            ? {
                trailing: (
                  <Txt role="meta" tone="mut" style={{ marginRight: 14 }}>
                    from your history
                  </Txt>
                ),
              }
            : {})}
          testID="input-workshop"
        />
        {errors.workshop ? (
          <Txt role="micro" tone="bad">
            {errors.workshop}
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {workshopChips.map((name) => (
            <WorkshopChip
              key={name}
              label={name}
              selected={!selfService && workshop.trim().toLowerCase() === name.trim().toLowerCase()}
              onPress={() => {
                setSelfService(false);
                setWorkshop(name);
              }}
              testID={`chip-workshop-${name}`}
            />
          ))}
          {/* Work the rider did themselves is a workshop choice, not a
              separate switch — the board draws it as one more chip. */}
          <WorkshopChip
            label="Self-service"
            icon="user"
            selected={selfService}
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
        </View>
      </Card>

      {/* Figma `Items card`: open, the ticks with the rule's standing under each. */}
      {itemRules.length > 0 && isOpen('items') ? (
        <ServiceDisclosureCard
          eyebrow="Maintenance items completed"
          onClose={() => closeSection('items')}
          gap={4}
          testID="card-maintenance-items"
        >
          <ServiceItemRows
            rules={itemRules}
            completedRuleIds={completedRuleIds}
            onToggle={toggleRule}
            drafts={itemDrafts}
            onChange={(ruleId, draft) => setItemDrafts((prev) => ({ ...prev, [ruleId]: draft }))}
            products={analytics.products}
            currencySymbol={symbol}
          />
          <Txt role="helper" tone="mut" style={{ marginTop: 8 }}>
            Each tick resets that rule&rsquo;s next due point from today&rsquo;s odometer.
          </Txt>
        </ServiceDisclosureCard>
      ) : null}

      {!selfService && isOpen('estimate') ? (
        <ServiceDisclosureCard eyebrow="Estimate guard" onClose={() => closeSection('estimate')} testID="card-estimate-guard">
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

      {isOpen('notes') ? (
        <ServiceDisclosureCard eyebrow="Notes and receipt" onClose={() => closeSection('notes')} gap={12} testID="card-service-notes">
          <TextArea
            value={notes}
            onChangeText={setNotes}
            placeholder="Pads bedded in, front rotor OK…"
            rows={3}
            testID="input-service-notes"
          />
          <PhotoField label="Attach receipt" uri={receiptUri} onChange={setReceiptUri} testID="field-service-receipt" />
        </ServiceDisclosureCard>
      ) : null}

      {/* Figma `Sections`: whatever is still closed, as rows in one card. */}
      <ServiceDisclosureList testID="service-sections">
        {!selfService && !isOpen('estimate') ? (
          <ServiceDisclosureRow
            icon="shieldCheck"
            title="Estimate guard"
            subtitle="Record the quote, compare the invoice"
            onPress={() => openSection('estimate')}
            testID="open-estimate-guard"
          />
        ) : null}
        {itemRules.length > 0 && !isOpen('items') ? (
          <ServiceDisclosureRow
            icon="check"
            title="Maintenance items completed"
            subtitle="Ticks reset the rules"
            onPress={() => openSection('items')}
            testID="open-maintenance-items"
          />
        ) : null}
        {!isOpen('notes') ? (
          <ServiceDisclosureRow
            icon="receipt"
            title="Notes and receipt"
            subtitle="Kept with this service"
            onPress={() => openSection('notes')}
            testID="open-service-notes"
          />
        ) : null}
      </ServiceDisclosureList>

      <Button
        label={existing ? 'Save changes' : 'Save service'}
        size="xlarge"
        onPress={submit}
        loading={saveService.isPending}
        testID="cta-save-service"
      />

      {existing ? (
        <Button
          label="Delete service"
          icon="trash"
          variant="dangerSubtle"
          size="large"
          onPress={() => setDeleteOpen(true)}
          testID="cta-delete-service"
        />
      ) : null}

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
