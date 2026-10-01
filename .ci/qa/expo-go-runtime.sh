#!/usr/bin/env bash
set -euo pipefail
ROOT="$PWD"
OUT="$ROOT/runtime-evidence"
mkdir -p "$OUT"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
cleanup() {
  if timeout 5 adb get-state >/dev/null 2>&1; then
    timeout 15 adb logcat -d > "$OUT/logcat.txt" 2>&1 || true
    timeout 15 adb shell uiautomator dump /sdcard/final.xml > /dev/null 2>&1 || true
    timeout 15 adb pull /sdcard/final.xml "$OUT/final.xml" > /dev/null 2>&1 || true
    timeout 15 adb exec-out screencap -p > "$OUT/final.png" 2>/dev/null || true
    timeout 10 adb emu kill > /dev/null 2>&1 || true
  fi
  test -z "${METRO_PID:-}" || kill "$METRO_PID" 2>/dev/null || true
  for log in emulator.log metro.log; do
    test ! -f "$OUT/$log" || { echo "RUNTIME_LOG:$log"; tail -100 "$OUT/$log"; }
  done
}

trap cleanup EXIT

# Require the hypervisor access prepared by this disposable job.
if emulator -accel-check > "$OUT/acceleration.txt" 2>&1; then
  ACCEL=auto
else
  cat "$OUT/acceleration.txt"
  id
  ls -l /dev/kvm || true
  echo 'Acceleration is not usable; stopping before the native runtime proof.'
  exit 77
fi
cat "$OUT/acceleration.txt"
echo "Using acceleration=$ACCEL for this disposable runtime job"
emulator -list-avds | tee "$OUT/avd-list.txt"
grep -qx gym-proof "$OUT/avd-list.txt"
emulator -avd gym-proof -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -accel "$ACCEL" -memory 2048 -cores 2 > "$OUT/emulator.log" 2>&1 &
EMULATOR_PID=$!
export EMULATOR_PID
timeout 900 bash -c 'until adb shell getprop sys.boot_completed 2>/dev/null | tr -d "\r" | grep -qx 1; do kill -0 "$EMULATOR_PID" || exit 1; sleep 5; done' 
kill -0 "$EMULATOR_PID"
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard
adb shell wm size 390x844
adb shell wm density 160

APK=$(node -p "require('./runtime-evidence/expo-go-download.json').path")
adb install "$APK"
adb shell dumpsys package host.exp.exponent | grep -E 'versionName=|versionCode=' | tee "$OUT/expo-go-installed.txt"
pnpm --dir apps/mobile exec expo config --type public --json > "$OUT/expo-config.json"
node -e "const c=require('./runtime-evidence/expo-config.json'); if(c.android?.package) throw new Error('The proof must not assign an Android app identity'); console.log('SDK',c.sdkVersion,'android.package remains unset');"
EXPO_UNSTABLE_HEADLESS=1 NODE_OPTIONS=--dns-result-order=ipv4first pnpm --dir apps/mobile exec expo start --go --localhost --port 8081 > "$OUT/metro.log" 2>&1 &
METRO_PID=$!
export METRO_PID
timeout 180 bash -c 'until curl --max-time 5 --fail --silent http://127.0.0.1:8081/status | grep -q packager-status:running; do kill -0 "$METRO_PID" || exit 1; sleep 2; done'
adb reverse tcp:8081 tcp:8081
adb logcat -c

capture() {
  local name="$1"
  adb shell uiautomator dump /sdcard/proof.xml >/dev/null
  adb pull /sdcard/proof.xml "$OUT/$name.xml" >/dev/null
  timeout 15 adb exec-out screencap -p > "$OUT/$name.png"
}
launch() {
  adb shell am start -a android.intent.action.VIEW -d exp://127.0.0.1:8081 -p host.exp.exponent
}
wait_shell() {
  local found=0
  for attempt in $(seq 1 45); do
    sleep 4
    adb shell uiautomator dump /sdcard/proof.xml >/dev/null 2>&1 || continue
    adb pull /sdcard/proof.xml "$OUT/current.xml" >/dev/null 2>&1
    if python3 .ci/qa/expo-go-ui.py assert "$OUT/current.xml" >/dev/null 2>&1; then found=1; break; fi
    # Only dismiss the known, non-binding Expo Go onboarding tutorial.
    python3 .ci/qa/expo-go-ui.py onboarding "$OUT/current.xml"
  done
  test "$found" = 1 || { echo 'Native shell did not become visible'; cat "$OUT/current.xml"; return 1; }
  python3 .ci/qa/expo-go-ui.py assert "$OUT/current.xml"
}

launch
wait_shell
python3 .ci/qa/native-client-ui.py "$OUT"
adb logcat -d > "$OUT/logcat.txt"
if grep -E 'FATAL EXCEPTION|ReactNativeJS.*(TypeError|ReferenceError|Invariant Violation|Unable to resolve|Error:)' "$OUT/logcat.txt"; then
  echo 'Native runtime error detected'; exit 1
fi
echo 'Native client runtime proof passed: Expo Go SDK 57, initial render, repeated tab, resume, cold reopen and wide layout; no app applicationId assigned.'
