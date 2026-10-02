"""Shell lifecycle contracts; fake host commands do not establish Android proof."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("expo-go-runtime.sh").read_text()
FUNCTIONS = SCRIPT.split("# HOST_AUDIO_FUNCTIONS_BEGIN\n", 1)[1].split("# HOST_AUDIO_FUNCTIONS_END", 1)[0]
FAKE = r'''#!/usr/bin/env python3
import json, os, signal, stat, sys, time
from pathlib import Path
root = Path(os.environ["HOST_FIXTURE"])
name, args = Path(sys.argv[0]).name, sys.argv[1:]
mode = os.environ["HOST_FIXTURE_MODE"]
if name == "emulator":
    print("Android emulator 37.2.12 fixture" if args == ["-version"] else "-audio <backend> selects backend")
elif name == "Xvfb":
    assert args == ["-displayfd", "3", "-screen", "0", "1920x1080x24", "-nolisten", "tcp", "-auth", os.environ["XAUTHORITY"]]
    authority = Path(os.environ["XAUTHORITY"])
    assert stat.S_IMODE(authority.stat().st_mode) == 0o600
    assert stat.S_IMODE(authority.parent.stat().st_mode) == 0o700
    (root / "display-dir").write_text(str(authority.parent))
    (root / "display-pid").write_text(str(os.getpid()))
    if mode == "display-death": raise SystemExit(5)
    os.write(3, b"17\n")
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    while True: time.sleep(0.01)
elif name == "xdpyinfo":
    assert args == ["-display", ":17"] and os.environ["DISPLAY"] == ":17"
    if Path(os.environ["XAUTHORITY"]).name == "unauthorized":
        raise SystemExit(0 if mode == "display-open" else 1)
    print("name of display: :17")
elif name == "pulseaudio":
    assert "-n" in args and "--daemonize=no" in args and "--disallow-module-loading" in args
    cookie = Path(os.environ["PULSE_COOKIE"])
    assert len(cookie.read_bytes()) == 256 and stat.S_IMODE(cookie.stat().st_mode) == 0o600
    assert cookie.parent == Path(os.environ["PULSE_RUNTIME_PATH"]).parent
    assert os.environ["QEMU_PA_SERVER"] == os.environ["PULSE_SERVER"]
    assert os.environ["QEMU_PA_SINK"] == os.environ["PULSE_SINK"] == "gym_null"
    (root / "pulse-dir").write_text(str(cookie.parent))
    (root / "pulse-pid").write_text(str(os.getpid()))
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    while True: time.sleep(0.01)
elif name == "pactl":
    if args == ["info"]:
        if not (root / "pulse-pid").exists(): raise SystemExit(1)
        print("Server Name: pulseaudio")
        raise SystemExit(0)
    assert args[:3] == ["--format=json", "list", args[2]]
    playing = (root / "play").exists()
    values = {
        "modules": [{"name": "module-null-sink"}, {"name": "module-native-protocol-unix"}],
        "sinks": [{"index": 0, "name": "gym_null"}],
        "sources": [{"index": 0, "name": "gym_null.monitor"}],
        "clients": [{"index": 77, "properties": {"application.process.binary": "qemu-system-x86_64"}}],
        "sink-inputs": ([{"index": 9, "client": 77, "sink": 1 if mode == "wrong-route" else 0}]
                        if playing and mode != "no-playback" else []),
        "source-outputs": [{"index": 4}] if playing and mode == "recording" else [],
    }
    print(json.dumps(values[args[2]]))
else: raise SystemExit("Unexpected command: " + name)
'''


class HostAudioContract(unittest.TestCase):
    def execute(self, mode):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            (directory / "functions.sh").write_text(FUNCTIONS)
            for name in ["emulator", "pulseaudio", "pactl"]:
                command = directory / name
                command.write_text(FAKE)
                command.chmod(0o755)
            out = directory / "evidence"
            out.mkdir()
            environment = {**os.environ, "PATH": str(directory) + os.pathsep + os.environ["PATH"],
                           "HOST_FIXTURE": folder, "HOST_FIXTURE_MODE": mode, "RUNNER_TEMP": folder}
            run = subprocess.run(["bash", "-c", '''
set -euo pipefail
OUT="$1/evidence"
source "$1/functions.sh"
trap 'rc=$?; if test -n "${HOST_AUDIO_STARTED:-}"; then stop_host_audio || rc=1; fi; exit "$rc"' EXIT
start_host_audio
verify_host_audio before
start_host_audio_monitor
touch "$1/play"
sleep 0.8
stop_host_audio_monitor
verify_host_audio after
''', "host-audio-contract", folder], env=environment, capture_output=True, text=True, timeout=20)
            record = json.loads((out / "host-audio.json").read_text())
            monitor = json.loads((out / "host-audio-monitor.json").read_text())
            cleanup = json.loads((out / "host-audio-cleanup.json").read_text())
            self.assertTrue(cleanup["stopped"], run.stderr)
            self.assertIn(cleanup["exitCode"], [0, 143])
            self.assertFalse(Path((directory / "pulse-dir").read_text()).exists())
            with self.assertRaises(ProcessLookupError):
                os.kill(int((directory / "pulse-pid").read_text()), 0)
            return run, record, monitor

    def test_lazy_backend_connects_before_stream_and_playback_is_required_later(self):
        run, record, monitor = self.execute("valid")
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(record["before"]["playbackStreams"], [])
        self.assertEqual(record["after"]["playbackStreams"], [9])
        self.assertTrue(monitor["observedEmulatorPlayback"])
        self.assertEqual(monitor["status"], "complete")
        self.assertFalse(record["physicalInput"])
        self.assertFalse(record["audibleOutputVerified"])

    def test_configuration_without_observed_playback_cannot_pass(self):
        run, record, monitor = self.execute("no-playback")
        self.assertNotEqual(run.returncode, 0)
        self.assertFalse(monitor["observedEmulatorPlayback"])
        self.assertNotIn("after", record)

    def test_failed_monitor_still_cleans_private_server_and_files(self):
        for mode in ["recording", "wrong-route"]:
            with self.subTest(mode=mode):
                run, record, monitor = self.execute(mode)
                self.assertNotEqual(run.returncode, 0)
                self.assertEqual(monitor["status"], "failed")
                self.assertTrue(monitor["errors"])
                self.assertNotIn("after", record)

    def test_private_display_readiness_authorization_and_failure_cleanup(self):
        for mode in ["valid", "display-open", "display-death"]:
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as folder:
                directory = Path(folder)
                (directory / "functions.sh").write_text(FUNCTIONS)
                for name in ["Xvfb", "xdpyinfo"]:
                    command = directory / name
                    command.write_text(FAKE)
                    command.chmod(0o755)
                out = directory / "evidence"
                out.mkdir()
                environment = {**os.environ, "PATH": folder + os.pathsep + os.environ["PATH"],
                               "HOST_FIXTURE": folder, "HOST_FIXTURE_MODE": mode, "RUNNER_TEMP": folder}
                run = subprocess.run(["bash", "-c", '''
set -euo pipefail
OUT="$1/evidence"
source "$1/functions.sh"
trap 'rc=$?; if test -n "${HOST_DISPLAY_STARTED:-}"; then stop_host_display || rc=1; fi; exit "$rc"' EXIT
start_host_display
''', "host-display-contract", folder], env=environment, capture_output=True, text=True, timeout=20)
                self.assertEqual(run.returncode == 0, mode == "valid", run.stderr)
                cleanup = json.loads((out / "host-display-cleanup.json").read_text())
                self.assertTrue(cleanup["stopped"])
                self.assertFalse(Path((directory / "display-dir").read_text()).exists())
                with self.assertRaises(ProcessLookupError):
                    os.kill(int((directory / "display-pid").read_text()), 0)
                if mode == "valid":
                    record = json.loads((out / "host-display.json").read_text())
                    self.assertEqual(record["display"], ":17")
                    self.assertEqual(record["authentication"], "MIT-MAGIC-COOKIE-1")
                    self.assertFalse(record["tcpListening"])
                else:
                    self.assertFalse((out / "host-display.json").exists())


if __name__ == "__main__":
    unittest.main()
