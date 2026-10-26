import React from 'react';
import { View } from 'react-native';

import { MiniBars, Txt } from '@/components';
import type { ServiceSpendSummary } from '@/calculations/serviceSpend';
import { useTheme } from '@/theme';
import { formatMonthLabel } from '@/utils/date';

/**
 * Figma `chart:spend` (318×72) inside the Services hero: twelve slim columns,
 * one per month, the current month lit in the accent, and the month initials
 * in `400 12px #9AA1AA` under them. Months with no visit keep a stub so the
 * row still reads as twelve months.
 */
export function ServiceSpendChart({ summary, testID }: { summary: ServiceSpendSummary; testID?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }} testID={testID}>
      <MiniBars
        values={summary.months.map((m) => m.minor)}
        height={50}
        color={c.heroLine}
        highlightColor={c.heroAcc}
        gapRatio={1.6}
        testID={testID === undefined ? undefined : `${testID}-bars`}
      />
      <View style={{ flexDirection: 'row' }}>
        {summary.months.map((m, index) => (
          <Txt key={`${m.key}-${index}`} role="meta" color={c.heroMut} align="center" style={{ flex: 1 }}>
            {formatMonthLabel(m.key).slice(0, 1)}
          </Txt>
        ))}
      </View>
    </View>
  );
}
