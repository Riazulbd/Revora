# Revora — Engineering Log

What broke, why, and how it was fixed — kept so the next working session doesn't
rediscover any of it. Newest lessons are at the bottom of the problem log.
Companion documents: [`docs/data-model.md`](data-model.md) (the Firestore
contract), [`SIGNING.md`](../SIGNING.md) (keys and builds), [`README.md`](../README.md).

Everything below happened on 1 Sep 2026 while building v1.0 → v1.1.

---

## The one-paragraph system

Expo SDK 57 / React Native 0.86, native Firebase (Auth + Firestore) sharing the
**web product's live database** on project `ai-fuel-assistant`. Screens live in
`src/app` (expo-router), every derived number in `src/calculations` (pure,
tested), Firestore only inside `src/repositories`. Storage is canonical
integers — metres, millilitres, minor currency units — converted to the web's
km/litres/taka **only** in `src/repositories/wire.ts`. Nothing derived is stored;
mileage, odometer, statuses and the ledger are recomputed on read.

### Invariants that must not regress

| Invariant | Enforced by |
| --- | --- |
| Every cost appears exactly once in the ledger | `buildLedger()` + `expenses.test.ts`, `journey.test.ts` |
| Mileage is full-tank → full-tank only | `calculateMileageIntervals()` + `mileage.test.ts` |
| No floats in the money path | integer minor units + `money.test.ts` |
| Dates never pass through UTC | `src/utils/date.ts` + `date.test.ts` |
| `NaN`/`Infinity` never reach a screen | `src/utils/format.ts` + `format.test.ts` |
| Rider A can never read rider B | `firestore.rules` + `tests/firestore.rules.test.ts` |
| No client can grant itself Pro | `entitlements/{uid}` is server-write-only (rules test) |
| Editing an old record corrects everything derived | nothing derived is stored |

---

## Problem log

Format: **Symptom → Cause → Fix**. Status ✅ fixed · 🟡 needs a user action.

### 1. Jest refused to run ✅
**Symptom:** `The React Native Jest preset that jest-expo relies on has moved to a separate package`, then `Could not locate module react-native/setup-env`.
**Cause:** jest-expo (SDK 57) peer-depends on `@react-native/jest-preset`; npm resolved a version that didn't match RN 0.86.3. Also jest 30 vs expected ~29.7.
**Fix:** `npm i -D @react-native/jest-preset@0.86.3 jest@~29.7.0 @types/jest@29.5.14 babel-preset-expo@~57.0.0`. **Rule: pin `@react-native/jest-preset` to the exact RN version.**

### 2. ESLint 9-vs-10 crash ✅
**Symptom:** `contextOrFilename.getFilename is not a function` from eslint-plugin-react.
**Cause:** npm installed ESLint 10; `eslint-config-expo` isn't compatible yet.
**Fix:** pin `eslint@^9.36.0`.

### 3. TypeScript 6 deprecations ✅
**Symptom:** `Option 'baseUrl' is deprecated` (TS5101).
**Fix:** drop `baseUrl`; use `"paths": {"@/*": ["./src/*"]}` with the leading `./`.

### 4. Custom `role` prop collided with React Native's ✅
**Symptom:** `Txt`'s `role` type resolved to `"figure" | "button" | "link"` everywhere.
**Cause:** RN's `TextProps` has its own accessibility `role`; intersection narrowed ours.
**Fix:** `export type TxtProps = Omit<RNTextProps, 'role'> & { role?: TypeRole }`.

### 5. Gauge arc: `pathLength` doesn't exist in react-native-svg ✅
**Fix:** the design's arc is a half-circle r=90, so dash on real length: `Math.PI * 90`.

### 6. Form hydration `useEffect`s (React 19 lint errors) ✅
**Symptom:** `Calling setState synchronously within an effect` across 9 editor forms; also a visible flash of empty form.
**Cause:** the load-then-populate pattern.
**Fix (pattern, now house style):** split every editor into a **route** that waits for data and a **form keyed on the record id** (`<Form key={existing?.id ?? 'new'}>`) whose `useState` initialisers read `existing` directly. Zero hydration effects remain. Reference: `src/app/fuel/add.tsx`.

