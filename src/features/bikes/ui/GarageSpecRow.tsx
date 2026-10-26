import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Txt, useCopy } from '@/components';
import { fontFamily, useTheme } from '@/theme';
import { NO_VALUE } from '@/utils/format';

/**
 * An identifier on the Motorcycle profile (Figma `KV copy`): the `400 14px`
 * muted label, the value in `600 14px` tracked 0.03em, and a 48px copy button.
 *
 * Engine and chassis numbers exist to be typed into something else — a claim
 * form, a workshop's job card — and reading seventeen tracked characters off a
 * screen is where a digit gets dropped. Copying is the point of the row, so the
 * whole row is the target and the button is only the affordance.
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
  const { c } = useTheme();
  const copy = useCopy();
  const has = value !== null && value.trim() !== '';

  const body = (
    <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Txt role="body" tone="mut" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt
        numberOfLines={2}
        style={{
          flexShrink: 1,
          textAlign: 'right',
          fontFamily: fontFamily[600],
          fontSize: 14,
          lineHeight: 18,
          letterSpacing: has ? 0.42 : 0,
          color: has ? c.ink : c.mut,
        }}
      >
        {has ? value : NO_VALUE}
      </Txt>
      {has ? (
        <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: -8 }}>
          <Icon name="copy" size={20} color={c.mut} />
        </View>
      ) : (
        <View style={{ width: 8 }} />
      )}
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
