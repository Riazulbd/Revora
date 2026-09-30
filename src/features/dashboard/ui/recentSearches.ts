/**
 * The last few searches, for the board's RECENT chips.
 *
 * Deliberately in memory and nowhere else. A query can name a workshop, a
 * document number or a fault the rider wrote down, so it is the rider's data —
 * and writing it anywhere would mean a repository, a sync and a delete path for
 * a convenience worth three taps. The chips live as long as the app does, and
 * the board's resting screen simply has one fewer section before the first
 * search of a session.
 */
const MAX_RECENT = 3;

let recent: string[] = [];

export function recentSearches(): readonly string[] {
  return recent;
}

export function rememberSearch(query: string): readonly string[] {
  const trimmed = query.trim();
  if (trimmed === '') return recent;
  recent = [trimmed, ...recent.filter((q) => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
  return recent;
}

/** Test seam: the chips must not leak between specs. */
export function forgetSearches(): void {
  recent = [];
}
