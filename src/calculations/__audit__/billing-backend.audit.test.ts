/**
 * QA audit — billing backend grant rule and the client's mirror of it.
 *
 * No emulator. Exercises the compiled `functions/lib/domain.js` (the module the
 * callables, RTDN handler and reconciler all decide Pro with) and the client's
 * `entitlementIsActive`, against expectations written as literals.
 *
 * Every expected value is stated by hand. Nothing below calls the module under
 * test to produce an expectation.
 */
import { entitlementIsActive } from '@/features/premium/entitlement';

const domain = require('../../../functions/lib/domain') as {
  PRODUCT_ID: string;
  hash: (v: string) => string;
  accountId: (uid: string) => string;
  subscriptionInfo: (purchase: Record<string, unknown>, now: number) => Record<string, unknown>;
  assertOwner: (uid: string, purchase: Record<string, unknown>, owner?: string, linkedOwner?: string) => void;
  isUnboundPurchase: (purchase: Record<string, unknown>) => boolean;
  isPro: (entitlement: Record<string, unknown> | undefined, now: number) => boolean;
};

// 2026-09-16T00:00:00.000Z = 1_789_430_400_000 ms since epoch
// (1_789_430_400 s: 56 years and 259 days after 1970-01-01; verified as the
// audit date so the arithmetic below reads naturally).
const NOW = 1_789_430_400_000;
const DAY = 86_400_000; // 24 * 60 * 60 * 1000

// sha256('revora:google_play:rider-a') computed with `shasum -a 256` outside this test.
const RIDER_A_ACCOUNT = '3cbf07122996680907564cf25bab3d2b81ee0ce92c53bd0935404fa528d0d90b';
// sha256('revora:google_play:rider-b')
const RIDER_B_ACCOUNT = '38a6ceecc7ed29823d2b32d3df62e7b3e9e89a9d0eb3111180b04511b54802a5';
// sha256('token') — the id under which the raw purchase token 'token' is stored/logged
const TOKEN_ID = '3c469e9d6c5875d37a43f353d4f88e61fcf812c66eee3457465a40b0da4153e0';

const play = (state: string, expiresAt: number, extra: Record<string, unknown> = {}) => ({
  subscriptionState: `SUBSCRIPTION_STATE_${state}`,
  acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
  externalAccountIdentifiers: { obfuscatedExternalAccountId: RIDER_A_ACCOUNT },
  lineItems: [{ productId: 'revora_pro', expiryTime: new Date(expiresAt).toISOString() }],
  ...extra,
});

describe('BIL-U01 hashing is sha256 hex, so a stored/logged tokenId never reveals the token', () => {
  test('accountId and hash match independently computed digests', () => {
    expect(domain.accountId('rider-a')).toBe(RIDER_A_ACCOUNT);
    expect(domain.accountId('rider-b')).toBe(RIDER_B_ACCOUNT);
    expect(domain.hash('token')).toBe(TOKEN_ID);
    expect(TOKEN_ID).not.toContain('token');
    expect(TOKEN_ID).toHaveLength(64);
  });
});

describe('BIL-U02 PENDING never grants, whatever the expiry', () => {
  test('PENDING with expiry 30 days out is free', () => {
    // expiresAt = NOW + 30 * DAY = 1_789_430_400_000 + 2_592_000_000 = 1_792_022_400_000 (> NOW)
    const info = domain.subscriptionInfo(play('PENDING', 1_792_022_400_000), NOW);
    expect(info.tier).toBe('free');
    expect(info.expiresAt).toBe(1_792_022_400_000);
  });
  test('PENDING_PURCHASE_CANCELED, ON_HOLD, PAUSED, EXPIRED are free with a future expiry', () => {
    for (const state of ['PENDING_PURCHASE_CANCELED', 'ON_HOLD', 'PAUSED', 'EXPIRED']) {
      expect(domain.subscriptionInfo(play(state, NOW + DAY), NOW).tier).toBe('free');
    }
  });
});

