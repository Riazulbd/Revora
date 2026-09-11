import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineString } from 'firebase-functions/params';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { z } from 'zod';
import { accountId, hash, isPro, PRODUCT_ID } from './domain';
import { resolveOwner, verifyPurchase } from './billing';
import { play } from './play';

// Deployed separately, once Slack is set up. The Firebase CLI resolves every
// `defineSecret` in the codebase during analysis — including for functions the
// --only filter excludes — so exporting this before the Secret Manager API is
// enabled and SLACK_FEEDBACK_WEBHOOK_URL exists blocks EVERY other deploy.
// Re-enable with:  docs/slack.md
// export { relayFeedbackToSlack } from './feedback';

initializeApp();
// Must match the Play Console app, never a package name supplied by a client.
const packageName = defineString('GOOGLE_PLAY_PACKAGE_NAME');
const topic = defineString('GOOGLE_PLAY_RTDN_TOPIC', { default: 'revora-google-play' });
const region = 'us-central1';
const callableOptions = { region, timeoutSeconds: 120, maxInstances: 20 };

function requireUid(request: CallableRequest, registered = true): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to Revora.');
  if (registered && request.auth.token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('failed-precondition', 'Create or sign in to a Revora account before subscribing.');
  }
  return request.auth.uid;
}

async function billingAction<T>(action: () => Promise<T>): Promise<T> {
  try { return await action(); } catch (error) {
    // Never log Google HTTP errors: their URL contains the purchase token.
    if (error instanceof HttpsError) throw error;
    const reason = error instanceof Error ? error.message : '';
    if (reason === 'ACCOUNT_MISMATCH' || reason === 'UNBOUND_PURCHASE') {
      throw new HttpsError('permission-denied', 'This purchase is linked to another Revora account, or could not be linked. Sign in to the account used to subscribe.');
    }
    if (reason === 'INVALID_PRODUCT') throw new HttpsError('invalid-argument', 'This is not a Revora Pro subscription.');
    logger.warn('Google Play verification needs retry');
    throw new HttpsError('unavailable', 'Could not verify with Google Play. Use Restore purchases to retry.');
  }
}

export const prepareGooglePlayPurchase = onCall(callableOptions, async request => {
  const uid = requireUid(request);
  await getFirestore().doc(`playAccounts/${accountId(uid)}`).set({ userId: uid });
  return { obfuscatedAccountId: accountId(uid), productId: PRODUCT_ID };
});

export const verifyGooglePlayPurchase = onCall(callableOptions, async request => {
  const uid = requireUid(request);
  const input = z.object({
    userId: z.string(), productId: z.literal(PRODUCT_ID), purchaseToken: z.string().min(1).max(8192),
  }).safeParse(request.data);
  if (!input.success) throw new HttpsError('invalid-argument', 'Invalid purchase.');
  if (input.data.userId !== uid) throw new HttpsError('permission-denied', 'Account changed. Sign in again.');
  return billingAction(() => verifyPurchase(uid, input.data.purchaseToken, packageName.value()));
});

export const syncGooglePlayEntitlement = onCall(callableOptions, async request => {
  const uid = requireUid(request);
  // Also verify server-known tokens that queryPurchasesAsync omits on hold,
  // after expiration, or when this device uses a different Google account.
  const tokens = await getFirestore().collection('purchaseTokens').where('userId', '==', uid).get();
  await billingAction(async () => {
    for (const token of tokens.docs) {
      if (token.data().needsSync) await verifyPurchase(uid, token.data().purchaseToken, packageName.value());
    }
  });
  return { synchronized: true };
});

