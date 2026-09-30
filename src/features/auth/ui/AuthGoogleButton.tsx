import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fontFamily } from '@/theme';
import { Txt } from '@/components';
import { useAuthTheme } from './AuthTheme';

/**
 * "Continue with Google" — the 52px secondary button every entry board carries:
 * `border-radius:14px; background:var(--sur); border:1px solid var(--brd);
 * gap:10px`, an 18px Google mark, a `700 15px` label.
 *
 * Offline the boards grey the whole thing: `--sur2` fill, a muted label, and
 * the mark drawn in one flat grey rather than in Google's colours, because a
 * full-colour mark on a dead button reads as available.
 */
export function AuthGoogleButton({
  onPress,
  disabled = false,
  loading = false,
  style,
  testID,
}: {
  onPress: () => unknown;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c } = useAuthTheme();
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        {
          height: 52,
          borderRadius: 14,
          backgroundColor: inactive ? c.sur2 : c.sur,
          borderWidth: 1,
          borderColor: c.brd,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <GoogleMark muted={inactive} mutedColor={c.mut} />
      <Txt style={{ fontFamily: fontFamily[700], fontSize: 15, color: inactive ? c.mut : c.ink }}>
        Continue with Google
      </Txt>
    </Pressable>
  );
}

/** Google's mark, path-for-path from the boards. */
function GoogleMark({ muted, mutedColor }: { muted: boolean; mutedColor: string }) {
  const fill = (brand: string) => (muted ? mutedColor : brand);
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48" opacity={muted ? 0.75 : 1}>
      <Path
        fill={fill('#EA4335')}
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill={fill('#4285F4')}
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill={fill('#FBBC05')}
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill={fill('#34A853')}
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/**
 * The line the Welcome board hangs under a greyed Google button, so the reason
 * is on screen rather than implied by the colour.
 */
export function AuthGoogleOfflineNote({ style }: { style?: ViewStyle }) {
  const { c } = useAuthTheme();
  return (
    <View style={style}>
      <Txt
        style={{
          fontFamily: fontFamily[500],
          fontSize: 11.5,
          lineHeight: 17,
          color: c.mut,
          textAlign: 'center',
          paddingHorizontal: 12,
        }}
      >
        Google sign-in needs a connection — it&rsquo;ll work again when you&rsquo;re back online.
      </Txt>
    </View>
  );
}
