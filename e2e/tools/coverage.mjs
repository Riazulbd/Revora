#!/usr/bin/env node
/**
 * Proves the flow suite touches every control and every field the app has.
 *
 *   node e2e/tools/inventory.mjs && node e2e/tools/coverage.mjs
 *
 * The inventory is read from the source; the flows are read from e2e/**.yaml.
 * Anything the app renders and no flow names is printed, grouped by the file
 * it lives in, and the process exits non-zero — so this can gate a run.
 *
 * A coverage number is only worth something if it is honest, which is what the
 * SKIP list below is for. Every entry is an id that exists in the app and
 * cannot be driven from a test device: it needs a Pro entitlement only the
 * backend can write, a real Google Play purchase, an account this fixture does
 * not have, or a system surface outside the app. Each carries its reason on
 * the same line. Skipped ids are excluded from the denominator and listed in
 * the report, never quietly counted as covered.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// SKIP — ids that exist but cannot be driven. One line each, with the reason.
// ---------------------------------------------------------------------------
export const SKIP = {
  // --- needs a real Google Play purchase, or a plan only the backend grants ---
  'cta-upgrade':
    'launches Google Play checkout — needs a licensed tester and a real purchase',
  'cta-manage-subscription':
    'only for an account whose entitlement came from Google Play — needs a live subscription',
  'banner-pro-active':
    'only when the server-written entitlement says Pro; no client path reaches it',
  'banner-subscription-state':
    'needs a Play subscription in grace, hold, paused or canceled state',
  'offer-':
    'one tile per offer Play returns; a build with no Play product gets none',
  'upsell-price':
    "Play's formattedPrice, absent until Billing answers with a product — never invented by the app",
  'billing-status':
    'only when Google Play returns a message; a device with no purchase history returns none',
  'billing-error':
    'only when Google Play errors; nothing in a clean run produces one',
  'link-play-retry':
    'the retry inside the Play-error banner, so it needs that error first',
  'banner-payment-pending':
    'needs a Play payment left pending mid-purchase',
  'banner-play-unavailable':
    'only when the Play Billing module is absent from the build; the dev build has it',
  'cta-sign-in-to-subscribe':
    'only when billing is available and the account cannot purchase; every fixture account can',
  'text-prices-loading':
    'a transient while Play answers — a flow cannot reliably catch it, and waiting for it would be a race',
  'notice-bike-switched':
    'switching motorcycles needs a second one, which is Pro',
  'bike-card-':
    'the garage only draws bike cards with more than one motorcycle, which is Pro',

  // --- needs an account this fixture is not, or a second device ---
  'cta-google':
    'opens the Google Play Services account chooser, a system surface outside the app',
  'row-resend-verification':
    'needs an email account whose address is unverified; the offline fixture has no email',
  'input-delete-password':
    'only for a password account; the offline fixture has no password to re-enter',

  // --- needs something a test device cannot produce ---
  'row-receipt':
    'needs a photo actually attached, which means picking a real image out of the device gallery',
  'cta-scan-allow':
    'drawn only when camera permission was denied; the suite runs with it granted',
  'empty-odometer':
    "only when the motorcycle has no readings at all; the fixture's opening 4,845 km is itself a reading",
  'link-remove-ads':
    'the ad card renders only after an AdMob creative loads; a filled banner cannot be guaranteed',
  'state-dashboard-error':
    'needs the records query to fail; nothing on the device can force Firestore to error',
  'attention-error':
    'the same forced query failure, on the attention card',
  'error-maintenance':
    'the same forced query failure, on the rule list',
  'error-service-plan':
    'the same forced query failure, on the service plan',
  'error-vault':
    'the same forced query failure, on the document vault',
  'error-warranties':
    'the same forced query failure, on the warranty list',
  'error-safety':
    'the same forced query failure, on the condition log',
  'note-uncompared':
    'only when a workshop visit recorded no quote to compare; every generated visit records one',
  'banner-save-failed':
    'needs a write that Firestore rejects after accepting it locally',
  'error-analytics':
    'the same forced query failure, on Analytics',
  'state-proof-generating':
    'the render is over in under a second — waiting for it would be a race, not a test',
  'cta-share-proof':
    'hands the PDF to the Android share sheet, which is not this app to drive',
  'cta-open-proof':
    'hands the PDF to whatever opens PDFs on the device',
  'banner-assistant-quota':
    'the Pro quota warning, for the same reason',
  'banner-assistant-offline':
    'the Pro assistant needs a connection; the Free one answers on the device, so this never shows for the fixture',
};

// ---------------------------------------------------------------------------

/**
 * A SKIP key is the id as the inventory names it, which for a templated id is
 * its prefix — `offer-` covers `offer-${offer.basePlanId}`.
 */
