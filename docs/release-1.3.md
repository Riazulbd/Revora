# Revora 1.3 — release checklist

Version `1.3`, versionCode `4`, package `app.revora.android.dev`.

Ships Google Play subscriptions (`revora_pro`), odometer corrections, rider
feedback with a Slack relay, a global currency list, and a dark-only welcome
screen.

## Fixed in this release

- **Motorcycles written before the `archived` flag existed could not be updated
  at all.** `resource.data.archived` throws in Firestore rules when the field is
  missing, which denied every bike update — including the one every odometer
  save makes. This is why the odometer would not save. Covered by a rules test.
- The welcome lockup rendered as black blobs with clipped underlines in dark
  mode. The "dark variant" asset was a background knock-out of artwork whose
  wordmark is itself near-black; it has been deleted and the entry screens are
  now pinned dark.
- A photo kept locally when Cloud Storage upload fails was stored in the app's
  **cache** directory, which Android reclaims freely — so it vanished later. It
  now goes to the documents directory.
- Changing the bike photo from the Garage tab navigated away from the tab.
- "Could not reach Revora. Check your connection" was shown for an undeployed
  function, sending riders to check a connection that was fine.

## Deploy the backend BEFORE uploading the AAB

This release moves motorcycle creation to the `createBike` callable, and
`firestore.rules` now denies client creates. **If the app ships before the
functions are deployed, nobody can add a motorcycle** — including existing
riders, and including anyone finishing onboarding. Billing fails safe (the
purchase flow never launches without the backend), but this does not.

Deploy in this order. Functions first, rules second: the other way round leaves a
window where creation is denied and nothing can serve it.

```bash
# 1. Enable the API — it has never been used on this project.
open "https://console.developers.google.com/apis/api/cloudfunctions.googleapis.com/overview?project=ai-fuel-assistant"

# 2. Configure the package the backend verifies against.
cp functions/.env.example functions/.env    # GOOGLE_PLAY_PACKAGE_NAME=app.revora.android.dev

# 3. Functions, then rules.
firebase deploy --only functions --project ai-fuel-assistant
firebase deploy --only firestore:rules --project ai-fuel-assistant
```

Confirm `createBike`, `prepareGooglePlayPurchase`, `verifyGooglePlayPurchase`,
`syncGooglePlayEntitlement`, `googlePlayRtdn` and
`reconcileGooglePlaySubscriptions` are all listed by
`firebase functions:list --project ai-fuel-assistant` before going further.

## Play Console

1. Create subscription **`revora_pro`** with at least one base plan, and activate
   it. Until it exists the Plan screen has no price to show — the app queries
   Google for it and hardcodes nothing.
2. Grant the functions' service account **Financial data → Manage orders and
   subscriptions** under Users and permissions, and enable the Google Play
   Android Developer API. Without it every verification fails closed.
3. Wire Real-time Developer Notifications — see [billing.md](billing.md).
4. Add a **licence tester** account. Test subscriptions renew in minutes, which
   is the only practical way to see renewal and expiry behaviour.
5. Prices to enter are recommended in [pricing.md](pricing.md).

## Slack

Feedback needs one secret before it relays — see [slack.md](slack.md):

```bash
firebase functions:secrets:set SLACK_FEEDBACK_WEBHOOK_URL --project ai-fuel-assistant
```

Without it the function logs a warning and the message is still stored in
Firestore, so nothing is lost — you just will not be told.

## Smoke test on a real device

Play Billing cannot be exercised off-device or from an emulator.

- [ ] Plan screen shows the localised price from Play, not a placeholder
- [ ] Upgrade launches Google's sheet; cancelling says the plan has not changed
- [ ] After purchase the Pro card reads CURRENT PLAN, and multiple motorcycles,
      CSV export, Assistant and advanced stats unlock; ads disappear
- [ ] Kill and relaunch — Pro survives, because it comes from the server
- [ ] Sign out and back in on a second device — Pro follows the account
- [ ] Manage Subscription opens the Play subscription page
- [ ] Add a motorcycle (this is what breaks if functions are missing)
- [ ] Odometer: enter a wrong reading, then correct it downwards from the
      history and confirm mileage, running cost and maintenance all follow
- [ ] Odometer on a motorcycle created before 1.3 — this is the bug that blocked
      saving, so test it on an existing account, not a fresh one
- [ ] Welcome screen with the phone in light mode: the lockup reads correctly
- [ ] More → Feedback & support: send one, confirm it lands in Slack
- [ ] Settings → Currency: search for "yen", pick JPY, confirm amounts show no
      decimal places anywhere

## Rollback

The AAB has no local Pro flag and stores nothing derived, so rolling the app back
to 1.1 loses no data. Do **not** roll the rules back while 1.2 is live — 1.2
cannot create motorcycles any other way. Roll back the app first, then rules.
