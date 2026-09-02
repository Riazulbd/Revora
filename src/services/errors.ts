import { log } from './logger';

/**
 * Every failure the rider can see passes through here.
 *
 * A raw `FirebaseError`, `[firestore/permission-denied]` or an HTTP status is
 * never rendered (requirement 46). Each one is mapped to a sentence a rider can
 * act on, plus a machine-readable `kind` the UI uses to pick the right recovery.
 */

export type AppErrorKind =
  | 'offline'
  | 'auth'
  | 'permission'
  | 'not_found'
  | 'conflict'
  | 'quota'
  | 'validation'
  | 'cancelled'
  | 'unknown';

export class AppError extends Error {
  override readonly name = 'AppError';
  readonly kind: AppErrorKind;
  /** True when retrying the same action could plausibly succeed. */
  readonly retryable: boolean;
  override readonly cause?: unknown;

  constructor(kind: AppErrorKind, message: string, options: { retryable?: boolean; cause?: unknown } = {}) {
    super(message);
    this.kind = kind;
    this.retryable = options.retryable ?? (kind === 'offline' || kind === 'unknown');
    this.cause = options.cause;
  }
}

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/user-disabled': 'This account has been disabled. Contact support to reopen it.',
  'auth/user-not-found': 'No account matches that email address.',
  'auth/wrong-password': 'That email and password do not match.',
  'auth/invalid-credential': 'That email and password do not match.',
  'auth/email-already-in-use': 'An account already exists for that email address.',
  'auth/weak-password': 'Choose a password with at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': "You're offline. Reconnect and try again.",
  'auth/requires-recent-login': 'For your security, sign in again before making this change.',
  'auth/operation-not-allowed': 'That sign-in method is not enabled for Revora.',
  'auth/credential-already-in-use': 'Those credentials already belong to another account.',
};

const FIRESTORE_MESSAGES: Partial<Record<string, [AppErrorKind, string]>> = {
  'firestore/permission-denied': ['permission', "You don't have access to that record."],
  'firestore/not-found': ['not_found', "That record no longer exists — it may have been deleted."],
  'firestore/already-exists': ['conflict', 'That record already exists.'],
  'firestore/unavailable': ['offline', "Can't reach Revora right now. Your changes are saved on this device and will sync automatically."],
  'firestore/deadline-exceeded': ['offline', 'The connection timed out. Your changes are saved on this device.'],
  'firestore/resource-exhausted': ['quota', 'Revora is busy. Try again in a moment.'],
  'firestore/cancelled': ['cancelled', 'That was cancelled.'],
  'firestore/unauthenticated': ['auth', 'Your session expired. Sign in again to continue.'],
  'firestore/failed-precondition': ['conflict', 'Something changed while you were editing. Reopen the record and try again.'],
  'storage/unauthorized': ['permission', "You don't have permission to upload that file."],
  'storage/canceled': ['cancelled', 'Upload cancelled.'],
  'storage/retry-limit-exceeded': ['offline', 'The upload kept failing. Check your connection and try again.'],
  'storage/quota-exceeded': ['quota', 'Storage is full for this account.'],
  'storage/object-not-found': ['not_found', 'That file is no longer available.'],
  'storage/bucket-not-found': ['not_found', "Cloud photo storage isn't set up yet. The photo stays on this phone."],
  'storage/project-not-found': ['not_found', "Cloud photo storage isn't set up yet. The photo stays on this phone."],
  'storage/unknown': ['unknown', "Couldn't upload that photo. It's kept on this phone instead."],
};

function codeOf(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return null;
}

/**
 * Maps any thrown value into an `AppError`. Always returns — never rethrows.
 */
export function toAppError(error: unknown, fallback = 'Something went wrong. Please try again.'): AppError {
  if (error instanceof AppError) return error;

  const code = codeOf(error);

  if (code !== null) {
    if (code.startsWith('auth/')) {
      const message = AUTH_MESSAGES[code];
      if (message) {
        return new AppError('auth', message, { retryable: code === 'auth/network-request-failed', cause: error });
      }
      return new AppError('auth', 'Could not complete that sign-in step. Please try again.', { cause: error });
    }

    const mapped = FIRESTORE_MESSAGES[code];
    if (mapped) {
      const [kind, message] = mapped;
      return new AppError(kind, message, { cause: error });
    }
  }

  const raw = error instanceof Error ? error.message : String(error);
  if (/network|offline|unreachable|timeout|econn/i.test(raw)) {
    return new AppError('offline', "You're offline. Revora saved this on your device and will sync when you reconnect.", {
      cause: error,
    });
  }

  log.error('errors', 'unmapped error', { code, raw });
  return new AppError('unknown', fallback, { cause: error });
}

/** The one-line message shown in a toast or an error state. */
export function messageFor(error: unknown, fallback?: string): string {
  return toAppError(error, fallback).message;
}
