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

/**
 * Decides whether `uid` may claim this purchase.
 *
 * A purchase bought inside Revora carries the obfuscated account id set by
 * `prepareGooglePlayPurchase`, and that is checked first — it can never be
 * claimed by anyone else.
 *
 * A purchase acquired OUTSIDE the app has no such id: a promo code redeemed in
 * the Play Store, or a subscription restarted from the Play subscriptions page.
 * Refusing those outright means promo codes cannot grant anything at all, so an
 * unbound token is claimable by the first account to present it — and only the
 * first. `verifyPurchase` records `userId` on the token in the same transaction,
 * so every later attempt hits the ACCOUNT_MISMATCH above.
 *
 * The property that matters is preserved: one subscription can never serve two
 * accounts. What is given up is narrower — someone holding another rider's
 * token, which means holding their unlocked phone, could claim it first.
 */
export function assertOwner(uid: string, purchase: PlaySubscription, owner?: string, linkedOwner?: string) {
  if (owner && owner !== uid) throw new Error('ACCOUNT_MISMATCH');
  if (linkedOwner && linkedOwner !== uid) throw new Error('ACCOUNT_MISMATCH');
  const obfuscated = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId
    ?? purchase.outOfAppPurchaseContext?.expiredExternalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (obfuscated && obfuscated !== accountId(uid)) throw new Error('ACCOUNT_MISMATCH');
}

/** True when this purchase carried no account binding of its own. */
export function isUnboundPurchase(purchase: PlaySubscription): boolean {
  return (purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId
    ?? purchase.outOfAppPurchaseContext?.expiredExternalAccountIdentifiers?.obfuscatedExternalAccountId) === undefined;
}

export function isPro(entitlement: Record<string, unknown> | undefined, now: number): boolean {
  if (entitlement?.tier !== 'pro') return false;
  if (entitlement.source === 'google_play') {
    return ACCESS_STATES.has(String(entitlement.subscriptionStatus))
      && typeof entitlement.expiresAt === 'number' && entitlement.expiresAt > now;
  }
  return entitlement.expiresAt === null || (typeof entitlement.expiresAt === 'number' && entitlement.expiresAt > now);
}
