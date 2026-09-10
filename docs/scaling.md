# Running Revora for many free riders and a few paying ones

Written against the code as it stands, with the arithmetic shown. The headline:
**the schema is right, the read volume is not.** You do not need a different
database; you need the Dashboard to stop reading five years of history to draw
one card.

## Where the money actually goes

Firestore bills documents read, not bytes. Every screen in the app reads through
`useGarageData`, which opens eight listeners per motorcycle with these caps
(`src/features/bikes/useGarageData.ts`):

| Collection | Cap | Collection | Cap |
| --- | --- | --- | --- |
| fuelEntries | 400 | services | 200 |
| expenses | 400 | parts | 200 |
| odometerEntries | 400 | adjustments | 200 |
| maintenanceRules | 100 | accessories | 100 |

**Up to 2,000 documents per motorcycle, on the first open.** Plus profile,
entitlement and the bike list.

At $0.06 per 100,000 reads that is **$0.0012 per cold start**. Sounds like
nothing. It is not, at volume:

| Daily active riders | Reads/day (worst case) | Cost/month |
| --- | --- | --- |
| 100 | 200k | ~$3.60 |
| 1,000 | 2M | ~$36 |
| 10,000 | 20M | ~$360 |
| 100,000 | 200M | ~$3,600 |

Two things soften this. Offline persistence is on, so a **warm** start re-reads
only what changed — the 2,000 is a cold-cache number, not a per-launch one. And
a new rider has ten records, not two thousand; only riders with years of history
hit the caps. Realistically expect **a third** of the table above.

But note what the free Spark tier gives you: **50,000 reads/day**. That is about
25 full cold starts. You will be on Blaze from roughly your first hundred riders,
and that is fine — just do not be surprised by it.

**A free rider costs exactly what a Pro rider costs.** Nothing about the tier
changes the read pattern. So the lever is not "charge more", it is "read less".

## What to change, in order of payoff

### 1. Split the summary read from the history read (biggest win, no schema change)

The Dashboard needs the last ~12 fill-ups, this month's expenses, the rules, and
the current odometer. It does not need 400 expenses to draw a monthly total —
but it currently loads them because Analytics and the ownership figures share the
same hook.

Give `useGarageData` a **scope**: `'summary'` for tab screens (caps of ~24), and
`'full'` for Analytics, the ledger and Proof Pack, which genuinely need
everything. Because `useLiveQuery` keys on the limit, the two coexist and the
full read only happens when a rider actually opens Analytics.

Expect a **70–85% cut** in cold-start reads for the common path. This is a day's
work and needs no rollups, no triggers and no change to the non-negotiables.

### 2. Bundle the reference data

`bikeModels` and `fuelGaugeProfiles` are the same for everyone and change rarely.
Reading them per rider is pure waste. Ship them as a JSON asset in the app and
refresh from Firestore only when a version document changes — one read instead of
hundreds.

### 3. Cap history at the query, not in memory

`odometerEntries` is ordered by `odometer DESC` with a cap of 400. A rider with
1,200 fill-ups has an odometer history far longer than that already, so the cap
is silently truncating — the calculations are correct on what they see, but they
are not seeing everything. Paginate the history screens properly rather than
raising the cap.

### 4. Only then, consider rollups

Above roughly 10,000 daily riders, precomputing per-month totals becomes worth
it. Reads are the only cost that grows with use, so this is the only lever that
matters at scale. **This collides with non-negotiable #3** ("nothing derived is stored"), and
that rule exists for a good reason — stored derivatives are how you get a screen
showing a figure that no longer matches its records.

If you do it, do it so the rule still holds in spirit:

- A rollup is a **cache**, never a source of truth. Editing a record never edits
  a rollup.
- It is written **only** by a Firestore trigger that recomputes it from the
  records, using the same `src/calculations/` code the app uses.
- It carries the `updatedAt` of the newest record it covers. If that does not
  match, the client ignores it and computes from records.

That last point is what keeps the class of bug the rule was written to prevent.
Do not skip it.

## Structure: keep what you have

Flat top-level collections with `userId` + `bikeId` on every document is the
right shape, and the 14 composite indexes in `firestore.indexes.json` match the
queries. Do not move to subcollections: the rules are simpler flat, the web
product already writes this shape, and subcollections would not reduce a single
read.

Three things worth adding:

- **TTL policies** on `playNotifications.expireAt` and `aiCache` — otherwise both
  grow forever and you pay storage on rows nobody will read again.
- **A budget alert** in GCP at your expected monthly spend. Firestore has no cap;
  a runaway listener is discovered by the bill.
- Note that `aiCache`, `aiUsage` and `budget` belong to the **web** product,
  which shares this Firebase project. The Android app never reads or writes
  them — its Assistant is on-device and costs nothing per question — so they are
  not part of this app's cost model.

## Feedback and support

`feedback/{id}` is write-once and private to its author (see `firestore.rules`).
`relayFeedbackToSlack` posts each new message to Slack the moment it lands, with
the rider's plan, app version, device and uid attached, then stamps `notifiedAt`.

It stays out of the per-rider read path entirely — the app never reads the
collection back on a normal launch — so it costs one write per message and
nothing else.

**Support is a Pro benefit, and the app never says so.** Everybody can write; the
Slack message carries the tier so you can triage. That is the honest way round:
a free rider reporting a crash is doing you a favour, and telling them their
report is second-class would be daft.

Setup is in [slack.md](slack.md).
