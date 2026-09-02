# Revora data model

The mobile app and the web product share one Firebase project and one database.
This is the contract between them. Nothing else in the app knows these shapes —
they are read and written only by `src/repositories/`.

## Storage conventions

These exist so arithmetic is exact and dates cannot shift by a timezone.

| Kind      | Stored as                        | Example                       |
| --------- | -------------------------------- | ----------------------------- |
| Money     | integer **minor units**          | `130500` = BDT 1,305.00        |
| Volume    | integer **millilitres**          | `9000` = 9.0 L                 |
| Distance  | integer **metres**               | `5180000` = 5,180 km           |
| Calendar  | `'YYYY-MM-DD'` local date string | `'2026-09-01'`                 |
| Instants  | epoch milliseconds               | `createdAt`, `updatedAt` only  |

A calendar date is **never** a `Timestamp` and never passes through UTC. A
service completed on 1 September must read "1 Sep" in Dhaka and in Los Angeles.

Money is never a float. `9 L × BDT 145` is `divideRound(9000 × 14500, 1000)`,
which is exactly `130500`.

## Collections

Everything lives under the signed-in rider's document, so ownership is a property
of the path and the security rule is a single `request.auth.uid == uid` check.

```
users/{uid}                       UserProfile
users/{uid}/bikes/{bikeId}        Bike
users/{uid}/fuel/{id}             FuelEntry
users/{uid}/odometer/{id}         OdometerReading      (manual + onboarding only)
users/{uid}/rules/{id}            MaintenanceRule
users/{uid}/completions/{id}      MaintenanceCompletion
users/{uid}/services/{id}         ServiceRecord
users/{uid}/parts/{id}            Part
users/{uid}/accessories/{id}      Accessory
users/{uid}/expenses/{id}         Expense              (manual expenses only)
users/{uid}/documents/{id}        VaultDocument
users/{uid}/warranties/{id}       Warranty
users/{uid}/safety/{id}           SafetyCheck
users/{uid}/captures/{id}         CaptureItem
users/{uid}/notifications/{id}    AppNotification
```

Every document except the profile and the bike carries `userId` **and** `bikeId`.
Both are re-verified server-side on write (`firestore.rules`).

Field-by-field shapes are in [`src/types/index.ts`](../src/types/index.ts), which
is the authoritative definition. `src/repositories/parsers.ts` reads every field
defensively, so a document written by an older version — or by the web product
with an extra field — degrades to a sensible default rather than crashing a list.

## Things that are deliberately *not* stored

Storing a derived value is how two screens end up disagreeing. These are computed
on every read instead:

| Not stored                   | Derived from                                                     |
| ---------------------------- | ---------------------------------------------------------------- |
| Current odometer             | the highest reading across all sources                            |
| Mileage / km/L               | full-to-full intervals over the raw fuel entries                  |
| Running cost, cost/km        | the ledger built from the source records                          |
| Maintenance status           | rule interval vs. current odometer and today's date               |
| Part remaining life          | current odometer − installed odometer, vs. expected life          |
| Monthly totals               | the ledger, grouped by calendar month                             |

This is why editing a fuel log from three months ago silently corrects every
figure that depended on it, with no migration and no cache to invalidate.

### Odometer readings are partly derived

The `odometer` collection holds only **manual** and **onboarding** readings. A
reading implied by a fuel log, a service or a part fitting is derived from that
record at read time (`buildOdometerHistory`). Deleting a fuel log therefore takes
its odometer reading with it, and the two can never disagree.

## The one rule the ledger enforces

**Every cost appears exactly once.** A record whose cost is already carried by
another record it links to contributes no line of its own:

| Record                | Contributes a ledger line when                |
| --------------------- | --------------------------------------------- |
| `FuelEntry`           | always                                        |
| `ServiceRecord`       | always                                        |
| `Part`                | `linkedServiceId === null` and cost > 0       |
| `Accessory`           | `linkedServiceId === null` and total > 0      |
| `MaintenanceCompletion` | `serviceId === null` and cost > 0           |
| `Expense`             | always                                        |

A BDT 2,400 service that fitted a BDT 1,900 part increases running cost by
exactly BDT 2,400. This is asserted in `src/calculations/expenses.test.ts` and
again end to end in `src/calculations/journey.test.ts`.

## Entitlement

`users/{uid}.entitlement` is the single source of truth for Free vs. Pro:

```ts
{
  tier: 'free' | 'pro',
  source: 'none' | 'google_play' | 'apple_iap' | 'web' | 'promo' | 'grant',
  expiresAt: number | null,   // epoch ms; null = perpetual
  updatedAt: number,
}
```

`firestore.rules` **rejects any client write that changes it**, so the app can
read the tier but can never grant itself Pro. Whichever billing source is
connected later — Google Play, Apple, or web checkout — writes this one field
from a trusted server, and every platform reflects it immediately.

## Web compatibility notes

If the web product already writes these collections under different names or
shapes, the mobile side changes in exactly one place: `src/repositories/`.
`parsers.ts` maps documents to the domain types, and `records.ts` maps the domain
types back. No screen and no calculation imports Firestore.
