import React from 'react';
import { Pressable, View } from 'react-native';

import { Button, Icon, RowIcon, Txt, type IconName, type RowTone } from '@/components';
import { useTheme } from '@/theme';

/**
 * Fast Capture's three tiles and its "waiting for details" rows (Figma `E5
 * More — Fast Capture`).
 *
 * The board paints the Odometer tile in a blue that the Revora palette does not
 * contain as a fill — the palette is one accent plus the status tones, and this
 * tile is neither an accent nor a status. It is transcribed here as a named
 * constant rather than substituted for the accent, which would make two
 * different actions look like the same one.
 */
const ODOMETER_BLUE = '#2E6BE6';

export type CaptureTileTone = 'accent' | 'odometer' | 'plain';

/** Figma `Tile · Receipt`: `flex:1; height:120px; border-radius:20px; gap:10px`, a 28px glyph over a `700 14px` label. */
export function CaptureTile({
  label,
  icon,
  tone,
  onPress,
  testID,
}: {
  label: string;
  icon: IconName;
  tone: CaptureTileTone;
  onPress: () => void;
  testID: string;
}) {
  const { c, radius, dark } = useTheme();

  const onColour = dark ? c.bg : '#FFFFFF';
  const background = tone === 'accent' ? c.acc : tone === 'odometer' ? ODOMETER_BLUE : c.sur;
  const ink = tone === 'plain' ? c.ink : onColour;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        flex: 1,
        height: 120,
        borderRadius: radius.smallCard,
        backgroundColor: background,
        borderWidth: tone === 'plain' ? 1 : 0,
        borderColor: c.brd,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon name={icon} size={28} color={ink} strokeWidth={1.8} />
      <Txt role="chip" color={ink} numberOfLines={1} style={{ fontSize: 14, lineHeight: 18 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** The row tile's tone for each capture kind: the receipt is accent, the odometer the info blue, a note plain. */
export function captureRowTone(tone: CaptureTileTone): RowTone {
  return tone === 'accent' ? 'accent' : tone === 'odometer' ? 'info' : 'neutral';
}

/**
 * One row of the waiting list (Figma `Row · Receipt photo`): `padding:12px 0;
 * gap:12px`, the 40px tinted square, the `600 15px` title and its `400 12px`
 * line, and the 40px pill that routes it into its full form — the accent pill
 * for the one the board leads with, the inset pill for the rest.
 *
 * A capture held back by a missing connection says so in `--warn` — waiting is
 * not an error, and the row explains which of the two it is.
 */
export function CaptureWaitingRow({
  title,
  subtitle,
  subtitleTone = 'mut',
  icon,
  tone,
  actionLabel,
  actionEmphasis = 'plain',
  onPress,
  onAction,
  testID,
  actionTestID,
}: {
  title: string;
  subtitle: string;
  subtitleTone?: 'mut' | 'warn';
  icon: IconName;
  tone: CaptureTileTone;
  actionLabel: string;
  actionEmphasis?: 'accent' | 'plain';
  onPress: () => void;
  onAction: () => void;
  testID: string;
  actionTestID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <RowIcon icon={icon} tone={captureRowTone(tone)} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt role="rowTitleLarge" numberOfLines={2}>
          {title}
        </Txt>
        <Txt role="meta" tone={subtitleTone} numberOfLines={2}>
          {subtitle}
        </Txt>
      </View>
      <Button
        label={actionLabel}
        onPress={onAction}
        size="compact"
        padX={14}
        variant={actionEmphasis === 'accent' ? 'primary' : 'subtle'}
        testID={actionTestID}
      />
    </Pressable>
  );
}
