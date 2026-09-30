import React, { useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  DateField,
  Field,
  FieldRow,
  Segmented,
  Sheet,
  Txt,
  type SegmentedOption,
} from '@/components';
import type { IsoDate } from '@/types';
import { useTheme } from '@/theme';
import { MaintenanceGlyph, type MaintenanceGlyphName } from './MaintenanceGlyph';
import { MaintenanceInlineField, MaintenanceNumberField } from './MaintenanceFields';
import { MaintenancePicker, type PickerOption } from './MaintenancePicker';

/**
 * Marking a rule done.
 *
 * The sheet's subtitle is the whole argument for its shape: *"Early or late is
 * fine — next due resets from what you enter."* A rider who changed the oil
 * 300 km late should not be nudged into lying about the odometer to keep a
 * schedule tidy, so the date and the reading are both editable and the next due
 * point is recomputed from them rather than from the schedule.
 *
 * Saving writes a real service record, which is why the brand, the quantity and
 * the price are here: an oil change done in the yard is the same event as one
 * done at a workshop, and the rider should be able to ask the same questions of
 * it a year later.
 */

export type CompletionPlace = 'workshop' | 'self';

const PLACE_OPTIONS: readonly SegmentedOption<CompletionPlace>[] = [
  { value: 'workshop', label: 'Workshop' },
  { value: 'self', label: 'Self-service' },
];

/** "Engine oil" → "Mark engine oil done"; "ABS sensor" keeps its capitals. */
function sentenceCase(name: string): string {
  const first = name.charAt(0);
  const second = name.charAt(1);
  if (first !== first.toLowerCase() && second !== '' && second === second.toLowerCase()) {
    return `${first.toLowerCase()}${name.slice(1)}`;
  }
  return name;
}

export function MaintenanceCompletionSheet(props: {
  visible: boolean;
  onClose: () => void;
  ruleName: string;
  glyph: MaintenanceGlyphName;

  date: IsoDate;
  onDateChange: (next: IsoDate) => void;

  odometer: string;
  onOdometerChange: (next: string) => void;
  distanceLabel: string;

  place: CompletionPlace;
  onPlaceChange: (next: CompletionPlace) => void;

  /** Workshops the rider has actually used, most recent first. */
  workshopOptions: readonly PickerOption[];
  workshopKey: string | null;
  onWorkshopKeyChange: (next: string | null) => void;
  workshopCustom: string;
  onWorkshopCustomChange: (next: string) => void;

  /** Brands from the rider's own service items — never a catalogue. */
  brandOptions: readonly PickerOption[];
  brandKey: string | null;
  onBrandKeyChange: (next: string | null) => void;
  brandCustom: string;
  onBrandCustomChange: (next: string) => void;
  brandPlaceholder: string;

  quantity: string;
  onQuantityChange: (next: string) => void;
  quantityUnit: string;

  cost: string;
  onCostChange: (next: string) => void;
  currencyLabel: string;

  /** "The next due point moves to 8,000 km." — recomputed from what is typed. */
  nextDueLine: string | null;

  busy: boolean;
  onConfirm: () => void;
}) {
  const { c } = useTheme();
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);

  return (
    <Sheet
      visible={props.visible}
      onClose={props.onClose}
      title={`Mark ${sentenceCase(props.ruleName)} done`}
      subtitle="Early or late is fine — next due resets from what you enter."
      subtitleSize="small"
      testID="sheet-complete"
    >
      <FieldRow>
        <Field label="Date" flex={1}>
          <DateField
            value={props.date}
            onChange={props.onDateChange}
            maximumDate={new Date()}
            inset="bg"
            padX={14}
            accessibilityLabel="Completion date"
            testID="picker-completion-date"
          />
        </Field>
        <Field label="Odometer" flex={1}>
          <MaintenanceNumberField
            value={props.odometer}
            onChangeText={props.onOdometerChange}
            unit={props.distanceLabel}
            accessibilityLabel={`Odometer in ${props.distanceLabel}`}
            testID="input-completion-odometer"
          />
        </Field>
      </FieldRow>

      <Segmented
        options={PLACE_OPTIONS}
        value={props.place}
        onChange={props.onPlaceChange}
        size="medium"
        style={{ marginTop: 14 }}
        testID="segmented-completion-place"
      />

      {/* Self-service has no workshop to name, and an empty "Workshop" box
          under a "Self-service" tab is a question the rider already answered. */}
      {props.place === 'workshop' ? (
        <View style={{ marginTop: 10 }}>
          <MaintenancePicker
            options={props.workshopOptions}
            selectedKey={props.workshopKey}
            onSelect={props.onWorkshopKeyChange}
            open={workshopOpen}
            onOpenChange={setWorkshopOpen}
            custom={props.workshopCustom}
            onCustomChange={props.onWorkshopCustomChange}
            customPlaceholder="Which workshop?"
            otherLabel="Other — type a workshop"
            backLabel="Pick one you’ve used before"
            placeholder="Which workshop?"
            height={48}
            inset="bg"
            accessibilityLabel="Workshop"
            testID="picker-completion-workshop"
            inputTestID="input-completion-workshop"
          />
        </View>
      ) : null}

      <Txt role="smallStrong" tone="mut" style={{ marginTop: 16, marginBottom: 8 }}>
        {`${props.ruleName} brand`}
      </Txt>

      <MaintenancePicker
        options={props.brandOptions}
        selectedKey={props.brandKey}
        onSelect={props.onBrandKeyChange}
        open={brandOpen}
        onOpenChange={setBrandOpen}
        custom={props.brandCustom}
        onCustomChange={props.onBrandCustomChange}
        customPlaceholder={props.brandPlaceholder}
        otherLabel="Other — type a brand"
        backLabel="Pick one you’ve used before"
        placeholder="Which brand went in?"
        leading={<MaintenanceGlyph name={props.glyph} size={16} color={c.acc} />}
        accessibilityLabel={`${props.ruleName} brand`}
        testID="picker-completion-brand"
        inputTestID="input-completion-brand"
      />

      <Txt role="helper" tone="mut" style={{ marginTop: 8 }}>
        Brands you’ve logged before sort first — nothing is suggested that you haven’t used.
      </Txt>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <MaintenanceInlineField
          label="Qty"
          value={props.quantity}
          onChangeText={props.onQuantityChange}
          suffix={props.quantityUnit}
          placeholder="0"
          testID="input-completion-quantity"
        />
        <MaintenanceInlineField
          label="Price"
          value={props.cost}
          onChangeText={props.onCostChange}
          prefix={props.currencyLabel}
          placeholder="0"
          testID="input-completion-cost"
        />
      </View>

      <Txt role="helper" tone="mut" style={{ marginTop: 12 }} testID="hint-completion-writes">
        {`Saving writes a real service record — it lands in Costs under Service and resets this rule.${
          props.nextDueLine === null ? '' : ` ${props.nextDueLine}`
        }`}
      </Txt>

      <Button
        label="Save completion"
        onPress={props.onConfirm}
        loading={props.busy}
        style={{ marginTop: 12 }}
        testID="cta-confirm-complete"
      />
    </Sheet>
  );
}
