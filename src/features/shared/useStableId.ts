import { useState } from 'react';

/**
 * A document id chosen once, when the form opens.
 *
 * Because the id is fixed before the first save attempt, a retry — whether from
 * the rider tapping again or from the mutation's own retry policy — writes the
 * same document instead of a second one (requirement 43 / mistake 6).
 *
 * `useState`'s lazy initialiser runs exactly once per mount, which is precisely
 * the guarantee needed here.
 */
export function useStableId(factory: () => string): string {
  const [id] = useState(factory);
  return id;
}
