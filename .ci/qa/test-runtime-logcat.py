"""Real shell collector contracts with a disposable fake adb, not Android proof."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("expo-go-runtime.sh").read_text()
FUNCTIONS = SCRIPT.split("# LOG_COLLECTION_FUNCTIONS_BEGIN\n", 1)[1].split("# LOG_COLLECTION_FUNCTIONS_END", 1)[0]
FAKE_ADB = r'''#!/usr/bin/env python3
import os, sys, time
from pathlib import Path
args = sys.argv[1:]
root = Path(os.environ["FAKE_ADB_ROOT"])
mode = os.environ.get("FAKE_ADB_MODE", "complete")
if args == ["logcat", "-b", "all", "-v", "threadtime", "*:V"]:
    (root / "collector.pid").write_text(str(os.getpid()))
    if mode == "early-exit":
        raise SystemExit(7)
    if mode == "stderr":
        print("fixture collector warning", file=sys.stderr, flush=True)
    position = 0
    while True:
        queue = root / "markers"
        lines = queue.read_text().splitlines() if queue.exists() else []
        for line in lines[position:]:
            if mode == "missing-end" and "GYM_AUDIT_END_" in line:
                raise SystemExit(0)
            print("10-03 12:00:00.000 123 123 I GYM_AUDIT: " + line, flush=True)
            if "GYM_AUDIT_BEGIN_" in line:
                print("10-03 12:00:00.001 123 123 E ReactNativeJS: fixture error remains unfiltered", flush=True)
                print("x" * 65536, flush=True)
        position = len(lines)
        time.sleep(0.01)
elif args[:6] == ["shell", "log", "-p", "i", "-t", "GYM_AUDIT"]:
    with (root / "markers").open("a") as stream:
        stream.write(args[6] + "\n")
elif args == ["logcat", "-b", "all", "-d", "-v", "threadtime", "*:V"]:
    print("old truncated cleanup diagnostic")
    raise SystemExit(124)
else:
    raise SystemExit("Unexpected adb command: " + repr(args))
'''


class NativeLogCollectorContract(unittest.TestCase):
    def execute(self, directory, mode):
        folder = Path(directory)
        (folder / "adb").write_text(FAKE_ADB)
        (folder / "adb").chmod(0o755)
        (folder / "functions.sh").write_text(FUNCTIONS)
        out = folder / "evidence"
        out.mkdir()
        (out / "result.json").write_text(json.dumps({"status": "ui-passed-awaiting-log-gate"}))
        environment = {**os.environ, "PATH": str(folder) + os.pathsep + os.environ["PATH"],
                       "FAKE_ADB_ROOT": str(folder), "FAKE_ADB_MODE": mode}
        run = subprocess.run(["bash", "-c", '''
set -euo pipefail
OUT="$1/evidence"
source "$1/functions.sh"
start_log_collection || startup_failed=1
finish_log_collection
collect_cleanup_log_diagnostic
''', "log-contract", str(folder)], env=environment, capture_output=True, text=True, timeout=20)
        return out, run

    def test_complete_stream_has_full_interval_actual_pid_and_untouched_primary(self):
        with tempfile.TemporaryDirectory() as directory:
            out, run = self.execute(directory, "complete")
            self.assertEqual(run.returncode, 0, run.stderr)
            record = json.loads((out / "logcat-capture.json").read_text())
            primary = (out / "logcat.txt").read_bytes()
            self.assertEqual(record["status"], "complete")
            self.assertEqual(record["collectorPid"], int((Path(directory) / "collector.pid").read_text()))
            self.assertIn(record["collectorExitCode"], [0, 143])
            self.assertEqual(record["bytes"], len(primary))
            self.assertGreater(len(primary), 65536)
            self.assertEqual(record["sha256"], hashlib.sha256(primary).hexdigest())
            self.assertEqual(primary.count(record["beginMarker"].encode()), 1)
            self.assertEqual(primary.count(record["endMarker"].encode()), 1)
            self.assertLess(primary.index(record["beginMarker"].encode()), primary.index(record["endMarker"].encode()))
            self.assertIn(b"E ReactNativeJS: fixture error remains unfiltered", primary)
            self.assertNotIn(b"cleanup diagnostic", primary)
            self.assertFalse((out / "logcat.partial.txt").exists())
            diagnostic = json.loads((out / "logcat-cleanup-status.json").read_text())
            self.assertEqual(diagnostic["exitCode"], 124)
            self.assertFalse(diagnostic["complete"])
            self.assertTrue(diagnostic["primaryLogUntouched"])
            # Complete collection alone is never a passed runtime log gate.
            self.assertEqual(json.loads((out / "result.json").read_text())["status"], "ui-passed-awaiting-log-gate")

    def test_partial_early_exit_and_stderr_cannot_become_primary_evidence(self):
        for mode in ["missing-end", "early-exit", "stderr"]:
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                out, run = self.execute(directory, mode)
                self.assertNotEqual(run.returncode, 0)
                self.assertFalse((out / "logcat.txt").exists())
                self.assertTrue((out / "logcat.partial.txt").exists())
                record = json.loads((out / "logcat-capture.json").read_text())
                self.assertEqual(record["status"], "failed")
                self.assertTrue(record["errors"])
                self.assertEqual(json.loads((out / "result.json").read_text())["status"], "failed-log-collection")

    def test_existing_primary_cannot_be_truncated_by_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder / "functions.sh").write_text(FUNCTIONS)
            primary = folder / "logcat.txt"
            primary.write_bytes(b"previous verified proof")
            run = subprocess.run(["bash", "-c", 'set -euo pipefail; OUT="$1"; source "$1/functions.sh"; start_log_collection',
                                  "log-contract", str(folder)], capture_output=True, text=True, timeout=5)
            self.assertNotEqual(run.returncode, 0)
            self.assertEqual(primary.read_bytes(), b"previous verified proof")
            self.assertFalse((folder / "logcat.partial.txt").exists())


if __name__ == "__main__":
    unittest.main()
