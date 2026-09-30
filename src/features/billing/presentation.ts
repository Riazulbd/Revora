import type { PlayOffer, PlayPhase } from './googlePlay';

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

/**
 * The phase whose price the plan card headlines: the one that recurs forever.
 * An introductory phase is not the price of the plan — it is an offer on it,
 * and `offerPrice()` spells the whole ladder out underneath.
 */
function recurringPhase(offer: PlayOffer): PlayPhase | undefined {
  return offer.phases.find(phase => phase.recurrenceMode === 1) ?? offer.phases.at(-1);
}

/** ALWAYS Google's localized `formattedPrice`. Never ours, never computed. */
export function offerHeadlinePrice(offer: PlayOffer): string | null {
  return recurringPhase(offer)?.formattedPrice ?? null;
}

/** `Monthly`, `Yearly`, `Every 3 months` — the plan card's own title. */
export function offerTermLabel(offer: PlayOffer): string {
  const phase = recurringPhase(offer);
  if (!phase) return 'Plan';
  const match = /^P(\d+)([DWMY])$/.exec(phase.billingPeriod);
  if (!match) return phase.billingPeriod;
  if (Number(match[1]) === 1) {
    return { D: 'Daily', W: 'Weekly', M: 'Monthly', Y: 'Yearly' }[match[2]!] ?? phase.billingPeriod;
  }
  return `Every ${billingPeriod(phase.billingPeriod)}`;
}

/** True when the offer is more than one phase, so the card must spell it out. */
export function offerHasIntroductoryPhase(offer: PlayOffer): boolean {
  return offer.phases.length > 1;
}

/**
 * The three failures the plan board draws in its Banner slot.
 *
 * Pro itself is never decided here — it comes from `entitlements/{uid}`. This
 * only says why the *store* could not be reached or a purchase could not be
 * attached, which is a different question with a different answer.
 *
 * The account mismatch is recognised by the backend's own refusal
 * ('…linked to another Revora account…', thrown as `permission-denied` from
 * `ACCOUNT_MISMATCH`); nothing else the client holds distinguishes it.
 */
export type PlanNoticeKind = 'account_mismatch' | 'pending' | 'unreachable';

export type PlanNotice = { kind: PlanNoticeKind; lead: string; message: string; retry: boolean };

export function planNotice(state: { pending: boolean; error: string | null }): PlanNotice | null {
  if (state.error !== null && /another Revora account/i.test(state.error)) {
    return {
      kind: 'account_mismatch',
      lead: 'This purchase belongs to a different Revora account.',
      message: 'Sign in to that account to use it, or contact support to move it.',
      retry: false,
    };
  }
  if (state.pending) {
    return {
      kind: 'pending',
      lead: 'Payment pending.',
      message: 'Google Play is still confirming it — Pro unlocks the moment it clears. Nothing more to do here.',
      retry: false,
    };
  }
  if (state.error !== null) {
    return {
      kind: 'unreachable',
      lead: 'Google Play isn’t reachable.',
      message: 'Prices and purchases need it —',
      retry: true,
    };
  }
  return null;
}
