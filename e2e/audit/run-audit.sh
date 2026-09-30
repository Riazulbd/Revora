#!/usr/bin/env bash
# Phase B runner: every e2e/audit/*.yaml in order, one line per flow.
#
#   usage: e2e/audit/run-audit.sh <adb-serial>
#
# Per flow it saves maestro's full output to e2e/audit/out/<flow>.log, keeps
# maestro's own debug artefacts under e2e/audit/out/<flow>.debug/, and takes a
# screenshot of whatever is on screen when the flow ends at
# e2e/audit/out/<flow>.png (adb screencap).
#
# 70-offline-crud is wrapped in radio toggles, because Maestro cannot touch
# the network itself. Radios are re-enabled on exit whatever happens.
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
OUT=e2e/audit/out
mkdir -p "$OUT"

if ! adb -s "$SERIAL" get-state >/dev/null 2>&1; then
  echo "device $SERIAL is not reachable over adb" >&2
  exit 2
fi

net_off() {
  adb -s "$SERIAL" shell svc wifi disable
  adb -s "$SERIAL" shell svc data disable
  sleep 3
}
net_on() {
  adb -s "$SERIAL" shell svc wifi enable
  adb -s "$SERIAL" shell svc data enable
  sleep 5
}
trap net_on EXIT

pass=0; fail=0; failed=()

for flow in e2e/audit/*.yaml; do
  name=$(basename "$flow" .yaml)
  log="$OUT/$name.log"
  png="$OUT/$name.png"

  case "$name" in
    70-offline-crud) net_off ;;
  esac

  maestro --device "$SERIAL" test --debug-output "$OUT/$name.debug" "$flow" >"$log" 2>&1
  status=$?

  # Whatever is on screen when the flow ends — pass or fail.
  adb -s "$SERIAL" exec-out screencap -p >"$png" 2>/dev/null

  case "$name" in
    70-offline-crud) net_on ;;
  esac

  if [ $status -ne 0 ] || grep -q "FAILED" "$log"; then
    fail=$((fail+1)); failed+=("$name")
    reason=$(grep -m1 -E 'FAILED|Element not found|Assertion is false|not found' "$log" | tr -s ' ')
    printf '  ✗ %-26s %s\n' "$name" "${reason:-see $log}"
  else
    pass=$((pass+1)); printf '  ✓ %-26s %s\n' "$name" "$png"
  fi
done

echo
echo "  $pass passed, $fail failed  (logs and screenshots in $OUT/)"
[ $fail -eq 0 ] || printf '  failing: %s\n' "${failed[*]}"
exit $fail
