import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { Txt } from '@/components';
import type { PlannedService } from '@/calculations/serviceplan';
import type { IsoDate } from '@/types';
import { useTheme } from '@/theme';
import { daysBetween, formatMonthLabel, recentMonthKeys, addMonths, monthKey } from '@/utils/date';

/**
 * Figma `chart:timeline` (326×84) at the top of the Service plan: a track
 * across the next twelve months with a dot where each projected item lands,
 * the month initials under it, and anything already overdue piled at the left
 * edge under a red `Now`.
 *
 * An item with no projected date — no riding history to project it from — is
 * not drawn: a dot placed by a guessed rate would be the one thing this card
 * must not show. The list below still names it with its distance.
 */
const DAYS = 365;
const TRACK_Y = 20;
const DOT = 6;
const OVERDUE_DOT = 7;

export function PlanTimeline({ plan, today, testID }: { plan: readonly PlannedService[]; today: IsoDate; testID?: string }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const overdue = plan.filter((row) => row.overdue);
  // Only what lands inside the year is drawn; a dot pinned to the right edge
  // would claim a date the card does not cover.
  const dated = plan.filter(
    (row) => !row.overdue && row.projectedOn !== null && daysBetween(today, row.projectedOn) <= DAYS,
  );

  // The twelve months after this one — the letters along the bottom.
  const months = recentMonthKeys(12, monthKey(addMonths(today, 12)));
  const x = (date: IsoDate) => Math.min(1, Math.max(0, daysBetween(today, date) / DAYS)) * Math.max(0, width - DOT * 2) + DOT;

  return (
    <View style={{ gap: 8 }} onLayout={onLayout} testID={testID}>
      <View style={{ height: 40 }}>
        {overdue.length > 0 ? (
          <Txt role="chip" color={c.bad} style={{ position: 'absolute', left: 0, top: 0 }}>
            Now
          </Txt>
        ) : null}
        {width > 0 ? (
          <Svg width={width} height={40} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Line x1={DOT} x2={width - DOT} y1={TRACK_Y + 4} y2={TRACK_Y + 4} stroke={c.sur2} strokeWidth={4} strokeLinecap="round" />
            {dated.map((row) => (
              <Circle key={row.ruleId} cx={x(row.projectedOn as IsoDate)} cy={TRACK_Y + 4} r={DOT} fill={c.ink} />
            ))}
            {overdue.map((row, index) => (
              <Circle
                key={row.ruleId}
                cx={OVERDUE_DOT + index * (OVERDUE_DOT * 2 + 4)}
                cy={TRACK_Y + 4}
                r={index === 0 ? OVERDUE_DOT : DOT - 1}
                fill={index === 0 ? c.badIcon : c.accBright}
              />
            ))}
          </Svg>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 }}>
        {months.map((key, index) => (
          <Txt key={`${key}-${index}`} role="meta" tone="faint" align="center" style={{ width: 14 }}>
            {formatMonthLabel(key).slice(0, 1)}
          </Txt>
        ))}
      </View>
    </View>
  );
}
