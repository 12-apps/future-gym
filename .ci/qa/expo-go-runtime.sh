#!/usr/bin/env bash
set -euo pipefail
ROOT="$PWD"
OUT="$ROOT/runtime-evidence"
mkdir -p "$OUT"
# Keep the audited application/dependency identity beside the actual captures.
git rev-parse HEAD > "$OUT/source-sha.txt"
git status --porcelain > "$OUT/source-working-tree.txt"
pnpm --dir apps/mobile list --depth 0 --json > "$OUT/installed-native-dependencies.json"
# Verify the exact reviewed application/configuration trees, not a nearby branch.
printf '%s\n' '1522b781fa2a1ca452f62a15c0e2eab3f29e99e6' > "$OUT/consumer-source-sha.txt"
test "$(git rev-parse HEAD:apps/mobile)" = 519547a5ba4e97b8a0b01ae1f96cb59a903cfc43
test "$(git rev-parse HEAD:pnpm-lock.yaml)" = d67da91050333556feb29efd202060c39b8577dd
test "$(git rev-parse HEAD:package.json)" = 8cabe285ed5dd4aa5a9857b01d242b1de56a0cc4
test "$(git rev-parse HEAD:turbo.json)" = 97e7679ecd7862623b6016e0cf964e0e11b51945
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
# HOST_AUDIO_FUNCTIONS_BEGIN
start_host_audio() {
  # Verify the installed official binary before selecting its documented backend.
  timeout 15 emulator -version > "$OUT/emulator-version.txt" 2>&1
  timeout 15 emulator -help-audio > "$OUT/emulator-audio-help.txt" 2>&1
  grep -q -- '-audio' "$OUT/emulator-audio-help.txt"
  grep -qi 'backend' "$OUT/emulator-audio-help.txt"
  command -v pulseaudio >/dev/null
  command -v pactl >/dev/null
  GYM_PULSE_DIR=$(mktemp -d "${RUNNER_TEMP:-/tmp}/gym-pulse.XXXXXX")
  chmod 700 "$GYM_PULSE_DIR"
  export PULSE_RUNTIME_PATH="$GYM_PULSE_DIR/run" PULSE_STATE_PATH="$GYM_PULSE_DIR/state"
  export PULSE_CONFIG_PATH="$GYM_PULSE_DIR/config" PULSE_SERVER="unix:$GYM_PULSE_DIR/native"
  export PULSE_SINK=gym_null PULSE_COOKIE="$GYM_PULSE_DIR/cookie"
  mkdir -m 700 "$PULSE_RUNTIME_PATH" "$PULSE_STATE_PATH" "$PULSE_CONFIG_PATH"
  python3 - "$PULSE_COOKIE" <<'PULSE_COOKIE_CREATE'
import os, sys
with os.fdopen(os.open(sys.argv[1], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as cookie:
    cookie.write(os.urandom(256))
PULSE_COOKIE_CREATE
  # No default modules, device discovery, hardware input, TCP or recording.
  # Google uses this null-sink backend in android-emulator-container-scripts.
  cat > "$OUT/pulse-null.pa" <<PULSE_CONFIG
load-module module-null-sink sink_name=gym_null rate=48000 channels=2 sink_properties=device.description=GymAuditNull
load-module module-native-protocol-unix socket=$GYM_PULSE_DIR/native auth-anonymous=0 auth-cookie=$PULSE_COOKIE
set-default-sink gym_null
PULSE_CONFIG
  pulseaudio -n --daemonize=no --use-pid-file=no --exit-idle-time=-1 \
    --high-priority=no --realtime=no --disallow-exit --disallow-module-loading \
    --log-target=stderr --log-level=info --file="$OUT/pulse-null.pa" > "$OUT/pulseaudio.log" 2>&1 &
  GYM_PULSE_PID=$!
  HOST_AUDIO_STARTED=1
  local ready=0
  for _ in $(seq 1 100); do
    kill -0 "$GYM_PULSE_PID" 2>/dev/null || break
    if timeout 2 pactl info > "$OUT/pulse-info.txt" 2> "$OUT/pulse-connect-stderr.txt"; then ready=1; break; fi
    sleep 0.1
  done
  test "$ready" = 1
  printf '{"status":"started","backend":"pa","sink":"gym_null","serverPid":%s,"physicalInput":false,"recording":false,"audibleOutputVerified":false}\n' \
    "$GYM_PULSE_PID" > "$OUT/host-audio.json"
}
verify_host_audio() {
  # Stream allocation may be lazy. Before app launch require the backend
  # connection; after the audit require a real stream observed during its interval.
  local label="$1"
  kill -0 "$GYM_PULSE_PID"
  for kind in modules sinks sources clients sink-inputs source-outputs; do
    timeout 5 pactl --format=json list "$kind" > "$OUT/pulse-$label-$kind.json"
  done
  python3 - "$OUT" "$label" <<'VERIFY_HOST_AUDIO'
import json, sys
from pathlib import Path
directory, label = Path(sys.argv[1]), sys.argv[2]
read = lambda kind: json.loads((directory / f"pulse-{label}-{kind}.json").read_text())
modules, sinks, sources, clients = (read(kind) for kind in ["modules", "sinks", "sources", "clients"])
inputs, outputs = read("sink-inputs"), read("source-outputs")
if {m["name"] for m in modules} != {"module-null-sink", "module-native-protocol-unix"}:
    raise SystemExit("Unexpected PulseAudio modules: hardware/discovery must remain absent")
if len(sinks) != 1 or sinks[0].get("name") != "gym_null":
    raise SystemExit("The sole PulseAudio output must be the private null sink")
if len(sources) != 1 or sources[0].get("name") != "gym_null.monitor" or outputs:
    raise SystemExit("Physical input or an active recording stream was exposed")
owned = {c["index"] for c in clients if "qemu-system" in c.get("properties", {}).get("application.process.binary", "")}
streams = [s for s in inputs if s.get("client") in owned and s.get("sink") == sinks[0]["index"]]
if not owned or len(streams) != len(inputs):
    raise SystemExit("Missing emulator backend connection or unexpected playback stream")
if label == "after":
    monitor = json.loads((directory / "host-audio-monitor.json").read_text())
    if monitor.get("status") != "complete" or not monitor.get("observedEmulatorPlayback") or monitor.get("errors"):
        raise SystemExit("No verified emulator playback stream during the real audit")
record_path = directory / "host-audio.json"
record = json.loads(record_path.read_text())
record.update(status="verified" if label == "after" else "connected", **{label: {"emulatorClients": sorted(owned), "playbackStreams": [s["index"] for s in streams]}})
record_path.write_text(json.dumps(record, indent=2))
VERIFY_HOST_AUDIO
}
start_host_audio_monitor() {
  python3 - "$OUT" <<'HOST_AUDIO_MONITOR' > "$OUT/host-audio-monitor-stderr.txt" 2>&1 &
import datetime, json, signal, subprocess, sys, time
from pathlib import Path
directory = Path(sys.argv[1])
running, seen, samples, errors = True, False, 0, []
def stop(*_):
    global running
    running = False
signal.signal(signal.SIGTERM, stop)
previous = None
try:
    with (directory / "host-audio-streams.jsonl").open("w", buffering=1) as output:
        while running:
            state = {}
            for kind in ["clients", "sink-inputs", "source-outputs"]:
                reply = subprocess.run(["pactl", "--format=json", "list", kind], capture_output=True, text=True, timeout=3, check=True)
                if reply.stderr.strip():
                    raise RuntimeError("Unexpected pactl diagnostic: " + reply.stderr.strip())
                state[kind] = json.loads(reply.stdout)
            samples += 1
            owned = {c["index"] for c in state["clients"] if "qemu-system" in c.get("properties", {}).get("application.process.binary", "")}
            sink = json.loads((directory / "pulse-before-sinks.json").read_text())[0]["index"]
            if state["source-outputs"] or any(s.get("client") not in owned or s.get("sink") != sink for s in state["sink-inputs"]):
                raise RuntimeError("Recording or unexpected host playback route observed")
            seen = seen or bool(state["sink-inputs"])
            # Preserve route changes with real clock identity, without recording audio.
            if state != previous:
                output.write(json.dumps({"utc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "state": state}) + "\n")
                previous = state
            time.sleep(0.25)
except Exception as error:
    errors.append(str(error))
finally:
    (directory / "host-audio-monitor.json").write_text(json.dumps({"status": "failed" if errors else "complete", "samples": samples,
        "observedEmulatorPlayback": seen, "errors": errors}, indent=2))
if errors:
    raise SystemExit("Host playback observation failed: " + "; ".join(errors))
HOST_AUDIO_MONITOR
  GYM_PULSE_MONITOR_PID=$!
}
stop_host_audio_monitor() {
  if test -n "${GYM_PULSE_MONITOR_FINISHED:-}"; then return "${GYM_PULSE_MONITOR_EXIT:-1}"; fi
  if test -n "${GYM_PULSE_MONITOR_PID:-}" && test -z "${GYM_PULSE_MONITOR_FINISHED:-}"; then
    GYM_PULSE_MONITOR_FINISHED=1
    GYM_PULSE_MONITOR_EXIT=1
    # An observer that exited before this request cannot silently establish proof.
    kill -0 "$GYM_PULSE_MONITOR_PID" 2>/dev/null || return 1
    kill -TERM "$GYM_PULSE_MONITOR_PID"
    for _ in $(seq 1 120); do
      if ! kill -0 "$GYM_PULSE_MONITOR_PID" 2>/dev/null; then
        if wait "$GYM_PULSE_MONITOR_PID"; then GYM_PULSE_MONITOR_EXIT=0; fi
        return "$GYM_PULSE_MONITOR_EXIT"
      fi
      sleep 0.1
    done
    kill -KILL "$GYM_PULSE_MONITOR_PID" 2>/dev/null || true
    wait "$GYM_PULSE_MONITOR_PID" || true
    return 1
  fi
}
stop_host_audio() {
  local stopped=0 pulse_exit=0 monitor_ok=1
  stop_host_audio_monitor || monitor_ok=0
  if kill -0 "$GYM_PULSE_PID" 2>/dev/null; then
    kill -TERM "$GYM_PULSE_PID" 2>/dev/null || true
    for _ in $(seq 1 50); do
      if ! kill -0 "$GYM_PULSE_PID" 2>/dev/null; then stopped=1; break; fi
      sleep 0.1
    done
    if test "$stopped" = 0; then kill -KILL "$GYM_PULSE_PID" 2>/dev/null || true; fi
  fi
  if wait "$GYM_PULSE_PID"; then pulse_exit=0; else pulse_exit=$?; fi
  printf '{"serverPid":%s,"exitCode":%s,"stopped":%s}\n' "$GYM_PULSE_PID" "$pulse_exit" \
    "$(kill -0 "$GYM_PULSE_PID" 2>/dev/null && echo false || echo true)" > "$OUT/host-audio-cleanup.json"
  # Only this job's mktemp directory is removed; no user audio configuration changes.
  rm -rf -- "$GYM_PULSE_DIR"
  test "$stopped" = 1 && test "$monitor_ok" = 1 && { test "$pulse_exit" = 0 || test "$pulse_exit" = 143; }
}
# HOST_AUDIO_FUNCTIONS_END
# LOG_COLLECTION_FUNCTIONS_BEGIN
wait_log_marker() {
  local marker="$1"
  for _ in $(seq 1 100); do
    kill -0 "$LOGCAT_PID" 2>/dev/null || return 1
    if grep -Fq "$marker" "$OUT/logcat.partial.txt"; then return 0; fi
    sleep 0.1
  done
  return 1
}
stop_log_collector() {
  local stopped=0
  if kill -0 "$LOGCAT_PID" 2>/dev/null; then
    kill -TERM "$LOGCAT_PID" 2>/dev/null || true
    for _ in $(seq 1 50); do
      if ! kill -0 "$LOGCAT_PID" 2>/dev/null; then stopped=1; break; fi
      sleep 0.1
    done
    if test "$stopped" = 0; then kill -KILL "$LOGCAT_PID" 2>/dev/null || true; fi
  fi
  if wait "$LOGCAT_PID"; then LOGCAT_EXIT=0; else LOGCAT_EXIT=$?; fi
  test "$LOGCAT_EXIT" = 0 || test "$LOGCAT_EXIT" = 143
}
start_log_collection() {
  # Never truncate an earlier proof when a job directory is reused accidentally.
  test ! -e "$OUT/logcat.txt" && test ! -e "$OUT/logcat.partial.txt" || return 1
  LOGCAT_TOKEN=$(python3 -c 'import uuid; print(uuid.uuid4().hex)')
  LOGCAT_BEGIN="GYM_AUDIT_BEGIN_$LOGCAT_TOKEN"
  LOGCAT_END="GYM_AUDIT_END_$LOGCAT_TOKEN"
  # Capture the actual adb child PID; no shell pipeline or timeout wrapper owns it.
  adb logcat -b all -v threadtime '*:V' > "$OUT/logcat.partial.txt" 2> "$OUT/logcat-stderr.txt" &
  LOGCAT_PID=$!
  LOGCAT_STARTED=1
  printf '{"status":"collecting","collectorPid":%s,"beginMarker":"%s","endMarker":"%s"}\n' \
    "$LOGCAT_PID" "$LOGCAT_BEGIN" "$LOGCAT_END" > "$OUT/logcat-capture.json"
  timeout 10 adb shell log -p i -t GYM_AUDIT "$LOGCAT_BEGIN" || return 1
  wait_log_marker "$LOGCAT_BEGIN"
}
finish_log_collection() {
  local failure=""
  # Finalize once, including on audit failure; cleanup must never retry a write.
  LOGCAT_FINALIZED=1
  if ! kill -0 "$LOGCAT_PID" 2>/dev/null; then
    failure="Collector exited before the audit end marker"
  elif ! timeout 10 adb shell log -p i -t GYM_AUDIT "$LOGCAT_END"; then
    failure="Could not emit the audit end marker"
  elif ! wait_log_marker "$LOGCAT_END"; then
    failure="Collector did not capture the audit end marker while alive"
  fi
  if ! stop_log_collector; then failure="Unexpected collector exit: $LOGCAT_EXIT; $failure"; fi
  python3 - "$OUT" "$LOGCAT_BEGIN" "$LOGCAT_END" "$LOGCAT_PID" "$LOGCAT_EXIT" "$failure" <<'VERIFY_LOG_CAPTURE'
import hashlib, json, sys
from pathlib import Path
directory = Path(sys.argv[1])
begin, end, pid, exit_code, failure = sys.argv[2:]
partial = directory / "logcat.partial.txt"
data = partial.read_bytes() if partial.exists() else b""
text = data.decode("utf-8", errors="replace")
errors = [failure] if failure else []
if text.count(begin) != 1 or text.count(end) != 1 or text.find(begin) >= text.find(end):
    errors.append("Missing, repeated or out-of-order audit markers")
if (directory / "logcat-stderr.txt").read_bytes():
    errors.append("Collector stderr is not empty")
if (directory / "logcat.txt").exists():
    errors.append("Refusing to replace existing primary evidence")
record = {"status": "failed" if errors else "complete", "file": "logcat.txt",
          "beginMarker": begin, "endMarker": end, "collectorPid": int(pid),
          "collectorExitCode": int(exit_code), "buffers": "all", "filter": "*:V",
          "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "errors": errors}
if not errors:
    partial.replace(directory / "logcat.txt")
(directory / "logcat-capture.json").write_text(json.dumps(record, indent=2))
if errors:
    result_path = directory / "result.json"
    result = json.loads(result_path.read_text()) if result_path.exists() else {}
    result.update(status="failed-log-collection", logCollectionErrors=errors)
    result_path.write_text(json.dumps(result, indent=2))
    raise SystemExit("Incomplete native log evidence: " + "; ".join(errors))
VERIFY_LOG_CAPTURE
}
collect_cleanup_log_diagnostic() {
  local diagnostic_exit=0
  timeout 15 adb logcat -b all -d -v threadtime '*:V' > "$OUT/logcat-cleanup.txt" 2> "$OUT/logcat-cleanup-stderr.txt" || diagnostic_exit=$?
  printf '{"status":"diagnostic-only","exitCode":%s,"complete":%s,"primaryLogUntouched":true}\n' \
    "$diagnostic_exit" "$(test "$diagnostic_exit" = 0 && echo true || echo false)" > "$OUT/logcat-cleanup-status.json"
}
# LOG_COLLECTION_FUNCTIONS_END
restore_font_scale_cleanup() {
  local actual
  if test "$ORIGINAL_FONT_SCALE" = null; then
    timeout 15 adb shell settings delete system font_scale || return 1
  else
    timeout 15 adb shell settings put system font_scale "$ORIGINAL_FONT_SCALE" || return 1
  fi
  actual=$(timeout 15 adb shell settings get system font_scale | tr -d '\r\n') || return 1
  printf 'original=%s\nrestored=%s\n' "$ORIGINAL_FONT_SCALE" "$actual"
  test "$actual" = "$ORIGINAL_FONT_SCALE"
}
cleanup() {
  local exit_status=$?
  if test -n "${LOGCAT_STARTED:-}" && test -z "${LOGCAT_FINALIZED:-}"; then
    finish_log_collection || exit_status=1
  fi
  # Always attempt the bounded font restore when its original value is known,
  # even if the driver or emulator disconnected. An unverified restore fails.
  if test -n "${ORIGINAL_FONT_SCALE:-}"; then
    if ! restore_font_scale_cleanup > "$OUT/font-scale-cleanup.txt" 2>&1; then
        echo 'Failed to restore original disposable-emulator font_scale'
        exit_status=1
        python3 - "$OUT/result.json" <<'RESTORE_FAILURE'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
result = json.loads(path.read_text()) if path.exists() else {}
result.update(status="failed-cleanup", cleanupError="Original emulator font_scale restoration could not be verified")
path.write_text(json.dumps(result, indent=2))
RESTORE_FAILURE
    fi
  fi
  if timeout 5 adb get-state >/dev/null 2>&1; then
    collect_cleanup_log_diagnostic
    timeout 15 adb shell uiautomator dump /sdcard/final.xml > /dev/null 2>&1 || true
    timeout 15 adb pull /sdcard/final.xml "$OUT/final.xml" > /dev/null 2>&1 || true
    timeout 15 adb exec-out screencap -p > "$OUT/final.png" 2>/dev/null || true
    stop_host_audio_monitor || exit_status=1
    timeout 10 adb emu kill > /dev/null 2>&1 || true
  fi
  test -z "${METRO_PID:-}" || kill "$METRO_PID" 2>/dev/null || true
  if test -n "${HOST_AUDIO_STARTED:-}"; then
    if ! stop_host_audio; then
      echo 'Private host audio server did not complete its bounded cleanup'
      exit_status=1
      python3 - "$OUT/result.json" <<'HOST_AUDIO_CLEANUP_FAILURE'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
result = json.loads(path.read_text()) if path.exists() else {}
result.update(status="failed-host-audio-cleanup", hostAudioCleanupError="Private PulseAudio process did not complete expected cleanup")
path.write_text(json.dumps(result, indent=2))
HOST_AUDIO_CLEANUP_FAILURE
    fi
  fi
  for log in emulator.log metro.log; do
    test ! -f "$OUT/$log" || { echo "RUNTIME_LOG:$log"; tail -100 "$OUT/$log"; }
  done
  trap - EXIT
  exit "$exit_status"
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
start_host_audio
# A real backend feeds only the private null sink; guest microphone input is disabled.
grep -qx 'hw.audioInput=no' "$ANDROID_AVD_HOME/gym-proof.avd/config.ini"
emulator -avd gym-proof -no-window -audio pa -no-boot-anim -no-snapshot -gpu swiftshader_indirect -accel "$ACCEL" -memory 2048 -cores 2 > "$OUT/emulator.log" 2>&1 &
EMULATOR_PID=$!
export EMULATOR_PID
timeout 900 bash -c 'until adb shell getprop sys.boot_completed 2>/dev/null | tr -d "\r" | grep -qx 1; do kill -0 "$EMULATOR_PID" || exit 1; sleep 5; done' 
kill -0 "$EMULATOR_PID"
verify_host_audio before
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard
adb shell wm size 390x844
adb shell wm density 160
# Capture the exact original value (including an absent/null setting) before the driver.
ORIGINAL_FONT_SCALE=$(adb shell settings get system font_scale | tr -d '\r\n')
[[ "$ORIGINAL_FONT_SCALE" =~ ^(null|[0-9]+([.][0-9]+)?)$ ]] || { echo 'Unexpected original font_scale'; exit 1; }
printf '%s\n' "$ORIGINAL_FONT_SCALE" > "$OUT/font-scale-original.txt"

APK=$(node -p "require('./runtime-evidence/expo-go-download.json').path")
adb install "$APK"
adb shell dumpsys package host.exp.exponent | grep -E 'versionName=|versionCode=' | tee "$OUT/expo-go-installed.txt"
APP_VARIANT=development NODE_ENV=development pnpm --dir apps/mobile exec expo config --type public --json > "$OUT/expo-config.json"
APP_VARIANT=production NODE_ENV=production pnpm --dir apps/mobile exec expo config --type public --json > "$OUT/expo-production-config.json"
node -e "const c=require('./runtime-evidence/expo-config.json'); if(c.android?.package || c.ios?.bundleIdentifier) throw new Error('The proof must not assign a native app identity'); if(c.scheme !== 'future-gym-dev') throw new Error('Development scheme is missing'); const p=require('./runtime-evidence/expo-production-config.json'); if(p.scheme || p.android?.package || p.ios?.bundleIdentifier) throw new Error('Production identity is still deferred'); console.log('SDK',c.sdkVersion,'development scheme configured; production identity remains unset');"
EXPO_UNSTABLE_HEADLESS=1 NODE_OPTIONS=--dns-result-order=ipv4first pnpm --dir apps/mobile dev --localhost --port 8081 > "$OUT/metro.log" 2>&1 &
METRO_PID=$!
export METRO_PID
timeout 180 bash -c 'until curl --max-time 5 --fail --silent http://127.0.0.1:8081/status | grep -q packager-status:running; do kill -0 "$METRO_PID" || exit 1; sleep 2; done'
adb reverse tcp:8081 tcp:8081
adb logcat -b all -c

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

# Compile our read-only observer against the official Android runtime tool.
# Stock uiautomator dump waits for 1s idle; the active timer updates every second.
D8=$(find "$ANDROID_HOME/build-tools" -type f -name d8 | sort -V | tail -1)
test -x "$D8"
mkdir -p "$RUNNER_TEMP/gym-dump/classes" "$RUNNER_TEMP/gym-dump/dex"
javac --release 8 -d "$RUNNER_TEMP/gym-dump/classes" .ci/qa/GymDump.java
"$D8" --output "$RUNNER_TEMP/gym-dump/dex" "$RUNNER_TEMP/gym-dump/classes/GymDump.class"
(cd "$RUNNER_TEMP/gym-dump/dex" && zip -q ../gym-dump.jar classes.dex)
adb push "$RUNNER_TEMP/gym-dump/gym-dump.jar" /data/local/tmp/gym-dump.jar
start_log_collection
start_host_audio_monitor
launch
wait_shell
python3 .ci/qa/native-client-ui.py "$OUT"
stop_host_audio_monitor
verify_host_audio after
finish_log_collection
# The UI result is provisional until unfiltered native + Metro logs pass as well.
python3 .ci/qa/native-client-ui.py --check-logs "$OUT"
echo 'Native client runtime proof passed: 20 phone/wide counterpart captures; inline edits, validation/cancel, 1.3x font/restore, bounded footer/sheet, tenant histories, discard/restart, resume/cold reopen and real Android playback-service checks. Host playback uses a private null sink with guest input disabled: audible output was not verified. No app applicationId assigned.'