### 7. Ref reads during render ✅
**Fix:** `useStableId` uses `useState(factory)` (lazy init runs once — exactly the idempotent-id guarantee needed); `useRecordMutation` returns an explicit `{submit, isPending, isError, error}` instead of `Object.assign(mutation, …)`.

### 8. Live-query layer: two real bugs found in review ✅
**Bug A:** a listener that errored synchronously leaked — the registry entry wasn't registered yet, so cleanup found nothing. Fix: register the entry **before** subscribing.
**Bug B:** pull-to-refresh returned the listener's **first** snapshot, not current data (the settled promise). Fix: cache `latest` on the entry; and refresh now calls `getDocsFromServer` per collection so it genuinely bypasses the cache (offline it rejects instead of spinning).

### 9. Release build: "Keystore file … not found" ✅
**Cause:** the keystore lived in `android/app/` — and `expo prebuild --clean` deletes `android/` wholesale.
**Fix:** keystore at `credentials/revora-release.keystore` (gitignored), injected by `plugins/withReleaseSigning.js` via gradle properties with an absolute path. **Rule: nothing precious lives under `android/` — it's generated output.**

### 10. APK was 112 MB ✅
**Cause:** 4 ABIs (incl. emulator-only x86/x86_64) + 8 unused dependencies (react-hook-form, date-fns, zustand, expo-secure-store, expo-haptics, expo-device, @hookform/resolvers, @react-native-firebase/functions).
**Fix:** build `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a`; uninstall unused deps; later R8. 112 → 58 MB.

### 11. Dev-only permission in the release manifest ✅
**Symptom:** `SYSTEM_ALERT_WINDOW` (RN dev menu) in the release APK — Play flags it.
**Fix:** `android.blockedPermissions` in `app.config.ts`.

### 12. THE BIG ONE — production sign-up failed: "You don't have access to this record" ✅
**Symptom:** every Firestore write denied the moment a rider signed up.
**Cause:** the app was built against `users/{uid}/fuel/...` subcollections — but the Firebase project already runs the web product's **"Moto Companion" ruleset**: flat top-level collections (`bikes`, `fuelEntries`, `fuelAdjustments`, `odometerEntries`, `maintenanceRules`, `services`, `parts`, `accessories`, `expenses`, `reminders`, `users`, `entitlements`) keyed by a `userId` field, field-validated, `userId`/`createdAt` frozen after create, **default-deny** for anything unlisted. The live DB already held real data.
**Fix:** rewrote the repository layer to the live schema. Key moves:
- `src/repositories/wire.ts` — the one place km↔metres, litres↔ml, major↔minor convert.
- Fuel **adjustments became dated timeline records** (`fuelAdjustments`, signed litres) — a better model than per-fill fields; the mileage engine nets them into whichever interval their date falls in.
- `bikes.currentOdometer` (stored, web-owned) is **written back** on every save via `syncCurrentOdometer` while the app keeps deriving it for display — both worlds stay consistent.
- All writes are `setDoc(..., {merge:true})`; updates never send `userId`/`createdAt` (frozen by rules); web-only fields survive because nothing does full-replace writes.
- Maintenance completions stopped being their own collection: cost → an `expenses` row linked by `maintenanceRuleId`; the rule's `lastCompleted*` fields move the due point.
**Proof:** `tests/signup-sequence.test.ts` replays every app write **through the real serialisers against the downloaded production ruleset** in the emulator.
**Rule for next time — before writing a single repository line against an existing backend, download the live rules:**
```
GET https://firebaserules.googleapis.com/v1/projects/<p>/releases   (find cloud.firestore)
GET https://firebaserules.googleapis.com/v1/<rulesetName>           (read the source)
```

### 13. Zero composite indexes on the project ✅
**Symptom:** queries `where(userId==) + where(bikeId==) + orderBy(date)` need composite indexes; the project had none.
**Fix:** 14 indexes created **additively** via the Firestore REST API (never `deploy --only firestore:indexes` against a shared project — it can prompt to delete unlisted ones). `firestore.indexes.json` is the record of what exists.

