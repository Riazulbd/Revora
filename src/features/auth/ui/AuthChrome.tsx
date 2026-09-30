import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { HIT_SLOP, fontFamily } from '@/theme';
import { Txt } from '@/components';
import { useAuthTheme } from './AuthTheme';

/**
 * The "or" rule between the password form and the Google button:
 * a `--brd` hairline either side of a `500 12px` muted word, `gap:12px`.
 */
export function AuthOrDivider({ style }: { style?: ViewStyle }) {
  const { c } = useAuthTheme();
  return (
    <View
      accessibilityRole="none"
      importantForAccessibility="no-hide-descendants"
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: c.brd }} />
      <Txt style={{ fontFamily: fontFamily[500], fontSize: 12, color: c.mut }}>or</Txt>
      <View style={{ flex: 1, height: 1, backgroundColor: c.brd }} />
    </View>
  );
}

/**
 * The line at the foot of Sign in and Create account — "New to Revora?
 * **Create account**": `500 13px` muted, centred, with a `700` accent word that
 * is the control. The whole 44px row is the target, not just the glyph-height
 * text, so the extra height is pulled back with a negative margin.
 */
export function AuthSwitchLine({
  prompt,
  action,
  onPress,
  style,
  testID,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
  style?: ViewStyle;
  testID?: string;
}) {
  const { c } = useAuthTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${prompt} ${action}`}
      onPress={onPress}
      hitSlop={HIT_SLOP}
      testID={testID}
      style={({ pressed }) => [
        { minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.6 : 1 },
        style,
      ]}
    >
      <Txt
        style={{ fontFamily: fontFamily[500], fontSize: 13, color: c.mut, textAlign: 'center' }}
      >
        {prompt}{' '}
        <Txt style={{ fontFamily: fontFamily[700], fontSize: 13, color: c.acc }}>{action}</Txt>
      </Txt>
    </Pressable>
  );
}

/**
 * "By continuing you agree to the **Terms** and **Privacy Policy**" —
 * `500 11.5px` muted, centred, both documents accent links into `/legal`.
 * They open in the app, not a browser: a rider reading the terms offline is
 * exactly the rider Revora is built for.
 */
export function AuthLegalLine({
  prompt,
  onTerms,
  onPrivacy,
  style,
}: {
  prompt: string;
  onTerms: () => void;
  onPrivacy: () => void;
  style?: ViewStyle;
}) {
  const { c } = useAuthTheme();
  const link = { fontFamily: fontFamily[500], fontSize: 11.5, lineHeight: 17, color: c.acc };

  return (
    <Txt
      style={[
        { fontFamily: fontFamily[500], fontSize: 11.5, lineHeight: 17, color: c.mut, textAlign: 'center' },
        style,
      ]}
    >
      {prompt}{' '}
      <Txt accessibilityRole="link" onPress={onTerms} testID="link-terms" style={link}>
        Terms
      </Txt>
      {' and '}
      <Txt accessibilityRole="link" onPress={onPrivacy} testID="link-privacy" style={link}>
        Privacy Policy
      </Txt>
    </Txt>
  );
}
