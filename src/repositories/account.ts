import { callBackend } from '@/services/backend';

/**
 * Account deletion.
 *
 * One call. The client used to walk every collection itself and then delete
 * `users/{uid}`, which the shared ruleset refuses outright (`allow delete: if
 * false`) — so the last step always failed and the rider was left signed out
 * with their profile, entitlement and photos still on a server. Half a deletion
 * is worse than none.
 *
 * `deleteMyAccount` is the server side of that rule. It reaches the places a
 * client cannot: the Cloud Storage prefix, the server-written collections, and
 * the Firebase identity itself — which has to go last, because once it is gone
 * there is no token left to delete anything with.
 *
 * The caller re-authenticates first (`authService.reauthenticate`); the server
 * refuses a session that has not proved itself in the last ten minutes.
 */
export const accountRepository = {
  /**
   * Erases everything belonging to the signed-in rider, and returns how many
   * documents went with it.
   *
   * `expectedUid` is not decoration: it refuses to fire if the session changed
   * between opening the confirmation and confirming it. The server ignores any
   * uid in the payload regardless and uses only the verified token.
   *
   * Safe to retry. Every step is a delete, so a second attempt finishes what a
   * timeout interrupted rather than doing anything twice — which matters,
   * because a large logbook can outlast the client's own request timeout.
   */
  deleteEverything(uid: string): Promise<{ deleted: number }> {
    return callBackend<{ deleted: number }>('deleteMyAccount', {}, uid);
  },
};
