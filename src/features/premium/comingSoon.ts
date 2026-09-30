/**
 * Features advertised on the Pro plan that are not shipping yet.
 *
 * One flag, read everywhere the feature is named, so the plan screen, the
 * upsell sheet and the menu row can never disagree about whether a rider can
 * use it. Selling a subscription on a feature that is not there is the kind of
 * promise that gets a listing pulled, so the flag exists to make the honest
 * wording automatic rather than something to remember in four files.
 *
 * Flip ASSISTANT_COMING_SOON to false on the day the Assistant ships; nothing
 * else needs editing.
 */
export const ASSISTANT_COMING_SOON = true;

/** The marker shown beside a feature that is announced but not yet usable. */
export const COMING_SOON_LABEL = 'COMING SOON';

/**
 * How a Pro feature reads in a list.
 *
 * The suffix goes on the feature itself rather than in a footnote: a rider
 * comparing plans reads the line, not the small print under it.
 */
export function proFeatureLabel(label: string, comingSoon: boolean): string {
  return comingSoon ? `${label} · coming soon` : label;
}
