import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Input, Txt, type IconName } from '@/components';
import { SAFETY_STATUS_LABEL } from '@/calculations/safetySessions';
import { HIT_SIZE, fontFamily, useTheme } from '@/theme';
import type { SafetyArea, SafetyStatus } from '@/types';

/**
 * One row of the walk-around check.
 *
 * The board calls it a one-handed form and builds it that way: the whole pass
 * is one screen, every area is one row, and every row is answered with a single
 * tap on one of three 40px targets. Nothing here scrolls sideways, nothing
 * opens a picker, and nothing has to be typed unless the rider found something
 * — which is the only case where words are worth asking for.
 *
 * Marking an area is a choice of three, not a toggle: OK, watch and action are
 * three different statements and none of them is the absence of the others.
 * Leaving a row untouched stays a fourth thing — an area this pass did not
 * cover — and writes no record at all.
 */

const STATUSES: readonly SafetyStatus[] = ['ok', 'watch', 'action'];

export const SAFETY_AREA_ICON: Record<SafetyArea, IconName> = {
  tyres: 'target',
  chain: 'settings',
  brakes: 'circle',
  battery: 'card',
  lights: 'sparkle',
};

/** What the app adds to the rider's own words, per status. */
const TAIL: Record<SafetyStatus, string | null> = {
  ok: null,
  watch: 'Noted — it will sit on the Safety screen until a later check clears it.',
  action: 'This shows on the Dashboard until a later check clears it.',
};

export function RecordsWalkaroundRow({
  area,
  label,
  status,
  onStatus,
  summary,
  onSummary,
  error,
  testID,
}: {
  area: SafetyArea;
  label: string;
  /** `null` is an area this pass has not covered — not a fourth status. */
  status: SafetyStatus | null;
  onStatus: (next: SafetyStatus) => void;
  summary: string;
  onSummary: (next: string) => void;
  error?: string | null;
  testID: string;
}) {
  const { c, dark, radius } = useTheme();
  const needsWords = status === 'watch' || status === 'action';
  const tone = status === 'action' ? c.bad : status === 'watch' ? c.warn : c.good;

  return (
    <View
      testID={testID}
      style={{
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: c.brd,
        borderRadius: radius.listCard,
        paddingVertical: 14,
        paddingHorizontal: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
          <Icon name={SAFETY_AREA_ICON[area]} size={18} color={c.mut} strokeWidth={1.8} />
          <Txt role="tileValue" numberOfLines={1}>
            {label}
          </Txt>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>
          {STATUSES.map((value) => {
            const active = value === status;
            const fill = value === 'action' ? c.bad : value === 'watch' ? c.warn : c.good;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${label} — ${SAFETY_STATUS_LABEL[value]}`}
                onPress={() => onStatus(value)}
                hitSlop={{ top: (HIT_SIZE - 40) / 2, bottom: (HIT_SIZE - 40) / 2 }}
                testID={`${testID}-${value}`}
                style={({ pressed }) => ({
                  height: 40,
                  minWidth: 56,
                  paddingHorizontal: 12,
                  borderRadius: radius.tile,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? fill : c.sur2,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Txt
                  numberOfLines={1}
                  style={{
                    fontFamily: fontFamily[active ? 700 : 600],
                    fontSize: 13,
                    color: active ? (dark ? c.bg : '#FFFFFF') : c.mut,
                  }}
                >
                  {SAFETY_STATUS_LABEL[value]}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </View>

      {needsWords ? (
        <View style={{ gap: 7, marginTop: 10 }}>
          <Input
            value={summary}
            onChangeText={onSummary}
            placeholder="What did you find?"
            autoCapitalize="sentences"
            size="micro"
            inset
            padX={14}
            invalid={Boolean(error)}
            testID={`${testID}-note`}
          />
          <Txt role="meta" color={error ? c.bad : tone}>
            {error ?? TAIL[status]}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
