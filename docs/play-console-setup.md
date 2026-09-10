# Creating `revora_pro` in Play Console

Exact values. Anything marked **must match** is compared against a string in the
code — get it wrong and the Plan screen shows nothing, with no useful error.

## Before you start

- Merchant account active (you have this).
- The app must have **at least one uploaded build containing the billing
  permission** before products become purchasable. `Revora-1.3.aab` contains
  `com.android.vending.BILLING`, so upload it to **Internal testing** first —
  you do not have to promote it to production to test buying.
- You cannot rename a product or base plan after creating it. Only deactivate.

## 1. The subscription

**Monetise → Products → Subscriptions → Create subscription**

| Field | Value |
| --- | --- |
| Product ID | `revora_pro` — **must match** exactly, lowercase, no spaces |
| Name | `Revora Pro` |

The Product ID is frozen the moment you hit create. It appears in three places in
this repo (`RevoraBillingModule.kt`, `googlePlay.ts`, `functions/src/domain.ts`);
if you ever need a different one, all three change together.

Then fill in the store listing for the subscription itself:

- **Benefits** (up to 4, these show in Google's purchase sheet):
  1. `Track as many motorcycles as you own`
  2. `Advanced statistics and consumption charts`
  3. `Export your full fuel history to CSV`
  4. `No ads`

## 2. Base plans

Create **two** base plans on that one subscription. Not two subscriptions.

| Base plan ID | Type | Billing period | Renewal |
| --- | --- | --- | --- |
| `monthly` | Auto-renewing | 1 month | Auto-renewing |
| `yearly` | Auto-renewing | 1 year | Auto-renewing |

Base plan IDs are lowercase letters, digits and hyphens, and are also permanent.
The app does not hardcode them — it renders whatever base plans exist, with each
one's own localised price — so these two names are a convention, not a contract.

**Grace period: 7 days. Account hold: enabled (30 days).** Both matter: the
backend already treats `SUBSCRIPTION_STATE_IN_GRACE_PERIOD` as still-Pro and
`ON_HOLD` as not-Pro, so a failed card gives the rider a week to fix it rather
than cutting them off the same day.

**Resubscribe: on.** Lets a lapsed rider restart from the Play subscription page.

## 3. Prices

Set these **per country** rather than letting Google convert from USD. Automatic
conversion produces prices like ৳1,180 that read as expensive locally and convert
badly.

| Market | Monthly | Yearly | Yearly ÷ 12 |
| --- | --- | --- | --- |
| Bangladesh (BDT) | ৳99 | ৳699 | ৳58 |
| India (INR) | ₹79 | ₹499 | ₹42 |
| Pakistan (PKR) | ₨199 | ₨1,299 | ₨108 |
| Sri Lanka (LKR) | Rs 299 | Rs 1,999 | Rs 167 |
| Nepal (NPR) | रू99 | रू699 | रू58 |
| United States (USD) | $1.99 | $9.99 | $0.83 |
| United Kingdom (GBP) | £1.79 | £8.99 | £0.75 |
| Eurozone (EUR) | €1.99 | €9.99 | €0.83 |
| Everywhere else | — | — | let Google convert from USD |

These are round local numbers chosen to read as cheap in each market, not
currency conversions — check them against the day's rates before entering, and
do not be alarmed that they are not consistent in USD terms. That is the point.

The yearly is ~40–45% below twelve months of monthly. That gap is what makes
yearly the obvious choice, which is what you want: annual billing on a
low-frequency utility churns far less. Reasoning in [pricing.md](pricing.md).

## 4. Do not add a free trial or introductory offer yet

The app deliberately shows **base plans only**. `RevoraBillingModule.kt` filters
to `offerId == null`, so a free trial or intro offer configured as an *offer*
will not appear in the app and cannot be bought through it.

This is deliberate — offers carry eligibility rules and commitment terms that
need UI Revora does not have yet. Adding trials is a real piece of work in both
the app and the purchase flow. Launch without one.

(`offerPrice()` in `presentation.ts` already renders multi-phase pricing
correctly, so the display side is ready when you want it. The native filter is
the part that would need changing.)

## 5. Activate

A subscription and its base plans are inactive until you activate them. It is
easy to finish all of the above and see nothing in the app because of this.

## 6. Licence testers

**Setup → Licence testing** → add the Google account you will test with.

Licence testers buy without being charged, and **test subscriptions renew in
minutes rather than months** — a yearly renews about every 30 minutes. That is
the only practical way to see renewal, grace period, hold and expiry behaviour
before real riders do.

## Verifying it worked

Install the Internal testing build on a device signed in as a licence tester,
then open **More → Free / Pro**. You should see:

- Two selectable rows, each showing Google's own localised price and period
- "Automatically renews. Cancel in Google Play." beneath each
- An enabled **Upgrade to Pro** button

If you see *"No subscription plans are currently available for this Google Play
account"*, one of these is true: the subscription or its base plans are not
activated; the build on the device is not the one Play knows about; or the
signed-in account is not a licence tester. It is almost never the code — the app
asks Play for `revora_pro` and renders whatever comes back.
