"""Exercise actual cleanup ordering with a real disposable child process."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("expo-go-runtime.sh").read_text()
FUNCTIONS = SCRIPT.split("# EMULATOR_CLEANUP_FUNCTIONS_BEGIN\n", 1)[1].split("# EMULATOR_CLEANUP_FUNCTIONS_END", 1)[0]
CLEANUP = "cleanup() {\n" + SCRIPT.split("\ncleanup() {\n", 1)[1].split("\ntrap cleanup EXIT", 1)[0]
CHILD = r'''import os, signal, sys, time
from pathlib import Path
mode = os.environ["CLEANUP_MODE"]
def acknowledge_then_exit(*_):
    time.sleep(0.05)
    sys.exit(0)
signal.signal(signal.SIGUSR1, acknowledge_then_exit if mode == "graceful" else signal.SIG_IGN)
if mode == "force-kill": signal.signal(signal.SIGTERM, signal.SIG_IGN)
Path(os.environ["CLEANUP_ROOT"], "child-ready").touch()
while True: time.sleep(0.01)
'''
ADB = r'''#!/usr/bin/env python3
import os, signal, sys
if sys.argv[1:] == ["emu", "kill"]:
    os.kill(int(os.environ["EMULATOR_PID"]), signal.SIGUSR1)
    print("OK: acknowledgement only")
    raise SystemExit(0)
print("Diagnostic unavailable", file=sys.stderr)
raise SystemExit(7)
'''


class EmulatorCleanupContract(unittest.TestCase):
    def execute(self, mode):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            out = directory / "evidence"
            out.mkdir()
            (out / "result.json").write_text('{"status":"passed"}')
            (directory / "functions.sh").write_text(FUNCTIONS + CLEANUP)
            (directory / "child.py").write_text(CHILD)
            adb = directory / "adb"
            adb.write_text(ADB)
            adb.chmod(0o755)
            environment = {**os.environ, "PATH": folder + os.pathsep + os.environ["PATH"],
                           "CLEANUP_ROOT": folder, "CLEANUP_MODE": mode}
            run = subprocess.run(["bash", "-c", '''
set -euo pipefail
OUT="$1/evidence"
source "$1/functions.sh"
# Only accelerate the bounded polling; the child and signals are real.
sleep() { command sleep 0.001; }
stop_host_audio_monitor() { return 0; }
stop_host_audio() {
  if kill -0 "$EMULATOR_PID" 2>/dev/null; then echo 'Audio stopped before emulator'; return 1; fi
  test -f "$OUT/emulator-cleanup.json"
  echo audio >> "$OUT/host-stop-order.txt"
}
stop_host_display() {
  if kill -0 "$EMULATOR_PID" 2>/dev/null; then echo 'Display stopped before emulator'; return 1; fi
  test -f "$OUT/emulator-cleanup.json"
  echo display >> "$OUT/host-stop-order.txt"
}
python3 "$1/child.py" &
EMULATOR_PID=$!
export EMULATOR_PID
while ! test -f "$1/child-ready"; do sleep 0.01; done
HOST_AUDIO_STARTED=1
HOST_DISPLAY_STARTED=1
trap cleanup EXIT
''', "emulator-cleanup-contract", folder], env=environment, capture_output=True, text=True, timeout=15)
            record = json.loads((out / "emulator-cleanup.json").read_text())
            result = json.loads((out / "result.json").read_text())
            self.assertEqual((out / "host-stop-order.txt").read_text().splitlines(), ["audio", "display"], run.stderr)
            with self.assertRaises(ProcessLookupError):
                os.kill(record["pid"], 0)
            return run, record, result

    def test_acknowledged_shutdown_waits_for_actual_child_before_dependencies(self):
        run, record, result = self.execute("graceful")
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertTrue(record["graceful"])
        self.assertTrue(record["reaped"])
        self.assertEqual(record["exitCode"], 0)
        self.assertEqual(record["forcedSignal"], "none")
        self.assertEqual(result["status"], "passed")

    def test_actual_term_and_kill_fallbacks_fail_but_still_teardown_dependencies(self):
        for mode, expected_signal, expected_exit in [("force-term", "TERM", 143), ("force-kill", "KILL", 137)]:
            with self.subTest(mode=mode):
                run, record, result = self.execute(mode)
                self.assertNotEqual(run.returncode, 0)
                self.assertFalse(record["graceful"])
                self.assertTrue(record["reaped"])
                self.assertEqual(record["forcedSignal"], expected_signal)
                self.assertEqual(record["exitCode"], expected_exit)
                self.assertEqual(result["status"], "failed-emulator-cleanup")

    def test_unavailable_read_only_diagnostics_retain_actual_status(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            (directory / "functions.sh").write_text(FUNCTIONS)
            adb = directory / "adb"
            adb.write_text(ADB)
            adb.chmod(0o755)
            environment = {**os.environ, "PATH": folder + os.pathsep + os.environ["PATH"]}
            run = subprocess.run(["bash", "-c", 'set -euo pipefail; OUT="$1"; source "$1/functions.sh"; collect_audio_device_diagnostics',
                                  "audio-diagnostic-contract", folder], env=environment, capture_output=True, text=True, timeout=10)
            self.assertEqual(run.returncode, 0, run.stderr)
            record = json.loads((directory / "audio-device-diagnostics.json").read_text())
            self.assertEqual(record["purpose"], "diagnostic-only")
            self.assertEqual(len(record["commands"]), 5)
            for command in record["commands"]:
                self.assertEqual(command["exitCode"], 7)
                self.assertEqual(command["status"], "unavailable")
                self.assertIn("Diagnostic unavailable", (directory / f"audio-device-{command['name']}-stderr.txt").read_text())


if __name__ == "__main__":
    unittest.main()
