import type { Entitlement } from '@/types';

export function entitlementIsActive(entitlement: Entitlement | null | undefined, now = Date.now()): boolean {
  if (entitlement?.tier !== 'pro') return false;
  if (entitlement.source === 'google_play') {
    return ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']
      .includes(entitlement.subscriptionStatus ?? '')
      && entitlement.expiresAt !== null && entitlement.expiresAt > now;
  }
  return entitlement.expiresAt === null || entitlement.expiresAt > now;
}
