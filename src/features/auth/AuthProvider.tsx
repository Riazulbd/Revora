import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authService, observeAuth, type AuthUser } from '@/services/auth';
import { closeAllLiveQueries } from '@/services/liveQuery';
import { log } from '@/services/logger';
import { profileRepository } from '@/repositories';

export type AuthStatus = 'restoring' | 'signed_out' | 'signed_in';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  /** True while the initial session restore is still running. */
  isRestoring: boolean;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signUp: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  continueWithoutAccount: () => Promise<void>;
  /** Resolves false when the rider dismissed the Google account picker. */
  signInWithGoogle: () => Promise<boolean>;
  linkEmailAccount: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session state.
 *
 * The native SDK restores the previous session from the platform keystore before
 * `onAuthStateChanged` first fires, so reopening the app never asks a signed-in
 * rider to sign in again (requirement 7). Until that first callback the status is
 * `restoring`, and the router holds on the splash rather than flashing the
 * welcome screen.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    return observeAuth((next) => {
      setUser(next);
      setStatus(next ? 'signed_in' : 'signed_out');

      if (next) {
        // Make sure the rider has a profile document. Safe to run on every
        // sign-in: it merges and never overwrites an existing one, so a rider who
        // signed up on the web keeps their settings and entitlement.
        void profileRepository
          .ensure({
            uid: next.uid,
            displayName: next.displayName ?? (next.isAnonymous ? 'Rider' : (next.email?.split('@')[0] ?? 'Rider')),
            email: next.email,
          })
          .catch((error) => log.warn('auth', 'profile ensure failed', { error: String(error) }));
      }
    });
  }, []);

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    await authService.signIn(input);
  }, []);

  const signUp = useCallback(async (input: { email: string; password: string; displayName: string }) => {
    await authService.signUp(input);
  }, []);

  const continueWithoutAccount = useCallback(async () => {
    await authService.continueWithoutAccount();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const result = await authService.signInWithGoogle();
    return result !== null;
  }, []);

  const linkEmailAccount = useCallback(
    async (input: { email: string; password: string; displayName: string }) => {
      await authService.linkEmailAccount(input);
    },
    [],
  );

  const signOut = useCallback(async () => {
    // Drop every listener first, so no query fires against a uid that is about
    // to disappear and trip a permission-denied error on the way out.
    closeAllLiveQueries();
    await authService.signOut();
  }, []);

  const refresh = useCallback(async () => {
    const next = await authService.refresh();
    setUser(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isRestoring: status === 'restoring',
      signIn,
      signUp,
      continueWithoutAccount,
      signInWithGoogle,
      linkEmailAccount,
      signOut,
      refresh,
    }),
    [status, user, signIn, signUp, continueWithoutAccount, signInWithGoogle, linkEmailAccount, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The signed-in uid, or null. Screens that require one use `useRequireUid`. */
export function useUid(): string | null {
  return useAuth().user?.uid ?? null;
}
