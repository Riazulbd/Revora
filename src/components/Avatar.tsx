import React from 'react';
import { Image, Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { Txt } from './Text';

/**
 * The circular profile mark (Figma `Avatar`): a 48px disc with the rider's
 * initial in `700 18px`. On a light surface the disc is the soft accent with
 * the accent text; `onDark` is the More tab's plan card — `#23272C` with the
 * initial in `#FF6B3D`.
 */
export function Avatar({
  name,
  uri,
  size = 48,
  onDark = false,
  onPress,
  accessibilityLabel = 'Profile',
  testID,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  onDark?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { c, text } = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || 'R';

  const body = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: onDark ? c.heroTile : c.accS,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          accessibilityLabel="Profile photo"
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <Txt style={text('tileValue', onDark ? c.heroAcc : c.accText)}>{initial}</Txt>
      )}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      {body}
    </Pressable>
  );
}

/** The 48px circular icon button beside it. */
export function CircleButton({
  children,
  onPress,
  accessibilityLabel,
  showDot = false,
  testID,
}: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  showDot?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.brd,
        backgroundColor: c.sur,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
      {showDot ? (
        <View
          style={{
            position: 'absolute',
            top: 10,
            left: 25,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: c.badIcon,
            borderWidth: 2,
            borderColor: c.sur,
          }}
        />
      ) : null}
    </Pressable>
  );
}
