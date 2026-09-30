import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { Txt } from '@/components';

/**
 * The field wrapper the Parts boards draw: a `600 12px` muted label with an
 * optional `500 11.5px` "Optional" marker pushed to the right edge of the
 * field, the control 7px under it, and a helper or validation line 8px below.
 *
 * The shared `Field` carries the same label and helper but has nowhere to put
 * the right-hand marker, and on these two forms the marker is load-bearing:
 * "Installed odometer" being required and "Expected life" being optional is the
 * difference between a measured life projection and a guessed one.
 */
export function PartsField({
  label,
  optional = false,
  helper,
  error,
  children,
  flex,
  style,
  testID,
}: {
  label: string;
  /** Draws the boards' "Optional" marker on the right of the label row. */
  optional?: boolean;
  helper?: string;
  error?: string | null;
  children: React.ReactNode;
  flex?: number;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <View style={[{ gap: 7 }, flex === undefined ? null : { flex }, style]} testID={testID}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <Txt role="smallStrong" tone="mut" numberOfLines={1} style={{ flexShrink: 1 }}>
          {label}
        </Txt>
        {optional ? (
          <Txt role="helper" tone="mut">
            Optional
          </Txt>
        ) : null}
      </View>
      {children}
      {error ? (
        <Txt role="helper" tone="bad" style={{ marginTop: 1 }}>
          {error}
        </Txt>
      ) : helper ? (
        <Txt role="helper" tone="mut" style={{ marginTop: 1 }}>
          {helper}
        </Txt>
      ) : null}
    </View>
  );
}
