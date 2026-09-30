import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Input, Txt } from '@/components';
import { fontFamily } from '@/theme';
import { passwordRules, type PasswordRule } from '@/calculations/passwordRules';
import { useAuthTheme } from './AuthTheme';

/**
 * The password field from the Sign in and Create account boards: the standard
 * 52px input with a 44×44 eye inside its right edge. The eye is a real control
 * with its own accessible name, because a rider who cannot see the field is
 * exactly the rider who needs to check what they typed.
 *
 * The eye sits over the field rather than in `Input`'s `trailing` slot so that
 * nothing element-shaped is handed across a prop — the entry screens are also
 * rendered by harnesses that serialise the tree, and a React element in props
 * takes its owning fiber with it.
 */
export function AuthPasswordField({
  value,
  onChangeText,
  placeholder,
  invalid = false,
  editable = true,
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  size,
  testID,
  toggleTestID,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  invalid?: boolean;
  editable?: boolean;
  autoComplete?: 'current-password' | 'new-password';
  textContentType?: 'password' | 'newPassword';
  returnKeyType?: 'go' | 'next' | 'done';
  onSubmitEditing?: () => void;
  size?: 'standard' | 'compact';
  testID?: string;
  toggleTestID?: string;
}) {
  const { c } = useAuthTheme();
  const [shown, setShown] = useState(false);

  // The eye keeps its own 44px target inside the field's right edge, which is
  // 4px in from the frame on a 52px field and 2px on the 48px one.
  const inset = size === 'compact' ? 2 : 4;

  return (
    <View>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={!shown}
        autoCapitalize="none"
        autoCorrect={false}
        invalid={invalid}
        editable={editable}
        style={editable ? { paddingRight: 48 } : undefined}
        {...(autoComplete === undefined ? {} : { autoComplete })}
        {...(textContentType === undefined ? {} : { textContentType })}
        {...(returnKeyType === undefined ? {} : { returnKeyType })}
        {...(onSubmitEditing === undefined ? {} : { onSubmitEditing })}
        {...(size === undefined ? {} : { size })}
        {...(testID === undefined ? {} : { testID })}
      />
      {editable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          accessibilityState={{ selected: shown }}
          onPress={() => setShown((previous) => !previous)}
          testID={toggleTestID}
          style={({ pressed }) => ({
            position: 'absolute',
            right: inset,
            top: inset,
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <EyeGlyph shown={shown} color={c.mut} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The boards' 20px eye, struck through once the password is visible. */
function EyeGlyph({ shown, color }: { shown: boolean; color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} fill="none" />
      {shown ? <Path d="m5 19 14-14" stroke={color} strokeWidth={1.8} strokeLinecap="round" /> : null}
    </Svg>
  );
}

/**
 * The three chips under the Create account password field.
 *
 * The board puts them up front, unmet in muted grey, ticking green as the rider
 * types. After a refused submit the unmet length rule says how far off it is
 * — "8+ characters — 2 more to go" — and turns red. `passwordRules()` decides
 * all of that; this only draws it.
 */
export function AuthPasswordRules({
  password,
  attempted,
  disabled = false,
}: {
  password: string;
  /** True once the rider has pressed Create account at least once. */
  attempted: boolean;
  /** Offline, the boards draw every chip in muted grey. */
  disabled?: boolean;
}) {
  const rules = passwordRules(password);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      {rules.map((rule) => (
        <AuthPasswordRuleChip key={rule.key} rule={rule} attempted={attempted} disabled={disabled} />
      ))}
    </View>
  );
}

function AuthPasswordRuleChip({
  rule,
  attempted,
  disabled,
}: {
  rule: PasswordRule;
  attempted: boolean;
  disabled: boolean;
}) {
  const { c } = useAuthTheme();

  const state = disabled ? 'pending' : rule.met ? 'met' : attempted ? 'failed' : 'pending';
  const color = state === 'met' ? c.good : state === 'failed' ? c.bad : c.mut;
  const label = state === 'failed' ? (rule.shortfallLabel ?? rule.label) : rule.label;

  return (
    <View
      accessibilityLabel={`${label}. ${state === 'met' ? 'Met' : 'Not met yet'}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
    >
      <RuleGlyph state={state} color={color} />
      <Txt style={{ fontFamily: fontFamily[state === 'failed' ? 600 : 500], fontSize: 11.5, color }}>
        {label}
      </Txt>
    </View>
  );
}

/** An open ring while the rule waits, a filled tick once met, a cross once refused. */
function RuleGlyph({ state, color }: { state: 'pending' | 'met' | 'failed'; color: string }) {
  if (state === 'pending') {
    return (
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} fill="none" />
      </Svg>
    );
  }

  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} fill={color} />
      {state === 'met' ? (
        <Path
          d="m7.5 12.5 3 3 6-6.5"
          stroke="#FFFFFF"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : (
        <Path d="m8 8 8 8M16 8l-8 8" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" fill="none" />
      )}
    </Svg>
  );
}
