import React from 'react';
import { View } from 'react-native';

import { fontFamily, useTheme } from '@/theme';
import type { IsoDate } from '@/types';
import { formatMonthLabel } from '@/utils/date';
import { Txt } from './Text';

/**
 * The date block that leads a log row (Figma `Date`): `44×48;
 * background:#F1F2F5; border-radius:14px`, the day in `700 16px` over the
 * month in `600 12px` muted capitals.
 */
export function DateChip({ date }: { date: IsoDate }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: 44,
        height: 48,
        borderRadius: 14,
        backgroundColor: c.sur2,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Txt role="cardTitle" style={{ fontFamily: fontFamily[700] }} numberOfLines={1}>
        {date.slice(8, 10)}
      </Txt>
      <Txt role="smallStrong" tone="mut" uppercase numberOfLines={1}>
        {formatMonthLabel(date.slice(0, 7))}
      </Txt>
    </View>
  );
}
