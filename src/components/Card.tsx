import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Divider } from './Divider';
import { Txt } from './Text';

export type CardTone = 'accent' | 'good' | 'warn' | 'bad' | 'neutral';

export type CardProps = ViewProps & {
  /**
   * `default` — `border-radius:18px; padding:16px`, the bordered white card.
   * `list` — `border-radius:16px; padding:0 16px`, rows carry their own
   *   vertical padding and a hairline between them.
   * `flush` — `border-radius:16px`, no padding (photo cards, `overflow:hidden`).
   * `dashed` — the "what a fill looks like" sample: 1px dashed border, 0.7 opacity.
   * `tinted` — no border, a soft tone background (the Current odometer card on
   *   Add motorcycle is `background:var(--accS); border-radius:18px; padding:16px`).
   */
  variant?: 'default' | 'list' | 'flush' | 'dashed' | 'tinted';
  /** Only read by `tinted`. */
  tone?: CardTone;
  style?: ViewStyle | ViewStyle[];
};

/**
 * The card surface used on every screen:
 * `background:var(--sur); border:1px solid var(--brd); border-radius:18px`.
 */
export function Card({ variant = 'default', tone = 'accent', style, children, ...rest }: CardProps) {
  const { c, radius } = useTheme();

  const tint =
    tone === 'good' ? c.goodS : tone === 'warn' ? c.warnS : tone === 'bad' ? c.badS : tone === 'neutral' ? c.sur2 : c.accS;

  const base: ViewStyle =
    variant === 'tinted'
      ? { backgroundColor: tint, borderRadius: radius.card }
      : {
          backgroundColor: c.sur,
          borderWidth: 1,
          borderColor: c.brd,
          borderStyle: variant === 'dashed' ? 'dashed' : 'solid',
          borderRadius: variant === 'list' || variant === 'flush' || variant === 'dashed' ? radius.listCard : radius.card,
          ...(variant === 'flush' ? { overflow: 'hidden' } : {}),
          ...(variant === 'dashed' ? { opacity: 0.7 } : {}),
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
 * the shape every row list on the boards takes (`padding:0 16px`, rows with
 * `border-bottom:1px solid var(--brd)`).
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
 * `font:700 10.5px; letter-spacing:0.95px; text-transform:uppercase; color:var(--acc)`
 * — the card and section eyebrow. Every board sets it in the accent; the
 * exceptions are tone-coded ("Needs attention" is `--bad`).
 */
export function Eyebrow({
  children,
  tone = 'acc',
  style,
}: {
  children: React.ReactNode;
  tone?: EyebrowTone;
  style?: ViewStyle;
}) {
  return (
    <Txt role="eyebrow" tone={tone} uppercase style={style as never}>
      {children}
    </Txt>
  );
}

/**
 * The eyebrow that sits between cards on a tab screen: `margin:18px 4px 8px`
 * (the first one after a header uses 16 on top — pass `first`). A handful of
 * boards set their own top margin (14 on Navigation, 20 on the Fuel tab's
 * "What a fill looks like"); `top` takes that number verbatim.
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
      style={{ marginTop: top ?? (first ? 16 : 18), marginBottom: 8, marginHorizontal: 4, ...style }}
    >
      {children}
    </Eyebrow>
  );
}

/** Eyebrow on the left, an action link on the right — the design's card header. */
export function CardHeader({
  title,
  action,
  tone,
  style,
}: {
  title: string;
  action?: React.ReactNode;
  tone?: EyebrowTone;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
        style,
      ]}
    >
      <Eyebrow {...(tone === undefined ? {} : { tone })}>{title}</Eyebrow>
      {action}
    </View>
  );
}
