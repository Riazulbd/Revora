import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { fontFamily, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

export type BannerTone = 'warn' | 'good' | 'bad' | 'neutral' | 'accent' | 'offline';

function useToneColor(tone: BannerTone): string {
  const { c } = useTheme();
  return tone === 'good' ? c.good : tone === 'bad' ? c.bad : tone === 'accent' ? c.accText : tone === 'neutral' ? c.mut : c.warn;
}

function useToneTint(tone: BannerTone): string {
  const { c } = useTheme();
  return tone === 'good' ? c.goodS : tone === 'bad' ? c.badS : tone === 'accent' ? c.accS : tone === 'neutral' ? c.sur2 : c.warnS;
}

/** The default glyph per tone: wifi-off, triangle, circle, filled tick. */
function ToneIcon({ tone, icon, size = 20 }: { tone: BannerTone; icon?: IconName; size?: number }) {
  const color = useToneColor(tone);
  if (icon) return <Icon name={icon} size={size} color={color} />;
  if (tone === 'good') {
    // Saved-offline draws a filled green disc with a white tick.
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={10} fill={color} />
        <Path d="m7.5 12.5 3 3 6-6.5" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    );
  }
  const name: IconName = tone === 'offline' ? 'wifiOff' : tone === 'bad' ? 'circleAlert' : tone === 'neutral' || tone === 'accent' ? 'info' : 'triangleAlert';
  return <Icon name={name} size={size} color={color} />;
}

/**
 * The inline notice (Figma `Banner`): `background:#FFFFFF; border:1px solid
 * #E9EBEF; border-radius:20px; padding:14px; gap:12px`, a 20px tone glyph
 * top-aligned, and a `400 13px / 1.5` message whose first sentence (`lead`)
 * is `600` in the tone.
 *
 * `label` (the older uppercase tag) still renders, ahead of the message.
 *
 * `variant`: `plain` drops the glyph; `inset` also trades the bordered card
 * for the `#F1F2F5` inset surface (a correction preview inside a card). Both
 * set the body a size smaller, so they pair with `compact`. `soft` is the
 * inset surface with the glyph kept, `border-radius:16px; gap:10px` and a
 * muted `400 13px` body — the ledger note on Add part, the uncompared-visits
 * note on Workshop records.
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
  /** `plain` drops the glyph; `inset` also trades the bordered card for `--sur2`; `soft` keeps the glyph on `--sur2`. */
  variant?: 'default' | 'plain' | 'inset' | 'soft';
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
  const soft = variant === 'soft';
  const inset = variant === 'inset' || soft;
  const glyph = variant === 'default' || soft;
  const size = compact || !glyph ? 12 : 13;

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[
        {
          backgroundColor: inset ? c.sur2 : c.sur,
          borderWidth: inset ? 0 : 1,
          borderColor: c.brd,
          borderRadius: soft ? 16 : 20,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: soft ? 10 : 12,
        },
        style,
      ]}
    >
      {glyph ? (
        <View style={{ marginTop: 1, flexShrink: 0 }}>
          <ToneIcon tone={tone} {...(icon === undefined ? {} : { icon })} />
        </View>
      ) : null}
      <Txt style={{ flex: 1, fontFamily: fontFamily[400], fontSize: size, lineHeight: size * 1.5, color: soft ? c.mut : c.ink }}>
        {label ? (
          <Txt role="fieldLabel" color={toneColor}>
            {label}{' '}
          </Txt>
        ) : null}
        {lead ? (
          <Txt style={{ fontFamily: fontFamily[600], fontSize: size, lineHeight: size * 1.5, color: toneColor }}>
            {lead}{' '}
          </Txt>
        ) : null}
        {message}
        {link ? (
          <Txt
            accessibilityRole="link"
            onPress={link.onPress}
            testID={link.testID}
            style={{ fontFamily: fontFamily[600], fontSize: size, lineHeight: size * 1.5, color: c.accText }}
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
 * The tinted callout: `border-radius:20px; background:<tone soft>;
 * padding:16px; gap:12px`, a tone glyph, a `600 14px` title and a `400 12px`
 * muted body — or, with `lead`, a single `400 12px / 1.5` line that opens in
 * `600` tone ("Can't check what needs attention").
 */
export function Callout({
  tone = 'good',
  icon,
  title,
  body,
  lead,
  message,
  bodyTone = 'mut',
  style,
  testID,
}: {
  tone?: BannerTone;
  icon?: IconName;
  title?: string;
  body?: string;
  /** `tone` sets both lines in the tone colour (Figma `Status banner` on the rule editor). */
  bodyTone?: 'mut' | 'tone';
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
          borderRadius: 20,
          backgroundColor: tint,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        style,
      ]}
    >
      <ToneIcon tone={tone} size={20} {...(icon === undefined ? {} : { icon })} />
      <View style={{ flex: 1 }}>
        {title ? <Txt role="rowTitle" {...(bodyTone === 'tone' ? { color: toneColor } : {})}>{title}</Txt> : null}
        {body ? (
          <Txt role="meta" tone="mut" {...(bodyTone === 'tone' ? { color: toneColor } : {})}>
            {body}
          </Txt>
        ) : null}
        {lead || message ? (
          <Txt style={{ fontFamily: fontFamily[400], fontSize: 12, lineHeight: 18, color: c.ink }}>
            {lead ? (
              <Txt style={{ fontFamily: fontFamily[600], fontSize: 12, lineHeight: 18, color: toneColor }}>
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
