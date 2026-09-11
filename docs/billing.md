# Revora Pro — Google Play subscriptions

One subscription product, `revora_pro`. **Google Play decides the price and the
base plans; the backend decides who is Pro.** Neither of those decisions is ever
made in the app.

## The rule that shapes everything

A client saying "the purchase succeeded" grants nothing. The app forwards a
purchase token; the backend calls the Google Play Developer API, and what Google
returns is written to `entitlements/{uid}`. Every screen reads that document.

There is no local Pro flag anywhere in `src/` — not in state, not in
AsyncStorage. Clearing app data, reinstalling, or patching the APK changes
nothing, and Pro follows the *Revora account* to a new phone or to the web.

## Pieces

| Piece | Where | Job |
| --- | --- | --- |
| Native module | `plugins/google-play-billing/RevoraBillingModule.kt` | Billing Library 9.1.0. Queries `ProductDetails`, launches the flow, reports purchases. Transports only — it never grants. |
| Expo plugin | `plugins/withGooglePlayBilling.js` | Adds the dependency, copies the Kotlin in, registers the package. `android/` stays generated. |
| Bridge | `src/features/billing/googlePlay.ts` | Typed wrapper + 30 s timeouts. |
| Session | `src/features/billing/BillingProvider.tsx` | Owns the flow, the restore loop and the pending state. Keyed on uid, so a sign-out disposes it. |
| Callables | `functions/src/index.ts` | `prepareGooglePlayPurchase`, `verifyGooglePlayPurchase`, `syncGooglePlayEntitlement`, `createBike`. |
| Verification | `functions/src/billing.ts` | The one transaction every path shares. |
| Play API | `functions/src/play.ts` | `subscriptionsv2` get + acknowledge. |
| Grant rule | `functions/src/domain.ts` | `subscriptionInfo()` / `isPro()`. Mirrored on the client in `src/features/premium/entitlement.ts`. |

## The purchase flow

1. `prepareGooglePlayPurchase` writes `playAccounts/{accountId(uid)}` and returns
   the obfuscated account id — `sha256('revora:google_play:' + uid)`. This is what
   binds a purchase to a Revora account **at Google**, before any money moves.
2. The app launches the flow with that id set on `BillingFlowParams`.
3. Google returns the purchase to `onPurchasesUpdated`.
4. The app posts `{ userId, productId, purchaseToken }` to
   `verifyGooglePlayPurchase`.
5. The backend fetches the purchase from Google, checks the binding, writes the
   entitlement, and only then acknowledges.

Acknowledgement happens **after** the grant is durable. If acknowledgement fails,
the grant still stands and RTDN, startup sync and the hourly reconciler retry it
— well inside Google's 3-day auto-refund window.

### The states

| Google says | Revora does |
| --- | --- |
| `PURCHASED` | Verify → grant → acknowledge. |
| `PENDING` | Nothing. No grant, no acknowledgement. The Plan screen says payment is pending; the token is re-checked until it resolves. |
| User cancelled (code 1) | "Purchase canceled. Your plan has not changed." |
| Already owned (code 7) | Runs a restore — the subscription exists, this account just has not been told. |
| Anything else | A message keyed to the response code; the entitlement is untouched. |

`ACTIVE`, `IN_GRACE_PERIOD` and `CANCELED` grant Pro until `expiresAt`.
`ON_HOLD`, `PAUSED`, `PENDING` and `EXPIRED` never grant it. An unrecognised
future state never grants it either — the allow-list is closed on purpose.

## Restoration

`BillingProvider` syncs on mount, on sign-in (the provider is keyed on uid), on
every foreground, when connectivity returns, and once a minute while the app is
open and no purchase flow is running.

It does two things at once: it re-verifies what Google Play on *this device*
reports, and it calls `syncGooglePlayEntitlement`, which re-checks tokens the
server already knows about. The second matters because `queryPurchasesAsync`
returns nothing when a subscription is on hold, has expired, or was bought with a
different Google account than the one on this phone.

## Real-time Developer Notifications

`googlePlayRtdn` is deployed and idempotent. To turn it on:

1. Create the topic:
   `gcloud pubsub topics create revora-google-play`
