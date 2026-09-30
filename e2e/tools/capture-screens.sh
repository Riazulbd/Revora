#!/usr/bin/env bash
# Walks the app and screenshots each screen, naming each shot after the
# artboard it must match.
#
# Navigation is by testID via Maestro — never by coordinate tap, which is how
# an earlier run wandered out of the app and into the launcher.
set -uo pipefail
S="${1:-emulator-5554}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$ANDROID_HOME/platform-tools:$PATH"
cd "$(dirname "$0")/.."/..
OUT=design/redesign/compare/shots
mkdir -p "$OUT"

shot() { sleep 1.5; adb -s "$S" exec-out screencap -p > "$OUT/$1.png" 2>/dev/null && echo "  captured $1"; }
flow() { maestro --device "$S" test "$1" >/dev/null 2>&1 && echo "  ran $(basename "$1")" || echo "  FAILED $(basename "$1")"; }

echo "== fixture: anonymous rider, bike at 4,845 km =="
flow e2e/audit/00-fresh-anon-bike-4845.yaml

echo "== tabs =="
cat > /tmp/nav.yaml <<'Y'
appId: app.revora.android.dev
---
- launchApp
- tapOn: { id: "tab-dashboard" }
Y
flow /tmp/nav.yaml; shot dashboard--03-light-first-run

for t in fuel expenses garage; do
  cat > /tmp/nav.yaml <<Y
appId: app.revora.android.dev
---
- tapOn: { id: "tab-$t" }
Y
  flow /tmp/nav.yaml
done

echo "done — $(ls "$OUT" | wc -l | tr -d ' ') shots"
