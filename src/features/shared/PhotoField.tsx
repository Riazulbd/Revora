import React from 'react';
import { Image, Pressable, View } from 'react-native';

import { Button, Icon, Txt } from '@/components';
import { useImagePicker } from './useImagePicker';
import { useTheme } from '@/theme';

/**
 * The dashed "Attach…" control from the design, and the preview it becomes once
 * a photo is chosen.
 */
export function PhotoField({
  label,
  uri,
  onChange,
  testID,
}: {
  label: string;
  uri: string | null;
  onChange: (uri: string | null) => void;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  const picker = useImagePicker();

  const choose = async () => {
    const next = await picker.choose(label);
    if (next) onChange(next);
  };

  if (uri) {
    return (
      <View style={{ gap: 10 }} testID={testID}>
        <Image
          source={{ uri }}
          accessibilityLabel={label}
          style={{ width: '100%', height: 180, borderRadius: radius.input, backgroundColor: c.sur2 }}
          resizeMode="cover"
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Replace" variant="secondary" size="small" onPress={choose} style={{ flex: 1 }} />
          <Button
            label="Remove"
            variant="secondary"
            size="small"
            onPress={() => onChange(null)}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: picker.busy }}
      disabled={picker.busy}
      onPress={choose}
      testID={testID}
      style={({ pressed }) => ({
        height: 50,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: c.brd,
        borderRadius: radius.input,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed || picker.busy ? 0.6 : 1,
      })}
    >
      <Icon name="camera" size={16} color={c.mut} />
      <Txt role="mediumStrong" tone="mut">
        {label}
      </Txt>
    </Pressable>
  );
}
