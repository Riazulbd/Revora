import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Divider, Field, FieldRow, Icon, Input, Txt } from '@/components';
import { describeProduct, productsFor } from '@/calculations/products';
import { useTheme } from '@/theme';
import type { CurrencyCode, KnownProduct, ServiceItemUnit } from '@/types';

/**
 * What was actually fitted, under each maintenance item that was ticked.
 *
 * Every field is optional. A rider who only wants to record that the oil was
 * changed ticks the item and never opens this; one who wants to know in two
 * years which oil is in the bike and what it cost fills it in. The row stays
 * collapsed until there is something to say, so ticking five items does not
 * turn the screen into an accounting form.
 *
 * Products the rider has used before for that same item appear as chips, so the
 * second oil change is two taps rather than retyping a brand and a grade.
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
  items,
  drafts,
  onChange,
  products,
  currencyLabel,
  currency,
}: {
  items: readonly { id: string; name: string }[];
  drafts: Record<string, ItemDraft>;
  onChange: (ruleId: string, draft: ItemDraft) => void;
  products: readonly KnownProduct[];
  currencyLabel: string;
  currency: CurrencyCode;
}) {
  const { c, radius } = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <View style={{ gap: 10 }}>
      {items.map((item) => {
        const draft = drafts[item.id] ?? emptyItemDraft();
        const summary = describeProduct({
          brand: draft.brand.trim() || null,
          product: draft.product.trim() || null,
          spec: draft.spec.trim() || null,
        });
        const open = openId === item.id;
        const suggestions = productsFor(products, item.name).slice(0, 4);

        return (
          <View
            key={item.id}
            style={{
              borderWidth: 1,
              borderColor: c.brd,
              borderRadius: radius.listCard,
              backgroundColor: c.sur,
              overflow: 'hidden',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={`${item.name}. ${summary === '' ? 'No product recorded' : summary}`}
              onPress={() => setOpenId(open ? null : item.id)}
              style={{
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
              testID={`service-item-${item.id}`}
            >
              <View style={{ flex: 1 }}>
                <Txt role="rowTitle">{item.name}</Txt>
                <Txt role="metaSmall" tone="mut" numberOfLines={1}>
                  {summary === '' ? 'Add the product used — optional' : summary}
                </Txt>
              </View>
              {draft.cost.trim() !== '' ? (
                <Txt role="smallStrong">{`${currencyLabel}${draft.cost.trim()}`}</Txt>
              ) : null}
              <Icon name={open ? 'chevronDown' : 'chevronRight'} size={15} color={c.mut} strokeWidth={2} />
            </Pressable>

            {open ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 12 }}>
                <Divider />

                {suggestions.length > 0 ? (
                  <View style={{ gap: 7 }}>
                    <Txt role="micro" tone="mut">USED BEFORE</Txt>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {suggestions.map((known) => (
                        <Pressable
                          key={describeProduct(known)}
                          accessibilityRole="button"
                          onPress={() =>
                            onChange(item.id, {
                              ...draft,
                              brand: known.brand ?? '',
                              product: known.product ?? '',
                              spec: known.spec ?? '',
                            })
                          }
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 999,
                            backgroundColor: c.sur2,
                            borderWidth: 1,
                            borderColor: c.brd,
                          }}
                          testID={`product-chip-${item.id}-${known.brand ?? 'unnamed'}`}
                        >
                          <Txt role="metaSmall">{describeProduct(known)}</Txt>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                <FieldRow>
                  <Field label="Brand" flex={1}>
                    <Input
                      value={draft.brand}
                      onChangeText={(next) => onChange(item.id, { ...draft, brand: next })}
                      placeholder="AMSOIL"
                      size="compact"
                      autoCapitalize="words"
                      testID={`input-brand-${item.id}`}
                    />
                  </Field>
                  <Field label="Grade or part no." flex={1}>
                    <Input
                      value={draft.spec}
                      onChangeText={(next) => onChange(item.id, { ...draft, spec: next })}
                      placeholder="10W-30"
                      size="compact"
                      testID={`input-spec-${item.id}`}
                    />
                  </Field>
                </FieldRow>

                <Field label="Product">
                  <Input
                    value={draft.product}
                    onChangeText={(next) => onChange(item.id, { ...draft, product: next })}
                    placeholder="Metric Motorcycle Oil"
                    size="compact"
                    testID={`input-product-${item.id}`}
                  />
                </Field>

                <FieldRow>
                  <Field label="Quantity" flex={1}>
                    <Input
                      value={draft.quantity}
                      onChangeText={(next) => onChange(item.id, { ...draft, quantity: next })}
                      placeholder="1"
                      keyboardType="decimal-pad"
                      size="compact"
                      testID={`input-quantity-${item.id}`}
                    />
                  </Field>
                  <Field label={`Price (${currency})`} flex={1}>
                    <Input
                      value={draft.cost}
                      onChangeText={(next) => onChange(item.id, { ...draft, cost: next })}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      size="compact"
                      testID={`input-cost-${item.id}`}
                    />
                  </Field>
                </FieldRow>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
