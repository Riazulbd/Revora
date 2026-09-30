import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { fontFamily, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

export type BannerTone = 'warn' | 'good' | 'bad' | 'neutral' | 'accent' | 'offline';

function useToneColor(tone: BannerTone): string {
  const { c } = useTheme();
  return tone === 'good' ? c.good : tone === 'bad' ? c.bad : tone === 'accent' ? c.acc : tone === 'neutral' ? c.mut : c.warn;
}

function useToneTint(tone: BannerTone): string {
  const { c } = useTheme();
  return tone === 'good' ? c.goodS : tone === 'bad' ? c.badS : tone === 'accent' ? c.accS : tone === 'neutral' ? c.sur2 : c.warnS;
}

/** The boards' default glyph per tone: wifi-off, triangle, circle, filled tick. */
function ToneIcon({ tone, icon, size = 18 }: { tone: BannerTone; icon?: IconName; size?: number }) {
  const color = useToneColor(tone);
  if (icon) return <Icon name={icon} size={size} color={color} strokeWidth={1.8} />;
  if (tone === 'good') {
    // The saved-offline board draws a filled green disc with a white tick.
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={10} fill={color} />
        <Path d="m7.5 12.5 3 3 6-6.5" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    );
  }
  const name: IconName = tone === 'offline' ? 'wifiOff' : tone === 'bad' ? 'alertCircle' : tone === 'neutral' || tone === 'accent' ? 'alertCircle' : 'alertTriangle';
  return <Icon name={name} size={size} color={color} strokeWidth={2} />;
}

/**
 * The inline notice from the boards — "You're offline.", "Not saved — litres
 * is empty.", "Motorcycle saved on this phone.":
 * `border-radius:11px; background:var(--sur); border:1px solid var(--brd);
 * padding:12px 14px; gap:10px`, an 18px tone glyph top-aligned, and a
 * `500 13px / 1.5` message whose first sentence (`lead`) is bold in the tone.
 *
 * `label` (the older uppercase tag) still renders, ahead of the message.
 *
 * Two of the boards' notes carry no glyph at all, and `variant` draws them:
 *  · `plain` — the same `--sur` card, text only (Account's "The current
 *    odometer isn't edited here…", the Money board's allowance note).
 *  · `inset` — `background:var(--sur2)`, no border, no glyph (the odometer
 *    history correction preview).
 * Both are `500 12.5px / 1.5`, so they pair with `compact`.
 */
export function Banner({
  message,
  lead,
  tone = 'warn',
  variant = 'default',
  icon,
  label,
  action,
  link,
  compact = false,
  style,
  testID,
}: {
  message: string;
  /** The bold, tone-coloured opening sentence. */
  lead?: string;
  tone?: BannerTone;
  /** `plain` drops the glyph; `inset` also trades the bordered card for `--sur2`. */
  variant?: 'default' | 'plain' | 'inset';
  icon?: IconName;
  /** A short uppercase tag before the message, e.g. `OFFLINE`. */
  label?: string;
  /** A text-like node appended to the message (kept for existing callers; prefer `link`). */
  action?: React.ReactNode;
  /** The inline accent link the boards end a banner with — "try again", "Odometer history". */
  link?: { label: string; onPress: () => void; testID?: string };
  /** `500 12.5px` body — the Add fuel low-odometer note and the plan banners. */
  compact?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c } = useTheme();
  const toneColor = useToneColor(tone);
  const inset = variant === 'inset';
  const glyph = variant === 'default';
  const size = compact || !glyph ? 12.5 : 13;

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[
        {
          backgroundColor: inset ? c.sur2 : c.sur,
          borderWidth: inset ? 0 : 1,
          borderColor: c.brd,
          borderRadius: 11,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
        },
        style,
      ]}
    >
      {glyph ? (
        <View style={{ marginTop: 1, flexShrink: 0 }}>
          <ToneIcon tone={tone} {...(icon === undefined ? {} : { icon })} />
        </View>
      ) : null}
      <Txt style={{ flex: 1, fontFamily: fontFamily[500], fontSize: size, lineHeight: size * 1.5, color: c.ink }}>
        {label ? (
          <Txt role="fieldLabel" color={toneColor}>
            {label}{' '}
          </Txt>
        ) : null}
        {lead ? (
          <Txt style={{ fontFamily: fontFamily[700], fontSize: size, lineHeight: size * 1.5, color: toneColor }}>
            {lead}{' '}
          </Txt>
        ) : null}
        {message}
        {link ? (
          <Txt
            accessibilityRole="link"
            onPress={link.onPress}
            testID={link.testID}
            style={{ fontFamily: fontFamily[700], fontSize: size, lineHeight: size * 1.5, color: c.acc }}
          >
            {' '}
            {link.label}
          </Txt>
        ) : null}
        {action ? <Txt> {action}</Txt> : null}
      </Txt>
    </View>
  );
}

/**
 * The tinted callout under the quick actions on the Dashboard:
 * `border-radius:16px; background:<tone soft>; padding:13px 16px; gap:11px`,
 * a tone glyph, a `700 13.5px` title and a `500 11.5px` muted body — or, with
 * `lead`, a single `500 12px / 1.5` line that opens in bold tone ("Can't check
 * what needs attention").
 */
export function Callout({
  tone = 'good',
  icon,
  title,
  body,
  lead,
  message,
  style,
  testID,
}: {
  tone?: BannerTone;
  icon?: IconName;
  title?: string;
  body?: string;
  lead?: string;
  message?: string;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c } = useTheme();
  const tint = useToneTint(tone);
  const toneColor = useToneColor(tone);

  return (
    <View
      testID={testID}
      style={[
        {
          borderRadius: 16,
          backgroundColor: tint,
          paddingHorizontal: 16,
          paddingVertical: 13,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
        },
        style,
      ]}
    >
      <ToneIcon tone={tone} size={20} {...(icon === undefined ? {} : { icon })} />
      <View style={{ flex: 1 }}>
        {title ? <Txt role="rowTitleDense">{title}</Txt> : null}
        {body ? (
          <Txt role="metaSmall" tone="mut">
            {body}
          </Txt>
        ) : null}
        {lead || message ? (
          <Txt style={{ fontFamily: fontFamily[500], fontSize: 12, lineHeight: 18, color: c.ink }}>
            {lead ? (
              <Txt style={{ fontFamily: fontFamily[700], fontSize: 12, lineHeight: 18, color: toneColor }}>
                {lead}{' '}
              </Txt>
            ) : null}
            {message}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}