export const googlePlayRtdn = onMessagePublished({ region, topic, retry: true, timeoutSeconds: 120 }, async event => {
  const db = getFirestore();
  const done = db.doc(`playNotifications/${hash(event.data.message.messageId)}`);
  if ((await done.get()).exists) return;
  const schema = z.object({
    packageName: z.string(), testNotification: z.unknown().optional(),
    subscriptionNotification: z.object({ purchaseToken: z.string().min(1).max(8192), notificationType: z.number() }).optional(),
    voidedPurchaseNotification: z.object({ purchaseToken: z.string().min(1).max(8192) }).optional(),
  });
  let data: unknown;
  try { data = event.data.message.json; } catch { logger.warn('Malformed Play notification'); return; }
  const parsed = schema.safeParse(data);
  if (!parsed.success || parsed.data.packageName !== packageName.value()) {
    logger.warn('Ignored invalid or wrong-package Play notification'); return;
  }
  // Play's "Send test notification" carries no purchase token, so without this
  // a successful test is silent — indistinguishable from one that never arrived.
  if (parsed.data.testNotification !== undefined) {
    logger.info('Play test notification received — RTDN is wired correctly', {
      packageName: parsed.data.packageName, messageId: event.data.message.messageId,
    });
  }
  const token = parsed.data.subscriptionNotification?.purchaseToken ?? parsed.data.voidedPurchaseNotification?.purchaseToken;
  if (token) {
    // Notification type is a wake-up signal, never evidence of entitlement.
    // Refund-only events may leave access active; revocation does not. Play decides.
    try {
      const purchase = await play.get(packageName.value(), token);
      const uid = await resolveOwner(token, purchase);
      if (!uid) { logger.warn('Unbound Play notification', { tokenId: hash(token) }); return; }
      await verifyPurchase(uid, token, packageName.value());
      logger.info('Play notification applied', {
        type: parsed.data.subscriptionNotification?.notificationType ?? 'voided',
        tokenId: hash(token),
      });
    } catch {
      logger.warn('Play notification will be retried', { messageId: event.data.message.messageId });
      throw new Error('Play notification verification failed');
    }
  }
  await done.set({ processedAt: Date.now(), expireAt: new Date(Date.now() + 30 * 86400000) });
});

export const reconcileGooglePlaySubscriptions = onSchedule({
  region, schedule: 'every 60 minutes', timeoutSeconds: 540, retryCount: 3,
}, async () => {
  const db = getFirestore();
  let cursor: string | undefined;
  let failures = 0;
  do {
    let query = db.collection('purchaseTokens').where('needsSync', '==', true).orderBy('__name__').limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    // Bound concurrency to protect the Publisher API quota.
    for (let i = 0; i < page.docs.length; i += 5) {
      const results = await Promise.allSettled(page.docs.slice(i, i + 5).map(async doc => {
        const value = doc.data();
        await verifyPurchase(value.userId, value.purchaseToken, packageName.value());
      }));
      failures += results.filter(result => result.status === 'rejected').length;
    }
    cursor = page.size === 100 ? page.docs.at(-1)!.id : undefined;
  } while (cursor);
  if (failures) { logger.warn('Play reconciliation failures', { count: failures }); throw new Error('Reconciliation needs retry'); }
});

const optionalText = z.string().max(512).nullable();
const bikeSchema = z.object({
  nickname: z.string().min(1).max(60), manufacturer: z.string().min(1).max(60), model: z.string().min(1).max(80),
  initialOdometer: z.number().nonnegative(), currentOdometer: z.number().nonnegative(),
  archived: z.literal(false), year: z.number().int().nullable(),
  tankCapacityLiters: z.number().nonnegative().nullable(), purchasePrice: z.number().nonnegative().nullable(),
  purchaseDate: optionalText, engineNumber: optionalText, chassisNumber: optionalText, photoPath: optionalText,
  // Any ISO 4217 code. The client's currency table decides what is offered;
  // the server only refuses something that is not a currency code at all.
  currency: z.string().regex(/^[A-Z]{3}$/),
  company: z.object({ enabled: z.boolean(), companyName: z.string().max(120), monthlyAllowance: z.number().nonnegative() }),
});

export const createBike = onCall({ region }, async request => {
  const uid = requireUid(request, false);
  const input = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), bike: bikeSchema }).safeParse(request.data);
  if (!input.success) throw new HttpsError('invalid-argument', 'Invalid motorcycle details.');
  const db = getFirestore();
  await db.runTransaction(async tx => {
    const lockRef = db.doc(`garageLocks/${uid}`);
    const lock = await tx.get(lockRef);
    const ref = db.doc(`bikes/${input.data.id}`);
    const existing = await tx.get(ref);
    if (existing.exists) {
      if (existing.data()?.userId !== uid) throw new HttpsError('permission-denied', 'Motorcycle already exists.');
      return; // Retry of the same creation is idempotent.
    }
    const entitlement = await tx.get(db.doc(`entitlements/${uid}`));
    const bikes = await tx.get(db.collection('bikes').where('userId', '==', uid));
    if (!isPro(entitlement.data(), Date.now()) && bikes.docs.some(bike => bike.data().archived !== true)) {
      throw new HttpsError('failed-precondition', 'The Free plan tracks one motorcycle. Upgrade to Pro to add more.');
    }
    tx.create(ref, { ...input.data.bike, userId: uid, createdAt: Date.now(), updatedAt: Date.now() });
    tx.set(lockRef, { revision: Number(lock.data()?.revision ?? 0) + 1 });
  });
  return { id: input.data.id };
});
