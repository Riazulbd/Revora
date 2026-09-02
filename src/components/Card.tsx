import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Txt } from './Text';

export type CardProps = ViewProps & {
  /** `padding:18` in the design; list-style cards use `6px 16px`. */
  variant?: 'default' | 'list' | 'flush' | 'dashed';
  style?: ViewStyle | ViewStyle[];
};

/**
 * The card surface used on every screen:
 * `background:var(--sur); border:1px solid var(--brd); border-radius:18px`.
 */
export function Card({ variant = 'default', style, children, ...rest }: CardProps) {
  const { c, radius } = useTheme();

  const base: ViewStyle = {
    backgroundColor: variant === 'dashed' ? 'transparent' : c.sur,
    borderWidth: variant === 'dashed' ? 1.5 : 1,
    borderColor: c.brd,
    borderStyle: variant === 'dashed' ? 'dashed' : 'solid',
    borderRadius: variant === 'list' || variant === 'flush' ? radius.listCard : radius.card,
  };

  const padding: ViewStyle =
    variant === 'list'
      ? { paddingHorizontal: 16, paddingVertical: 6 }
      : variant === 'flush'
        ? {}
        : { padding: 18 };

  return (
    <View style={[base, padding, style]} {...rest}>
      {children}
    </View>
  );
}

/** `font:700 10.5px; letter-spacing:.09em; color:var(--mut)` — the card eyebrow. */
export function Eyebrow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <Txt role="eyebrow" tone="mut" uppercase style={style as never}>
      {children}
    </Txt>
  );
}

/** Eyebrow on the left, an action link on the right — the design's card header. */
export function CardHeader({
  title,
  action,
  style,
}: {
  title: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
        style,
      ]}
    >
      <Eyebrow>{title}</Eyebrow>
      {action}
    </View>
  );
}
