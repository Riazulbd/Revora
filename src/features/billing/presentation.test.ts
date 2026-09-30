import {
  billingResponseMessage,
  offerHasIntroductoryPhase,
  offerHeadlinePrice,
  offerPrice,
  offerTermLabel,
  planNotice,
} from './presentation';

test('displays the exact localized Google price and dynamic duration', () => {
  expect(offerPrice({ basePlanId: 'from-play', offerToken: 'token', phases: [
    { formattedPrice: '৳৯৯.০০', billingPeriod: 'P3M', billingCycleCount: 0, recurrenceMode: 1 },
  ] })).toBe('৳৯৯.০০ every 3 months');
  expect(offerPrice({ basePlanId: 'prepaid', offerToken: 'token', phases: [
    { formattedPrice: '€12,49', billingPeriod: 'P1Y', billingCycleCount: 0, recurrenceMode: 3 },
  ] })).toBe('€12,49 for 1 year');
});
test('an introductory phase is described before the price it becomes', () => {
  // Play sends the phases in order; the rider must see what they pay later too.
  expect(offerPrice({ basePlanId: 'monthly', offerToken: 'token', phases: [
    { formattedPrice: 'Free', billingPeriod: 'P1W', billingCycleCount: 1, recurrenceMode: 2 },
    { formattedPrice: '$4.99', billingPeriod: 'P1M', billingCycleCount: 0, recurrenceMode: 1 },
  ] })).toBe('Free for the first 1 week, then $4.99 every 1 month');
  expect(offerPrice({ basePlanId: 'monthly', offerToken: 'token', phases: [
    { formattedPrice: '$2.49', billingPeriod: 'P1M', billingCycleCount: 3, recurrenceMode: 2 },
    { formattedPrice: '$4.99', billingPeriod: 'P1M', billingCycleCount: 0, recurrenceMode: 1 },
  ] })).toBe('$2.49 every 1 month for 3 payments, then $4.99 every 1 month');
});
test('an unparseable billing period is shown as Google sent it, never guessed', () => {
  expect(offerPrice({ basePlanId: 'odd', offerToken: 'token', phases: [
    { formattedPrice: '$1.00', billingPeriod: 'P1M2D', billingCycleCount: 0, recurrenceMode: 1 },
  ] })).toBe('$1.00 every P1M2D');
});
test('canceled, owned, unavailable and unknown failures have actionable messages', () => {
  expect(billingResponseMessage(1)).toContain('canceled');
  expect(billingResponseMessage(7)).toContain('Restoring');
  expect(billingResponseMessage(3)).toContain('unavailable');
  expect(billingResponseMessage(4)).toContain('Reload');
  expect(billingResponseMessage(999)).toContain('could not complete');
});

const phase = (formattedPrice: string, billingPeriod: string, recurrenceMode: number, billingCycleCount = 0) =>
  ({ formattedPrice, billingPeriod, billingCycleCount, recurrenceMode });
const offer = (...phases: ReturnType<typeof phase>[]) => ({ basePlanId: 'plan', offerToken: 'token', phases });

test('the plan card headlines the recurring price, never an introductory one', () => {
  expect(offerHeadlinePrice(offer(phase('Free', 'P1W', 2, 1), phase('$4.99', 'P1M', 1)))).toBe('$4.99');
  expect(offerHeadlinePrice(offer(phase('€12,49', 'P1Y', 3)))).toBe('€12,49');
  expect(offerHeadlinePrice({ basePlanId: 'plan', offerToken: 'token', phases: [] })).toBeNull();
});

test('the plan card titles itself from Google’s billing period', () => {
  expect(offerTermLabel(offer(phase('৳299', 'P1M', 1)))).toBe('Monthly');
  expect(offerTermLabel(offer(phase('৳2,499', 'P1Y', 1)))).toBe('Yearly');
  expect(offerTermLabel(offer(phase('৳99', 'P3M', 1)))).toBe('Every 3 months');
  expect(offerTermLabel(offer(phase('$1.00', 'P1M2D', 1)))).toBe('P1M2D');
});

test('an offer with an introductory phase is flagged so the card spells it out', () => {
  expect(offerHasIntroductoryPhase(offer(phase('$4.99', 'P1M', 1)))).toBe(false);
  expect(offerHasIntroductoryPhase(offer(phase('Free', 'P1W', 2, 1), phase('$4.99', 'P1M', 1)))).toBe(true);
});

describe('the plan screen’s banner slot', () => {
  test('is empty when Google Play is answering and nothing is pending', () => {
    expect(planNotice({ pending: false, error: null })).toBeNull();
  });

  test('puts the account mismatch ahead of everything else', () => {
    const notice = planNotice({
      pending: true,
      error: 'This purchase is linked to another Revora account, or could not be linked. Sign in to the account used to subscribe.',
    });
    expect(notice?.kind).toBe('account_mismatch');
    expect(notice?.retry).toBe(false);
  });

  test('says a pending payment needs nothing from the rider', () => {
    const notice = planNotice({ pending: true, error: null });
    expect(notice?.kind).toBe('pending');
    expect(notice?.lead).toBe('Payment pending.');
    expect(notice?.retry).toBe(false);
  });

  test('offers a retry, and reassures about the current plan, when Play is unreachable', () => {
    const notice = planNotice({ pending: false, error: 'Google Play did not respond. Try again.' });
    expect(notice?.kind).toBe('unreachable');
    expect(notice?.retry).toBe(true);
  });
});
