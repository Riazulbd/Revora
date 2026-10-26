import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Divider } from './Divider';
import { Txt } from './Text';

export type CardTone = 'accent' | 'good' | 'warn' | 'bad' | 'neutral';

export type CardProps = ViewProps & {
  /**
   * `default` — white, `border-radius:24px; padding:16px`, no border (every
   *   card in the Figma redesign sits on the page without an outline).
   * `list` — the same surface with `padding:0 16px`; rows carry their own
   *   vertical padding and a hairline between them.
   * `flush` — no padding, clipped (photo cards).
   * `dashed` — the "what a fill looks like" sample: 1px dashed border, 0.7 opacity.
   * `tinted` — a soft tone background instead of white.
   */
  variant?: 'default' | 'list' | 'flush' | 'dashed' | 'tinted';
  /** Only read by `tinted`. */
  tone?: CardTone;
  style?: ViewStyle | ViewStyle[];
};

/** The card surface used on every screen: `background:#FFFFFF; border-radius:24px`. */
export function Card({ variant = 'default', tone = 'accent', style, children, ...rest }: CardProps) {
  const { c, radius } = useTheme();

  const tint =
    tone === 'good' ? c.goodS : tone === 'warn' ? c.warnS : tone === 'bad' ? c.badS : tone === 'neutral' ? c.sur2 : c.accS;

  const base: ViewStyle =
    variant === 'tinted'
      ? { backgroundColor: tint, borderRadius: radius.card }
      : variant === 'dashed'
        ? {
            backgroundColor: c.sur,
            borderWidth: 1,
            borderColor: c.brdStrong,
            borderStyle: 'dashed',
            borderRadius: radius.card,
            opacity: 0.7,
          }
        : {
            backgroundColor: c.sur,
            borderRadius: radius.card,
            ...(variant === 'flush' ? { overflow: 'hidden' } : {}),
          };

  const padding: ViewStyle =
    variant === 'list' || variant === 'dashed'
      ? { paddingHorizontal: 16 }
      : variant === 'flush'
        ? {}
        : { padding: 16 };

  return (
    <View style={[base, padding, style]} {...rest}>
      {children}
    </View>
  );
}

/**
 * A `list` card whose children are separated by the design's 1px hairline —
 * the shape every row list takes (`padding:0 16px`, rows with
 * `border-top:1px solid #EEF0F3`).
 */
export function ListCard({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <Card variant="list" style={style} testID={testID}>
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <Divider /> : null}
          {child}
        </React.Fragment>
      ))}
    </Card>
  );
}

export type EyebrowTone = 'acc' | 'mut' | 'bad' | 'warn' | 'good';

/**
 * `font:600 12px; letter-spacing:0.06em; text-transform:uppercase; color:#6B727C`
 * — the section eyebrow ("UNITS", "APPEARANCE") and the label at the top of a
 * hero card. Muted by default; a tone is for the rare eyebrow that carries a
 * status.
 */
export function Eyebrow({
  children,
  tone = 'mut',
  color,
  style,
}: {
  children: React.ReactNode;
  tone?: EyebrowTone;
  /** An explicit colour — the hero's `#9AA1AA`. */
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <Txt role="eyebrow" tone={tone} uppercase style={style as never} {...(color === undefined ? {} : { color })}>
      {children}
    </Txt>
  );
}

/**
 * The eyebrow above a card: `padding-left:4px`, 8px over the card it names,
 * and the screen's 16px gap above it (`first` drops that gap for the eyebrow
 * that opens a screen; `top` overrides it).
 */
export function SectionEyebrow({
  children,
  tone,
  first = false,
  top,
  style,
}: {
  children: React.ReactNode;
  tone?: EyebrowTone;
  first?: boolean;
  /** Overrides the top margin. */
  top?: number;
  style?: ViewStyle;
}) {
  return (
    <Eyebrow
      {...(tone === undefined ? {} : { tone })}
      style={{ marginTop: top ?? (first ? 0 : 16), marginBottom: 8, paddingLeft: 4, ...style }}
    >
      {children}
    </Eyebrow>
  );
}

/**
 * A card's heading row: the `600 16px` title ("Needs attention", "All fills"),
 * an optional count pill beside it, and an action link ("View all") on the
 * right — `padding-bottom:6px` under it.
 */
export function CardHeader({
  title,
  action,
  count,
  tone = 'bad',
  style,
}: {
  title: string;
  action?: React.ReactNode;
  /** The pill after the title (`Needs attention 3`); hidden when 0 or absent. */
  count?: number;
  /** The count pill's tone. */
  tone?: EyebrowTone;
  style?: ViewStyle;
}) {
  const { c } = useTheme();
  const pill =
    tone === 'good' ? [c.goodS, c.good] : tone === 'warn' ? [c.warnS, c.warn] : tone === 'acc' ? [c.accS, c.accText] : tone === 'mut' ? [c.sur2, c.mut] : [c.badS, c.bad];
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingBottom: 6 },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <Txt role="cardTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
          {title}
        </Txt>
        {count ? (
          <View style={{ backgroundColor: pill[0], borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Txt role="chip" color={pill[1]}>
              {String(count)}
            </Txt>
          </View>
        ) : null}
      </View>
      {action}
    </View>
  );
}
