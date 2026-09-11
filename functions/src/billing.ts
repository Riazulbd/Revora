import { getFirestore } from 'firebase-admin/firestore';
import { accountId, assertOwner, hash, isPro, isUnboundPurchase, PRODUCT_ID, subscriptionInfo, type PlaySubscription } from './domain';
import { play } from './play';

/** All entry points share this transaction, including RTDN and scheduled repair.
 * Read the account lock BEFORE fetching Play, and refetch on transaction retry.
 * Concurrent or out-of-order events can therefore never commit an older snapshot.
 */
export async function verifyPurchase(uid: string, token: string, packageName: string) {
  const db = getFirestore();
  const tokenId = hash(token);
  const tokenRef = db.doc(`purchaseTokens/${tokenId}`);
  const result = await db.runTransaction(async tx => {
    const lockRef = db.doc(`billingLocks/${uid}`);
    const lock = await tx.get(lockRef);
    const purchase = await play.get(packageName, token);
    const now = Date.now();
    const info = subscriptionInfo(purchase, now);
    const previous = await tx.get(tokenRef);
    const linkedToken = purchase.linkedPurchaseToken ?? purchase.outOfAppPurchaseContext?.expiredPurchaseToken;
    const linkedRef = linkedToken ? db.doc(`purchaseTokens/${hash(linkedToken)}`) : null;
    const linked = linkedRef ? await tx.get(linkedRef) : null;
    assertOwner(uid, purchase, previous.data()?.userId, linked?.data()?.userId);
    const entitlementRef = db.doc(`entitlements/${uid}`);
    const currentEntitlement = await tx.get(entitlementRef);
    const tokens = await tx.get(db.collection('purchaseTokens').where('userId', '==', uid));
    const record = {
      ...info, userId: uid, packageName, purchaseToken: token, purchase: purchase,
      tokenId, supersededBy: previous.data()?.supersededBy ?? null,
      // How this account came to own the token. 'unbound' means it arrived from
      // outside the app — a promo code, or a Play-side resubscription — and was
      // claimed by first presentation. Kept for support and for auditing grants.
      claimedVia: previous.data()?.claimedVia
        ?? (isUnboundPurchase(purchase) ? 'unbound' : 'in_app'),
      claimedAt: previous.data()?.claimedAt ?? now,
      // Refresh terminal purchases for 60 days, while tokens remain queryable.
      needsSync: info.expiresAt > now - 60 * 86400000 || info.subscriptionStatus === 'SUBSCRIPTION_STATE_PENDING',
    };
    tx.set(tokenRef, record);
    // Pending replacements do not take access away from the existing purchase.
    const replaces = info.subscriptionStatus !== 'SUBSCRIPTION_STATE_PENDING'
      && info.subscriptionStatus !== 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED';
    if (linkedRef && linked?.exists && replaces) tx.update(linkedRef, { supersededBy: tokenId });

    const candidates: Record<string, unknown>[] = tokens.docs.filter(doc => doc.id !== tokenId).map(doc => ({ ...doc.data(), tokenId: doc.id }));
    candidates.push(record);
    const eligible = candidates.filter(candidate =>
      !candidate.supersededBy && !(replaces && linkedRef?.id === candidate.tokenId));
    const active = eligible.filter(candidate => isPro(candidate, now))
      .sort((a, b) => Number(b.expiresAt) - Number(a.expiresAt))[0];
    const latest = [...eligible].sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))[0];
    const selected = active ?? latest ?? record;
    // Never let a stale Play token remove a separate, active server grant.
    const existing = currentEntitlement.data();
    if (!existing || existing.source === 'google_play' || !isPro(existing, now)) {
      const { purchaseToken: _token, purchase: _purchase, needsSync: _sync, supersededBy: _superseded, ...publicInfo } = selected;
      tx.set(entitlementRef, { ...publicInfo, tier: active ? 'pro' : 'free', updatedAt: now });
    }
    tx.set(lockRef, { revision: Number(lock.data()?.revision ?? 0) + 1, updatedAt: now });
    return { info, purchase };
  });

  // Grant is durable first. A crash or acknowledgement failure is repaired by
  // RTDN retries, startup sync, and the scheduled reconciliation worker.
  if (result.info.tier === 'pro' && result.purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
    try {
      await play.acknowledge(packageName, PRODUCT_ID, token);
    } catch (error) {
      const refreshed = await play.get(packageName, token);
      if (refreshed.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') throw error;
    }
    await tokenRef.update({ acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED', acknowledgedAt: Date.now() });
  }
  return { verified: true };
}

export async function resolveOwner(token: string, purchase: PlaySubscription): Promise<string | null> {
  const db = getFirestore();
  const existing = await db.doc(`purchaseTokens/${hash(token)}`).get();
  if (existing.exists) return existing.data()!.userId as string;
  const obfuscated = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId
    ?? purchase.outOfAppPurchaseContext?.expiredExternalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (obfuscated && /^[a-f0-9]{64}$/.test(obfuscated)) {
    const account = await db.doc(`playAccounts/${obfuscated}`).get();
    const uid = account.data()?.userId;
    if (typeof uid === 'string' && accountId(uid) === obfuscated) return uid;
  }
  const linked = purchase.linkedPurchaseToken ?? purchase.outOfAppPurchaseContext?.expiredPurchaseToken;
  if (!linked) return null;
  const old = await db.doc(`purchaseTokens/${hash(linked)}`).get();
  return old.data()?.userId ?? null;
}
