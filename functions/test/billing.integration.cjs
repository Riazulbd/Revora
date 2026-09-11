// Run only against the Firestore emulator; Play is replaced with verified API fixtures.
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is required');
process.env.GCLOUD_PROJECT = 'revora-rules-test';
process.env.GOOGLE_PLAY_PACKAGE_NAME = 'app.revora.android.dev';
const functions = require('../lib/index');
const { getFirestore } = require('firebase-admin/firestore');
const { deleteApp, getApp } = require('firebase-admin/app');
const { play } = require('../lib/play');
const { verifyPurchase, resolveOwner } = require('../lib/billing');
const { accountId, hash } = require('../lib/domain');
const db = getFirestore();
const uid = 'billing-rider';
const pkg = process.env.GOOGLE_PLAY_PACKAGE_NAME;
let purchases;
let acknowledgements;
const future = () => Date.now() + 86400000;
const purchase = (state = 'ACTIVE', expiresAt = future(), extra = {}) => ({
  subscriptionState: `SUBSCRIPTION_STATE_${state}`,
  acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
  externalAccountIdentifiers: { obfuscatedExternalAccountId: accountId(uid) },
  lineItems: [{ productId: 'revora_pro', expiryTime: new Date(expiresAt).toISOString(),
    offerDetails: { basePlanId: 'plan-from-google' } }],
  ...extra,
});
const entitlement = async () => (await db.doc(`entitlements/${uid}`).get()).data();
const request = (data, userId = uid) => ({ auth: { uid: userId, token: { firebase: { sign_in_provider: 'password' } } }, data });

beforeEach(async () => {
  for (const collection of ['entitlements', 'purchaseTokens', 'billingLocks', 'playAccounts', 'playNotifications', 'garageLocks', 'bikes']) {
    await db.recursiveDelete(db.collection(collection));
  }
  purchases = new Map([['token', purchase()]]);
  acknowledgements = [];
  play.get = async (_package, token) => {
    assert.equal(_package, pkg);
    if (!purchases.has(token)) throw new Error('Google unavailable');
    return structuredClone(purchases.get(token));
  };
  play.acknowledge = async (_package, productId, token) => {
    assert.equal(productId, 'revora_pro');
    assert.equal((await entitlement()).tier, 'pro', 'entitlement must be durable before acknowledgement');
    acknowledgements.push(token);
    purchases.get(token).acknowledgementState = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
  };
});
after(async () => { await deleteApp(getApp()); });

test('authenticated callable rejects forged UID, anonymous caller, wrong product and unavailable Google', async () => {
  const payload = { userId: uid, productId: 'revora_pro', purchaseToken: 'token' };
  await assert.rejects(functions.verifyGooglePlayPurchase.run(request(payload, 'other')), /Account changed/);
  await assert.rejects(functions.verifyGooglePlayPurchase.run({ data: payload }), /Sign in/);
  await assert.rejects(functions.verifyGooglePlayPurchase.run({ data: payload,
    auth: { uid, token: { firebase: { sign_in_provider: 'anonymous' } } } }), /before subscribing/);
  await assert.rejects(functions.verifyGooglePlayPurchase.run(request({ ...payload, productId: 'wrong' })), /Invalid purchase/);
  await assert.rejects(functions.verifyGooglePlayPurchase.run(request({ ...payload, purchaseToken: 'missing' })), /Could not verify/);
  assert.equal(await entitlement(), undefined);
  assert.equal(acknowledgements.length, 0);
});

