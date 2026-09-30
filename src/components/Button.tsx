import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';

import { HIT_SIZE, HIT_SLOP, fontFamily, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

/**
 * `primary` — `background:var(--acc)`, white label (in dark the label is `--bg`,
 *   as every dark board draws it).
 * `secondary` — `background:var(--sur); border:1px solid var(--brd)`.
 * `subtle` — `background:var(--sur2)`, no border (the dialog's "Keep").
 * `tinted` — `background:var(--accS); color:var(--acc)` (the "Mark done" pill).
 * `ghost` — no chrome; `tone` colours the label ("Delete" in `--bad`, "Not now" in `--mut`).
 * `danger` — `background:var(--bad)`.
 * `dangerSubtle` — the Parts board's "Remove accessory": `background:var(--sur);
 *   border:1px solid <bad soft>`, label and icon in `--bad`. A destructive
 *   action that sits in the page rather than in a dialog.
 * `dashed` — the add-another placeholder (`border-radius:13px` on every board
 *   that draws one, which is why it overrides the size's radius).
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'subtle'
  | 'tinted'
  | 'danger'
  | 'dangerSubtle'
  | 'ghost'
  | 'dashed';

/**
 * Heights and radii from the boards:
 * `xlarge` 56/14 (Save fill), `large` 52/14 (Start tracking), `medium` 48/14
 * (dialogs, empty-state CTA), `small` 44/12, `compact` 40/14 (the header's
 * "Add fuel" pill), `chip` 36/11 (Notifications "Open"), `micro` 32/10
 * (Dashboard "Mark done"). Anything under 44 gets hit slop back up to 44.
 */
export type ButtonSize = 'xlarge' | 'large' | 'medium' | 'small' | 'compact' | 'chip' | 'micro';

export type ButtonProps = {
  label: string;
  onPress: () => unknown;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Label colour for `ghost` (and the icon). Defaults to ink. */
  tone?: 'ink' | 'mut' | 'acc' | 'bad' | 'good' | 'warn';
  /** A second, smaller line under the label — "offline — saves on phone, syncs later". */
  subLabel?: string;
  disabled?: boolean;
  /** Shows the spinner and blocks further presses. */
  loading?: boolean;
  /** When set, the spinner sits beside this text instead of replacing the label ("Signing in…"). */
  loadingLabel?: string;
  /** Stretch to the row (`flex:1`); the default hugs its container width. */
  flex?: boolean;
  /**
   * Overrides the size's corner radius. The boards mostly pair a height with
   * one radius, but a few field-shaped buttons keep the 13px input radius at a
   * 48 or 52px height — pass it rather than reaching for `style`, so the
   * pressed and disabled states stay on the same rounding.
   */
  radius?: number;
  style?: ViewStyle;
  accessibilityHint?: string;
  testID?: string;
};

const SPEC: Record<ButtonSize, { height: number; radius: number; font: number; padX: number; icon: number }> = {
  xlarge: { height: 56, radius: 14, font: 16, padX: 24, icon: 16 },
  large: { height: 52, radius: 14, font: 15, padX: 22, icon: 16 },
  medium: { height: 48, radius: 14, font: 14, padX: 22, icon: 16 },
  small: { height: 44, radius: 12, font: 13.5, padX: 18, icon: 14 },
  compact: { height: 40, radius: 14, font: 13, padX: 16, icon: 14 },
  chip: { height: 36, radius: 11, font: 12, padX: 12, icon: 13 },
  micro: { height: 32, radius: 10, font: 11.5, padX: 11, icon: 12 },
};

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
  tone,
  subLabel,
  disabled = false,
  loading = false,
  loadingLabel,
  flex = false,
  radius,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { c, dark } = useTheme();
  const [busy, setBusy] = useState(false);
  const lastPress = useRef(0);

  const inactive = disabled || loading || busy;
  const spec = SPEC[size];

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

  const toneColor =
    tone === 'mut' ? c.mut : tone === 'acc' ? c.acc : tone === 'bad' ? c.bad : tone === 'good' ? c.good : tone === 'warn' ? c.warn : c.ink;

  // The Sign in board draws a disabled primary as an inert grey field
  // (`background:var(--sur2); border:1px solid var(--brd); color:var(--mut)`)
  // rather than a faded orange one.
  const mutedPrimary = disabled && (variant === 'primary' || variant === 'danger');

  const background = mutedPrimary
    ? c.sur2
    : variant === 'primary'
      ? c.acc
      : variant === 'danger'
        ? c.bad
        : variant === 'subtle'
          ? c.sur2
          : variant === 'tinted'
            ? c.accS
            : variant === 'ghost' || variant === 'dashed'
              ? 'transparent'
              : c.sur;

  const foreground = mutedPrimary
    ? c.mut
    : variant === 'primary'
      ? dark
        ? c.bg
        : '#FFFFFF'
      : variant === 'danger'
        ? '#FFFFFF'
        : variant === 'tinted'
          ? c.acc
          : variant === 'dangerSubtle'
            ? c.bad
            : variant === 'dashed'
              ? c.mut
              : toneColor;

  const bordered =
    mutedPrimary ||
    variant === 'secondary' ||
    variant === 'dashed' ||
    variant === 'dangerSubtle' ||
    (variant === 'subtle' && dark);
  const borderWidth = bordered ? (variant === 'dashed' ? 1.5 : 1) : 0;
  const borderColor = variant === 'dangerSubtle' ? c.badS : c.brd;
  // The boards' pill buttons close to 6px between the glyph and the label; the
  // "Add fuel" header pill is the one every tab screen repeats.
  const iconGap = size === 'compact' || size === 'chip' || size === 'micro' ? 6 : 8;

  const hitSlop = spec.height < HIT_SIZE ? { top: (HIT_SIZE - spec.height) / 2, bottom: (HIT_SIZE - spec.height) / 2, left: 4, right: 4 } : undefined;

  const showLabelWhileLoading = (loading || busy) && loadingLabel !== undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading || busy }}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={subLabel ? `${label}. ${subLabel}` : label}
      testID={testID}
      hitSlop={hitSlop}
      disabled={inactive}
      onPress={handlePress}
      style={({ pressed }) => [
        {
          height: spec.height,
          borderRadius: radius ?? (variant === 'dashed' ? 13 : spec.radius),
          backgroundColor: background,
          borderWidth,
          borderColor: bordered ? borderColor : 'transparent',
          borderStyle: variant === 'dashed' ? 'dashed' : 'solid',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: showLabelWhileLoading ? 10 : iconGap,
          paddingHorizontal: spec.padX,
          opacity: inactive && !mutedPrimary ? 0.55 : pressed ? 0.85 : 1,
        },
        flex ? { flex: 1 } : null,
        style,
      ]}
    >
      {(loading || busy) && !showLabelWhileLoading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <>
          {showLabelWhileLoading ? (
            <ActivityIndicator size="small" color={foreground} />
          ) : icon ? (
            <Icon name={icon} size={spec.icon} color={foreground} strokeWidth={size === 'compact' ? 2.4 : 2.2} />
          ) : null}
          {subLabel ? (
            <View style={{ alignItems: 'center', gap: 1 }}>
              <Txt style={{ fontFamily: fontFamily[700], fontSize: spec.font, color: foreground }} numberOfLines={1}>
                {showLabelWhileLoading ? loadingLabel : label}
              </Txt>
              <Txt style={{ fontFamily: fontFamily[600], fontSize: 10.5, color: foreground, opacity: 0.75 }} numberOfLines={1}>
                {subLabel}
              </Txt>
            </View>
          ) : (
            <Txt style={{ fontFamily: fontFamily[700], fontSize: spec.font, color: foreground }} numberOfLines={1}>
              {showLabelWhileLoading ? loadingLabel : label}
            </Txt>
          )}
        </>
      )}
    </Pressable>
  );
}