2. Let Google publish to it:
   ```
   gcloud pubsub topics add-iam-policy-binding revora-google-play \
     --member=serviceAccount:google-play-developer-notifications@system.gserviceaccount.com \
     --role=roles/pubsub.publisher
   ```
3. Play Console → **Monetise → Monetisation setup** → paste
   `projects/<PROJECT_ID>/topics/revora-google-play` → **Send test notification**.
4. Grant the functions' service account the **Financial data / Manage orders and
   subscriptions** permission in Play Console → **Users and permissions**, and
   enable the Google Play Android Developer API in the Cloud project. Without
   this every verification fails closed and nobody is granted Pro.

The handler treats the notification type as a *wake-up signal only*. Renewal,
cancellation, expiry, grace period, hold, revocation and refund all take the
same path: re-fetch the purchase from Google and rewrite the entitlement from
what Google says now. That is why an out-of-order or replayed notification
cannot corrupt anything, and why refunds that do not revoke access correctly
leave access alone.

Messages are de-duplicated in `playNotifications/{sha256(messageId)}`. Those
documents carry `expireAt`, so set a **TTL policy on `playNotifications.expireAt`**
(Firestore → Time-to-live) or they accumulate forever:

```
gcloud firestore fields ttls update expireAt \
  --collection-group=playNotifications --enable-ttl
```

A failed notification throws, so Pub/Sub redelivers. `reconcileGooglePlaySubscriptions`
sweeps hourly and repairs anything that was lost entirely.

## Account binding

**A purchase token is bound to exactly one Revora account, forever.** That is
the property to protect: one subscription must never serve two accounts.
Sharing a token with a second account fails with `ACCOUNT_MISMATCH`.

A purchase bought inside the app carries the obfuscated account id set by
`prepareGooglePlayPurchase`, and Google's own binding is checked first — so it
can never be claimed by anybody else.

A purchase acquired **outside** the app carries no such id: a **promo code**
redeemed in the Play Store, or a subscription restarted from the Play
subscriptions page. Those are claimable by the first account to present one, and
`verifyPurchase` records the owner in the same transaction, so every later
attempt is refused. `purchaseTokens.claimedVia` records which route it came by —
`in_app` or `unbound` — so grants stay auditable.

The trade-off is deliberate and narrow: someone holding another rider's purchase
token, which in practice means holding their unlocked phone, could claim it
first. Refusing unbound tokens outright was the earlier behaviour, and it made
promo codes impossible to redeem — they granted nothing at all.

All of this is covered in `functions/test/billing.integration.cjs`.

Upgrades, downgrades and out-of-app resubscriptions arrive as a new token with a
`linkedPurchaseToken`. The old token is marked superseded so it can never
re-grant access it no longer has.

Purchase tokens are never logged — a Google HTTP error contains the token in its
URL, which is why `billingAction` never logs the underlying error.

## Free vs Pro

Free is one motorcycle, with ads. Pro is multiple motorcycles, advanced
statistics and consumption charts, CSV fuel-history export, the Assistant, and no
ads.

The one-motorcycle limit is enforced in the `createBike` callable, inside a
transaction that reads the server entitlement and takes a per-account lock — so
two simultaneous creates cannot both win. `firestore.rules` denies client bike
creation outright, and denies un-archiving an archived bike, which would
otherwise be a way around the limit. The UI check in `useAddBike` is only there
to give a better error before the round trip.

## Configuration

Copy `functions/.env.example` to `functions/.env`. `GOOGLE_PLAY_PACKAGE_NAME`
must equal the app's `applicationId`; it is never taken from a client, so a
repackaged APK cannot redirect verification.

## Tests

```bash
npm --prefix functions test                       # the grant rule, no emulator needed
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
firebase emulators:exec --only firestore --project revora-rules-test \
  "npm --prefix functions run test:integration"   # the whole backend, Play stubbed
npm run test:rules                                # what a client can reach
```

The integration suite is the one that matters. It covers pending payments,
acknowledgement failure, token replay from a second account, upgrade
replacement, expiry, hold and recovery, refunds, RTDN de-duplication and
retries, and concurrent motorcycle creation on the Free plan.

Play Billing itself cannot be tested off-device: use a **licence tester** account
and Play Console's test base plans, and note that test subscriptions renew in
minutes rather than months.
