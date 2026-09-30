import React, { useCallback } from 'react';
import { Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { HIT_SIZE, useTheme } from '@/theme';
import { Icon } from './Icon';
import { KeyValueRow } from './Rows';
import { useToast } from './Toast';

/**
 * One tap puts a number on the clipboard.
 *
 * Every identifier Revora stores exists to be typed into something else — an
 * insurance form, a workshop's job card, a renewal counter. Reading a chassis
 * number off a screen and retyping it is where a digit gets dropped, and a
 * wrong chassis number on a claim is worse than none at all.
 *
 * The toast is not decoration: a clipboard write is invisible, so without it
 * the rider has no way to tell a successful copy from a missed tap, and taps
 * again.
 */
export function useCopy() {
  const toast = useToast();

  return useCallback(
    async (label: string, value: string | null | undefined) => {
      if (value === null || value === undefined || value.trim() === '') return;
      await Clipboard.setStringAsync(value);
      toast.show(`${label} copied`);
    },
    [toast],
  );
}

/**
 * A label/value row that copies its value, and quietly stops being a button
 * when there is no value to copy — an inert row that still looks tappable is a
 * worse failure than a plain one.
 */
export function CopyableRow({
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

  return (
    <KeyValueRow
      label={label}
      value={has ? value : '—'}
      onPress={has ? () => void copy(copyLabel ?? label, value) : undefined}
      trailing={has ? <Icon name="copy" size={14} color={c.acc} strokeWidth={2} /> : undefined}
      testID={testID}
    />
  );
}

/** The same action as a standalone control, for a list row that already navigates. */
export function CopyButton({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  const copy = useCopy();

  // The Records board: `width:44px; height:44px; border-radius:11px;
  // background:var(--accS)` with the copy glyph in `--acc`, beside the number.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
      onPress={() => void copy(label, value)}
      style={({ pressed }) => ({
        width: HIT_SIZE,
        height: HIT_SIZE,
        minHeight: HIT_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.tile,
        backgroundColor: c.accS,
        opacity: pressed ? 0.7 : 1,
      })}
      testID={testID}
    >
      <Icon name="copy" size={17} color={c.acc} strokeWidth={2} />
    </Pressable>
  );
}
