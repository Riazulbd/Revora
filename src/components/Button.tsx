import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';

import { HIT_SIZE, HIT_SLOP, fontFamily, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

/**
 * `primary` — `background:#D2400F`, white label (in dark the accent brightens
 *   and the label turns to the page colour for contrast).
 * `secondary` — `background:#FFFFFF; border:1px solid #E9EBEF`.
 * `ink` — `background:#14171B`, white label (the "Mark done" pill, the active
 *   segment).
 * `outline` — transparent with `border:1px solid #C9CED4; border-radius:14px`
 *   ("Attach pump receipt").
 * `subtle` — `background:#F1F2F5`, no border.
 * `tinted` — `background:#FDEAE3; border:1px solid #F6D3C5; color:#C93D0E`.
 * `ghost` — no chrome; `tone` colours the label ("Delete" in bad, "Not now" muted).
 * `danger` — the danger fill.
 * `dangerSubtle` — a destructive action in the page (Figma `Delete`):
 *   `background:#FBE9E7`, label and icon in the danger colour.
 * `dashed` — the add-another placeholder (`border-radius:14px`).
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ink'
  | 'outline'
  | 'subtle'
  | 'tinted'
  | 'danger'
  | 'dangerSubtle'
  | 'ghost'
  | 'dashed';

/**
 * Heights from Figma; every button is a pill (`border-radius:999px`) except the
 * field-shaped `outline` and `dashed`. `xlarge` 56 (Save fill, Add fuel),
 * `large` 52, `action` 48 in `600 15px` (the tab header's "Add rule" /
 * "Log a service"), `medium` 48, `small` 44, `compact` 40, `chip` 36 ("Mark done"),
 * `micro` 32. Anything under 48 gets hit slop back up to 48.
 */
export type ButtonSize = 'xlarge' | 'large' | 'action' | 'medium' | 'small' | 'compact' | 'chip' | 'micro';

export type ButtonProps = {
  label: string;
  onPress: () => unknown;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Which side of the label the glyph sits; Welcome's "Create account →" puts it after. */
  iconPosition?: 'left' | 'right';
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
  /** Overrides the size's corner radius. */
  radius?: number;
  /** Overrides the size's side padding (a pill sized by its row rather than its label). */
  padX?: number;
  style?: ViewStyle;
  accessibilityHint?: string;
  testID?: string;
};

const SPEC: Record<ButtonSize, { height: number; font: number; padX: number; icon: number }> = {
  xlarge: { height: 56, font: 16, padX: 24, icon: 20 },
  large: { height: 52, font: 15, padX: 22, icon: 20 },
  action: { height: 48, font: 15, padX: 18, icon: 18 },
  medium: { height: 48, font: 14, padX: 20, icon: 18 },
  small: { height: 44, font: 14, padX: 18, icon: 16 },
  compact: { height: 40, font: 13, padX: 16, icon: 16 },
  chip: { height: 36, font: 13, padX: 14, icon: 14 },
  micro: { height: 32, font: 12, padX: 12, icon: 14 },
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
  iconPosition = 'left',
  tone,
  subLabel,
  disabled = false,
  loading = false,
  loadingLabel,
  flex = false,
  radius,
  padX,
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
    tone === 'mut' ? c.mut : tone === 'acc' ? c.accText : tone === 'bad' ? c.bad : tone === 'good' ? c.good : tone === 'warn' ? c.warn : c.ink;

  // A disabled primary is an inert grey pill rather than a faded orange one.
  const mutedPrimary = disabled && (variant === 'primary' || variant === 'danger');

  const background = mutedPrimary
    ? c.sur2
    : variant === 'primary'
      ? c.acc
      : variant === 'danger'
        ? c.bad
        : variant === 'ink'
          ? c.ink
          : variant === 'dangerSubtle'
            ? c.badS
            : variant === 'subtle'
              ? c.sur2
            : variant === 'tinted'
              ? c.accS
              : variant === 'ghost' || variant === 'dashed' || variant === 'outline'
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
        : variant === 'ink'
          ? c.sur
          : variant === 'tinted'
            ? c.accText
            : variant === 'dangerSubtle'
              ? c.bad
              : variant === 'dashed'
                ? c.mut
                : toneColor;

  const bordered =
    mutedPrimary ||
    variant === 'secondary' ||
    variant === 'outline' ||
    variant === 'tinted' ||
    variant === 'dashed' ||
    (variant === 'subtle' && dark);
  const borderWidth = bordered ? (variant === 'dashed' ? 1.5 : 1) : 0;
  const borderColor =
    variant === 'tinted' ? c.accBrd : variant === 'outline' || variant === 'dashed' ? c.brdStrong : c.brd;
  // Figma's pills close to 8px between the glyph and the label, 6px on the small ones.
  const iconGap = size === 'compact' || size === 'chip' || size === 'micro' || size === 'action' ? 6 : 8;
  const fieldShaped = variant === 'outline' || variant === 'dashed';

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
          borderRadius: radius ?? (fieldShaped ? 14 : 999),
          backgroundColor: background,
          borderWidth,
          borderColor: bordered ? borderColor : 'transparent',
          borderStyle: variant === 'dashed' ? 'dashed' : 'solid',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: showLabelWhileLoading ? 10 : iconGap,
          paddingHorizontal: padX ?? spec.padX,
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
          ) : icon && iconPosition === 'left' ? (
            <Icon name={icon} size={spec.icon} color={foreground} />
          ) : null}
          {subLabel ? (
            <View style={{ alignItems: 'center', gap: 1 }}>
              <Txt style={{ fontFamily: fontFamily[600], fontSize: spec.font, color: foreground }} numberOfLines={1}>
                {showLabelWhileLoading ? loadingLabel : label}
              </Txt>
              <Txt style={{ fontFamily: fontFamily[600], fontSize: 10.5, color: foreground, opacity: 0.75 }} numberOfLines={1}>
                {subLabel}
              </Txt>
            </View>
          ) : (
            <Txt style={{ fontFamily: fontFamily[600], fontSize: spec.font, color: foreground }} numberOfLines={1}>
              {showLabelWhileLoading ? loadingLabel : label}
            </Txt>
          )}
          {icon && iconPosition === 'right' && !showLabelWhileLoading ? (
            <Icon name={icon} size={spec.icon} color={foreground} />
          ) : null}
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
 * The inline accent link in `#C93D0E`: `600 13px` (`small` and `medium` — the
 * card header's "View all", "Show all") and `600 14px` (`large`, "Forgot
 * password?").
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
  const color = tone === 'mut' ? c.mut : tone === 'ink' ? c.ink : c.accText;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={HIT_SLOP}
      testID={testID}
      style={({ pressed }) => ({
        opacity: pressed ? 0.6 : 1,
        // A 48px target (requirement 58) that still sits on the heading's
        // baseline: the extra height is pulled back with a negative margin.
        minHeight: HIT_SIZE,
        marginVertical: -(HIT_SIZE - 16) / 2,
        justifyContent: 'center',
        paddingHorizontal: size === 'large' ? 6 : 0,
      })}
    >
      <Txt role={size === 'large' ? 'linkLarge' : 'link'} color={color}>
        {label}
      </Txt>
    </Pressable>
  );
}
