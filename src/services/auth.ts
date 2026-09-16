import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  EmailAuthProvider,
  linkWithCredential,
  type User,
} from '@react-native-firebase/auth';

import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

import { auth } from './firebase';
import { AppError, toAppError } from './errors';
import { log } from './logger';

/**
 * Authentication.
 *
 * Tokens are never handled by this app. The native Firebase SDK persists the
 * refresh token in the platform keystore (Android Keystore / iOS Keychain) and
 * refreshes ID tokens itself, so nothing sensitive is written to AsyncStorage,
 * to a file, or to a log (requirement 8 / 68). Session restoration on relaunch is
 * therefore automatic: `onAuthStateChanged` fires with the restored user.
 */

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  /** True for a rider who chose "Continue offline — no account". */
  isAnonymous: boolean;
  /**
   * Which sign-in methods this account carries — 'password', 'google.com'.
   * Re-authentication has to use one the account actually has: asking a
   * Google-only rider for a password they never set is a locked door.
   */
  providers: string[];
};

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    isAnonymous: user.isAnonymous,
    providers: user.providerData.map((entry) => entry.providerId),
  };
}

export function currentUser(): AuthUser | null {
  const user = auth().currentUser;
  return user ? toAuthUser(user) : null;
}

export function observeAuth(onChange: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(auth(), (user) => onChange(user ? toAuthUser(user) : null));
}

/**
 * The OAuth *web* client id from google-services.json (client_type 3). It is an
 * identifier, not a secret: Google validates the app by its package name and
 * the signing-certificate SHA registered on the Firebase project.
 */
const GOOGLE_WEB_CLIENT_ID = '623196607074-pl7nv8prhm77cut27ik7ngsb3lfo3ja4.apps.googleusercontent.com';

let googleConfigured = false;

function ensureGoogleConfigured() {
  if (googleConfigured) return;
  googleConfigured = true;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
}

/**
 * Runs the Google account picker and turns the result into a Firebase
 * credential. Null when the rider closed the picker.
 */
async function googleCredential() {
  ensureGoogleConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    const idToken = response.data.idToken;
    if (!idToken) throw new AppError('auth', "Google didn't return a sign-in token. Try again.");
    return GoogleAuthProvider.credential(idToken);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = String((error as { code: unknown }).code);
      if (code === '12501' || code === 'SIGN_IN_CANCELLED' || code === '-5') return null;
      if (code === 'PLAY_SERVICES_NOT_AVAILABLE' || code === '12500') {
        throw new AppError('auth', 'Google sign-in needs Google Play services, which this device does not have.');
      }
    }
    throw toAppError(error);
  }
}

