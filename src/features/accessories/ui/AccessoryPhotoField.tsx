import React from 'react';
import { Image, Pressable, View } from 'react-native';

import { Icon, Txt } from '@/components';
import { useImagePicker } from '@/features/shared/useImagePicker';
import { HIT_SIZE, HIT_SLOP, fontFamily, useTheme } from '@/theme';

/**
 * The Add accessory board's photo slot: the right half of a two-up, so it is a
 * 52px field rather than the full-width dashed panel the other forms use —
 * `border-radius:13px; border:1px dashed var(--brd)`, a 15px camera mark and a
 * `600 12.5px` muted "Add".
 *
 * Once a photo is chosen the slot turns solid and shows it, with the mark it
 * replaced gone and a clear way back out; the board draws only the empty state,
 * but a photo you cannot remove is a trap.
 */
export function AccessoryPhotoField({
  uri,
  onChange,
  testID,
}: {
  uri: string | null;
  onChange: (uri: string | null) => void;
  testID?: string;
}) {
  const { c, radius } = useTheme();
  const picker = useImagePicker();

  const choose = async () => {
    const next = await picker.choose('Accessory photo');
    if (next) onChange(next);
  };

  if (uri === null) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a photo of this accessory"
        accessibilityState={{ busy: picker.busy }}
        disabled={picker.busy}
        onPress={choose}
        testID={testID}
        style={({ pressed }) => ({
          height: 52,
          minHeight: HIT_SIZE,
          borderRadius: radius.input,
          backgroundColor: c.sur,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: c.brd,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          opacity: pressed || picker.busy ? 0.6 : 1,
        })}
      >
        <Icon name="camera" size={15} color={c.mut} strokeWidth={1.8} />
        <Txt style={{ fontFamily: fontFamily[600], fontSize: 12.5, color: c.mut }}>Add</Txt>
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      style={{
        height: 52,
        borderRadius: radius.input,
        backgroundColor: c.sur,
        borderWidth: 1,
        borderColor: c.brd,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change this accessory's photo"
        accessibilityState={{ busy: picker.busy }}
        disabled={picker.busy}
        onPress={choose}
        testID={testID === undefined ? undefined : `${testID}-change`}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          opacity: pressed || picker.busy ? 0.6 : 1,
        })}
      >
        <Image
          source={{ uri }}
          accessibilityIgnoresInvertColors
          style={{ width: 36, height: 36, borderRadius: radius.badge, backgroundColor: c.sur2 }}
          resizeMode="cover"
        />
        <Txt style={{ fontFamily: fontFamily[600], fontSize: 12.5, color: c.ink }}>Change</Txt>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove this accessory's photo"
        hitSlop={HIT_SLOP}
        onPress={() => onChange(null)}
        testID={testID === undefined ? undefined : `${testID}-remove`}
        style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
      >
        <Icon name="cross" size={16} color={c.mut} strokeWidth={1.8} />
      </Pressable>
    </View>
  );
}
