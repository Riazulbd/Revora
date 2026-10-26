import React from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Banner, Button, Icon, Input, RowIcon, Txt, type IconName, type RowTone } from '@/components';
import type { OdometerHistoryRow } from '@/calculations/odometerHistory';
import { INITIAL_ODOMETER_POINT_ID } from '@/calculations/odometer';
import type { DistanceUnit, OdometerSource } from '@/types';
import { formatShortDate } from '@/utils/date';
import { formatDistance } from '@/utils/format';
import { HIT_SIZE, useTheme } from '@/theme';

/** The tag on each reading: Fuel log, Manual, Service. */
const SOURCE_TAG: Record<OdometerSource, string> = {
  manual: 'Manual',
  fuel: 'Fuel log',
  service: 'Service',
  expense: 'Expense',
};

const SOURCE_ICON: Record<OdometerSource, IconName> = {
  manual: 'penLine',
  fuel: 'fuel',
  service: 'wrench',
  expense: 'receipt',
};

/**
 * One reading in the history (Figma `Reading`): a 40px tile for where it came
 * from, the reading in `600 15px`, the date and whether it can be corrected
 * here, and the source tag. A reading that looks out of sequence goes amber
 * with the alert glyph; the words carry it too, never the colour alone.
 */
export function OdometerReadingRow({
  row,
  unit,
  selected = false,
  onPress,
  testID,
}: {
  row: OdometerHistoryRow;
  unit: DistanceUnit;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { c } = useTheme();
  const { point, correctable, outOfSequence } = row;

  const note = outOfSequence
    ? 'looks out of sequence'
    : point.id === INITIAL_ODOMETER_POINT_ID
      ? 'your starting reading'
      : correctable
        ? 'tap to correct'
        : 'correct on that record';
  const tone: RowTone = outOfSequence ? 'warn' : point.source === 'fuel' ? 'accent' : 'neutral';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${formatDistance(point.metres, unit)}, ${formatShortDate(point.date)}, ${note}`}
      accessibilityHint={correctable ? 'Opens the correction editor' : 'Shows where this reading comes from'}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: HIT_SIZE,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <RowIcon icon={outOfSequence ? 'triangleAlert' : SOURCE_ICON[point.source]} tone={tone} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt role="rowTitleLarge" tone={outOfSequence ? 'warn' : 'ink'} numberOfLines={1}>
          {formatDistance(point.metres, unit)}
        </Txt>
        <Txt role="meta" tone={outOfSequence ? 'warn' : 'mut'} numberOfLines={1}>
          {`${formatShortDate(point.date)} · ${note}`}
        </Txt>
      </View>
      <Badge label={SOURCE_TAG[point.source]} tone={point.source === 'fuel' ? 'accent' : 'neutral'} />
      {correctable ? <Icon name="chevronRight" size={20} color={c.faint} /> : null}
    </Pressable>
  );
}

/**
 * The correction editor, inline under the history: the old reading struck
 * through, an arrow, the new one — and, before any button, a plain sentence
 * saying what the odometer will read afterwards.
 *
 * Every figure in that sentence comes from `previewOdometerCorrection`, so the
 * promise on screen is the arithmetic that will actually run.
 */
export function OdometerCorrectionPanel({
  dateLabel,
  originalLabel,
  value,
  onChange,
  invalid,
  preview,
  onCommit,
  onCancel,
  onDelete,
  busy,
  unitLabel,
  style,
}: {
  dateLabel: string;
  originalLabel: string;
  value: string;
  onChange: (next: string) => void;
  invalid: boolean;
  /** The sentence describing what the odometer reads after the change. */
  preview: string;
  onCommit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  busy: boolean;
  unitLabel: string;
  style?: { marginTop?: number };
}) {
  const { c, radius } = useTheme();

  return (
    <View
      style={{
        backgroundColor: c.sur,
        borderWidth: 1.5,
        borderColor: c.acc,
        borderRadius: radius.card,
        padding: 16,
        gap: 12,
        ...style,
      }}
      testID="panel-correct-odometer"
    >
      <Txt role="cardTitle">{`Correcting the ${dateLabel} reading`}</Txt>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          accessibilityLabel={`Current reading ${originalLabel}, being replaced`}
          style={{
            flex: 1,
            height: 48,
            borderRadius: radius.input,
            backgroundColor: c.field,
            borderWidth: 1,
            borderColor: c.brd,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt role="inputNumeric" tone="mut" style={{ textDecorationLine: 'line-through' }}>
            {originalLabel}
          </Txt>
        </View>

        <Icon name="arrowRight" size={20} color={c.mut} />

        <Input
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          size="numeric"
          align="center"
          invalid={invalid}
          style={{ flex: 1, height: 48 }}
          accessibilityLabel={`Corrected reading in ${unitLabel}`}
          testID="input-correct-odometer"
        />
      </View>

      <Banner variant="inset" message={preview} testID="preview-odometer" />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Button
          label="Commit correction"
          size="medium"
          flex
          disabled={invalid || value.trim() === ''}
          loading={busy}
          onPress={onCommit}
          testID="cta-save-correction"
        />
        <Button label="Cancel" variant="ghost" tone="mut" size="medium" onPress={onCancel} testID="cta-cancel-correction" />
      </View>

      {/* A reading entered by mistake has to be removable: correcting it to a
          plausible figure would leave a ride that never happened in the history. */}
      <Button label="Delete this reading" variant="ghost" tone="bad" size="small" onPress={onDelete} testID="cta-delete-reading" />
    </View>
  );
}
