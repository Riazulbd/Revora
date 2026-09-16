#!/usr/bin/env bash
# Runs every flow and prints one line per flow.
#
# Maestro needs a JDK on PATH and adb reachable; neither is set up by the
# repo's other scripts, so they are pinned here rather than assumed.
set -uo pipefail
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$ANDROID_HOME/platform-tools:$PATH"

cd "$(dirname "$0")/.."
pass=0; fail=0; failed=()

for flow in e2e/*.yaml; do
  name=$(basename "$flow" .yaml)
  out=$(maestro test "$flow" 2>&1)
  if grep -q "FAILED" <<<"$out"; then
    fail=$((fail+1)); failed+=("$name")
    printf '  ✗ %-20s %s\n' "$name" "$(grep -m1 -E 'FAILED|Element not found|Assertion is false' <<<"$out" | tr -s ' ')"
  else
    pass=$((pass+1)); printf '  ✓ %s\n' "$name"
  fi
done

echo
echo "  $pass passed, $fail failed"
[ $fail -eq 0 ] || printf '  failing: %s\n' "${failed[*]}"
exit $fail
