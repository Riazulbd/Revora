import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useToast } from '@/components';
import { compressImage } from '@/services/images';
import { messageFor } from '@/services/errors';

/**
 * Choosing a photo, with every failure path handled.
 *
 * The library goes through the system photo picker, which needs no permission at
 * all. The camera permission is requested only when the rider taps Camera, and a
 * refusal is reported plainly rather than crashing or silently doing nothing
 * (requirement 17 / 18 / 48).
 */
export function useImagePicker() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const fromLibrary = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        selectionLimit: 1,
      });
      if (result.canceled || !result.assets[0]) return null;
      return await compressImage(result.assets[0].uri);
    } catch (error) {
      toast.show(messageFor(error, "Couldn't open your photos."), 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const fromCamera = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        toast.show(
          permission.canAskAgain
            ? 'Camera access is needed to take that photo.'
            : 'Camera access is off. Turn it on in your phone settings to use the camera.',
          'error',
        );
        return null;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 1 });
      if (result.canceled || !result.assets[0]) return null;
      return await compressImage(result.assets[0].uri);
    } catch (error) {
      toast.show(messageFor(error, "Couldn't open the camera."), 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }, [toast]);

  /** Presents the source chooser and resolves with a compressed local URI. */
  const choose = useCallback(
    (title: string): Promise<string | null> =>
      new Promise((resolve) => {
        Alert.alert(title, 'Where should the photo come from?', [
          { text: 'Take a photo', onPress: () => void fromCamera().then(resolve) },
          { text: 'Choose from library', onPress: () => void fromLibrary().then(resolve) },
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        ]);
      }),
    [fromCamera, fromLibrary],
  );

  return { busy, choose, fromCamera, fromLibrary };
}
