# Revora — Know Your Bike.

A motorcycle ownership app for Android, built from the approved design in
[`design/Revora.dc.html`](design/Revora.dc.html). Fuel, mileage, maintenance,
services, parts, accessories, expenses, documents and analytics — all computed
from records the rider actually logged, and all working with no connection.

## Quick start

```bash
npm install
npm run verify          # TypeScript, ESLint, 163 unit tests

export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME="$HOME/Library/Android/sdk"

npx expo prebuild --platform android --clean
./android/gradlew -p android assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

A development build (Metro + a dev client) needs the native project too — this
app uses the native Firebase SDKs, so it does not run in Expo Go:

```bash
npx expo run:android
```

## How it is put together

```
src/
  app/            expo-router routes — one file per screen, no logic
  components/     the design system: Card, Button, Input, Badge, Gauge, Sheet…
  features/       one folder per domain: hooks, forms and mutations
  calculations/   every derived number in the product. Pure, tested, no React.
  repositories/   the only code that knows Firestore exists
  services/       auth, storage, connectivity, errors, logging, sync
  validation/     Zod schemas over parsed domain values
  types/          the domain model
  theme/          colour tokens and the type scale, transcribed from the design
  utils/          dates and display formatting
```

Three rules hold the shape:

1. **No business logic in a component.** Every figure comes from
   `src/calculations/`. Dashboard, Analytics and Expenses read the *same*
   `analyseBike()` result, so two screens cannot disagree about a metric.
2. **No Firestore outside `src/repositories/`.** Swapping to a REST backend means
   reimplementing that folder and nothing else.
3. **Nothing derived is stored.** Current odometer, mileage, running cost and
   maintenance status are recomputed on every read — which is why editing a fuel
   log from three months ago corrects everything that depended on it.

## The parts worth knowing about

**Mileage** is measured between two **full-tank** fills only. Partial fills
contribute their fuel to the interval but never terminate one — computing a
figure per partial fill is the classic fuel-log bug and it is explicitly not done
here. Confidence is reported as HIGH / MEDIUM / ESTIMATED, and best/worst/last-5
stay hidden until five reliable intervals exist. See
[`src/calculations/mileage.ts`](src/calculations/mileage.ts).

**Money is never a float.** Amounts are integer minor units, volumes integer
millilitres, distances integer metres. `9 L × BDT 145` is exactly `BDT 1,305`.

**Dates are never UTC.** Calendar dates are `'YYYY-MM-DD'` strings throughout, so
a service on 1 September cannot render as 31 August.

**Every cost appears exactly once.** A part fitted during a service has its cost
inside that service and produces no ledger line of its own. Asserted in
[`journey.test.ts`](src/calculations/journey.test.ts).

**Offline is the normal case.** Firestore's native persistence keeps a durable
local copy and an ordered write queue, so a fill logged at a pump with no signal
survives the app being killed and uploads itself later.

**Entitlement comes from the server.** `users/{uid}.entitlement` is the only
source of Free vs. Pro, and `firestore.rules` rejects any client write to it.

## Documentation

- [`docs/data-model.md`](docs/data-model.md) — the Firestore contract shared with
  the web product
- [`SIGNING.md`](SIGNING.md) — release keys and how to build for Play
- [`firestore.rules`](firestore.rules) / [`storage.rules`](storage.rules) — where
  ownership is actually enforced, verified by
  [`tests/firestore.rules.test.ts`](tests/firestore.rules.test.ts)

## Scripts

| Command             | What it does                            |
| ------------------- | --------------------------------------- |
| `npm run verify`    | typecheck + lint + tests                |
| `npm run typecheck` | `tsc --noEmit`                          |
| `npm run lint`      | ESLint, zero warnings tolerated         |
| `npm test`          | Jest — 163 unit tests                   |
| `npm run test:rules`| Firestore security rules against the emulator (needs JDK 21) |
| `npm run android`   | build and run on a device or emulator   |
| `npm run prebuild`  | regenerate `android/` from `app.config.ts` |
