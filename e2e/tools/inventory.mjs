#!/usr/bin/env node
/**
 * Enumerates every interactive surface in the app, from the source.
 *
 * The point is coverage you can prove rather than coverage you assert: a flow
 * suite is only trustworthy if something independent knows what the app
 * contains. This walks src/app and src/features, finds every screen, control
 * and input, and emits JSON the flow generator and the report both read.
 *
 * It is deliberately dumb about semantics — it reports what is rendered, not
 * what it means. A control with no testID is itself a finding, because it
 * cannot be driven by a test or named by a screen reader.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== '__audit__' && name !== 'node_modules') walk(p, out); }
    // A .test.tsx renders fixtures, not the app; counting its testIDs would
    // inflate the denominator with surfaces no rider can reach.
    else if (/\.tsx$/.test(p) && !/\.(test|spec)\.tsx$/.test(p) && !/__/.test(name)) out.push(p);
  }
  return out;
};

const files = [...walk(join(ROOT, 'src/app')), ...walk(join(ROOT, 'src/features'))];

// A control is anything a finger can land on; a field is anything a keyboard
// can reach. Both are matched on the component names this codebase actually
// uses, so a rename shows up as a drop in the count rather than silence.
const CONTROL = /<(Button|LinkButton|Pressable|TouchableOpacity|MenuRow|RecordRow|KeyValueRow|CopyableRow|CopyButton|IconButton|Toggle|ToggleRow|CheckRow|Segmented|ChipGroup|ChoiceGrid|StatTile|CircleButton|Avatar)\b/g;
const FIELD = /<(Input|TextArea|DateField|PickerField)\b/g;

const screens = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  // Every form the codebase uses: the JSX attribute, the prefixed variants a
  // component takes for the controls it owns (`inputTestID`, `sendTestID`,
  // `backTestID`), and the `testID:` key of
  // an options object a component spreads onto its own control (EmptyState's
  // primaryAction, OverflowMenu's rows). Missing the second form hid a dozen
  // real controls and made the suite look like it was driving ids that had
  // moved rather than gone.
  const ids = [
    ...[...src.matchAll(/\b[A-Za-z]*[tT]estID=["'`]([^"'`$]+)["'`]/g)].map((m) => m[1]),
    // The object form also matches fragments a component later composes into a
    // real id (`testID: 'service'` becoming `category-reroute-service`), so it
    // only counts when the value already looks like an id. Every testID in this
    // codebase is kebab-case; a bare word never is.
    ...[...src.matchAll(/\b[A-Za-z]*[tT]estID:\s*['"]([^'"$]+)['"]/g)].map((m) => m[1]).filter((id) => id.includes('-')),
    // And the branching form, `testID={pending ? 'a' : 'b'}` — two real ids,
    // one of which a coverage run would otherwise never know existed.
    ...[...src.matchAll(/\b[A-Za-z]*[tT]estID=\{([^}]*)\}/g)]
      .flatMap((m) => [...m[1].matchAll(/['"]([^'"$]+)['"]/g)].map((q) => q[1]))
      // A branch may also hold a joiner or a fragment; only kebab-case words
      // with something on both sides of a hyphen are ids.
      .filter((id) => /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/i.test(id)),
  ];
  const dynamicIds = [
    ...[...src.matchAll(/\b[A-Za-z]*[tT]estID=\{`([^`]+)`\}/g)].map((m) => m[1]),
    ...[...src.matchAll(/\b[A-Za-z]*[tT]estID:\s*`([^`]+)`/g)].map((m) => m[1]),
  ];
  const screenId = ids.find((i) => i.startsWith('screen-')) ?? null;

  const controls = (src.match(CONTROL) ?? []).length;
  const fields = (src.match(FIELD) ?? []).length;
  // A file that names a testID is an addressable surface whether or not its
  // wrapper happens to be one of the component names above — the redesign
  // keeps inventing new ones (ActionTile, IconSquareButton, PhotoPanel), and
  // dropping their files here would quietly shrink what coverage is measured
  // against, which is the one thing a coverage number must never do.
  if (controls === 0 && fields === 0 && !screenId && ids.length === 0 && dynamicIds.length === 0) continue;

  // Labels give the flow generator something to assert when an id is absent.
  const labels = [...src.matchAll(/label=["']([^"']{2,60})["']/g)].map((m) => m[1]);

  screens.push({
    file: rel,
    route: rel.startsWith('src/app/') ? '/' + rel.slice(8).replace(/\.tsx$/, '').replace(/\/index$/, '') : null,
    screenId,
    controls,
    fields,
    testIds: ids.filter((i) => !i.startsWith('screen-')),
    dynamicIds,
    labels: [...new Set(labels)],
    untestable: Math.max(0, controls + fields - ids.length - dynamicIds.length),
  });
}

const totals = screens.reduce(
  (a, s) => ({
    screens: a.screens + (s.screenId ? 1 : 0),
    controls: a.controls + s.controls,
    fields: a.fields + s.fields,
    ids: a.ids + s.testIds.length + s.dynamicIds.length,
    untestable: a.untestable + s.untestable,
  }),
  { screens: 0, controls: 0, fields: 0, ids: 0, untestable: 0 },
);

mkdirSync(join(ROOT, 'e2e/out'), { recursive: true });
writeFileSync(join(ROOT, 'e2e/out/inventory.json'), JSON.stringify({ totals, screens }, null, 1));

console.log(`screens with an id : ${totals.screens}`);
console.log(`controls           : ${totals.controls}`);
console.log(`fields             : ${totals.fields}`);
console.log(`addressable testIDs: ${totals.ids}`);
console.log(`NOT addressable    : ${totals.untestable}  <- cannot be driven by a test or named to a screen reader`);
console.log(`\nwritten: e2e/out/inventory.json`);
