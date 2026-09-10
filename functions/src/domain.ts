import { createHash } from 'node:crypto';

export const PRODUCT_ID = 'revora_pro';
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const accountId = (uid: string) => hash(`revora:google_play:${uid}`);

export interface PlaySubscription {
  subscriptionState?: string;
  acknowledgementState?: string;
  startTime?: string;
  latestOrderId?: string;
  linkedPurchaseToken?: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  outOfAppPurchaseContext?: {
    expiredPurchaseToken?: string;
    expiredExternalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  };
  lineItems?: {
    productId?: string;
    expiryTime?: string;
    latestSuccessfulOrderId?: string;
    offerDetails?: { basePlanId?: string; offerId?: string };
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
  }[];
  [key: string]: unknown;
}

export const ACCESS_STATES = new Set([
  'SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED',
]);

export function subscriptionInfo(purchase: PlaySubscription, now: number) {
  const items = purchase.lineItems?.filter(item => item.productId === PRODUCT_ID) ?? [];
  if (!items.length) throw new Error('INVALID_PRODUCT');
  const item = [...items].sort((a, b) =>
    (Date.parse(b.expiryTime ?? '') || 0) - (Date.parse(a.expiryTime ?? '') || 0))[0]!;
  const expiresAt = Date.parse(item.expiryTime ?? '') || 0;
  const status = purchase.subscriptionState ?? 'SUBSCRIPTION_STATE_UNSPECIFIED';
  return {
    provider: 'google_play', source: 'google_play', productId: PRODUCT_ID,
    subscriptionStatus: status, expiresAt,
    tier: ACCESS_STATES.has(status) && expiresAt > now ? 'pro' : 'free',
    basePlanId: item.offerDetails?.basePlanId ?? null,
    offerId: item.offerDetails?.offerId ?? null,
    autoRenewing: item.autoRenewingPlan?.autoRenewEnabled === true,
    orderId: item.latestSuccessfulOrderId ?? purchase.latestOrderId ?? null,
    startedAt: Date.parse(purchase.startTime ?? '') || null,
    acknowledgementState: purchase.acknowledgementState ?? 'ACKNOWLEDGEMENT_STATE_UNSPECIFIED',
    updatedAt: now,
  };
}

export function assertOwner(uid: string, purchase: PlaySubscription, owner?: string, linkedOwner?: string) {
  if (owner && owner !== uid) throw new Error('ACCOUNT_MISMATCH');
  if (linkedOwner && linkedOwner !== uid) throw new Error('ACCOUNT_MISMATCH');
  const obfuscated = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId
    ?? purchase.outOfAppPurchaseContext?.expiredExternalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (obfuscated && obfuscated !== accountId(uid)) throw new Error('ACCOUNT_MISMATCH');
  // A token is never assigned solely on the strength of possession of it.
  if (!owner && !linkedOwner && obfuscated !== accountId(uid)) throw new Error('UNBOUND_PURCHASE');
}

export function isPro(entitlement: Record<string, unknown> | undefined, now: number): boolean {
  if (entitlement?.tier !== 'pro') return false;
  if (entitlement.source === 'google_play') {
    return ACCESS_STATES.has(String(entitlement.subscriptionStatus))
      && typeof entitlement.expiresAt === 'number' && entitlement.expiresAt > now;
  }
  return entitlement.expiresAt === null || (typeof entitlement.expiresAt === 'number' && entitlement.expiresAt > now);
}
