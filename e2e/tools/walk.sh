#!/usr/bin/env bash
# Drives the app by testID and screenshots each screen under the artboard name
# it must match. Never taps coordinates — that is how an earlier run wandered
# into the launcher.
set -uo pipefail
S="${1:-emulator-5554}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$ANDROID_HOME/platform-tools:$PATH"
cd "$(dirname "$0")/../.."
OUT=design/redesign/compare/shots; mkdir -p "$OUT"

run() {  # run <name> <steps-file>
  maestro --device "$S" test "$2" >/tmp/walk.log 2>&1
  if grep -q FAILED /tmp/walk.log; then echo "  ✗ $1"; return 1; fi
  sleep 1.2; adb -s "$S" exec-out screencap -p > "$OUT/$1.png" 2>/dev/null
  echo "  ✓ $1"
}

step() { printf 'appId: app.revora.android.dev\n---\n%s\n' "$1" > /tmp/step.yaml; }

echo "== auth =="
step '- launchApp: { clearState: true }
- assertVisible: { id: "screen-welcome" }'
run welcome--01-light-online /tmp/step.yaml

step '- tapOn: { id: "cta-signin" }
- assertVisible: { id: "screen-signin" }'
run sign-in--01-light-idle /tmp/step.yaml

step '- tapOn: { id: "cta-signup-link" }
- assertVisible: { id: "screen-signup" }'
run create-account--01-light-idle-rules-up-front /tmp/step.yaml || true

step '- back
- tapOn: { id: "cta-forgot" }
- assertVisible: { id: "screen-recover" }'
run reset-password--01-light-idle /tmp/step.yaml || true

echo "== onboarding =="
step '- launchApp: { clearState: true }
- tapOn: { id: "cta-signin" }
- tapOn: { id: "cta-anonymous" }
- assertVisible: { id: "screen-onboarding" }'
run add-motorcycle--01-light-empty /tmp/step.yaml

echo "== fixture bike =="
maestro --device "$S" test e2e/audit/lib/fresh-anon-bike.yaml >/tmp/walk.log 2>&1 \
  && echo "  ✓ bike created" || { echo "  ✗ bike creation"; tail -3 /tmp/walk.log; }

echo "== tabs =="
for t in dashboard fuel expenses garage; do
  case $t in
    dashboard) name=dashboard--03-light-first-run;;
    fuel)      name=fuel-tab--02-light-no-fills-yet;;
    expenses)  name=costs-tab--02-light-nothing-logged;;
    garage)    name=garage-tab--01-light-one-bike-common-case;;
  esac
  step "- tapOn: { id: \"tab-$t\" }"
  run "$name" /tmp/step.yaml
done

echo "== hub and deeper =="
step '- tapOn: { id: "tab-garage" }
- tapOn: { id: "cta-profile" }
- assertVisible: { id: "screen-bike-profile" }'
run navigation--03-ownership-hub-motorcycle-profile-light /tmp/step.yaml || true

step '- tapOn: { id: "hub-documents" }
- assertVisible: { id: "screen-vault" }'
run records--01-document-vault-light /tmp/step.yaml || true

step '- back
- tapOn: { id: "hub-maintenance" }
- assertVisible: { id: "screen-maintenance" }'
run maintenance--01-maintenance-mixed-states-light /tmp/step.yaml || true

step '- back
- tapOn: { id: "hub-safety" }
- assertVisible: { id: "screen-safety" }'
run records--07-safety-never-checked-dark /tmp/step.yaml || true

echo "== search and add-fuel =="
step '- tapOn: { id: "tab-dashboard" }
- tapOn: { id: "cta-search" }
- assertVisible: { id: "screen-search" }'
run navigation--04-search-resting-light /tmp/step.yaml || true

step '- back
- tapOn: { id: "quick-add-fuel" }
- assertVisible: { id: "screen-fuel-add" }'
run add-fuel--01-light-new-fill /tmp/step.yaml || true

echo "done — $(ls "$OUT" | wc -l | tr -d ' ') shots"
