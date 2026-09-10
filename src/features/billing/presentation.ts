import type { PlayOffer } from './googlePlay';

export function billingPeriod(period: string): string {
  const match = /^P(\d+)([DWMY])$/.exec(period);
  if (!match) return period;
  const count = Number(match[1]);
  const unit = { D: 'day', W: 'week', M: 'month', Y: 'year' }[match[2]!];
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/** Amounts and currencies are ALWAYS Google's localized formattedPrice. */
export function offerPrice(offer: PlayOffer): string {
  return offer.phases.map(phase => {
    const period = billingPeriod(phase.billingPeriod);
    if (phase.recurrenceMode === 1) return `${phase.formattedPrice} every ${period}`;
    // Finite recurring: a single cycle is an introductory period, not "1 payments".
    if (phase.recurrenceMode === 2) {
      return phase.billingCycleCount === 1
        ? `${phase.formattedPrice} for the first ${period}`
        : `${phase.formattedPrice} every ${period} for ${phase.billingCycleCount} payments`;
    }
    return `${phase.formattedPrice} for ${period}`;
  }).join(', then ');
}

export function billingResponseMessage(code: number): string {
  if (code === 1) return 'Purchase canceled. Your plan has not changed.';
  if (code === 7) return 'You already own this subscription on Google Play. Restoring it to your Revora account…';
  if (code === 3) return 'Google Play Billing is unavailable for this account or device.';
  if (code === 4) return 'This subscription is currently unavailable. Reload the plans and try again.';
  return 'Google Play could not complete the purchase. Try again, or check your payment method in Google Play.';
}
