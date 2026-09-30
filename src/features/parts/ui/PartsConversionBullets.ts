import type { DistanceUnit, Part } from '@/types';
import { formatDistance } from '@/utils/format';
import { formatShortDate } from '@/utils/date';

/**
 * What moving a part into accessories throws away, in the rider's own figures.
 *
 * `conversionLosses` in `src/calculations/recategorise.ts` names the same
 * things in the abstract; the board names them with the numbers attached —
 * "Expected life (2,000 km) and the wear bar" — because a rider agreeing to
 * lose 2,000 km of projection deserves to see the 2,000 km. Nothing here is
 * derived: every value is read straight off the record being converted.
 */
export function partToAccessoryBullets(part: Part, unit: DistanceUnit): string[] {
  const bullets: string[] = [];

  if (part.expectedLifeMetres !== null) {
    bullets.push(`Expected life (${formatDistance(part.expectedLifeMetres, unit)}) and the wear bar`);
  }

  bullets.push(`Installed-at odometer (${formatDistance(part.installedOdometerMetres, unit)})`);

  const fitted: string[] = [];
  if (part.fittedBy !== null) fitted.push(`Fitted by ${part.fittedBy}`);
  if (part.linkedServiceId !== null) fitted.push('linked service');
  if (fitted.length > 0) bullets.push(fitted.join(' · '));

  if (part.removedDate !== null) {
    bullets.push(`When it came off (${formatShortDate(part.removedDate)})`);
  }

  return bullets;
}
