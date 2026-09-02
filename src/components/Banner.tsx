import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Txt } from './Text';

export type BannerTone = 'warn' | 'good' | 'bad' | 'neutral' | 'accent';

/**
 * The inline callout from the design — the offline notice on the Fuel tab, the
 * queued-reset-link notice on password recovery, the reminder note on a document.
 */
export function Banner({
  message,
  tone = 'warn',
  icon,
  label,
  action,
  style,
  testID,
}: {
  message: string;
  tone?: BannerTone;
  icon?: IconName;
  /** A short uppercase tag before the message, e.g. `OFFLINE`. */
  label?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c, radius } = useTheme();

  const background =
    tone === 'good' ? c.goodS : tone === 'bad' ? c.badS : tone === 'accent' ? c.accS : tone === 'neutral' ? c.sur2 : c.warnS;
  const foreground = tone === 'good' ? c.good : tone === 'bad' ? c.bad : tone === 'accent' ? c.acc : tone === 'neutral' ? c.mut : c.warn;

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[
        {
          backgroundColor: background,
          borderWidth: 1,
          borderColor: c.brd,
          borderRadius: radius.input,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={17} color={foreground} /> : null}
      {label ? (
        <Txt role="fieldLabel" color={foreground}>
          {label}
        </Txt>
      ) : null}
      <Txt role="smallStrong" style={{ flex: 1, lineHeight: 18 }}>
        {message}
      </Txt>
      {action}
    </View>
  );
}
