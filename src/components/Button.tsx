import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';

import { HIT_SLOP, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'dashed';
export type ButtonSize = 'large' | 'medium' | 'small';

export type ButtonProps = {
  label: string;
  onPress: () => unknown;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  disabled?: boolean;
  /** Shows the spinner and blocks further presses. */
  loading?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
  testID?: string;
};

/** Heights taken from the design: 54/52 hero, 50/48 standard, 44 compact. */
const HEIGHTS: Record<ButtonSize, number> = { large: 52, medium: 50, small: 44 };
const RADII: Record<ButtonSize, number> = { large: 14, medium: 13, small: 12 };

/**
 * Every button in Revora.
 *
 * It guards against the duplicate-record bug that a bare `onPress` invites: while
 * an async handler is in flight the button is disabled, and a synchronous
 * double-tap inside 600 ms is swallowed. Pressing "Save fuel log" twice cannot
 * create two fills (requirement 43 / mistake 6).
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  icon,
  disabled = false,
  loading = false,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { c, text } = useTheme();
  const [busy, setBusy] = useState(false);
  const lastPress = useRef(0);

  const inactive = disabled || loading || busy;

  const handlePress = useCallback(() => {
    const now = Date.now();
    if (now - lastPress.current < 600) return;
    lastPress.current = now;

    const result = onPress();
    if (result instanceof Promise) {
      setBusy(true);
      void result.finally(() => setBusy(false));
    }
  }, [onPress]);

  const background =
    variant === 'primary'
      ? c.acc
      : variant === 'danger'
        ? c.bad
        : variant === 'ghost' || variant === 'dashed'
          ? 'transparent'
          : c.sur;

  const foreground =
    variant === 'primary' || variant === 'danger' ? '#FFFFFF' : variant === 'dashed' ? c.mut : c.ink;

  const borderColor = variant === 'primary' || variant === 'danger' ? 'transparent' : c.brd;
  const borderWidth = variant === 'primary' || variant === 'danger' ? 0 : variant === 'dashed' ? 1.5 : 1;

  const role = size === 'large' ? 'buttonPrimary' : size === 'medium' ? 'button' : 'buttonSmall';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading || busy }}
      accessibilityHint={accessibilityHint}
      testID={testID}
      hitSlop={size === 'small' ? HIT_SLOP : undefined}
      disabled={inactive}
      onPress={handlePress}
      style={({ pressed }) => [
        {
          height: HEIGHTS[size],
          borderRadius: RADII[size],
          backgroundColor: background,
          borderWidth,
          borderColor,
          borderStyle: variant === 'dashed' ? 'dashed' : 'solid',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: size === 'small' ? 18 : 22,
          opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading || busy ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'small' ? 14 : 16} color={foreground} strokeWidth={2.6} /> : null}
          <Txt style={text(role, foreground)} numberOfLines={1}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

/** A row of buttons sharing the width equally, as the design pairs Edit/Delete. */
export function ButtonRow({ children, gap = 10 }: { children: React.ReactNode; gap?: number }) {
  return <View style={{ flexDirection: 'row', gap }}>{children}</View>;
}

/** `font:700 11.5px; color:var(--acc)` — the inline text link in card headers. */
export function LinkButton({
  label,
  onPress,
  size = 'small',
  testID,
}: {
  label: string;
  onPress: () => void;
  size?: 'small' | 'large';
  testID?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={HIT_SLOP}
      testID={testID}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Txt role={size === 'small' ? 'link' : 'linkLarge'} color={c.acc}>
        {label}
      </Txt>
    </Pressable>
  );
}
