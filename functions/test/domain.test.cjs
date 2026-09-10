const { test } = require('node:test');
const assert = require('node:assert/strict');
const { subscriptionInfo, assertOwner, accountId, isPro } = require('../lib/domain');

const now = Date.parse('2026-09-10T00:00:00Z');
const purchase = (state, expiry = now + 10000) => ({
  subscriptionState: `SUBSCRIPTION_STATE_${state}`,
  acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
  externalAccountIdentifiers: { obfuscatedExternalAccountId: accountId('rider-a') },
  lineItems: [{ productId: 'revora_pro', expiryTime: new Date(expiry).toISOString(),
    offerDetails: { basePlanId: 'dynamic-plan-id' }, autoRenewingPlan: { autoRenewEnabled: true } }],
});

for (const state of ['ACTIVE', 'IN_GRACE_PERIOD', 'CANCELED']) {
  test(`${state} allows Pro only before expiration`, () => {
    assert.equal(subscriptionInfo(purchase(state), now).tier, 'pro');
    assert.equal(subscriptionInfo(purchase(state, now), now).tier, 'free');
    assert.equal(subscriptionInfo(purchase(state, now - 1), now).tier, 'free');
  });
}
for (const state of ['PENDING', 'PENDING_PURCHASE_CANCELED', 'ON_HOLD', 'PAUSED', 'EXPIRED', 'UNSPECIFIED', 'NEW_UNKNOWN_STATE']) {
  test(`${state} never grants Pro even with future expiry`, () => {
    assert.equal(subscriptionInfo(purchase(state), now).tier, 'free');
  });
}
test('Google product, line item, expiry and base plan are authoritative', () => {
  assert.throws(() => subscriptionInfo({ lineItems: [{ productId: 'other' }] }, now), /INVALID_PRODUCT/);
  const value = purchase('ACTIVE');
  value.lineItems.push({ productId: 'other', expiryTime: '2099-01-01T00:00:00Z' });
  const info = subscriptionInfo(value, now);
  assert.equal(info.expiresAt, now + 10000);
  assert.equal(info.basePlanId, 'dynamic-plan-id');
  assert.equal(info.autoRenewing, true);
  assert.equal(subscriptionInfo({ ...value, lineItems: [{ productId: 'revora_pro' }] }, now).tier, 'free');
});
test('new token must be bound by Google to the authenticated account', () => {
  assert.doesNotThrow(() => assertOwner('rider-a', purchase('ACTIVE')));
  assert.throws(() => assertOwner('rider-b', purchase('ACTIVE')), /ACCOUNT_MISMATCH/);
  assert.throws(() => assertOwner('rider-a', {}), /UNBOUND_PURCHASE/);
  assert.throws(() => assertOwner('rider-a', purchase('ACTIVE'), 'rider-b'), /ACCOUNT_MISMATCH/);
  assert.throws(() => assertOwner('rider-a', purchase('ACTIVE'), undefined, 'rider-b'), /ACCOUNT_MISMATCH/);
});
test('linked tokens and out-of-app resubscriptions preserve ownership', () => {
  assert.doesNotThrow(() => assertOwner('rider-a', {}, 'rider-a'));
  assert.doesNotThrow(() => assertOwner('rider-a', {}, undefined, 'rider-a'));
  assert.doesNotThrow(() => assertOwner('rider-a', { outOfAppPurchaseContext: {
    expiredExternalAccountIdentifiers: { obfuscatedExternalAccountId: accountId('rider-a') },
  } }));
});
test('Google Pro cannot be perpetual or active on hold; server grants can be perpetual', () => {
  assert.equal(isPro({ tier: 'pro', source: 'google_play', expiresAt: null }, now), false);
  assert.equal(isPro({ tier: 'pro', source: 'google_play', subscriptionStatus: 'SUBSCRIPTION_STATE_ON_HOLD', expiresAt: now + 1 }, now), false);
  assert.equal(isPro({ tier: 'pro', source: 'grant', expiresAt: null }, now), true);
});