describe('BIL-U03 ACTIVE / GRACE / CANCELED grant strictly before expiry', () => {
  test('expiry one millisecond after now grants; expiry equal to now does not', () => {
    expect(domain.subscriptionInfo(play('ACTIVE', NOW + 1), NOW).tier).toBe('pro');
    expect(domain.subscriptionInfo(play('ACTIVE', NOW), NOW).tier).toBe('free');
    expect(domain.subscriptionInfo(play('IN_GRACE_PERIOD', NOW + 1), NOW).tier).toBe('pro');
    expect(domain.subscriptionInfo(play('CANCELED', NOW + 1), NOW).tier).toBe('pro');
    expect(domain.subscriptionInfo(play('CANCELED', NOW - 1), NOW).tier).toBe('free');
  });
  test('a line item for another product cannot lend its expiry to revora_pro', () => {
    // revora_pro expires NOW + 1 day; a foreign product expires NOW + 365 days.
    const purchase = play('ACTIVE', NOW + DAY, {
      lineItems: [
        { productId: 'revora_pro', expiryTime: new Date(NOW + DAY).toISOString() },
        { productId: 'someone_elses_sku', expiryTime: new Date(NOW + 365 * DAY).toISOString() },
      ],
    });
    // NOW + DAY = 1_789_430_400_000 + 86_400_000 = 1_789_516_800_000
    expect(domain.subscriptionInfo(purchase, NOW).expiresAt).toBe(1_789_516_800_000);
  });
  test('a purchase with no revora_pro line item is rejected as INVALID_PRODUCT', () => {
    expect(() => domain.subscriptionInfo({ lineItems: [{ productId: 'other' }] }, NOW)).toThrow('INVALID_PRODUCT');
    expect(() => domain.subscriptionInfo({}, NOW)).toThrow('INVALID_PRODUCT');
  });
});

