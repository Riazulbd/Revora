import { getDownloadURL, putFile, ref } from '@react-native-firebase/storage';

import { storage } from './firebase';
import { toAppError } from './errors';
import { log } from './logger';

/**
 * File storage.
 *
 * Photos live in Cloud Storage under `users/{uid}/…`, which storage.rules locks
 * to that rider. What is kept in Firestore is the *path*, never the bytes — a
 * base64 image inside a document would bloat every read of that collection
 * (requirement 50).
 *
 * An upload that fails is not fatal: the caller keeps the local URI on the
 * record so the photo is still visible on this device and can be retried.
 */

export type UploadKind = 'receipt' | 'document' | 'bike' | 'part' | 'accessory' | 'avatar' | 'safety';

function pathFor(uid: string, kind: UploadKind, recordId: string): string {
  return `users/${uid}/${kind}/${recordId}.jpg`;
}

export async function uploadImage(input: {
  uid: string;
  kind: UploadKind;
  recordId: string;
  localUri: string;
}): Promise<string> {
  try {
    const path = pathFor(input.uid, input.kind, input.recordId);
    const reference = ref(storage(), path);
    await putFile(reference, input.localUri.replace('file://', ''));
    return path;
  } catch (error) {
    throw toAppError(error, "Couldn't upload that photo. It's still saved on this device.");
  }
}

/**
 * Uploads when the cloud side exists; keeps the local file when it does not.
 *
 * Cloud photo storage is optional infrastructure — the project works before the
 * Storage bucket has been set up, and a rider's photo must never be lost or
 * blocked by that. The record stores whichever path this returns: the cloud
 * path when the upload succeeded, otherwise the device-local URI, which still
 * renders on this phone.
 */
export async function uploadImageOrKeepLocal(input: {
  uid: string;
  kind: UploadKind;
  recordId: string;
  localUri: string;
}): Promise<{ path: string; uploaded: boolean }> {
  try {
    return { path: await uploadImage(input), uploaded: true };
  } catch (error) {
    log.warn('storage', 'upload failed, keeping local copy', { error: String(error) });
    return { path: input.localUri, uploaded: false };
  }
}

/** Resolves a stored path to a URL the app can render. */
export async function imageUrl(path: string | null): Promise<string | null> {
  if (path === null) return null;
  // A local file URI from a not-yet-uploaded photo renders directly.
  if (path.startsWith('file://') || path.startsWith('http')) return path;
  try {
    return await getDownloadURL(ref(storage(), path));
  } catch (error) {
    log.warn('storage', 'could not resolve image url', { error: String(error) });
    return null;
  }
}
