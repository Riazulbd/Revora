import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { log } from './logger';

/**
 * Image preparation.
 *
 * A modern phone camera produces 4–12 MB files. Uploading one of those over a
 * 3G connection at a petrol pump is the difference between a receipt that
 * attaches and one that times out — so every image is resized to a legible
 * 1600px and re-encoded as JPEG before it goes anywhere (requirement 47).
 */

const MAX_EDGE = 1600;
const QUALITY = 0.7;

export async function compressImage(uri: string): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(uri).resize({ width: MAX_EDGE });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
    return result.uri;
  } catch (error) {
    // A failed resize must not lose the rider's photo — fall back to the original.
    log.warn('images', 'compression failed, using original', { error: String(error) });
    return uri;
  }
}