const skipReason = (id) => SKIP[id];

/** Every id the app renders: literals plus the prefix of each templated id. */
export function readTargets(root = ROOT) {
  const inventory = JSON.parse(readFileSync(join(root, 'e2e/out/inventory.json'), 'utf8'));
  const targets = [];
  for (const screen of inventory.screens) {
    if (screen.screenId) targets.push({ id: screen.screenId, file: screen.file, dynamic: false });
    for (const id of screen.testIds) targets.push({ id, file: screen.file, dynamic: false });
    for (const pattern of screen.dynamicIds) {
      const prefix = pattern.split('${')[0];
      if (prefix === '') continue;
      targets.push({ id: prefix, file: screen.file, dynamic: true, pattern });
    }
  }
  const seen = new Set();
  const unique = [];
  for (const target of targets) {
    const key = `${target.id}${target.dynamic ? '${…}' : ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...target, key });
  }
  return unique;
}

const walkYaml = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'out' && name !== 'node_modules') walkYaml(path, out);
    } else if (/\.ya?ml$/.test(path)) out.push(path);
  }
  return out;
};

/**
 * Every id any flow names, and which of them a flow actually *drives*.
 *
 * Maestro matches `id:` as a regex, so a flow targets a templated id with
 * `fuel-row-.*` — which still starts with its prefix, and that is what makes
 * dynamic coverage checkable at all.
 *
 * Named and driven are deliberately counted apart. An `assertVisible` proves
 * the control is on screen; only `tapOn` or `inputText` proves it does
 * anything. A suite that only asserts would report 100% and test nothing.
 */
export function readFlows(root = ROOT) {
  const files = walkYaml(join(root, 'e2e'));
  const named = new Set();
  const driven = new Set();
  for (const path of files) {
    const lines = readFileSync(path, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const match = /id:\s*["']([^"']+)["']/.exec(lines[i]);
      if (!match) continue;
      named.add(match[1]);
      // Walk back to the command this `id:` belongs to. A tap, a scroll-to or
      // a field being typed into all count as driving it.
      for (let j = i; j >= 0 && j > i - 6; j -= 1) {
        if (/^\s*-?\s*(tapOn|doubleTapOn|longPressOn|scrollUntilVisible|inputText|eraseText):/.test(lines[j])) {
          driven.add(match[1]);
          break;
        }
        if (/^\s*-?\s*(assertVisible|assertNotVisible):/.test(lines[j])) break;
      }
    }
  }
  return { files, named, driven };
}

const satisfiedBy = (set, target) => {
  if (!target.dynamic) return set.has(target.id);
  for (const key of set) if (key.startsWith(target.id) && key.length > target.id.length) return true;
  return false;
};

// ---------------------------------------------------------------------------
// Report — only when run directly, so generate.mjs can import SKIP.
// ---------------------------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith('coverage.mjs')) {
  const unique = readTargets();
  const { files, named, driven } = readFlows();

  const skipped = unique.filter((t) => skipReason(t.id) !== undefined);
  const drivable = unique.filter((t) => skipReason(t.id) === undefined);
  const covered = drivable.filter((t) => satisfiedBy(named, t));
  const missing = drivable.filter((t) => !satisfiedBy(named, t));
  const touched = drivable.filter((t) => satisfiedBy(driven, t));

  const percent = drivable.length === 0 ? 100 : (covered.length / drivable.length) * 100;
  const drivenPercent = drivable.length === 0 ? 100 : (touched.length / drivable.length) * 100;

  console.log(`flows read            : ${files.length}`);
  console.log(`testIDs in the app    : ${unique.length}`);
  console.log(`skipped, with reason  : ${skipped.length}`);
  console.log(`drivable              : ${drivable.length}`);
  console.log(`covered (named)       : ${covered.length}`);
  console.log(`coverage              : ${percent.toFixed(1)}%`);
  console.log(`of those, driven      : ${touched.length}  (${drivenPercent.toFixed(1)}% tapped or typed into,`);
  console.log(`                         the rest asserted only — see generate.mjs)`);

  if (skipped.length > 0) {
    console.log('\nSKIPPED — exists in the app, cannot be driven from a device:');
    for (const t of skipped.sort((a, b) => a.id.localeCompare(b.id))) {
      console.log(`  ${t.key.padEnd(30)} ${skipReason(t.id)}`);
    }
  }

  if (missing.length > 0) {
    const byFile = new Map();
    for (const t of missing) {
      if (!byFile.has(t.file)) byFile.set(t.file, []);
      byFile.get(t.file).push(t.key);
    }
    console.log(`\nUNCOVERED — ${missing.length} id(s) no flow names:`);
    for (const [file, ids] of [...byFile].sort()) {
      console.log(`\n  ${file}`);
      for (const id of ids.sort()) console.log(`    ${id}`);
    }
    console.log(
      '\nAdd a step for each in e2e/tools/generate.mjs and re-run, or — only if it',
      'genuinely cannot be driven — add it to SKIP at the top of this file with a reason.',
    );
  }

  // The check in the other direction: an id a flow drives that the app no
  // longer renders. That is what a rename looks like from this side, and it is
  // the failure the generated suite is most likely to hit on a device.
  //
  // A flow legitimately names ids the inventory cannot see — Maestro regexes
  // like `fuel-row-.*`, and the children a component derives from its own
  // testID (`segment-fill-full`, `dialog-delete-fuel-cancel`, `unit-distance-km`).
  // So an id counts as known if it is a literal, extends a literal, or extends
  // a templated prefix.
  const literals = unique.filter((t) => !t.dynamic).map((t) => t.id);
  const prefixes = unique.filter((t) => t.dynamic).map((t) => t.id);
  const recognised = (id) =>
    literals.includes(id) ||
    prefixes.some((p) => id.startsWith(p)) ||
    literals.some((l) => id.startsWith(`${l}-`));
  const orphans = [...named].filter((id) => !recognised(id) && SKIP[id] === undefined).sort();
  if (orphans.length > 0) {
    console.log(`\nNAMED BUT GONE — ${orphans.length} id(s) a flow drives that the app no longer renders:`);
    for (const id of orphans) console.log(`  ${id}`);
    console.log('  These steps will fail on a device. Fix them in e2e/tools/generate.mjs.');
  }

  // A SKIP entry for an id the app no longer has is stale, and a stale excuse
  // is how a coverage number starts lying.
  const known = new Set(unique.map((t) => t.id));
  const stale = Object.keys(SKIP).filter((id) => !known.has(id));
  if (stale.length > 0) {
    console.log(`\nSTALE SKIP — no longer in the app, delete from SKIP: ${stale.join(', ')}`);
  }

  // A stale entry does not bend the number — the id is not in the denominator
  // either way — so it is a warning, not a failure. Screens are being rewritten
  // as this runs, and an id can leave and come back inside an afternoon.
  if (missing.length > 0) process.exitCode = 1;
}
