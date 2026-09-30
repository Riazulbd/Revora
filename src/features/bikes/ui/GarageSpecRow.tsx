import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Txt, useCopy } from '@/components';
import { fontFamily, HIT_SIZE, useTheme } from '@/theme';
import { NO_VALUE } from '@/utils/format';

/**
 * An identifier on the Motorcycle profile, with the board's copy square.
 *
 * Engine and chassis numbers exist to be typed into something else — a claim
 * form, a workshop's job card — and reading seventeen tracked characters off a
 * screen is where a digit gets dropped. The board sets them tracked at 0.5px
 * and puts a tinted square beside them; copying is the point of the row, so
 * the whole row is the target and the square is only the affordance.
 *
 * With nothing to copy the row goes inert and prints a dash, because a row that
 * still looks tappable and does nothing is worse than a plain one.
 */
export function GarageCopyRow({
  label,
  value,
  copyLabel,
  testID,
}: {
  label: string;
  value: string | null;
  /** What the toast calls it, when the row label is abbreviated. */
  copyLabel?: string;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  const copy = useCopy();
  const has = value !== null && value.trim() !== '';

  const body = (
    <View
      style={{
        minHeight: HIT_SIZE,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <Txt role="body" tone="mut" style={{ flexShrink: 0, lineHeight: 18 }}>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <Txt
          role="body"
          tone={has ? 'ink' : 'mut'}
          numberOfLines={2}
          style={{
            flexShrink: 1,
            textAlign: 'right',
            fontFamily: fontFamily[700],
            lineHeight: 18,
            letterSpacing: has ? 0.5 : 0,
          }}
        >
          {has ? value : NO_VALUE}
        </Txt>
        {has ? (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.badge + 1,
              backgroundColor: c.accS,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="copy" size={15} color={c.acc} strokeWidth={2} />
          </View>
        ) : null}
      </View>
    </View>
  );

  if (!has) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy ${copyLabel ?? label}. ${value}`}
      onPress={() => void copy(copyLabel ?? label, value)}
      testID={testID}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}
