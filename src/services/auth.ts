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
};

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    isAnonymous: user.isAnonymous,
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

export const authService = {
  /**
   * Google Sign-In → Firebase credential.
   *
   * A rider closing the account picker is a decision, not a failure: it returns
   * null and the caller simply stays on the sign-in screen.
   */
  async signInWithGoogle(): Promise<AuthUser | null> {
    ensureGoogleConfigured();
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return null; // cancelled

      const idToken = response.data.idToken;
      if (!idToken) {
        throw new AppError('auth', "Google didn't return a sign-in token. Try again.");
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth(), credential);
      return toAuthUser(result.user);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = String((error as { code: unknown }).code);
        // The library's cancel codes — the rider changed their mind.
        if (code === '12501' || code === 'SIGN_IN_CANCELLED' || code === '-5') return null;
        if (code === 'PLAY_SERVICES_NOT_AVAILABLE' || code === '12500') {
          throw new AppError('auth', 'Google sign-in needs Google Play services, which this device does not have.');
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
  async deleteAccount(password?: string): Promise<void> {
    const user = auth().currentUser;
    if (!user) throw new AppError('auth', 'Sign in again to delete your account.');
    try {
      if (password && user.email) {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
      }
      await deleteUser(user);
    } catch (error) {
      throw toAppError(error);
    }
  },
};