/** A row of buttons sharing the width equally, as the design pairs Edit/Delete. */
export function ButtonRow({ children, gap = 10, style }: { children: React.ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', gap }, style]}>{children}</View>;
}

/**
 * The inline accent link: `font:700 11.5px` (`small`), `font:700 12px` (`medium`,
 * the card header's "View all"), `font:700 13px` (`large`, "Show all fills",
 * "Forgot password?").
 */
export function LinkButton({
  label,
  onPress,
  size = 'small',
  tone = 'acc',
  testID,
}: {
  label: string;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  tone?: 'acc' | 'mut' | 'ink';
  testID?: string;
}) {
  const { c } = useTheme();
  const color = tone === 'mut' ? c.mut : tone === 'ink' ? c.ink : c.acc;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={HIT_SLOP}
      testID={testID}
      style={({ pressed }) => ({
        opacity: pressed ? 0.6 : 1,
        // A 44px target (requirement 58) that still sits on the eyebrow's
        // baseline: the extra height is pulled back with a negative margin.
        minHeight: HIT_SIZE,
        marginVertical: -(HIT_SIZE - 16) / 2,
        justifyContent: 'center',
        paddingHorizontal: size === 'large' ? 6 : 0,
      })}
    >
      <Txt role={size === 'small' ? 'link' : size === 'medium' ? 'fieldLabel' : 'linkLarge'} color={color}>
        {label}
      </Txt>
    </Pressable>
  );
}
