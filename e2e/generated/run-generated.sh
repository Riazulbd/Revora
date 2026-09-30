#!/usr/bin/env bash
# Runs every generated flow, in order, against one device.
#
#   usage: e2e/generated/run-generated.sh <adb-serial>     (adb devices lists them)
#
# Per flow it writes maestro's full output to e2e/out/<flow>.log, keeps
# maestro's own debug artefacts under e2e/out/<flow>.debug/, and takes a
# screenshot of whatever is on screen when the flow ends — pass or fail — at
# e2e/out/<flow>.png. One PASS/FAIL line per flow, then a summary.
#
# Order is the suite. 00–04 sign in and build the fixture, 05–17 prove the
# empty states while nothing is logged, 18–60 drive every form and every
# populated screen, and 9x are destructive and run last: the final one deletes
# the account, so nothing can follow it.
#
# Two flows need the radios down and cannot do it themselves — Maestro has no
# way to touch the network. Any flow whose name ends "-offline" is wrapped in
# svc toggles, and the radios are put back on exit whatever happens, including
# Ctrl-C.
set -uo pipefail

SERIAL="${1:-}"
if [ -z "$SERIAL" ]; then
  echo "usage: $0 <adb-serial>   (adb devices lists them)" >&2
  exit 2
fi

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$ANDROID_HOME/platform-tools:$PATH"

cd "$(dirname "$0")/../.."
OUT=e2e/out
mkdir -p "$OUT"

if ! command -v maestro >/dev/null 2>&1; then
  echo "maestro is not on PATH (expected ~/.maestro/bin)" >&2
  exit 2
fi

if ! adb -s "$SERIAL" get-state >/dev/null 2>&1; then
  echo "device $SERIAL is not reachable over adb" >&2
  exit 2
fi

net_off() {
  adb -s "$SERIAL" shell svc wifi disable >/dev/null 2>&1
  adb -s "$SERIAL" shell svc data disable >/dev/null 2>&1
  sleep 3
}
net_on() {
  adb -s "$SERIAL" shell svc wifi enable >/dev/null 2>&1
  adb -s "$SERIAL" shell svc data enable >/dev/null 2>&1
  sleep 5
}
# Leaving a rider's phone with no radios because a test suite was interrupted
# is worse than a failed run, so this is unconditional.
trap net_on EXIT INT TERM

shopt -s nullglob
flows=(e2e/generated/*.yaml)
if [ ${#flows[@]} -eq 0 ]; then
  echo "no flows in e2e/generated — run: node e2e/tools/generate.mjs" >&2
  exit 2
fi

pass=0
fail=0
failed=()
started=$(date +%s)

echo "  ${#flows[@]} flows · device $SERIAL · logs and screenshots in $OUT/"
echo

for flow in "${flows[@]}"; do
  name=$(basename "$flow" .yaml)
  log="$OUT/$name.log"
  png="$OUT/$name.png"

  case "$name" in
    *-offline) net_off ;;
  esac

  maestro --device "$SERIAL" test --debug-output "$OUT/$name.debug" "$flow" >"$log" 2>&1
  status=$?

  # Whatever is on screen when the flow ends, pass or fail. A screenshot of a
  # failure is usually the fastest way to see what the redesign renamed.
  adb -s "$SERIAL" exec-out screencap -p >"$png" 2>/dev/null

  case "$name" in
    *-offline) net_on ;;
  esac

  if [ $status -ne 0 ] || grep -q "FAILED" "$log"; then
    fail=$((fail + 1))
    failed+=("$name")
    reason=$(grep -m1 -E 'FAILED|Element not found|Assertion is false|not found' "$log" | tr -s ' ' | cut -c1-90)
    printf '  FAIL  %-34s %s\n' "$name" "${reason:-see $log}"
  else
    pass=$((pass + 1))
    printf '  PASS  %-34s %s\n' "$name" "$png"
  fi
done

elapsed=$(( $(date +%s) - started ))
echo
echo "  $pass passed, $fail failed, ${#flows[@]} total  (${elapsed}s)"
echo "  logs: $OUT/<flow>.log   screenshots: $OUT/<flow>.png"
if [ $fail -ne 0 ]; then
  printf '  failing: %s\n' "${failed[*]}"
  echo "  if a step cannot find an id, the redesign probably renamed it:"
  echo "    node e2e/tools/inventory.mjs && node e2e/tools/generate.mjs && node e2e/tools/coverage.mjs"
fi
exit $fail
