import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Input, LinkButton, Txt } from '@/components';
import { HIT_SIZE, fontFamily, useTheme } from '@/theme';

/**
 * The completion sheet's "pick from what you've used before, or type a new one"
 * control — the brand list on the board, and the workshop field above it.
 *
 * The board is making a promise in the helper line under it: *"Brands you've
 * logged before sort first — nothing is suggested that you haven't used."* So
 * the options handed in here always come from the rider's own history, and the
 * last row is always an escape hatch into a plain text field. A rider with no
 * history at all sees the text field on its own, because a dropdown with one
 * row reading "Other" is a dropdown that wastes a tap.
 */

export type PickerOption = {
  key: string;
  label: string;
  /** "used last time", "used in May", "12 services" — a fact, never a rating. */
  note?: string | null;
};

export function MaintenancePicker({
  options,
  /** The chosen option's key, or null when the rider is typing their own. */
  selectedKey,
  onSelect,
  open,
  onOpenChange,
  custom,
  onCustomChange,
  customPlaceholder,
  otherLabel,
  backLabel,
  placeholder,
  height = 52,
  inset = false,
  leading,
  accessibilityLabel,
  testID,
  inputTestID,
}: {
  options: readonly PickerOption[];
  selectedKey: string | null;
  /** `null` means "Other — type one", which switches the control to a text field. */
  onSelect: (key: string | null) => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  custom: string;
  onCustomChange: (next: string) => void;
  customPlaceholder: string;
  /** "Other — type a brand". */
  otherLabel: string;
  /** "Pick one you've used before". */
  backLabel: string;
  placeholder: string;
  height?: 52 | 48;
  inset?: boolean | 'bg';
  /** The 16px accent glyph the board draws inside the brand field. */
  leading?: React.ReactNode;
  accessibilityLabel: string;
  testID: string;
  /** The text field's own id, so the E2E suite keeps the name it already knows. */
  inputTestID?: string;
}) {
  const { c, radius } = useTheme();

  const selected = options.find((option) => option.key === selectedKey) ?? null;
  const typing = selectedKey === null;

  // Nothing in the history yet: the text field is the whole control, because
  // the only thing a list could offer is the escape hatch itself.
  if (options.length === 0) {
    return (
      <Input
        value={custom}
        onChangeText={onCustomChange}
        placeholder={customPlaceholder}
        size={height === 52 ? 'standard' : 'compact'}
        padX={14}
        autoCapitalize="words"
        inset={inset}
        testID={inputTestID ?? `${testID}-input`}
      />
    );
  }

  if (typing) {
    return (
      <View style={{ gap: 8 }}>
        <Input
          value={custom}
          onChangeText={onCustomChange}
          placeholder={customPlaceholder}
          size={height === 52 ? 'standard' : 'compact'}
          padX={14}
          autoCapitalize="words"
          inset={inset}
          testID={inputTestID ?? `${testID}-input`}
        />
        <LinkButton
          label={backLabel}
          onPress={() => {
            onSelect(options[0]?.key ?? null);
            onOpenChange(true);
          }}
          testID={`${testID}-back`}
        />
      </View>
    );
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        accessibilityState={{ expanded: open }}
        onPress={() => onOpenChange(!open)}
        testID={testID}
        style={({ pressed }) => ({
          height,
          borderRadius: radius.input,
          borderWidth: open ? 1.5 : 1,
          borderColor: open ? c.acc : c.brd,
          backgroundColor: inset === 'bg' ? c.bg : inset ? c.sur2 : c.sur,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        {leading}
        <Txt
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: fontFamily[700],
            fontSize: 14,
            color: selected === null ? c.mut : c.ink,
          }}
        >
          {selected?.label ?? placeholder}
          {selected?.note ? (
            <Txt style={{ fontFamily: fontFamily[500], fontSize: 11.5, color: c.mut }}>
              {` · ${selected.note}`}
            </Txt>
          ) : null}
        </Txt>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={16} color={c.mut} strokeWidth={2} />
        </View>
      </Pressable>

      {open ? (
        <View
          style={{
            marginTop: 6,
            borderRadius: radius.input,
            backgroundColor: c.sur,
            borderWidth: 1,
            borderColor: c.brd,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: 0.14,
            shadowRadius: 32,
            shadowOffset: { width: 0, height: 12 },
            elevation: 12,
          }}
          testID={`${testID}-list`}
        >
          {options.map((option, index) => {
            const active = option.key === selectedKey;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={option.note ? `${option.label}, ${option.note}` : option.label}
                onPress={() => {
                  onSelect(option.key);
                  onOpenChange(false);
                }}
                testID={`${testID}-option-${index}`}
                style={({ pressed }) => ({
                  minHeight: HIT_SIZE + 4,
                  height: 48,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  backgroundColor: active ? c.accS : pressed ? c.sur2 : c.sur,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: c.brd,
                })}
              >
                <Txt
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    fontFamily: fontFamily[active ? 700 : 600],
                    fontSize: 13,
                    color: active ? c.acc : c.ink,
                  }}
                >
                  {option.label}
                  {option.note ? (
                    <Txt style={{ fontFamily: fontFamily[500], fontSize: 11, color: active ? c.acc : c.mut }}>
                      {` · ${option.note}`}
                    </Txt>
                  ) : null}
                </Txt>
                {active ? <Icon name="checkLarge" size={15} color={c.acc} strokeWidth={2.4} /> : null}
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={otherLabel}
            onPress={() => {
              onSelect(null);
              onOpenChange(false);
            }}
            testID={`${testID}-other`}
            style={({ pressed }) => ({
              minHeight: HIT_SIZE + 4,
              height: 48,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: pressed ? c.sur2 : c.sur,
              borderTopWidth: 1,
              borderTopColor: c.brd,
            })}
          >
            <Icon name="plus" size={14} color={c.mut} strokeWidth={2} />
            <Txt style={{ fontFamily: fontFamily[600], fontSize: 13, color: c.mut }}>{otherLabel}</Txt>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
