import React from 'react';
import { Image, View } from 'react-native';

import { Button } from '@/components';
import { useImagePicker } from './useImagePicker';
import { useTheme } from '@/theme';

/**
 * The "Attach pump receipt" control (Figma `Attach`): a 52px outline button,
 * `border:1px solid #C9CED4; border-radius:14px`, a receipt glyph and a
 * `600 14px` label — and the preview it becomes once a photo is chosen.
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
          style={{ width: '100%', height: 168, borderRadius: radius.input, backgroundColor: c.sur2 }}
          resizeMode="cover"
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Replace" variant="secondary" size="small" onPress={choose} flex />
          <Button label="Remove" variant="secondary" size="small" onPress={() => onChange(null)} flex />
        </View>
      </View>
    );
  }

  return (
    <Button
      label={label}
      icon="receipt"
      variant="outline"
      size="large"
      onPress={choose}
      loading={picker.busy}
      {...(testID === undefined ? {} : { testID })}
    />
  );
}