export const authService = {
  /**
   * Google Sign-In → Firebase credential.
   *
   * A rider closing the account picker is a decision, not a failure: it returns
   * null and the caller simply stays on the sign-in screen.
   */
  async signInWithGoogle(): Promise<AuthUser | null> {
    const credential = await googleCredential();
    if (credential === null) return null;
    try {
      const result = await signInWithCredential(auth(), credential);
      return toAuthUser(result.user);
    } catch (error) {
      throw toAppError(error);
    }
  },

  /**
   * Attaches a Google identity to the current (anonymous) account.
   *
   * `linkWithCredential` keeps the uid, which is the whole point: every bike
   * and log the rider made offline stays theirs. `signInWithCredential` here
   * would mint a fresh uid and silently orphan all of it.
   *
   * If that Google account already owns a separate Revora account, linking is
   * refused rather than merged — two logbooks cannot be folded into one from a
   * phone, and picking a side for the rider would lose one of them.
   */
  async linkGoogleAccount(): Promise<AuthUser | null> {
    const user = auth().currentUser;
    if (!user) throw new AppError('auth', 'Sign in again to finish setting up your account.');
    const credential = await googleCredential();
    if (credential === null) return null;
    try {
      const result = await linkWithCredential(user, credential);
      await result.user.reload();
      return toAuthUser(auth().currentUser ?? result.user);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = String((error as { code: unknown }).code);
        if (code === 'auth/credential-already-in-use') {
          throw new AppError(
            'auth',
            'That Google account already has its own Revora records. To use those instead, sign out and choose Continue with Google.',
          );
        }
      }
      throw toAppError(error);
    }
  },


  async signUp(input: { email: string; password: string; displayName: string }): Promise<AuthUser> {
    try {
      const credential = await createUserWithEmailAndPassword(auth(), input.email.trim(), input.password);
      await updateProfile(credential.user, { displayName: input.displayName.trim() });
      // Verification is offered, not enforced: a rider at a fuel station must be
      // able to log a fill before they next open their inbox.
      void sendEmailVerification(credential.user).catch((error) => {
        log.warn('auth', 'verification email failed', { error: String(error) });
      });
      await credential.user.reload();
      return toAuthUser(auth().currentUser ?? credential.user);
    } catch (error) {
      throw toAppError(error);
    }
  },

  async signIn(input: { email: string; password: string }): Promise<AuthUser> {
    try {
      const credential = await signInWithEmailAndPassword(auth(), input.email.trim(), input.password);
      return toAuthUser(credential.user);
    } catch (error) {
      throw toAppError(error);
    }
  },

  /**
   * "Continue offline — no account". A real Firebase identity is created, so the
   * rider's records are already owned, private and ready to be claimed later by
   * `linkEmailAccount` without losing a single row.
   */
  async continueWithoutAccount(): Promise<AuthUser> {
    try {
      const credential = await signInAnonymously(auth());
      return toAuthUser(credential.user);
    } catch (error) {
      throw toAppError(error);
    }
  },

  /** Upgrades an anonymous rider to a full account, keeping their uid and data. */
  async linkEmailAccount(input: { email: string; password: string; displayName: string }): Promise<AuthUser> {
    const user = auth().currentUser;
    if (!user) throw new AppError('auth', 'Sign in again to finish setting up your account.');
    try {
      const credential = EmailAuthProvider.credential(input.email.trim(), input.password);
      const result = await linkWithCredential(user, credential);
      await updateProfile(result.user, { displayName: input.displayName.trim() });
      void sendEmailVerification(result.user).catch(() => undefined);
      await result.user.reload();
      return toAuthUser(auth().currentUser ?? result.user);
    } catch (error) {
      throw toAppError(error);
    }
  },

  async signOut(): Promise<void> {
    try {
      await signOut(auth());
    } catch (error) {
      throw toAppError(error);
    }
  },

  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth(), email.trim());
    } catch (error) {
      throw toAppError(error);
    }
  },

  async resendVerification(): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new AppError('auth', 'Sign in again to resend the verification email.');
    try {
      await sendEmailVerification(user);
    } catch (error) {
      throw toAppError(error);
    }
  },

  async refresh(): Promise<AuthUser | null> {
    const user = auth().currentUser;
    if (!user) return null;
    try {
      await user.reload();
    } catch (error) {
      log.warn('auth', 'reload failed', { error: String(error) });
    }
    const refreshed = auth().currentUser;
    return refreshed ? toAuthUser(refreshed) : null;
  },

  async updateDisplayName(displayName: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new AppError('auth', 'Sign in again to change your name.');
    try {
      await updateProfile(user, { displayName: displayName.trim() });
    } catch (error) {
      throw toAppError(error);
    }
  },

  /**
   * Deletes the Firebase identity. The caller deletes the rider's records first
   * — an account deletion that only signs the rider out is not a deletion
   * (mistake 32).
   *
   * Firebase requires a recent sign-in; `password` re-authenticates when the
   * session has aged out.
   */
  async deleteAccount(reauth: { password?: string; viaGoogle?: boolean }): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new AppError('auth', 'Sign in again to delete your account.');
    try {
      if (reauth.viaGoogle) {
        const credential = await googleCredential();
        if (credential === null) throw new AppError('auth', 'Confirm with Google to delete your account.');
        await reauthenticateWithCredential(user, credential);
      } else if (reauth.password && user.email) {
        const credential = EmailAuthProvider.credential(user.email, reauth.password);
        await reauthenticateWithCredential(user, credential);
      }
      await deleteUser(user);
    } catch (error) {
      throw toAppError(error);
    }
  },

};
