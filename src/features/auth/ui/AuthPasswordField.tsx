import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Input, Txt } from '@/components';
import { fontFamily } from '@/theme';
import { passwordRules, type PasswordRule } from '@/calculations/passwordRules';
import { useAuthTheme } from './AuthTheme';

/**
 * The password field (Figma `Field — Password`): the 48px input with a 48×48
 * eye inside its right edge. The eye is a real control with its own
 * accessible name, because a rider who cannot see the field is exactly the
 * rider who needs to check what they typed.
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

  // The eye's 48px target sits flush inside the field's right edge.
  const inset = 0;

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
            width: 48,
            height: 48,
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
 * The three chips under the Create account password field (Figma `Rules`):
 * pills, `padding:4px 10px 4px 8px; gap:4px`, `600 12px`.
 *
 * They sit up front, unmet on the inset surface in grey, turning to the soft
 * green with a tick as the rider types. After a refused submit the unmet
 * length rule says how far off it is — "8+ characters — 2 more to go" — and
 * turns red. `passwordRules()` decides all of that; this only draws it.
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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
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
  const fill = state === 'met' ? c.goodS : state === 'failed' ? c.badS : c.sur2;
  const label = state === 'failed' ? (rule.shortfallLabel ?? rule.label) : rule.label;

  return (
    <View
      accessibilityLabel={`${label}. ${state === 'met' ? 'Met' : 'Not met yet'}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingLeft: 8,
        paddingRight: 10,
        borderRadius: 999,
        backgroundColor: fill,
      }}
    >
      <RuleGlyph state={state} color={color} />
      <Txt style={{ fontFamily: fontFamily[600], fontSize: 12, lineHeight: 15, color }}>{label}</Txt>
    </View>
  );
}

/** An open ring while the rule waits, a tick once met, a cross once refused. */
function RuleGlyph({ state, color }: { state: 'pending' | 'met' | 'failed'; color: string }) {
  if (state === 'pending') {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} fill="none" />
      </Svg>
    );
  }

  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      {state === 'met' ? (
        <Path d="M20 6 9 17l-5-5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ) : (
        <Path d="M18 6 6 18M6 6l12 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      )}
    </Svg>
  );
}
