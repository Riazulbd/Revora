import { useAuth } from '@/features/auth/AuthProvider';
import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { accountRepository, bikeRepository } from '@/repositories';
import { authService } from '@/services/auth';
import { AppError } from '@/services/errors';
import { closeAllLiveQueries } from '@/services/liveQuery';

/**
 * Account deletion.
 *
 * Three steps, and the order is the whole design:
 *
 *  1. **Prove who you are.** Firebase's own `deleteUser` refuses without a
 *     recent sign-in; the work now happens on a server, so that protection has
 *     to be asked for explicitly or it is silently lost. `reauthenticate` uses
 *     whichever provider the account actually carries — a Google-only rider is
 *     never asked for a password they never set.
 *
 *  2. **Let the server erase everything.** `deleteMyAccount` deletes the
 *     records, the Cloud Storage prefix, the profile and finally the Firebase
 *     identity. This used to be done here, document by document, and it could
 *     not finish: the shared ruleset sets `allow delete: if false` on
 *     `users/{uid}`, so the profile step always failed and the rider was left
 *     signed out with their data intact on a server (mistake 32).
 *
 *  3. **Drop the dead session.** The identity is gone but this device still
 *     holds a token for it, which stays valid until it expires. Signing out
 *     clears it now instead of an hour from now.
 *
 * The bikes and every per-bike collection go with step 2 — the server sweeps
 * every collection by `userId`, so nothing depends on what this device happens
 * to have loaded into the garage.
 */
export function useDeleteAccount(options: { onDeleted?: () => void } = {}) {
  const { user } = useAuth();

  return useRecordMutation<{ password?: string | undefined; viaGoogle?: boolean }>({
    mutationFn: async ({ password, viaGoogle }) => {
      if (!user) throw new AppError('auth', 'Sign in again to delete your account.');
      const uid = user.uid;

      await authService.reauthenticate({ password, viaGoogle });

      // Stop every listener before the documents underneath them disappear:
      // a live listener on a deleted collection surfaces permission errors on
      // the way out, which the rider would see as the deletion failing.
      closeAllLiveQueries();

      await accountRepository.deleteEverything(uid);
      await authService.signOut();
    },
    successMessage: 'Your account and every record in it have been deleted.',
    errorFallback: "Couldn't delete the account. Sign in again and try once more.",
    onSuccess: () => options.onDeleted?.(),
  });
}

/** Removes one motorcycle and everything logged against it. */
export function useRemoveBike(options: { onRemoved?: () => void } = {}) {
  const { user } = useAuth();

  return useRecordMutation<string>({
    mutationFn: async (bikeId) => {
      if (!user) throw new AppError('auth', 'Sign in again to remove a motorcycle.');
      await bikeRepository.remove(user.uid, bikeId);
    },
    successMessage: 'Motorcycle removed',
    onSuccess: () => options.onRemoved?.(),
  });
}
