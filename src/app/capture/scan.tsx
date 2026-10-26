import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { useRouter } from 'expo-router';

import { Button, Icon, Txt, type IconName } from '@/components';
import { useAddCapture } from '@/features/capture/useCaptureMutations';
import { useImagePicker } from '@/features/shared/useImagePicker';
import { useTheme } from '@/theme';

/**
 * Scan a receipt (Figma `E5b More — Capture: Scan receipt (camera)`).
 *
 * A dark full-bleed screen: the viewfinder with the board's corner brackets
 * and scan line, a hint to fit the receipt in the frame, the shutter between
 * the gallery and switch-camera discs. The photo becomes a queued capture the
 * moment it is taken — saved on this phone, finished later, no signal needed.
 */

const INK = '#0B0C0E';
const DISC = '#23272C';
const CHIP = '#262A30';
const CHIP_INK = '#C9CED4';
const CAPTION = '#9AA1AA';
const FRAME_W = 300;
const FRAME_H = 440;
const BRACKET = 36;

export default function ScanReceipt() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const picker = useImagePicker();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [busy, setBusy] = useState(false);

  const addCapture = useAddCapture();

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/capture');
  };

  const queue = async (uri: string) => {
    const saved = await addCapture.submit({ kind: 'receipt', label: 'Receipt photo', detail: null, photoPath: uri });
    if (saved !== null) close();
  };

  const shoot = async () => {
    if (busy || !permission?.granted) return;
    setBusy(true);
    try {
      const picture = await camera.current?.takePictureAsync({ quality: 0.8 });
      if (picture?.uri) await queue(picture.uri);
    } finally {
      setBusy(false);
    }
  };

  const fromGallery = async () => {
    const uri = await picker.fromLibrary();
    if (uri) await queue(uri);
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: INK,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 28,
        paddingHorizontal: 16,
        gap: 16,
      }}
      testID="screen-capture-scan"
    >
      {/* Figma `Top bar`. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Disc icon="x" label="Close" onPress={close} testID="cta-scan-close" />
        <Txt role="screenTitle" color="#FFFFFF">
          Receipt photo
        </Txt>
        <Disc
          icon={flash === 'off' ? 'zapOff' : 'zap'}
          label={flash === 'off' ? 'Flash off' : 'Flash on'}
          onPress={() => setFlash((prev) => (prev === 'off' ? 'on' : 'off'))}
          testID="cta-scan-flash"
        />
      </View>

      {/* Figma `Hint chip`. */}
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 12,
            paddingRight: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: CHIP,
          }}
        >
          <Icon name="scan" size={16} color={c.accBright} />
          <Txt role="mediumStrong" color={CHIP_INK}>
            Fit the whole receipt inside the frame
          </Txt>
        </View>
      </View>

      {/* Figma `Viewfinder`. */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: '100%', maxWidth: FRAME_W, aspectRatio: FRAME_W / FRAME_H, borderRadius: 24, overflow: 'hidden' }}>
          {permission?.granted ? (
            <CameraView ref={camera} facing={facing} flash={flash} style={{ flex: 1 }} />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: DISC }}>
              <Icon name="camera" size={28} color={CAPTION} />
              <Txt role="body" color={CAPTION} align="center">
                {permission?.canAskAgain === false
                  ? 'Camera access is off. Turn it on in your phone settings, or pick a photo from the gallery.'
                  : 'Revora needs the camera to photograph the receipt.'}
              </Txt>
              {permission?.canAskAgain === false ? null : (
                <Button label="Allow camera" size="medium" onPress={() => void requestPermission()} testID="cta-scan-allow" />
              )}
            </View>
          )}
          <Brackets />
          <View pointerEvents="none" style={{ position: 'absolute', left: 24, right: 24, top: '50%', height: 2, backgroundColor: c.accBright, opacity: 0.9 }} />
        </View>
      </View>

      {/* Figma `Caption`. */}
      <Txt role="bodySmall" color={CAPTION} align="center" style={{ paddingHorizontal: 24 }}>
        Saved to Fast Capture straight away — finish the details later, even with no signal.
      </Txt>

      {/* Figma `Controls`. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 }}>
        <Disc icon="image" label="Choose from gallery" size={56} onPress={() => void fromGallery()} testID="cta-scan-gallery" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          accessibilityState={{ disabled: busy || !permission?.granted }}
          disabled={busy || !permission?.granted}
          onPress={() => void shoot()}
          testID="cta-scan-shutter"
          style={({ pressed }) => ({
            width: 80,
            height: 80,
            borderRadius: 40,
            borderWidth: 4,
            borderColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy || !permission?.granted ? 0.5 : pressed ? 0.8 : 1,
          })}
        >
          <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' }} />
        </Pressable>
        <Disc
          icon="refreshCw"
          label="Switch camera"
          size={56}
          onPress={() => setFacing((prev) => (prev === 'back' ? 'front' : 'back'))}
          testID="cta-scan-switch"
        />
      </View>
    </View>
  );
}

/** The `#23272C` discs: 48px in the top bar, 56px among the controls. */
function Disc({
  icon,
  label,
  onPress,
  size = 48,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: DISC,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={size > 48 ? 22 : 20} color="#FFFFFF" />
    </Pressable>
  );
}

/** The four white corner brackets of the board's viewfinder. */
function Brackets() {
  const corner = (pos: { top?: number; bottom?: number; left?: number; right?: number }) => (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: BRACKET,
        height: BRACKET,
        borderColor: '#FFFFFF',
        borderTopWidth: pos.top === undefined ? 0 : 3,
        borderBottomWidth: pos.bottom === undefined ? 0 : 3,
        borderLeftWidth: pos.left === undefined ? 0 : 3,
        borderRightWidth: pos.right === undefined ? 0 : 3,
        borderTopLeftRadius: pos.top !== undefined && pos.left !== undefined ? 12 : 0,
        borderTopRightRadius: pos.top !== undefined && pos.right !== undefined ? 12 : 0,
        borderBottomLeftRadius: pos.bottom !== undefined && pos.left !== undefined ? 12 : 0,
        borderBottomRightRadius: pos.bottom !== undefined && pos.right !== undefined ? 12 : 0,
        ...pos,
      }}
    />
  );
  return (
    <>
      {corner({ top: 12, left: 12 })}
      {corner({ top: 12, right: 12 })}
      {corner({ bottom: 12, left: 12 })}
      {corner({ bottom: 12, right: 12 })}
    </>
  );
}