test('verified purchase is durable, private token is hidden, duplicate is idempotent', async () => {
  await verifyPurchase(uid, 'token', pkg);
  await verifyPurchase(uid, 'token', pkg);
  const value = await entitlement();
  assert.equal(value.tier, 'pro');
  assert.equal(value.provider, 'google_play');
  assert.equal(value.basePlanId, 'plan-from-google');
  assert.equal(value.purchaseToken, undefined);
  assert.equal(value.purchase, undefined);
  const token = (await db.doc(`purchaseTokens/${hash('token')}`).get()).data();
  assert.equal(token.userId, uid);
  assert.equal(token.purchaseToken, 'token');
  assert.equal(token.acknowledgementState, 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED');
  assert.deepEqual(acknowledgements, ['token']);
});

test('pending never grants or acknowledges; completed payment later activates Pro', async () => {
  purchases.set('token', purchase('PENDING'));
  await verifyPurchase(uid, 'token', pkg);
  assert.equal((await entitlement()).tier, 'free');
  assert.equal(acknowledgements.length, 0);
  purchases.set('token', purchase());
  await verifyPurchase(uid, 'token', pkg);
  assert.equal((await entitlement()).tier, 'pro');
  assert.equal(acknowledgements.length, 1);
});

test('token replay from another Revora account cannot steal a subscription', async () => {
  await verifyPurchase(uid, 'token', pkg);
  await assert.rejects(verifyPurchase('attacker', 'token', pkg), /ACCOUNT_MISMATCH/);
  assert.equal((await db.doc('entitlements/attacker').get()).exists, false);
});

test('a promo code redeemed in the Play Store grants Pro, once, to one account', async () => {
  // Redeemed outside the app, so Google attaches no obfuscatedExternalAccountId.
  // Before first-claim binding this was refused and 200 promo codes were inert.
  const promo = purchase();
  delete promo.externalAccountIdentifiers;
  purchases.set('promo-token', promo);

  await verifyPurchase(uid, 'promo-token', pkg);
  assert.equal((await entitlement()).tier, 'pro');
  assert.deepEqual(acknowledgements, ['promo-token'], 'a promo purchase still has to be acknowledged');

  const stored = (await db.doc(`purchaseTokens/${hash('promo-token')}`).get()).data();
  assert.equal(stored.claimedVia, 'unbound', 'provenance is recorded for auditing grants');
  assert.equal(stored.userId, uid);

  // The binding is what makes it claimable exactly once.
  await assert.rejects(verifyPurchase('someone-else', 'promo-token', pkg), /ACCOUNT_MISMATCH/);
  assert.equal((await db.doc('entitlements/someone-else').get()).exists, false);

  // Re-verifying as the owner stays idempotent and does not re-acknowledge.
  await verifyPurchase(uid, 'promo-token', pkg);
  assert.deepEqual(acknowledgements, ['promo-token']);
});

test('a purchase made in the app is still bound to the account that bought it', async () => {
  await verifyPurchase(uid, 'token', pkg);
  const stored = (await db.doc(`purchaseTokens/${hash('token')}`).get()).data();
  assert.equal(stored.claimedVia, 'in_app');
});

test('acknowledgement failure keeps durable verification and retry repairs it', async () => {
  const acknowledge = play.acknowledge;
  play.acknowledge = async () => { throw new Error('Transient Google error'); };
  await assert.rejects(verifyPurchase(uid, 'token', pkg), /Transient/);
  assert.equal((await entitlement()).tier, 'pro');
  assert.equal((await db.doc(`purchaseTokens/${hash('token')}`).get()).data().needsSync, true);
  play.acknowledge = acknowledge;
  await verifyPurchase(uid, 'token', pkg);
  assert.deepEqual(acknowledgements, ['token']);
});

test('renewal, grace, hold, recovery, cancellation and expiration follow Google', async () => {
  for (const [state, expires, tier] of [
    ['ACTIVE', future(), 'pro'], ['ACTIVE', future() + 86400000, 'pro'],
    ['IN_GRACE_PERIOD', future(), 'pro'], ['ON_HOLD', future(), 'free'],
    ['ACTIVE', future(), 'pro'], ['CANCELED', future(), 'pro'],
    ['EXPIRED', Date.now() - 1, 'free'],
  ]) {
    purchases.set('token', purchase(state, expires, { acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }));
    await verifyPurchase(uid, 'token', pkg);
    assert.equal((await entitlement()).tier, tier, state);
    assert.equal((await entitlement()).expiresAt, expires);
  }
});

test('replacement token invalidates old token; replay cannot regrant old access', async () => {
  await verifyPurchase(uid, 'token', pkg);
  purchases.set('new-token', purchase('ACTIVE', future(), { linkedPurchaseToken: 'token' }));
  await verifyPurchase(uid, 'new-token', pkg);
  purchases.set('new-token', purchase('EXPIRED', Date.now() - 1, { linkedPurchaseToken: 'token' }));
  await verifyPurchase(uid, 'new-token', pkg);
  await verifyPurchase(uid, 'token', pkg);
  assert.equal((await entitlement()).tier, 'free');
});

test('expired historical token does not erase a separate current subscription', async () => {
  await verifyPurchase(uid, 'token', pkg);
  purchases.set('old-token', purchase('EXPIRED', Date.now() - 1000));
  await verifyPurchase(uid, 'old-token', pkg);
  assert.equal((await entitlement()).tier, 'pro');
  assert.equal((await entitlement()).tokenId, hash('token'));
});

test('out-of-app resubscription resolves owner and is acknowledged without opening app', async () => {
  await functions.prepareGooglePlayPurchase.run(request({}));
  assert.equal(await resolveOwner('token', purchases.get('token')), uid);
  await verifyPurchase(uid, 'token', pkg);
  purchases.set('resub', purchase('ACTIVE', future(), {
    externalAccountIdentifiers: undefined, outOfAppPurchaseContext: { expiredPurchaseToken: 'token' },
  }));
  // JSON mirrors Google's omission of undefined values.
  purchases.set('resub', JSON.parse(JSON.stringify(purchases.get('resub'))));
  assert.equal(await resolveOwner('resub', purchases.get('resub')), uid);
  await verifyPurchase(uid, 'resub', pkg);
  assert.deepEqual(acknowledgements, ['token', 'resub']);
});

const event = (id, notification) => ({ data: { message: { messageId: id, json: {
  packageName: pkg, ...notification,
} } } });

test('RTDN deduplicates messages, uses current Google state, and handles voided/refunded purchases', async () => {
  await functions.prepareGooglePlayPurchase.run(request({}));
  const notification = event('message-1', { subscriptionNotification: { purchaseToken: 'token', notificationType: 2 } });
  await functions.googlePlayRtdn.run(notification);
  assert.equal((await entitlement()).tier, 'pro');
  const previousGet = play.get;
  play.get = async () => { throw new Error('duplicate should not query Play'); };
  await functions.googlePlayRtdn.run(notification);
  play.get = previousGet;
  purchases.set('token', purchase('EXPIRED', Date.now() - 1));
  await functions.googlePlayRtdn.run(event('message-2', { voidedPurchaseNotification: { purchaseToken: 'token' } }));
  assert.equal((await entitlement()).tier, 'free');
  // An old "renewed" event cannot restore a currently revoked subscription.
  await functions.googlePlayRtdn.run(event('message-3', { subscriptionNotification: { purchaseToken: 'token', notificationType: 2 } }));
  assert.equal((await entitlement()).tier, 'free');
});

test('RTDN failures are retriable and wrong packages never affect access', async () => {
  await functions.prepareGooglePlayPurchase.run(request({}));
  const notification = event('retry-me', { subscriptionNotification: { purchaseToken: 'missing', notificationType: 4 } });
  await assert.rejects(functions.googlePlayRtdn.run(notification), /verification failed/);
  assert.equal((await db.doc(`playNotifications/${hash('retry-me')}`).get()).exists, false);
  notification.data.message.json.packageName = 'wrong.package';
  await functions.googlePlayRtdn.run(notification);
  assert.equal(await entitlement(), undefined);
});

test('server sync sees account hold even when a device has no owned purchases', async () => {
  await verifyPurchase(uid, 'token', pkg);
  purchases.set('token', purchase('ON_HOLD'));
  await functions.syncGooglePlayEntitlement.run(request({}));
  assert.equal((await entitlement()).tier, 'free');
});

const bike = { nickname: 'Bike', manufacturer: 'Honda', model: 'Hornet', initialOdometer: 0,
  currentOdometer: 0, archived: false, year: null, tankCapacityLiters: null, purchasePrice: null,
  purchaseDate: null, engineNumber: null, chassisNumber: null, photoPath: null, currency: 'BDT',
  company: { enabled: false, companyName: '', monthlyAllowance: 0 } };
test('concurrent Free motorcycle creates cannot exceed one; verified Pro can add more', async () => {
  const results = await Promise.allSettled(['bike-a', 'bike-b'].map(id => functions.createBike.run(request({ id, bike }))));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await db.collection('bikes').get()).size, 1);
  await verifyPurchase(uid, 'token', pkg);
  await functions.createBike.run(request({ id: 'bike-c', bike }));
  await functions.createBike.run(request({ id: 'bike-c', bike }));
  assert.equal((await db.collection('bikes').get()).size, 2);
});
