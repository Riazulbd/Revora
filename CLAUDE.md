# Revora — working notes

Android-first React Native app built from the approved design in
`design/Revora.dc.html`. **That file is the visual source of truth.** Colours,
type, spacing, radii and copy come from it; do not substitute a lookalike.

## Non-negotiables

1. **No business logic in a component.** Every derived number comes from
   `src/calculations/`. If Dashboard and Analytics both show "average mileage",
   they must read the same `analyseBike()` field.
2. **No Firestore outside `src/repositories/`.** Screens and calculations must
   never import `@react-native-firebase/*`.
3. **Nothing derived is stored.** Current odometer, mileage, running cost and
   maintenance status are recomputed on read. Adding a stored copy reintroduces
   the class of bug where editing an old record leaves stale figures behind.
4. **Money is integer minor units. Volume is integer millilitres. Distance is
   integer metres.** No floats anywhere in the money path.
5. **Calendar dates are `'YYYY-MM-DD'` strings.** Never `Timestamp`, never UTC.
   Use `src/utils/date.ts`; `new Date('2026-09-01')` is a bug.
6. **A figure that cannot be computed renders as `—`, not `0`.**
   `src/utils/format.ts` guarantees `NaN`/`Infinity`/`null` never reach a screen.

## Where things live

| Need                        | Go to                                    |
| --------------------------- | ---------------------------------------- |
| A colour or a font size     | `src/theme/` — transcribed from the design |
| A shared UI piece           | `src/components/`                        |
| A derived number            | `src/calculations/`                      |
| Reading or writing data     | `src/repositories/`                      |
| A form or a mutation        | `src/features/<domain>/`                 |
| A screen                    | `src/app/` (expo-router; routes only)    |

## Patterns to follow

**Editor screens** split into a route that waits for data and a form keyed on the
record id, so every field initialises from its final value on first render. There
is no hydration `useEffect` anywhere — see `src/app/fuel/add.tsx`.

**Writes** go through `useRecordMutation`, which handles the toast, the error
mapping, the sync tracker and the in-flight guard. Ids come from `useStableId`
so a retry writes the same document instead of a second one.

**Reads** go through `useLiveQuery`, which shares one reference-counted Firestore
listener per query key and mirrors it into TanStack Query. Because Firestore
emits a local snapshot the moment a write is accepted, screens update instantly —
including offline — with no invalidation to remember.

## Commands

```bash
npm run verify      # typecheck + lint (0 warnings) + 163 unit tests
npm run test:rules  # firestore.rules against the emulator (needs JDK 21)
```

The rules suite is the only thing that can prove rider A cannot reach rider B's
data — the app cannot enforce that for itself. Run it after any rules change.

Native build (needs JDK 17 + Android SDK — see `SIGNING.md`):

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME="$HOME/Library/Android/sdk"
npx expo prebuild --platform android --clean
./android/gradlew -p android assembleRelease
```

`android/` is generated — never edit it by hand. Native changes go in
`app.config.ts` or a plugin under `plugins/`.
