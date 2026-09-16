import { useAuth } from '@/features/auth/AuthProvider';
import { useGarage } from '@/features/bikes/GarageProvider';
import { useRecordMutation } from '@/features/shared/useRecordMutation';
import { bikeRepository, perBikeRepositories, profileRepository } from '@/repositories';
import { authService } from '@/services/auth';
import { AppError } from '@/services/errors';
import { closeAllLiveQueries } from '@/services/liveQuery';
import { deleteRecord } from '@/repositories/base';

/**
 * Account deletion.
 *
 * A real deletion, in order: every per-bike collection, then the bikes, then the
 * profile document, then the Firebase identity. Signing the rider out and calling
 * it deleted is the failure this exists to avoid (mistake 32).
 *
 * The Firebase identity goes last on purpose — once it is gone the client has no
 * token left and could not delete the data.
 */
export function useDeleteAccount(options: { onDeleted?: () => void } = {}) {
  const { user } = useAuth();
  const { bikes } = useGarage();

  return useRecordMutation<{ password?: string | undefined; viaGoogle?: boolean }>({
    mutationFn: async ({ password, viaGoogle }) => {
      if (!user) throw new AppError('auth', 'Sign in again to delete your account.');
      const uid = user.uid;

      // Stop every listener first: deleting the documents underneath a live
      // listener would surface permission errors on the way out.
      closeAllLiveQueries();

      for (const repo of perBikeRepositories) {
        await repo.removeAllForUser(uid);
      }

      for (const bike of bikes) {
        await deleteRecord({ name: 'bikes', id: bike.id });
      }

      // The profile document last, then the identity itself — once the identity
      // is gone the client has no token left to delete anything with.
      await profileRepository.remove(uid);
      await authService.deleteAccount({ password, viaGoogle });
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
