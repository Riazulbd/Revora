import { getApp } from '@react-native-firebase/app';
import { getIdToken } from '@react-native-firebase/auth';
import { auth } from './firebase';
import { AppError } from './errors';

/** Firebase callable protocol, authenticated using the current Revora session. */
export async function callBackend<T>(name: string, data: unknown, expectedUid?: string): Promise<T> {
  const user = auth().currentUser;
  if (!user || (expectedUid && user.uid !== expectedUid)) throw new Error('Sign in to your Revora account again.');
  const idToken = await getIdToken(user);
  if (auth().currentUser?.uid !== user.uid) throw new Error('Account changed. Try again.');
  const project = getApp().options.projectId;
  if (!project) throw new Error('Revora could not connect to your account.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 115000);
  try {
    const response = await fetch(`https://us-central1-${project}.cloudfunctions.net/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ data }), signal: controller.signal,
    });
    // A 404 means the function is not deployed — that is an operator problem,
    // not the rider's connection, and telling them to check their signal sends
    // them chasing something they cannot fix.
    if (response.status === 404 || response.status === 501) {
      throw new AppError('validation', 'This part of Revora is not available yet. Try again later.');
    }
    const payload = await response.json().catch(() => ({})) as
      { result?: T; error?: { message?: string; status?: string } };
    if (!response.ok || payload.error || payload.result === undefined) {
      throw new AppError(payload.error?.status === 'PERMISSION_DENIED' ? 'permission' : 'validation',
        payload.error?.message ?? 'Could not synchronize your account. Try again.');
    }
    if (auth().currentUser?.uid !== user.uid) throw new Error('Account changed. Try again.');
    return payload.result;
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw new AppError('offline', 'Could not reach Revora. Check your connection and try again.', { retryable: true });
  } finally { clearTimeout(timer); }
}
