"""Harness contract tests only. These are not native execution/audio evidence."""
import importlib.util
import json
from pathlib import Path
import tempfile
from contextlib import ExitStack
from unittest.mock import patch
import unittest
import xml.etree.ElementTree as ET

SPEC = importlib.util.spec_from_file_location("audit", Path(__file__).with_name("native-client-ui.py"))
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)
MONITOR = "PlaybackActivityMonitor dump time: 21:00:00\n"
APP = "10-01 21:00:00.000 1234 2345 I ReactNativeJS: Running main\n"


class NativeAuditContract(unittest.TestCase):
    def test_every_reference_has_two_counterparts(self):
        self.assertEqual(len(audit.COUNTERPARTS), 10)
        self.assertEqual(audit.VIEWPORTS, [(390, 844), (1280, 800)])
        self.assertEqual(len(set(audit.COUNTERPARTS)), 10)

    def test_warning_and_audio_overlays_rejected(self):
        for marker in audit.ERRORS:
            with self.subTest(marker=marker), self.assertRaises(RuntimeError):
                audit.reject_visible_errors([ET.Element("node", {"bounds": "[0,0][300,80]", "text": marker})])

    def test_offscreen_nodes_not_visible_evidence(self):
        for bound in ["[0,844][390,900]", "[0,0][0,90]", "[0,10][390,8]", "[400,0][500,90]"]:
            self.assertFalse(audit.visible(ET.Element("node", {"bounds": bound})))

    def test_horizontal_bounds_reject_escape_at_both_widths(self):
        original = audit.viewport
        try:
            for width, height in audit.VIEWPORTS:
                audit.viewport = (width, height)
                for bounds in [f"[-2,20][100,50]", f"[20,20][{width + 1},50]", f"[{width + 2},20][{width + 20},50]"]:
                    with self.subTest(width=width, bounds=bounds), self.assertRaisesRegex(RuntimeError, "Horizontal overflow"):
                        audit.assert_horizontal_bounds([ET.Element("node", {"package": audit.PACKAGE, "text": "Control", "bounds": bounds})], "test")
                audit.assert_horizontal_bounds([ET.Element("node", {"package": audit.PACKAGE, "text": "Control", "bounds": f"[0,20][{width},50]"})], "test")
        finally:
            audit.viewport = original

    def test_horizontal_bounds_do_not_reject_vertical_scroll(self):
        audit.assert_horizontal_bounds([
            ET.Element("node", {"package": audit.PACKAGE, "bounds": "[0,0][390,844]"}),
            ET.Element("node", {"package": audit.PACKAGE, "text": "Below viewport", "bounds": "[-20,900][450,950]"}),
        ], "scroll")

    def test_host_tools_drag_uses_measured_container_and_checks_fresh_bounds(self):
        for move in [False, True]:
            with self.subTest(move=move), tempfile.TemporaryDirectory() as folder, ExitStack() as stack:
                directory = Path(folder)
                tree = ET.fromstring('<hierarchy><node bounds="[0,0][390,844]"><node resource-id="toggle-sound" bounds="[334,65][374,105]"/><node bounds="[322,65][374,117]"><node content-desc="Tools" bounds="[335,78][361,104]"/></node></node></hierarchy>')
                host = list(tree[0])[1]
                def observe():
                    ET.ElementTree(tree).write(directory / "current-client.xml")
                    return list(tree.iter("node"))
                def drag(*args):
                    self.assertEqual(args, ("shell", "input", "swipe", "348", "91", "348", "422", "900"))
                    if move:
                        host.set("bounds", "[322,396][374,448]")
                        host[0].set("bounds", "[335,409][361,435]")
                    return b""
                stack.enter_context(patch.object(audit, "out", directory))
                stack.enter_context(patch.object(audit, "viewport", (390, 844)))
                stack.enter_context(patch.object(audit, "host_checks", []))
                stack.enter_context(patch.object(audit, "observe", side_effect=observe))
                stack.enter_context(patch.object(audit, "adb", side_effect=drag))
                stack.enter_context(patch.object(audit, "shot"))
                stack.enter_context(patch.object(audit.time, "sleep"))
                if move:
                    self.assertEqual(audit.ensure_control_reachable().get("resource-id"), "toggle-sound")
                    self.assertEqual(audit.host_checks[0]["after"], (322, 396, 374, 448))
                else:
                    with self.assertRaisesRegex(RuntimeError, "still overlaps"):
                        audit.ensure_control_reachable()

    def test_font_scale_restores_exact_value_and_absent_setting(self):
        for original in ["1.0", "null"]:
            for fail_capture in [False, True]:
                with self.subTest(original=original, fail_capture=fail_capture), tempfile.TemporaryDirectory() as folder, ExitStack() as stack:
                    state = {"font": original, "mutations": [], "running": True, "launches": [], "workouts": []}
                    def fake_adb(*args):
                        if args == ("exec-out", "screencap", "-p"):
                            self.assertTrue(state["running"], "Capture must precede cleanup")
                            self.assertEqual(state["font"], "1.3")
                            return b"native-failure-image"
                        if args == ("get-serialno",):
                            return b"emulator-5554\n"
                        if args[:2] == ("shell", "getprop"):
                            return b"1\n"
                        if args[:3] == ("shell", "settings", "get"):
                            return (state["font"] + "\n").encode()
                        if args[:3] == ("shell", "settings", "put"):
                            self.assertFalse(state["running"], "Font must change while Expo is stopped")
                            state["font"] = args[-1]
                            state["mutations"].append(args)
                            return b""
                        if args[:3] == ("shell", "settings", "delete"):
                            self.assertFalse(state["running"], "Font must restore while Expo is stopped")
                            state["font"] = "null"
                            state["mutations"].append(args)
                            return b""
                        raise AssertionError(args)
                    def stop_app():
                        state["running"] = False
                    def cold_reopen():
                        state["running"] = True
                        state["launches"].append(state["font"])
                    def start_workout(identity):
                        self.assertTrue(state["running"])
                        self.assertEqual(identity, "gym-a")
                        state["workouts"].append(state["font"])
                    stack.enter_context(patch.object(audit, "stop_app", side_effect=stop_app))
                    stack.enter_context(patch.object(audit, "cold_reopen", side_effect=cold_reopen))
                    stack.enter_context(patch.object(audit, "start_workout", side_effect=start_workout))
                    stack.enter_context(patch.object(audit, "adb", side_effect=fake_adb))
                    stack.enter_context(patch.object(audit, "out", Path(folder)))
                    stack.enter_context(patch.object(audit, "font_checks", []))
                    stack.enter_context(patch.object(audit, "viewport", (390, 844)))
                    stack.enter_context(patch.object(audit.time, "sleep"))
                    for name in ["top", "assert_text", "assert_footer", "assert_horizontal_bounds", "assert_set", "assert_inline_row_reachable", "tap", "hide_keyboard", "observe"]:
                        stack.enter_context(patch.object(audit, name))
                    stack.enter_context(patch.object(audit, "find", return_value=ET.Element("node", {"focused": "true"})))
                    stack.enter_context(patch.object(audit, "shot", side_effect=RuntimeError("capture failed") if fail_capture else None))
                    if fail_capture:
                        with self.assertRaisesRegex(RuntimeError, "capture failed"):
                            audit.large_font_ready_audit()
                    else:
                        audit.large_font_ready_audit()
                    self.assertEqual(state["launches"], ["1.3"] if fail_capture else ["1.3", original])
                    self.assertEqual(state["workouts"], state["launches"])
                    self.assertEqual(state["font"], original)
                    self.assertEqual(state["mutations"][0], ("shell", "settings", "put", "system", "font_scale", "1.3"))
                    self.assertEqual(state["mutations"][-1][2], "delete" if original == "null" else "put")
                    record = json.loads((Path(folder) / "font-scale-result.json").read_text())[0]
                    self.assertTrue(record["restored"])
                    self.assertEqual(record["restoredValue"], original)
                    self.assertEqual(record["status"], "failed" if fail_capture else "passed")

    def test_font_scale_refuses_non_emulator_before_setting(self):
        with patch.object(audit, "adb", side_effect=lambda *args: b"physical-device" if args == ("get-serialno",) else b"0") as adb:
            with self.assertRaisesRegex(RuntimeError, "only on the disposable"):
                audit.large_font_ready_audit()
            self.assertFalse(any(call.args[:2] == ("shell", "settings") for call in adb.call_args_list))

    def test_font_restore_mismatch_is_failure(self):
        with patch.object(audit, "adb", return_value=b""), patch.object(audit, "read_font_scale", return_value="1.3"):
            with self.assertRaisesRegex(RuntimeError, "restore failed"):
                audit.restore_font_scale("1.0")

    def test_event_requires_uid_attribution(self):
        owned = MONITOR + "10-01 21:00:00 new player piid:9 uid/pid:10081/1234 type:android.media.AudioTrack\n10-01 21:00:00 player piid:9 event:started\n"
        self.assertEqual(len(audit.playback_started_lines(owned, 10081)), 1)
        self.assertEqual(audit.playback_started_lines(owned, 10082), set())
        self.assertEqual(audit.playback_started_lines(MONITOR + "player piid:9 event:started\n", 10081), set())

    def test_active_state_is_native_evidence(self):
        data = MONITOR + "Player piid:11 deviceId:2 type:android.media.AudioTrack u/pid:10081/1234 state:started attr:USAGE_MEDIA\n"
        self.assertEqual(len(audit.playback_started_lines(data, 10081)), 1)
        self.assertEqual(audit.playback_started_lines(data.replace("state:started", "state:paused"), 10081), set())

    def test_active_playback_excludes_history_and_other_apps(self):
        history = MONITOR + "new player piid:9 uid/pid:10081/1234\nplayer piid:9 event:started\n"
        self.assertEqual(audit.active_owned_playback(history, 10081), set())
        current = history + "Player piid:10 u/pid:10081/1234 state:started\n"
        self.assertEqual(len(audit.active_owned_playback(current, 10081)), 1)
        self.assertEqual(audit.active_owned_playback(current, 10082), set())
        self.assertEqual(audit.active_owned_playback(current.replace("state:started", "state:paused"), 10081), set())

    def test_stale_events_do_not_count_as_new_playback(self):
        data = MONITOR + "new player piid:9 uid/pid:10081/1234\n21:00:00 player piid:9 event:started\n"
        before = audit.playback_started_lines(data, 10081)
        self.assertEqual(audit.playback_started_lines(data, 10081) - before, set())
        next_data = data + "new player piid:12 uid/pid:10081/1234\n21:00:01 player piid:12 event:started\n"
        self.assertEqual(len(audit.playback_started_lines(next_data, 10081) - before), 1)

    def test_audio_service_unavailable_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "not available"):
            audit.playback_started_lines("Permission Denial", 10081)

    def test_linking_and_runtime_errors_rejected_in_logs(self):
        for line in ["Linking requires a build-time setting", "Linking found multiple possible URI schemes", "The provided Linking scheme", "FATAL EXCEPTION", "ReactNativeJS TypeError", "ReactNativeJS Error: fail", "10-01 21:00:00.001 1234 2345 W ReactNativeJS: warned", "Workout audio cleanup failed"]:
            with self.subTest(line=line), self.assertRaises(RuntimeError):
                audit.reject_log_errors(APP + line, "Bundled successfully")

    def test_native_audio_failure_and_warning_for_app_pid_rejected(self):
        for severity in ["W", "E"]:
            for tag in ["AudioTrack", "ExoPlayerImplInternal", "ExpoAudio", "AudioPlayer"]:
                with self.subTest(severity=severity, tag=tag), self.assertRaises(RuntimeError):
                    audit.reject_log_errors(APP + f"10-01 21:00:00.001 1234 2345 {severity} {tag}: failed playback", "Bundled")

    def test_unrelated_system_audio_log_is_not_attributed_to_app(self):
        audit.reject_log_errors(APP + "10-01 21:00:00.001 9876 2345 E AudioTrack: unrelated system app", "Bundled")

    def test_metro_warning_is_not_suppressed(self):
        for marker in ["WARN audio", "ERROR bundle", "Warning: audio", "Error: player failed"]:
            with self.subTest(marker=marker), self.assertRaises(RuntimeError):
                audit.reject_log_errors(APP, marker)

    def test_ui_result_cannot_pass_without_log_gate(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            (directory / "result.json").write_text(json.dumps({"status": "ui-passed-awaiting-log-gate"}))
            (directory / "metro.log").write_text("Bundled")
            (directory / "logcat.txt").write_text(APP + "FATAL EXCEPTION")
            with self.assertRaises(RuntimeError):
                audit.finalize_log_gate(directory)
            self.assertEqual(json.loads((directory / "result.json").read_text())["status"], "failed-log-gate")
            (directory / "result.json").write_text(json.dumps({"status": "ui-passed-awaiting-log-gate"}))
            (directory / "logcat.txt").write_text(APP)
            audit.finalize_log_gate(directory)
            self.assertEqual(json.loads((directory / "result.json").read_text())["status"], "passed")


if __name__ == "__main__":
    unittest.main()
