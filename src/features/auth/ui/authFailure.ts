import { toAppError } from '@/services/errors';

/**
 * Which notice a failed sign-in or sign-up should draw.
 *
 * `messageFor` already turns a Firebase code into a sentence; what the boards
 * need on top of that is *where* the sentence goes. Wrong credentials paint
 * both fields red and explain under them; an email already in use paints the
 * email field and offers Sign in; being offline is not the rider's mistake at
 * all and gets the amber note. Everything else stays in the toast, which is
 * where an unexpected failure belongs.
 */
export type AuthFailure = 'offline' | 'credentials' | 'email-in-use' | 'other';

function codeOf(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return null;
}

export function authFailure(error: unknown): AuthFailure {
  const code = codeOf(error);

  if (code === 'auth/network-request-failed') return 'offline';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
    return 'credentials';
  }
  if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use') return 'email-in-use';

  return toAppError(error).kind === 'offline' ? 'offline' : 'other';
}
