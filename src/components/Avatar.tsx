import React from 'react';
import { Image, Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { Txt } from './Text';

/** The circular profile button in the dashboard header and Settings. */
export function Avatar({
  name,
  uri,
  size = 44,
  onPress,
  accessibilityLabel = 'Profile',
  testID,
}: {
  name: string;
  uri?: string | null;
  size?: number;
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
        backgroundColor: c.acc,
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
        <Txt style={text('cardTitle', '#FFFFFF')}>{initial}</Txt>
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

/** The 44px circular icon button beside it (notifications). */
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
        width: 44,
        height: 44,
        borderRadius: 22,
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
            top: 9,
            right: 10,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: c.bad,
            borderWidth: 2,
            borderColor: c.sur,
          }}
        />
      ) : null}
    </Pressable>
  );
}
