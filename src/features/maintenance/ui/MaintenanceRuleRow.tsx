import React from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Icon, ProgressBar, RowIcon, Txt, type RowTone } from '@/components';
import type { RuleWithStatus } from '@/calculations/analytics';
import { maintenanceProgress } from '@/calculations/maintenance';
import type { UnitPreferences } from '@/types';
import { HIT_SIZE, useTheme } from '@/theme';
import { describeInterval, describeRemaining, describeStatusBadge } from '../describeRule';
import { MaintenanceGlyph, glyphForRule } from './MaintenanceGlyph';

/**
 * Figma `Rule row` on the Maintenance list: `padding:14px 0; gap:12px`, the
 * 40px tinted tile, then a column — the `600 15px` name with the status pill
 * beside it, the `400 12px` schedule, a 6px track filled to how much of the
 * interval has gone, and a `500 12px` line in the status colour saying what is
 * left — and a chevron.
 *
 * The pill, the fill and the line are three readings of one
 * `MaintenanceStatus`, so a fuel log that advances the odometer moves all
 * three together.
 */
export function MaintenanceRuleRow({
  entry,
  units,
  onPress,
  testID,
}: {
  entry: RuleWithStatus;
  units: UnitPreferences;
  onPress: () => void;
  testID?: string;
}) {
  const { c } = useTheme();
  const badge = describeStatusBadge(entry.status);
  const tone: RowTone = badge.tone === 'bad' || badge.tone === 'warn' || badge.tone === 'good' ? badge.tone : 'neutral';
  const ink = tone === 'bad' ? c.badIcon : tone === 'warn' ? c.warnIcon : tone === 'good' ? c.good : c.mut;
  const lineColor = tone === 'bad' ? c.bad : tone === 'warn' ? c.warn : tone === 'good' ? c.good : c.mut;
  const progress = maintenanceProgress(entry.rule, entry.status);
  const remaining = describeRemaining(entry.rule, entry.status, units);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.rule.name}. ${badge.label}. ${remaining}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: HIT_SIZE,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <RowIcon tone={tone}>
        <MaintenanceGlyph name={glyphForRule(entry.rule.name)} color={ink} />
      </RowIcon>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt role="rowTitleLarge" numberOfLines={2} style={{ flex: 1 }}>
            {entry.rule.name}
          </Txt>
          <Badge label={badge.label} tone={badge.tone} icon={badge.icon} />
        </View>
        <Txt role="meta" tone="mut" numberOfLines={1}>
          {describeInterval(entry.rule, units)}
        </Txt>
        {progress === null ? null : (
          <ProgressBar fraction={progress} tone={tone} height={6} style={{ marginTop: 2 }} />
        )}
        <Txt role="micro" color={lineColor} numberOfLines={2}>
          {remaining}
        </Txt>
      </View>
      <View style={{ alignSelf: 'center' }}>
        <Icon name="chevronRight" size={20} color={c.faint} />
      </View>
    </Pressable>
  );
}

/**
 * Figma `Off card`: a rule with reminders off, drawn at 0.75 opacity under the
 * TURNED OFF eyebrow — still a row, still opens, because a rule you cannot
 * re-open is a rule you have to delete and retype.
 */
export function MaintenanceOffRow({ name, onPress, testID }: { name: string; onPress: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. Reminders off. Tap to turn back on`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: HIT_SIZE,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <RowIcon tone="neutral">
        <MaintenanceGlyph name="bellOff" color={c.mut} />
      </RowIcon>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt role="rowTitleLarge" numberOfLines={1}>
          {name}
        </Txt>
        <Txt role="meta" tone="mut" numberOfLines={2}>
          Reminders off · history kept · tap to turn back on
        </Txt>
      </View>
    </Pressable>
  );
}
