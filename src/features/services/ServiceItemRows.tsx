import React, { useState } from 'react';
import { View } from 'react-native';

import { Input } from '@/components';
import { describeProduct, placeholdersFor, productsFor } from '@/calculations/products';
import { serviceItemUnit } from '@/calculations/serviceCategories';
import { ServiceChip, ServiceChipRow } from '@/features/services/ui/ServiceChips';
import { ServiceMoneyField } from '@/features/services/ui/ServiceMoneyField';
import { ServiceTick } from '@/features/services/ui/ServiceTick';
import { useTheme } from '@/theme';
import type { KnownProduct, ServiceItemUnit } from '@/types';

/**
 * Maintenance items completed — the list inside the opened card on the board.
 *
 * A ticked item opens into its own box: the tick and the item's name, the
 * products the rider has used for it before as chips, `+ Other` for one they
 * have not, and what it cost. An unticked item stays a single muted line, so
 * ticking five items does not turn the screen into an accounting form.
 *
 * Every field is optional. A rider who only wants to record that the oil was
 * changed ticks the item and fills in nothing; one who wants to know in two
 * years which oil is in the bike and what it cost fills it in.
 */
export type ItemDraft = {
  brand: string;
  product: string;
  spec: string;
  quantity: string;
  cost: string;
  unit: ServiceItemUnit;
};

export const emptyItemDraft = (): ItemDraft => ({
  brand: '', product: '', spec: '', quantity: '', cost: '', unit: 'piece',
});

export function ServiceItemRows({
  rules,
  completedRuleIds,
  onToggle,
  drafts,
  onChange,
  products,
  currencySymbol,
}: {
  rules: readonly { id: string; name: string }[];
  completedRuleIds: readonly string[];
  onToggle: (ruleId: string) => void;
  drafts: Record<string, ItemDraft>;
  onChange: (ruleId: string, draft: ItemDraft) => void;
  products: readonly KnownProduct[];
  /** The symbol stuck to a price, e.g. `৳`. */
  currencySymbol: string;
}) {
  const { c, radius } = useTheme();
  // "+ Other" opens the boxes for a product that is not in the rider's history.
  const [manualIds, setManualIds] = useState<readonly string[]>([]);

  if (rules.length === 0) return null;

  return (
    <View style={{ gap: 12 }}>
      {rules.map((rule) => {
        const ticked = completedRuleIds.includes(rule.id);
        const draft = drafts[rule.id] ?? emptyItemDraft();

        // Unticked: one muted line with an empty box, as the board draws it.
        if (!ticked) {
          return (
            <View key={rule.id} style={{ paddingTop: 2, paddingHorizontal: 2 }}>
              <ServiceTick
                label={rule.name}
                checked={false}
                onChange={() => onToggle(rule.id)}
                testID={`service-rule-${rule.id}`}
              />
            </View>
          );
        }

        const suggestions = productsFor(products, rule.name).slice(0, 3);
        // The boxes prompt with something plausible for THIS item — a tyre row
        // asking for a 10W-30 grade tells the rider they are on the wrong row.
        const hints = placeholdersFor(rule.name);
        const byLitre = serviceItemUnit(rule.name) === 'litre';
        const manual = manualIds.includes(rule.id);
        // With nothing to pick from, the box for the product is simply there.
        const typing = manual || suggestions.length === 0;

        const productBox = (
          <Input
            value={draft.product}
            onChangeText={(next) => onChange(rule.id, { ...draft, product: next })}
            placeholder={hints.product}
            size="micro"
            padX={12}
            autoCapitalize="words"
            accessibilityLabel={`Product fitted for ${rule.name}`}
            testID={`input-product-${rule.id}`}
          />
        );

        return (
          <View
            key={rule.id}
            style={{
              borderRadius: radius.input,
              backgroundColor: c.bg,
              borderWidth: 1,
              borderColor: c.brd,
              paddingVertical: 12,
              paddingHorizontal: 14,
              gap: 10,
            }}
          >
            <ServiceTick
              label={rule.name}
              checked
              strong
              onChange={() => onToggle(rule.id)}
              testID={`service-rule-${rule.id}`}
            />

            {suggestions.length > 0 ? (
              <ServiceChipRow>
                {suggestions.map((known) => {
                  const label = describeProduct(known);
                  const chosen =
                    !manual &&
                    (known.brand ?? '') === draft.brand &&
                    (known.product ?? '') === draft.product &&
                    (known.spec ?? '') === draft.spec;
                  return (
                    <ServiceChip
                      key={label}
                      label={label}
                      kind={chosen ? 'selected' : 'suggestion'}
                      onPress={() => {
                        setManualIds((prev) => prev.filter((id) => id !== rule.id));
                        onChange(rule.id, {
                          ...draft,
                          brand: known.brand ?? '',
                          product: known.product ?? '',
                          spec: known.spec ?? '',
                          unit: byLitre ? 'litre' : 'piece',
                        });
                      }}
                      testID={`product-chip-${rule.id}-${label}`}
                    />
                  );
                })}
                <ServiceChip
                  label="+ Other"
                  kind="outline"
                  selected={manual}
                  accessibilityLabel={`Record another product for ${rule.name}`}
                  onPress={() => {
                    setManualIds((prev) => (prev.includes(rule.id) ? prev : [...prev, rule.id]));
                    onChange(rule.id, { ...draft, brand: '', product: '', spec: '' });
                  }}
                  testID={`product-other-${rule.id}`}
                />
              </ServiceChipRow>
            ) : null}

            {/* A fluid is bought by the litre, so the board asks how much went
                in; a part is one thing, so it asks which one. */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {byLitre ? (
                <ServiceMoneyField
                  label="Qty"
                  value={draft.quantity}
                  onChangeText={(next) => onChange(rule.id, { ...draft, quantity: next, unit: 'litre' })}
                  placeholder="1"
                  unit="L"
                  testID={`input-quantity-${rule.id}`}
                />
              ) : typing ? (
                <View style={{ flex: 1.4 }}>{productBox}</View>
              ) : null}
              <ServiceMoneyField
                label="Price"
                value={draft.cost}
                onChangeText={(next) => onChange(rule.id, { ...draft, cost: next })}
                prefix={currencySymbol}
                testID={`input-cost-${rule.id}`}
              />
            </View>

            {byLitre && typing ? productBox : null}

            {/* The brand and the grade are what the Products-fitted search and
                the chips above are built from, so a rider with nothing in their
                history yet still needs a way to record them. */}
            {typing ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={draft.brand}
                    onChangeText={(next) => onChange(rule.id, { ...draft, brand: next })}
                    placeholder={hints.brand}
                    size="micro"
                    padX={12}
                    autoCapitalize="words"
                    accessibilityLabel={`Brand for ${rule.name}`}
                    testID={`input-brand-${rule.id}`}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    value={draft.spec}
                    onChangeText={(next) => onChange(rule.id, { ...draft, spec: next })}
                    placeholder={hints.spec}
                    size="micro"
                    padX={12}
                    accessibilityLabel={`Grade or part number for ${rule.name}`}
                    testID={`input-spec-${rule.id}`}
                  />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
