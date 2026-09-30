import React from 'react';
import { Pressable, View } from 'react-native';

import { Card, Eyebrow, Txt } from '@/components';
import { IconSquareButton } from '@/components/IconButton';
import { HIT_SIZE, fontFamily, useTheme } from '@/theme';

/**
 * The chrome the two legal boards share (account--05, account--06).
 *
 * Both open on a two-line `700 20px / 1.25` title beside the 44px back
 * chevron — a sentence, not a document name — then a bordered summary card
 * whose eyebrow says out loud that it is a summary, then the sections.
 */

export function AccountDocHeader({
  title,
  onBack,
  testID,
}: {
  /** Drawn verbatim, including the board's line break. */
  title: string;
  onBack?: () => void;
  testID?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -10, minHeight: HIT_SIZE }}>
      <IconSquareButton
        icon="chevronLeft"
        variant="plain"
        accessibilityLabel="Back"
        onPress={onBack ?? (() => undefined)}
        {...(testID === undefined ? {} : { testID })}
      />
      <Txt role="screenTitle" numberOfLines={2} style={{ flexShrink: 1, lineHeight: 25 }}>
        {title}
      </Txt>
    </View>
  );
}

/**
 * `border-radius:18px; padding:16px`, the accent eyebrow, and a `500 13px / 1.7`
 * ink paragraph 8px under it. The body is ink, not muted: the board gives the
 * summary the same weight as the sections it summarises.
 */
export function AccountDocSummary({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const { c } = useTheme();

  return (
    <Card style={{ marginTop: 14 }} testID={testID}>
      <Eyebrow>In short — a summary, not the contract</Eyebrow>
      <Txt style={{ fontFamily: fontFamily[500], fontSize: 13, lineHeight: 22.1, color: c.ink, marginTop: 8 }}>
        {children}
      </Txt>
    </Card>
  );
}

/** `700 15px` heading, `500 13px / 1.65` ink body 6px under it, 18px between sections. */
export function AccountDocSection({ title, body }: { title: string; body: string }) {
  const { c } = useTheme();

  return (
    <View>
      <Txt style={{ fontFamily: fontFamily[700], fontSize: 15, color: c.ink }}>{title}</Txt>
      <Txt style={{ fontFamily: fontFamily[500], fontSize: 13, lineHeight: 21.45, color: c.ink, marginTop: 6 }}>
        {body}
      </Txt>
    </View>
  );
}

/**
 * The Terms board's anchor row: `height:32px; border-radius:7px; padding:0 11px`,
 * the current one on `--accS` with a `700 11.5px` accent label, the rest on
 * `--sur` with a hairline and a `600 11.5px` ink label. Tapping one jumps to
 * its section — the sections all stay on screen, exactly as the board draws
 * them.
 */
export function AccountDocTabs<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}) {
  const { c } = useTheme();
  const slop = (HIT_SIZE - 32) / 2;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }} testID={testID}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Jump to ${option.label}`}
            onPress={() => onChange(option.value)}
            hitSlop={{ top: slop, bottom: slop }}
            testID={testID === undefined ? undefined : `${testID}-${option.value}`}
            style={({ pressed }) => ({
              height: 32,
              borderRadius: 7,
              paddingHorizontal: 11,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? c.accS : c.sur,
              borderWidth: active ? 0 : 1,
              borderColor: c.brd,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Txt
              numberOfLines={1}
              style={{
                fontFamily: fontFamily[active ? 700 : 600],
                fontSize: 11.5,
                color: active ? c.acc : c.ink,
              }}
            >
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
