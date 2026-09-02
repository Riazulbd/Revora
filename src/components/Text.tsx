import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { MAX_FONT_SCALE, useTheme, type TypeRole } from '@/theme';

export type TxtProps = Omit<RNTextProps, 'role'> & {
  /** A named role from the design's type scale. */
  role?: TypeRole;
  /** A colour token name, or an explicit colour. */
  tone?: 'ink' | 'mut' | 'acc' | 'good' | 'warn' | 'bad' | 'inverse';
  color?: string;
  align?: 'left' | 'center' | 'right';
  uppercase?: boolean;
};

/**
 * The only text primitive in the app.
 *
 * Going through one component is what keeps 39 screens on the same type scale,
 * and it is where the accessibility font-scale cap is applied — scaling stays on,
 * it just stops short of the point where a currency row would collapse
 * (requirement 57).
 */
export function Txt({
  role = 'body',
  tone = 'ink',
  color,
  align,
  uppercase,
  style,
  children,
  ...rest
}: TxtProps) {
  const { c, text } = useTheme();

  const toneColor =
    color ??
    (tone === 'inverse'
      ? c.bg
      : tone === 'mut'
        ? c.mut
        : tone === 'acc'
          ? c.acc
          : tone === 'good'
            ? c.good
            : tone === 'warn'
              ? c.warn
              : tone === 'bad'
                ? c.bad
                : c.ink);

  return (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[
        text(role, toneColor),
        align ? { textAlign: align } : null,
        uppercase ? { textTransform: 'uppercase' } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