### 14. Four design screens had no rules ✅
**Cause:** Document vault, Warranties, Safety log and Fast Capture don't exist in the web schema, and the ruleset default-denies.
**Fix:** additive rules block for `documents` / `warranties` / `safetyChecks` / `captures` in the house style (owner checks, field validation, frozen fields). Deployed after (a) diff against live showed **0 deletions**, (b) the full isolation matrix passed in the emulator, (c) user approval. Previous ruleset backed up before deploy.

### 15. Build/test environment bootstrap ✅
- `brew install --cask temurin@17` **fails** (needs sudo); `brew install openjdk@17` works.
- **Two JAVA_HOMEs**: gradle wants 17 (`/opt/homebrew/opt/openjdk@17`); firebase-tools ≥ some 2026 release requires **21** (`/opt/homebrew/opt/openjdk@21`).
- No AVD existed: cmdline-tools zip from `dl.google.com` into `$ANDROID_HOME/cmdline-tools/latest`, then `sdkmanager "emulator" "system-images;android-35;google_apis;arm64-v8a"`, `avdmanager create avd -n revora -d pixel_7`, boot headless: `emulator -avd revora -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-snapshot`.
- Maestro drives the app by the `testID`s already on every control; needs JAVA_HOME 21. Flows in `.maestro/`.
- Emulators automatically receive **test ads** from AdMob — release builds included — which keeps automated testing inside AdMob policy.

### 16. Sign-up returned email-already-in-use ✅
**Cause:** the auth user was created during the owner's earlier on-phone attempt (auth succeeded; only Firestore had failed).
**Fix:** test flows sign **in** rather than up. Uid `m2qOOoVuideInyNisVRD0F0iNjv2`.

