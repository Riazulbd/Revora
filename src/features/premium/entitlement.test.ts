import { entitlementIsActive } from './entitlement';
import type { Entitlement } from '@/types';

const entitlement: Entitlement = { tier: 'pro', source: 'google_play', expiresAt: 2000,
  updatedAt: 1000, subscriptionStatus: 'SUBSCRIPTION_STATE_ACTIVE' };
test('Google Play access requires a server Pro entitlement, recognized status, and future expiration', () => {
  expect(entitlementIsActive(null, 1000)).toBe(false);
  expect(entitlementIsActive(entitlement, 1000)).toBe(true);
  expect(entitlementIsActive(entitlement, 2000)).toBe(false);
  expect(entitlementIsActive({ ...entitlement, tier: 'free' }, 1000)).toBe(false);
  expect(entitlementIsActive({ ...entitlement, expiresAt: null }, 1000)).toBe(false);
  expect(entitlementIsActive({ ...entitlement, subscriptionStatus: 'SUBSCRIPTION_STATE_ON_HOLD' }, 1000)).toBe(false);
  expect(entitlementIsActive({ ...entitlement, subscriptionStatus: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' }, 1000)).toBe(true);
  expect(entitlementIsActive({ ...entitlement, subscriptionStatus: 'SUBSCRIPTION_STATE_CANCELED' }, 1000)).toBe(true);
  expect(entitlementIsActive({ ...entitlement, source: 'grant', expiresAt: null }, 1000)).toBe(true);
});