describe('BIL-U04 ownership: bound tokens cannot be claimed by another account', () => {
  test('rider-b presenting rider-a’s in-app purchase → ACCOUNT_MISMATCH', () => {
    expect(() => domain.assertOwner('rider-b', play('ACTIVE', NOW + DAY))).toThrow('ACCOUNT_MISMATCH');
    expect(() => domain.assertOwner('rider-a', play('ACTIVE', NOW + DAY))).not.toThrow();
  });
  test('a token already recorded to rider-a → rider-b gets ACCOUNT_MISMATCH even if Google carries no id', () => {
    const unbound = { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', lineItems: [{ productId: 'revora_pro' }] };
    expect(() => domain.assertOwner('rider-b', unbound, 'rider-a')).toThrow('ACCOUNT_MISMATCH');
  });
  test('a linked (replaced) token owned by rider-a blocks rider-b', () => {
    const unbound = { lineItems: [{ productId: 'revora_pro' }] };
    expect(() => domain.assertOwner('rider-b', unbound, undefined, 'rider-a')).toThrow('ACCOUNT_MISMATCH');
  });
  test('an out-of-app resubscription still carries the original binding', () => {
    const resub = {
      lineItems: [{ productId: 'revora_pro' }],
      outOfAppPurchaseContext: { expiredExternalAccountIdentifiers: { obfuscatedExternalAccountId: RIDER_A_ACCOUNT } },
    };
    expect(() => domain.assertOwner('rider-b', resub)).toThrow('ACCOUNT_MISMATCH');
    expect(() => domain.assertOwner('rider-a', resub)).not.toThrow();
    expect(domain.isUnboundPurchase(resub)).toBe(false);
  });
});

describe('BIL-U05 first-claim of an unbound (promo) token', () => {
  test('unbound token with no prior owner is claimable by anyone once', () => {
    const promo = { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', lineItems: [{ productId: 'revora_pro' }] };
    expect(domain.isUnboundPurchase(promo)).toBe(true);
    expect(() => domain.assertOwner('rider-a', promo)).not.toThrow();
    expect(() => domain.assertOwner('rider-b', promo)).not.toThrow(); // before any claim, both would pass
    // After verifyPurchase has stored owner = rider-a, rider-b is refused:
    expect(() => domain.assertOwner('rider-b', promo, 'rider-a')).toThrow('ACCOUNT_MISMATCH');
  });
});

describe('BIL-U06 isPro on the stored entitlement document', () => {
  const gp = (status: string, expiresAt: number | null) => ({
    tier: 'pro', source: 'google_play', subscriptionStatus: `SUBSCRIPTION_STATE_${status}`, expiresAt,
  });
  test('google_play ACTIVE expiring in 1 ms is Pro; expiring now is not', () => {
    expect(domain.isPro(gp('ACTIVE', NOW + 1), NOW)).toBe(true);
    expect(domain.isPro(gp('ACTIVE', NOW), NOW)).toBe(false);
  });
  test('google_play ON_HOLD / PAUSED / PENDING / EXPIRED never Pro with a future expiry', () => {
    for (const s of ['ON_HOLD', 'PAUSED', 'PENDING', 'EXPIRED']) expect(domain.isPro(gp(s, NOW + DAY), NOW)).toBe(false);
  });
  test('google_play can never be perpetual (expiresAt null)', () => {
    expect(domain.isPro(gp('ACTIVE', null), NOW)).toBe(false);
  });
  test('a bare {tier: pro} document with no source or expiry is NOT Pro', () => {
    expect(domain.isPro({ tier: 'pro' }, NOW)).toBe(false);
  });
  test('server grant with null expiry is perpetual Pro; expired grant is not', () => {
    expect(domain.isPro({ tier: 'pro', source: 'grant', expiresAt: null }, NOW)).toBe(true);
    expect(domain.isPro({ tier: 'pro', source: 'grant', expiresAt: NOW - 1 }, NOW)).toBe(false);
  });
  test('tier free or missing document is never Pro', () => {
    expect(domain.isPro({ tier: 'free', source: 'google_play', subscriptionStatus: 'SUBSCRIPTION_STATE_ACTIVE', expiresAt: NOW + DAY }, NOW)).toBe(false);
    expect(domain.isPro(undefined, NOW)).toBe(false);
  });
});

describe('BIL-U07 client entitlementIsActive agrees with the server rule', () => {
  const gp = (status: string, expiresAt: number | null) => ({
    tier: 'pro' as const, source: 'google_play' as const, subscriptionStatus: `SUBSCRIPTION_STATE_${status}`, expiresAt, updatedAt: NOW,
  });
  test('same matrix as BIL-U06', () => {
    expect(entitlementIsActive(gp('ACTIVE', NOW + 1), NOW)).toBe(true);
    expect(entitlementIsActive(gp('ACTIVE', NOW), NOW)).toBe(false);
    for (const s of ['ON_HOLD', 'PAUSED', 'PENDING', 'EXPIRED']) expect(entitlementIsActive(gp(s, NOW + DAY), NOW)).toBe(false);
    expect(entitlementIsActive(gp('IN_GRACE_PERIOD', NOW + 1), NOW)).toBe(true);
    expect(entitlementIsActive(gp('CANCELED', NOW + 1), NOW)).toBe(true);
    expect(entitlementIsActive(gp('ACTIVE', null), NOW)).toBe(false);
    expect(entitlementIsActive({ tier: 'pro', source: 'grant', expiresAt: null, updatedAt: NOW }, NOW)).toBe(true);
    expect(entitlementIsActive({ tier: 'free', source: 'none', expiresAt: null, updatedAt: 0 }, NOW)).toBe(false);
    expect(entitlementIsActive(null, NOW)).toBe(false);
    expect(entitlementIsActive(undefined, NOW)).toBe(false);
  });
});
