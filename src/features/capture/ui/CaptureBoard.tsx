import React from 'react';
import { Pressable, View } from 'react-native';

import { Button, Icon, Txt, type IconName } from '@/components';
import { useTheme } from '@/theme';

/**
 * Fast Capture's three tiles and its "waiting for details" rows.
 *
 * The board paints the Odometer tile in a blue that the Revora palette does not
 * contain — the palette is one accent plus the four status tones, and this tile
 * is neither an accent nor a status. It is transcribed here as a named constant
 * with its own soft tint rather than substituted for the accent, which would
 * make two different actions look like the same one. If a blue is ever added to
 * `src/theme/tokens.ts`, these three lines are what should read it instead.
 */
const ODOMETER_BLUE = '#2E6BE6';
const ODOMETER_BLUE_TINT_LIGHT = '#E7EEFC';
const ODOMETER_BLUE_TINT_DARK = '#16243E';

export type CaptureTileTone = 'accent' | 'odometer' | 'plain';

/** `flex:1; height:120px; border-radius:18px` with a 30px glyph over a `700 14px` label. */
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
        borderRadius: radius.card,
        backgroundColor: background,
        borderWidth: tone === 'plain' ? 1 : 0,
        borderColor: c.brd,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon name={icon} size={30} color={ink} strokeWidth={2} />
      <Txt role="rowTitle" color={ink} numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** The 44px tinted square in front of a waiting row (`border-radius:11px`). */
function CaptureRowIcon({ icon, tone }: { icon: IconName; tone: CaptureTileTone }) {
  const { c, radius, dark } = useTheme();

  const tint =
    tone === 'accent'
      ? c.accS
      : tone === 'odometer'
        ? dark
          ? ODOMETER_BLUE_TINT_DARK
          : ODOMETER_BLUE_TINT_LIGHT
        : c.sur2;
  const ink = tone === 'accent' ? c.acc : tone === 'odometer' ? ODOMETER_BLUE : c.mut;

  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.tile,
        backgroundColor: tint,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={18} color={ink} strokeWidth={1.8} />
    </View>
  );
}

/**
 * One row of the waiting list: `padding:13px 0; gap:12px`, the tinted square,
 * the title and its line, and the 36px pill that routes it into its full form.
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 13,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <CaptureRowIcon icon={icon} tone={tone} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt role="rowTitle" numberOfLines={2}>
          {title}
        </Txt>
        <Txt role="meta" tone={subtitleTone} numberOfLines={2}>
          {subtitle}
        </Txt>
      </View>
      <Button
        label={actionLabel}
        onPress={onAction}
        size="chip"
        variant={actionEmphasis === 'accent' ? 'tinted' : 'subtle'}
        testID={actionTestID}
      />
    </Pressable>
  );
}