### 17. AdMob broke the Kotlin build ✅
**Symptom:** `Module was compiled with an incompatible version of Kotlin. The binary version of its metadata is 2.3.0, expected version is 2.1.0` (play-services-ads).
**Dead ends:** pin ads SDK 24.6.0 → the RN lib needs 25.x APIs (`AgeRestrictedTreatment`); pin 25.3.0 → same 2.3 metadata; `android.kotlinVersion` gradle property alone → ignored (RN's plugin substitutes the classpath version).
**Fix:** Kotlin **2.2.20** (compiler N reads metadata ≤ N+1) forced on the **buildscript classpath** by `plugins/withKotlin22.js`. Remove when RN's toolchain reaches Kotlin 2.3.

### 18. Play Console: three release errors at once ✅
**Symptom:** "upload an APK or Bundle / doesn't allow existing users to upgrade / does not add or remove bundles".
**Cause:** one cause — the release had no **new** `versionCode` (v1 was already uploaded).
**Fix:** every upload increments `android.versionCode` in `app.config.ts` (v1.1 = versionCode 2). Same signing key → accepted as upgrade.

### 19. Advertising ID warning 🟡→✅
`com.google.android.gms.permission.AD_ID` is already merged into the manifest by the ads SDK (verify: `aapt2 dump badging app-release.apk | grep AD_ID`). The remaining half is console-only: **App content → Advertising ID → Yes → purpose: Advertising or marketing**.

### 20. "The file is no longer available" when adding a photo ✅ app / 🟡 project
**Cause:** Firebase **Storage was never set up** on the project — no bucket exists. The error string was our mapping of `storage/object-not-found`. The provisioning API refuses non-console credentials (`PERMISSION_DENIED`), so it cannot be automated.
**Fix (app, shipped in v1.1):** `uploadImageOrKeepLocal()` — every photo path (avatar, bike, receipt, document, accessory, safety) keeps the device-local URI when upload fails, the record still saves, and the toast says so plainly.
**Fix (project, owner action):** Firebase console → Storage → **Get started** → then `firebase deploy --only storage` (rules are already written in `storage.rules`).

### 21. Google Sign-In ✅ with a future trap 🟡
Enabled provider was already on. What made it work: registering the **release keystore's SHA-1 and SHA-256** on the Firebase Android app (Firebase Management API), and using the **web** client id (`client_type: 3` in google-services.json) as `webClientId`.
**Trap:** enrolling **Play App Signing** re-signs the app with Google's key — its SHA-1 must be added to Firebase too, or Google Sign-In breaks in production only.

### 22. Play data-safety & listing ✅
Hosted on the project's Firebase Hosting (auto-provisioned, no console step):
- Delete account: `https://ai-fuel-assistant.web.app/delete-account`
- Privacy policy: `https://ai-fuel-assistant.web.app/privacy`
Form answers recorded: encrypted in transit **Yes**; account methods **Username and password + OAuth** (nothing "other authentication"); data types = email/name/user IDs (account mgmt), user-generated content (app functionality), photos (optional), device/other IDs (**shared**, Advertising).

---

## What worked — keep doing it

- **Pure calculation layer with tests first.** The 168 unit tests survived the entire schema rewrite untouched in their logic; only fixtures changed. The critical cases (335 km ÷ 8 L → "41.9", BDT 2,400 counted once) never broke.
- **Firestore isolated to `src/repositories/`.** The production-schema discovery — the kind of event that kills projects — was a contained rewrite. No screen changed.
- **Emulator rules testing against the real downloaded ruleset** before touching production. `npm run test:rules`.
- **`testID` on every control from day one** made Maestro automation trivial.
- **Ids minted before first save** (`useStableId`) + in-flight guards: double-tap cannot create duplicates.
- **Merge-writes everywhere**: the web product's fields survive mobile edits.
- Live verification numbers that must stay true with the imported CSV: odometer **5,180 km**, mileage **37.2 km/L**, services **BDT 21,760**, August total **BDT 24,660**.

## Runbook

```bash
# Verify (always before building)
npm run verify                       # tsc + eslint(0 warnings) + 168 tests
JAVA_HOME=/opt/homebrew/opt/openjdk@21 npm run test:rules   # 20 rules tests vs emulator

# Build
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME="$HOME/Library/Android/sdk"
npx expo prebuild --platform android          # --clean wipes android/ (keystore is safe in credentials/)
echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties
./android/gradlew -p android bundleRelease assembleRelease \
  -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
# → android/app/build/outputs/{bundle/release/app-release.aab, apk/release/app-release.apk}
# R8 mapping: android/app/build/outputs/mapping/release/mapping.txt (embedded in the AAB)

# Emulator + UI tests
"$ANDROID_HOME/emulator/emulator" -avd revora -no-window -no-audio -no-boot-anim \
  -gpu swiftshader_indirect -no-snapshot &
"$ANDROID_HOME/platform-tools/adb" install -r android/app/build/outputs/apk/release/app-release.apk
JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH="$HOME/.maestro/bin:$PATH" maestro test .maestro/

# Deploy (JDK 21 for all firebase-tools commands)
npx firebase deploy --only firestore:rules --project ai-fuel-assistant
npx firebase deploy --only hosting        --project ai-fuel-assistant
npx firebase deploy --only storage        --project ai-fuel-assistant   # after console Get Started

# Play assets / launcher assets
node scripts/generate-play-assets.js      # → play-assets/
node scripts/generate-assets.js           # → assets/ (icons, splash, dark logo)
```

Release checklist: bump `version` + `versionCode` in `app.config.ts` → `npm run verify` → prebuild → build → check signer SHA-256 `e78f5718…f16b` unchanged → upload AAB → release note.

## Open items

| # | Item | Who |
| --- | --- | --- |
| 1 | Firebase Storage "Get started" in console, then deploy `storage.rules` | Owner clicks; then one command |
| 2 | Package id is `app.revora.android.dev` — now permanent on this Play listing | Decided by first upload |
| 3 | On Play App Signing enrolment: add Google's app-signing SHA-1 to Firebase | Owner |
| 4 | `app-ads.txt` on the developer site once the listing is live (AdMob) | Owner |
| 5 | Billing not connected — Plan screen says so honestly; entitlement is server-write-only and ready | Future work |
| 6 | Real (non-test) ads appear only after AdMob approves the app & ad unit | Google |
| 7 | Web team: mobile added 4 collections + writes `estimate`, `units`, `clientRef` etc. — see `docs/data-model.md` | Web team |
