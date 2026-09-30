import { useAuth } from '@/features/auth/AuthProvider';
import { bikeRepository } from '@/repositories';
import { useLiveQuery } from '@/services/liveQuery';
import type { Bike } from '@/types';

/**
 * Every motorcycle on the account, archived ones included.
 *
 * `useGarage().bikes` deliberately hides archived bikes — no other screen
 * should ever act on one. The Garage board is the exception: it draws the sold
 * CD80 greyed out with "records kept", because a rider who sold a bike and
 * cannot see it anywhere assumes the app threw their history away.
 *
 * It shares the query key `GarageProvider` already subscribes to, so this is
 * the same reference-counted Firestore listener rather than a second one.
 */
export function useAllBikes(): { bikes: Bike[]; isPending: boolean } {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const query = useLiveQuery<Bike[]>({
    queryKey: ['bikes', uid],
    enabled: uid !== null,
    subscribe: (onData, onError) =>
      uid === null ? () => undefined : bikeRepository.subscribe(uid)(onData, onError),
  });

  return { bikes: query.data ?? [], isPending: uid !== null && query.isPending };
}
