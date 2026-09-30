import React from 'react';
import { Image, Pressable, View, type ViewStyle } from 'react-native';

import { HIT_SIZE, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Txt } from './Text';

/**
 * Bike and record photography, in the two shapes the boards draw it.
 *
 * Both fall back to the Revora mark on a `--sur2` ground rather than to a
 * broken-image box or a blank rectangle, which is what the Garage, Parts and
 * Records boards all show when a rider has not added a picture yet. The mark is
 * `odometer` — the same needle-over-arc glyph the design uses as its own — set
 * in a dimmed `--mut` so it reads as furniture rather than as content.
 */

/** The dimmed glyph colour the boards use for a placeholder (`#C6CAD1` over `--sur2`). */
const PLACEHOLDER_OPACITY = 0.55;

export function PhotoPanel({
  uri,
  height = 180,
  placeholder = 'Add a photo of the bike',
  onPress,
  accessibilityLabel,
  style,
  testID,
}: {
  /** `null` or omitted draws the placeholder. */
  uri?: string | null;
  /** The boards' full-width panel is 180px inside a `Card variant="flush"`. */
  height?: number;
  /** `600 12px` muted line under the mark; `null` draws the mark alone. */
  placeholder?: string | null;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c } = useTheme();

  const body = uri ? (
    <Image
      source={{ uri }}
      accessibilityLabel={accessibilityLabel ?? 'Photo'}
      style={{ width: '100%', height }}
      resizeMode="cover"
    />
  ) : (
    <View
      style={{
        height,
        backgroundColor: c.sur2,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <Icon name="odometer" size={44} color={c.mut} strokeWidth={2.5} opacity={PLACEHOLDER_OPACITY} />
      {placeholder === null ? null : (
        <Txt role="smallStrong" tone="mut">
          {placeholder}
        </Txt>
      )}
    </View>
  );

  if (!onPress) return <View style={style} testID={testID}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (uri ? 'Photo' : placeholder) ?? 'Photo'}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }, style]}
    >
      {body}
    </Pressable>
  );
}

/**
 * The thumbnail beside a row: `84×64; border-radius:11px` on the Garage's bike
 * list, `56×72; border-radius:8px; border:1px solid var(--brd)` on the Records
 * board's document rows (pass `bordered` for the second).
 */
export function PhotoThumb({
  uri,
  width = 84,
  height = 64,
  radius: r = 11,
  bordered = false,
  tone = 'mut',
  onPress,
  accessibilityLabel = 'Photo',
  style,
  testID,
}: {
  uri?: string | null;
  width?: number;
  height?: number;
  radius?: number;
  bordered?: boolean;
  /** The placeholder mark's colour — `acc` is the Records board's document thumb. */
  tone?: 'mut' | 'acc';
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c } = useTheme();
  const accent = tone === 'acc';

  const frame: ViewStyle = {
    width,
    height,
    borderRadius: r,
    backgroundColor: c.sur2,
    borderWidth: bordered ? 1 : 0,
    borderColor: c.brd,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  };

  const body = (
    <View style={frame}>
      {uri ? (
        <Image
          source={{ uri }}
          accessibilityLabel={accessibilityLabel}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <Icon
          name="odometer"
          size={Math.round(Math.min(width, height) * 0.42)}
          color={accent ? c.acc : c.mut}
          strokeWidth={2.5}
          {...(accent ? {} : { opacity: PLACEHOLDER_OPACITY })}
        />
      )}
    </View>
  );

  if (!onPress) return <View style={style} testID={testID}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      hitSlop={
        height < HIT_SIZE ? { top: (HIT_SIZE - height) / 2, bottom: (HIT_SIZE - height) / 2 } : undefined
      }
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }, style]}
    >
      {body}
    </Pressable>
  );
}
