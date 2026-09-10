import { billingResponseMessage, offerPrice } from './presentation';

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
