import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Badge, Banner, Button, Eyebrow, Input, Txt } from '@/components';
import type { OdometerHistoryRow } from '@/calculations/odometerHistory';
import { INITIAL_ODOMETER_POINT_ID } from '@/calculations/odometer';
import type { DistanceUnit, OdometerSource } from '@/types';
import { formatShortDate } from '@/utils/date';
import { formatDistance } from '@/utils/format';
import { HIT_SIZE, useTheme } from '@/theme';

/** The board's tag on each reading: FUEL LOG, MANUAL, SERVICE. */
const SOURCE_TAG: Record<OdometerSource, string> = {
  manual: 'Manual',
  fuel: 'Fuel log',
  service: 'Service',
  expense: 'Expense',
};

/**
 * One reading in the history.
 *
 * The second line is the whole point of the row: it says whether this reading
 * can be put right here, or whether it belongs to a record that has to be
 * edited instead — and, when the readings around it disagree, that this is the
 * one that looks wrong. Colour is never the only signal; the words carry it.
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
  const { point, correctable, outOfSequence } = row;

  const note = outOfSequence
    ? 'looks out of sequence'
    : point.id === INITIAL_ODOMETER_POINT_ID
      ? 'your starting reading'
      : correctable
        ? 'tap to correct'
        : 'correct on that record';

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
        paddingVertical: 13,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt role="rowTitle" tone={outOfSequence ? 'warn' : 'ink'} numberOfLines={1}>
          {formatDistance(point.metres, unit)}
        </Txt>
        <Txt role="meta" tone={outOfSequence ? 'warn' : 'mut'} numberOfLines={1}>
          {`${formatShortDate(point.date)} · ${note}`}
        </Txt>
      </View>
      <Badge label={SOURCE_TAG[point.source]} size="tag" tone={point.source === 'fuel' ? 'accent' : 'neutral'} />
    </Pressable>
  );
}

/**
 * The correction editor, inline under the history exactly as the board draws
 * it: the old reading struck through, an arrow, the new one — and, before any
 * button, a plain sentence saying what the odometer will read afterwards.
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
      <Eyebrow>{`Correcting the ${dateLabel} reading`}</Eyebrow>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          accessibilityLabel={`Current reading ${originalLabel}, being replaced`}
          style={{
            flex: 1,
            height: 52,
            borderRadius: radius.input,
            backgroundColor: c.bg,
            borderWidth: 1,
            borderColor: c.brd,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt role="inputNumeric" tone="mut" style={{ fontSize: 17, textDecorationLine: 'line-through' }}>
            {originalLabel}
          </Txt>
        </View>

        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 12h14m-5-5 5 5-5 5"
            stroke={c.mut}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>

        <Input
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          size="numeric"
          align="center"
          invalid={invalid}
          style={{ flex: 1, height: 52 }}
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
        <Button
          label="Cancel"
          variant="ghost"
          tone="mut"
          size="medium"
          onPress={onCancel}
          style={{ width: 100 }}
          testID="cta-cancel-correction"
        />
      </View>

      {/* Not on the board, but a reading entered by mistake has to be removable:
          correcting it to a plausible figure would leave a ride that never
          happened in the history. */}
      <Button
        label="Delete this reading"
        variant="ghost"
        tone="bad"
        size="small"
        onPress={onDelete}
        testID="cta-delete-reading"
      />
    </View>
  );
}
