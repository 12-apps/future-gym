"""Real Android accessibility/ADB audit. No injected app state or mocked playback.

Paired native captures correspond to capture-reference.cjs at 390x844/1280x800.
The audio proof is Android playback-service activity, never audible host output.
"""
import json
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
import xml.etree.ElementTree as ET

ERRORS = [
    "Something went wrong", "Render Error", "Uncaught Error", "Invariant Violation",
    "TypeError", "ReferenceError", "Unable to resolve", "Project is incompatible",
    "Linking requires a build-time setting", "Linking found multiple possible URI schemes",
    "The provided Linking scheme", "Som indisponível", "Sound is unavailable",
]
COUNTERPARTS = ["01-home", "02-empty-history", "03-workout", "04-session-ready",
                "05-edited-set", "06-paused", "07-rest", "08-partial-finish",
                "09-summary", "10-history"]
VIEWPORTS = [(390, 844), (1280, 800)]
INVALID_SET = "Use carga de 0 a 1.000 kg e 1 a 100 repetições inteiras"
PACKAGE = "host.exp.exponent"
out = None
shots = []
paired = []
audio_checks = []
layout_checks = []
font_checks = []
viewport = (390, 844)


def adb(*args):
    return subprocess.check_output(["adb", *args], timeout=30)


def bounds(node):
    found = re.fullmatch(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]", node.attrib.get("bounds", ""))
    if not found:
        raise RuntimeError("Observed element has no valid bounds")
    return tuple(map(int, found.groups()))


def visible(node):
    left, top, right, bottom = bounds(node)
    return right > left and bottom > top and right > 0 and bottom > 0 and left < viewport[0] and top < viewport[1]


def matches(node, value, by_id=False):
    if by_id:
        identity = node.attrib.get("resource-id", "")
        return identity == value or identity.endswith(":id/" + value)
    return value in (node.attrib.get("text", ""), node.attrib.get("content-desc", ""))


def visible_text(nodes):
    return " ".join(n.attrib.get("text", "") + " " + n.attrib.get("content-desc", "") for n in nodes if visible(n))


def reject_visible_errors(nodes):
    text = visible_text(nodes)
    for marker in ERRORS:
        if marker in text:
            raise RuntimeError("Runtime error or warning visible: " + marker)


def observe():
    global viewport
    size = adb("shell", "wm", "size").decode()
    viewport = tuple(map(int, re.findall(r"(\d+)x(\d+)", size)[-1]))
    # Delete both copies: a successful command must never reuse an earlier tree.
    target = out / "current-client.xml"
    target.unlink(missing_ok=True)
    adb("shell", "rm", "-f", "/sdcard/client.xml")
    adb("shell", "CLASSPATH=/data/local/tmp/gym-dump.jar:/system/framework/uiautomator.jar",
        "app_process", "/system/bin", "GymDump", "/sdcard/client.xml", *map(str, viewport))
    adb("pull", "/sdcard/client.xml", str(target))
    nodes = list(ET.parse(target).getroot().iter("node"))
    if not nodes:
        raise RuntimeError("Fresh native hierarchy is empty")
    reject_visible_errors(nodes)
    return nodes


def viewport_scroll(nodes, direction):
    choices = [n for n in nodes if n.attrib.get("scrollable") == "true" and visible(n)]
    if not choices:
        raise RuntimeError("No observed scrollable viewport")
    # The body scroll view, rather than a footer or keyboard, owns scrolling.
    node = max(choices, key=lambda n: (bounds(n)[2] - bounds(n)[0]) * (bounds(n)[3] - bounds(n)[1]))
    left, top, right, bottom = bounds(node)
    x = (left + right) // 2
    near_top, near_bottom = top + (bottom - top) // 5, bottom - (bottom - top) // 5
    start, end = (near_bottom, near_top) if direction == "down" else (near_top, near_bottom)
    adb("shell", "input", "swipe", str(x), str(start), str(x), str(end), "300")
    time.sleep(0.15)


def find(value, by_id=False, scroll=False):
    for attempt in range(16):
        nodes = observe()
        candidates = [n for n in nodes if matches(n, value, by_id) and visible(n)
                      and (n.attrib.get("clickable") != "true" or bounds(n)[3] - bounds(n)[1] >= 20)]
        if candidates:
            return candidates[0]
        if scroll:
            viewport_scroll(nodes, "down" if attempt < 8 else "up")
        else:
            time.sleep(0.35)
    raise RuntimeError("Expected control not visible: " + value)


def tap_node(node):
    if node.attrib.get("enabled") == "false":
        raise RuntimeError("Refusing to tap disabled control: " + node.attrib.get("resource-id", ""))
    left, top, right, bottom = bounds(node)
    adb("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))
    time.sleep(0.3)


def tap(value, by_id=False, scroll=False):
    tap_node(find(value, by_id, scroll))


def assert_text(value, nodes=None):
    if value not in visible_text(observe() if nodes is None else nodes):
        raise RuntimeError("Expected text not visible: " + value)


def assert_absent(value, nodes=None):
    if value in visible_text(observe() if nodes is None else nodes):
        raise RuntimeError("Unexpected text visible: " + value)


def assert_input(identity, value):
    node = find(identity, True, True)
    if node.attrib.get("class") != "android.widget.EditText":
        raise RuntimeError("Expected actual native text input: " + identity)
    if node.attrib.get("text") != value:
        raise RuntimeError(f"{identity}: expected {value!r}, got {node.attrib.get('text')!r}")


def assert_set(index, completed, kg=None, reps=None):
    if kg is not None:
        assert_input(f"inline-load-{index}", kg)
    if reps is not None:
        assert_input(f"inline-reps-{index}", reps)
    node = find(f"toggle-set-{index}", True, True)
    expected = f"Série {index + 1}: {'Concluída' if completed else 'Pendente'}"
    if node.attrib.get("content-desc") != expected:
        raise RuntimeError(f"Expected set state {expected!r}, got {node.attrib}")
    if node.attrib.get("checkable") == "true" and node.attrib.get("checked") != str(completed).lower():
        raise RuntimeError("Native checkbox state disagrees with its accessible label")


def assert_enabled(identity, enabled):
    if find(identity, True).attrib.get("enabled") != str(enabled).lower():
        raise RuntimeError(f"{identity}: enabled must be {enabled}")


def shot(name):
    observe()
    (out / (name + ".xml")).write_bytes((out / "current-client.xml").read_bytes())
    data = adb("exec-out", "screencap", "-p")
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError("Native screenshot is not a PNG")
    # PNG IHDR stores real raster dimensions, not a requested viewport label.
    width, height = int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    if (width, height) != viewport:
        raise RuntimeError(f"Screenshot dimensions {(width, height)} != wm size {viewport}")
    (out / (name + ".png")).write_bytes(data)
    shots.append(name)
    print("Captured", name, flush=True)


def fill(identity, value, hide=True):
    node = find(identity, True, True)
    tap_node(node)
    adb("shell", "input", "keyevent", "KEYCODE_MOVE_END")
    adb("shell", "input", "keyevent", *(["KEYCODE_DEL"] * (len(node.attrib.get("text", "")) + 3)))
    if value:
        adb("shell", "input", "text", value)
    if hide:
        hide_keyboard()
    assert_input(identity, value)


def hide_keyboard():
    state = adb("shell", "dumpsys", "input_method").decode(errors="replace")
    flags = re.findall(r"\bmInputShown=(true|false)\b", state)
    if not flags:
        raise RuntimeError("Cannot determine whether native Back would hide the keyboard or navigate")
    if "true" in flags:
        adb("shell", "input", "keyevent", "KEYCODE_BACK")
        time.sleep(0.2)


def top(anchor):
    # Anchor was observed in this screen's code; only actual fresh UI bounds drive swipes.
    for _ in range(10):
        nodes = observe()
        if any(matches(n, anchor, True) and visible(n) and bounds(n)[3] - bounds(n)[1] >= 32 for n in nodes):
            return
        viewport_scroll(nodes, "up")
    raise RuntimeError("Screen header cannot be restored: " + anchor)


def assert_footer(screen, control):
    footer = find(screen + "-footer", True)
    action = find(control, True)
    fl, ft, fr, fb = bounds(footer)
    al, at, ar, ab = bounds(action)
    if not (0 <= fl < fr <= viewport[0] and viewport[1] - 80 <= fb <= viewport[1]):
        raise RuntimeError(f"Persistent footer is not at viewport bottom: {bounds(footer)} / {viewport}")
    if not (fl <= al < ar <= fr and ft <= at < ab <= fb):
        raise RuntimeError("Primary action is outside its persistent footer")
    layout_checks.append({"screen": screen, "viewport": viewport, "footer": bounds(footer), "control": bounds(action)})


def assert_sheet():
    dialog = find("finish-dialog", True)
    left, top_edge, right, bottom = bounds(dialog)
    if not (0 <= left < right <= viewport[0] and 0 < top_edge < bottom <= viewport[1] and bottom >= viewport[1] - 80):
        raise RuntimeError(f"Finish dialog is not a bounded bottom sheet: {bounds(dialog)} / {viewport}")
    for label in ["Descartar treino", "Continuar treinando"]:
        node = find(label)
        nl, nt, nr, nb = bounds(node)
        if not (left <= nl < nr <= right and top_edge <= nt < nb <= bottom):
            raise RuntimeError("Finish choice is clipped outside bottom sheet: " + label)


def assert_horizontal_bounds(nodes, label):
    """Reject horizontal escape the accessibility tree exposes; never infer hidden pixels."""
    checked = 0
    for node in nodes:
        if node.attrib.get("package", PACKAGE) != PACKAGE:
            continue
        left, top_edge, right, bottom = bounds(node)
        if bottom <= top_edge or bottom <= 0 or top_edge >= viewport[1]:
            continue  # Vertical scrolling is legitimate; only this viewport is under review.
        meaningful = bool(node.attrib.get("text") or node.attrib.get("content-desc") or node.attrib.get("clickable") == "true")
        if left < 0 or right > viewport[0] or (meaningful and (right <= left or right <= 0 or left >= viewport[0])):
            raise RuntimeError(f"Horizontal overflow exposed in {label}: {node.attrib.get('resource-id') or node.attrib.get('text')} {bounds(node)} / {viewport}")
        checked += 1
    if not checked:
        raise RuntimeError("No app accessibility bounds available for horizontal check: " + label)
    result = {"state": label, "viewport": viewport, "horizontalBoundsChecked": checked,
              "limit": "Exposed accessibility bounds only; clipped or paint-only content still needs screenshot review"}
    layout_checks.append(result)
    return result


def assert_inline_row_reachable(index):
    find(f"inline-load-{index}", True, True)
    nodes = observe()
    row = next((n for n in nodes if matches(n, f"set-row-{index}", True) and visible(n)), None)
    if row is None:
        raise RuntimeError("Inline set row is not visible")
    rl, rt, rr, rb = bounds(row)
    for prefix in ["toggle-set", "edit-set", "inline-reps", "decrease-load", "inline-load", "increase-load"]:
        identity = f"{prefix}-{index}"
        node = next((n for n in nodes if matches(n, identity, True) and visible(n)), None)
        if node is None:
            raise RuntimeError("Inline control is clipped or unreachable: " + identity)
        left, top_edge, right, bottom = bounds(node)
        if not (0 <= left < right <= viewport[0] and rl <= left < right <= rr and rt <= top_edge < bottom <= rb):
            raise RuntimeError("Inline control escapes the row/viewport: " + identity)
        if node.attrib.get("enabled") != "true" or right - left < 20 or bottom - top_edge < 20:
            raise RuntimeError("Inline control lacks a usable enabled native target: " + identity)
    assert_horizontal_bounds(nodes, "inline-row-" + str(index))


def read_font_scale():
    value = adb("shell", "settings", "get", "system", "font_scale").decode().strip()
    if value != "null" and (not re.fullmatch(r"\d+(?:\.\d+)?", value) or not 0 < float(value) <= 5):
        raise RuntimeError("Unexpected Android font_scale value: " + repr(value))
    return value


def restore_font_scale(original):
    if original == "null":
        adb("shell", "settings", "delete", "system", "font_scale")
    else:
        adb("shell", "settings", "put", "system", "font_scale", original)
    actual = read_font_scale()
    if actual != original:
        raise RuntimeError(f"font_scale restore failed: expected {original}, observed {actual}")
    return actual


def large_font_ready_audit():
    # Only the explicitly authorized disposable emulator receives this visual setting.
    serial = adb("get-serialno").decode().strip()
    is_emulator = any(adb("shell", "getprop", key).decode().strip() == "1" for key in ["ro.kernel.qemu", "ro.boot.qemu"])
    if not serial.startswith("emulator-") or not is_emulator:
        raise RuntimeError("Large-font setting is authorized only on the disposable Android emulator")
    if viewport != (390, 844):
        raise RuntimeError("Large-font state requires the phone viewport")
    original = read_font_scale()
    (out / "font-scale-driver-original.txt").write_text(original + "\n")
    record = {"original": original, "requested": "1.3", "viewport": viewport, "status": "running", "restored": False}
    font_checks.append(record)
    try:
        adb("shell", "settings", "put", "system", "font_scale", "1.3")
        if read_font_scale() != "1.3":
            raise RuntimeError("Android did not apply requested font_scale=1.3")
        time.sleep(1)
        find("gym-session", True)
        top("toggle-sound")
        assert_text("PRONTO")
        assert_footer("gym-session", "next-exercise")
        assert_horizontal_bounds(observe(), "large-font-ready-390")
        shot("layout-large-font-ready-390")
        assert_set(0, False, "40", "10")
        assert_inline_row_reachable(0)
        tap("increase-load-0", True)
        assert_set(0, False, "42,5", "10")
        tap("decrease-load-0", True)
        assert_set(0, False, "40", "10")
        tap("toggle-set-0", True)
        assert_set(0, True, "40", "10")
        tap("toggle-set-0", True)
        assert_set(0, False, "40", "10")
        # Focus each real text field, proving the exposed target opens an editable input.
        for identity in ["inline-load-0", "inline-reps-0"]:
            tap(identity, True)
            if find(identity, True).attrib.get("focused") != "true":
                raise RuntimeError("Large-font input cannot receive focus: " + identity)
            hide_keyboard()
        assert_inline_row_reachable(0)
        assert_footer("gym-session", "next-exercise")
        shot("layout-large-font-inline-row-390")
        tap("next-exercise", True)
        top("toggle-sound")
        assert_text("Supino inclinado com halteres")
        tap("Exercício anterior")
        assert_set(0, False, "40", "10")
        record["status"] = "passed"
    except Exception as error:
        record["status"] = "failed"
        record["error"] = str(error)
        raise
    finally:
        try:
            record["restoredValue"] = restore_font_scale(original)
            record["restored"] = True
        except Exception as error:
            record["status"] = "failed-restore"
            record["restoreError"] = str(error)
            raise
        finally:
            (out / "font-scale-result.json").write_text(json.dumps(font_checks, indent=2))
    time.sleep(1)
    find("gym-session", True)
    top("toggle-sound")
    assert_text("PRONTO")


def counterpart(state, screen, anchor=None, text=None, footer=None, sheet=False):
    if state not in COUNTERPARTS:
        raise RuntimeError("Unknown reference counterpart: " + state)
    for width, height in VIEWPORTS:
        adb("shell", "wm", "size", f"{width}x{height}")
        time.sleep(0.6)
        find(screen, True)
        if anchor:
            top(anchor)
        if text:
            assert_text(text)
        if footer:
            assert_footer(screen, footer)
        if sheet:
            assert_sheet()
        name = f"native-{state}-{width}"
        assert_horizontal_bounds(observe(), name)
        shot(name)
        paired.append({"state": state, "width": width, "height": height, "native": name + ".png", "reference": f"reference-{state}-{width}.png"})
        (out / "counterparts.json").write_text(json.dumps(paired, indent=2))
    adb("shell", "wm", "size", "390x844")
    time.sleep(0.6)
    find(screen, True)


def playback_started_lines(text, uid):
    """Parse real Android 15 AudioPlaybackConfiguration/PlaybackActivityMonitor dumps.

    UID mapping must exist in the same dump. Event text alone is not app evidence.
    AOSP Android 15 emits `u/pid`, `uid/pid`, `state:started`, `event:started`.
    """
    if "PlaybackActivityMonitor dump time:" not in text:
        raise RuntimeError("Android playback activity monitor is not available in dumpsys audio")
    owned = set()
    for line in text.splitlines():
        player = re.search(r"\bpiid:\s*(\d+)", line)
        owner = re.search(r"\b(?:u|uid)/pid:\s*(\d+)/\d+", line)
        if player and owner and int(owner.group(1)) == uid:
            owned.add(player.group(1))
    started = set()
    for line in text.splitlines():
        player = re.search(r"\bpiid:\s*(\d+)", line)
        if player and player.group(1) in owned and re.search(r"\b(?:state|event):\s*started\b", line):
            started.add(line.strip())
    return started


def audio_probe(name, control, expect_started):
    # Resolve fresh control first so accessibility observation latency cannot miss a short cue.
    node = find(control, True, True)
    package = adb("shell", "dumpsys", "package", PACKAGE).decode()
    match = re.search(r"\buserId=(\d+)", package)
    if not match:
        raise RuntimeError("Cannot identify Expo Go UID for native playback attribution")
    uid = int(match.group(1))
    baseline = adb("shell", "dumpsys", "audio").decode(errors="replace")
    before = playback_started_lines(baseline, uid)
    (out / f"audio-{name}-before.txt").write_text(baseline)
    snapshots, failures = [], []
    ready = threading.Event()
    stop = threading.Event()

    def sample():
        try:
            ready.set()
            while not stop.is_set():
                snapshots.append(adb("shell", "dumpsys", "audio").decode(errors="replace"))
                stop.wait(0.08)
        except Exception as error:
            failures.append(str(error))

    thread = threading.Thread(target=sample, daemon=True)
    thread.start()
    ready.wait(2)
    try:
        tap_node(node)
        time.sleep(2.2)  # Longer than the longest real cue plus its load/start deadline.
    finally:
        stop.set()
        thread.join(timeout=35)
    if thread.is_alive() or failures or not snapshots:
        raise RuntimeError(f"Audio observation failed: {failures}")
    newly_started = set()
    for index, snapshot in enumerate(snapshots):
        (out / f"audio-{name}-{index:03d}.txt").write_text(snapshot)
        newly_started.update(playback_started_lines(snapshot, uid) - before)
    result = {"name": name, "uid": uid, "expectedStarted": expect_started,
              "observedStarted": bool(newly_started), "evidence": sorted(newly_started),
              "samples": len(snapshots), "proof": "Android playback-service activity; host audio disabled, no audible proof"}
    audio_checks.append(result)
    (out / "audio-result.json").write_text(json.dumps(audio_checks, indent=2))
    observe()  # Reject the real app's visible playback/configuration/cleanup failure immediately.
    if bool(newly_started) != expect_started:
        raise RuntimeError(f"Native audio {name}: expected started={expect_started}, observed={bool(newly_started)}")


def choose_provider(identity, title):
    tap("provider-switch", True, True)
    tap("provider-" + identity, True)
    find("gym-home", True)
    assert_text(title)


def start_workout(identity):
    tap("workout-" + identity, True, True)
    find("gym-workout-detail", True)
    assert_footer("gym-workout-detail", "start-workout")
    tap("start-workout", True)
    find("gym-session", True)
    assert_footer("gym-session", "next-exercise")


def open_finish():
    tap("finish-workout", True, True)
    assert_sheet()
    assert_text("Encerrar treino?")


def complete_one_and_save(volume, record):
    tap("toggle-set-0", True, True)
    assert_set(0, True)
    open_finish()
    assert_text("Você já fez 1 série.")
    assert_enabled("save-finish", True)
    tap("save-finish", True)
    find("gym-summary", True)
    assert_text(volume)
    assert_text(record)
    tap("Voltar à ficha")
    find("gym-home", True)
    tap("Histórico")
    find("gym-history", True)
    assert_text(volume + " kg")


def reject_log_errors(logcat, metro):
    # Keep every prior fatal/JS/linking rejection, add app audio errors and warnings.
    patterns = [
        r"Linking requires a build-time setting|Linking found multiple possible URI schemes|The provided Linking scheme",
        r"FATAL EXCEPTION|ReactNativeJS.*(?:TypeError|ReferenceError|Invariant Violation|Unable to resolve|Error:)",
        r"\b[WE]\s+ReactNativeJS\s*:",
        r"Workout audio .* failed|The workout cue did not start|Som indisponível|Sound is unavailable",
    ]
    rejected = [line for line in logcat.splitlines() if any(re.search(pattern, line) for pattern in patterns)]
    app_pids = set(re.findall(r"^\S+\s+\S+\s+(\d+)\s+\d+\s+\w\s+ReactNativeJS\s*:", logcat, re.M))
    for line in logcat.splitlines():
        match = re.match(r"^\S+\s+\S+\s+(\d+)\s+\d+\s+([WE])\s+(\S+)\s*:", line)
        if match and match.group(1) in app_pids and re.search(r"audio|playback|exoplayer|media3", line[match.start(3):], re.I):
            rejected.append(line)
    rejected += [line for line in metro.splitlines() if re.search(r"\b(?:WARN|ERROR)\b|(?:^|\s)(?:Warning|Error|TypeError|ReferenceError):", line)]
    if rejected:
        raise RuntimeError("Native runtime/audio error or warning detected:\n" + "\n".join(dict.fromkeys(rejected)))


def finalize_log_gate(directory):
    result_path = directory / "result.json"
    result = json.loads(result_path.read_text())
    if result.get("status") != "ui-passed-awaiting-log-gate":
        raise RuntimeError("Cannot finalize an incomplete native UI audit")
    logcat = (directory / "logcat.txt").read_text(errors="replace")
    metro = (directory / "metro.log").read_text(errors="replace")
    if not logcat.strip() or not metro.strip():
        raise RuntimeError("Missing native or Metro log evidence")
    try:
        reject_log_errors(logcat, metro)
    except RuntimeError as error:
        result["status"] = "failed-log-gate"
        result["logGateError"] = str(error)
        result_path.write_text(json.dumps(result, indent=2))
        raise
    result["status"] = "passed"
    result["logGate"] = "passed: JS/linking/audio failures and app audio warnings rejected"
    result_path.write_text(json.dumps(result, indent=2))
    print(json.dumps(result), flush=True)


def cold_reopen():
    adb("shell", "am", "force-stop", PACKAGE)
    for _ in range(30):
        process = subprocess.run(["adb", "shell", "pidof", PACKAGE], capture_output=True, timeout=10)
        if not process.stdout.strip():
            break
        time.sleep(0.2)
    else:
        raise RuntimeError("Expo Go process did not stop for cold reopen")
    time.sleep(1)  # Android's old ActivityRecord can outlive the process briefly.
    print(adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "exp://127.0.0.1:8081", "-p", PACKAGE).decode(), flush=True)
    for _ in range(60):
        nodes = observe()
        if any(matches(n, "gym-home", True) and visible(n) for n in nodes):
            return
        # Only the same observed non-binding Expo onboarding/menu controls; no warning dismissal.
        subprocess.run(["python3", str(Path(__file__).with_name("expo-go-ui.py")), "onboarding", str(out / "current-client.xml")], check=True, timeout=30)
        time.sleep(1)
    raise RuntimeError("Native home did not return after synchronized cold reopen")


def run_audit():
    find("gym-home", True)
    counterpart("01-home", "gym-home", anchor="provider-switch", text="Academia Horizonte")
    tap("home-volume", True, True)
    find("gym-workouts", True)
    find("planned-volume", True, True)
    assert_text("Volume previsto")
    assert_text("Peitoral")
    assert_text("14 séries")
    assert_horizontal_bounds(observe(), "home-planned-volume-390")
    shot("navigation-01-home-planned-volume")
    tap("Início")
    find("gym-home", True)
    tap("Histórico")
    find("gym-history", True)
    counterpart("02-empty-history", "gym-history", anchor="provider-switch", text="Nenhum treino concluído ainda")
    tap("Início")
    tap("workout-gym-a", True, True)
    counterpart("03-workout", "gym-workout-detail", text="Supino reto com barra", footer="start-workout")
    tap("start-workout", True)
    find("gym-session", True)
    counterpart("04-session-ready", "gym-session", anchor="toggle-sound", text="PRONTO", footer="next-exercise")
    assert_text("Desligar som")
    large_font_ready_audit()

    # Real inline invalid draft must neither toggle completion nor mutate the stored model.
    fill("inline-load-0", "40kg")
    tap("toggle-set-0", True, True)
    assert_text(INVALID_SET)
    assert_set(0, False)
    shot("validation-01-invalid-inline-load")
    tap("Cancelar", scroll=True)
    assert_set(0, False, "40", "10")
    fill("inline-reps-0", "0")
    tap("toggle-set-0", True, True)
    assert_text(INVALID_SET)
    assert_set(0, False)
    shot("validation-02-invalid-inline-reps")
    tap("Cancelar", scroll=True)
    assert_set(0, False, "40", "10")

    # Routed editor still has its own validation, keyboard-safe Save, Cancel and native Back.
    tap("edit-set-0", True, True)
    find("set-editor", True)
    fill("set-load-input", "55")
    fill("set-reps-input", "0", hide=False)
    tap("save-set", True, True)
    assert_text(INVALID_SET)
    shot("validation-03-invalid-routed-draft")
    hide_keyboard()
    tap("Cancelar", scroll=True)
    find("gym-session", True)
    assert_set(0, False, "40", "10")
    tap("edit-set-0", True, True)
    fill("set-load-input", "55")
    fill("set-reps-input", "11")
    adb("shell", "input", "keyevent", "KEYCODE_BACK")
    find("gym-session", True)
    assert_set(0, False, "40", "10")
    shot("validation-04-cancel-and-back-preserve-set")
    tap("edit-set-0", True, True)
    fill("set-load-input", "45")
    fill("set-reps-input", "8", hide=False)
    find("save-set", True, True)
    shot("validation-05-keyboard-safe-save")
    tap("save-set", True, True)
    find("gym-session", True)
    assert_set(0, False, "45", "8")

    # Set the reference values through inline fields, exercise both real step buttons.
    fill("inline-load-0", "42,5")
    fill("inline-reps-0", "9")
    tap("decrease-load-0", True, True)
    assert_set(0, False, "40", "9")
    tap("increase-load-0", True, True)
    assert_set(0, False, "42,5", "9")
    tap("edit-set-0", True, True)
    assert_input("set-load-input", "42,5")
    assert_input("set-reps-input", "9")
    tap("Cancelar", scroll=True)
    assert_set(0, False, "42,5", "9")
    shot("validation-06-inline-committed-values")
    assert_footer("gym-session", "next-exercise")
    tap("next-exercise", True)
    top("toggle-sound")
    assert_text("Supino inclinado com halteres")
    tap("Exercício anterior")
    assert_set(0, False, "42,5", "9")
    counterpart("05-edited-set", "gym-session", anchor="toggle-sound", text="PRONTO", footer="next-exercise")

    top("toggle-sound")
    tap("toggle-sound", True)
    assert_text("Ligar som")
    shot("audio-01-sound-disabled")
    audio_probe("enable-without-replay", "toggle-sound", False)
    assert_text("Desligar som")
    audio_probe("foreground-start-cue", "start-set", True)
    assert_text("EXECUÇÃO")
    tap("pause-timer", True, True)
    assert_text("PAUSADO")
    clock_value = find("session-clock", True).attrib.get("text")
    time.sleep(1.2)
    if find("session-clock", True).attrib.get("text") != clock_value:
        raise RuntimeError("Paused timer continued counting")
    counterpart("06-paused", "gym-session", anchor="toggle-sound", text="PAUSADO", footer="next-exercise")
    top("toggle-sound")
    tap("toggle-sound", True)
    assert_text("Ligar som")
    tap("pause-timer", True, True)
    assert_absent("PAUSADO")
    audio_probe("muted-set-completion", "complete-set", False)
    assert_text("INTERVALO")
    assert_set(0, True, "42,5", "9")
    top("toggle-sound")
    audio_probe("reenable-without-replay", "toggle-sound", False)
    assert_text("Desligar som")
    before = find("session-clock", True).attrib.get("text")
    observed_at = time.monotonic()
    tap("extend-rest", True, True)
    after = find("session-clock", True).attrib.get("text")
    elapsed = time.monotonic() - observed_at
    seconds = lambda text: sum(int(value) * factor for value, factor in zip(text.split(":"), [60, 1]))
    added = seconds(after) - seconds(before) + elapsed
    if not 13 <= added <= 17:
        raise RuntimeError(f"Extend rest did not add 15 seconds (elapsed-adjusted delta {added:.2f})")
    counterpart("07-rest", "gym-session", anchor="toggle-sound", text="INTERVALO", footer="next-exercise")
    audio_probe("foreground-skip-rest-cue", "skip-rest", True)
    assert_text("PRONTO")
    tap("Voltar à ficha")
    find("gym-home", True)
    choose_provider("sample-physio", "Fisioterapia Movimento")
    shot("isolation-01-physiotherapy-client")
    tap("Histórico")
    assert_text("Nenhum treino concluído ainda")
    shot("isolation-02-physio-empty-history")
    choose_provider("sample-gym", "Academia Horizonte")
    tap("home-open-workout", True, True)
    find("gym-session", True)
    assert_set(0, True, "42,5", "9")
    open_finish()
    assert_text("Você já fez 1 série.")
    assert_enabled("save-finish", True)
    counterpart("08-partial-finish", "finish-dialog", text="Você já fez 1 série.", sheet=True)
    tap("Continuar treinando")
    find("gym-session", True)
    assert_absent("Encerrar treino?")
    assert_set(0, True, "42,5", "9")
    open_finish()
    tap("save-finish", True)
    find("gym-summary", True)
    assert_text("382,5")
    assert_text("42,5 kg × 9")
    counterpart("09-summary", "gym-summary", text="382,5")
    tap("Voltar à ficha")
    find("gym-home", True)
    tap("Histórico")
    counterpart("10-history", "gym-history", anchor="provider-switch", text="382,5 kg")

    # Both personal providers are active simultaneously, including their different set defaults.
    choose_provider("sample-personal", "Personal Marina")
    start_workout("personal-a")
    assert_set(0, False, "12", "10")
    tap("Voltar à ficha")
    choose_provider("sample-personal-rafael", "Personal Rafael")
    start_workout("personal-rafael-a")
    assert_set(0, False, "8", "12")
    shot("isolation-03-rafael-independent-session")
    tap("Voltar à ficha")
    choose_provider("sample-personal", "Personal Marina")
    tap("home-open-workout", True, True)
    assert_set(0, False, "12", "10")
    shot("isolation-04-marina-session-retained")
    complete_one_and_save("120", "12 kg × 10")
    assert_absent("382,5 kg")
    shot("isolation-05-marina-only-history-120")
    choose_provider("sample-personal-rafael", "Personal Rafael")
    tap("Histórico")
    assert_text("Nenhum treino concluído ainda")
    assert_absent("120 kg")
    shot("isolation-06-rafael-history-still-empty")
    tap("Início")
    tap("home-open-workout", True, True)
    assert_set(0, False, "8", "12")
    complete_one_and_save("96", "8 kg × 12")
    assert_absent("120 kg")
    assert_absent("382,5 kg")
    shot("isolation-07-rafael-only-history-96")
    choose_provider("sample-personal", "Personal Marina")
    tap("Histórico")
    assert_text("120 kg")
    assert_absent("96 kg")
    shot("isolation-08-marina-history-still-120")

    choose_provider("sample-physio", "Fisioterapia Movimento")
    start_workout("physio-a")
    open_finish()
    assert_text("Nenhuma série foi marcada.")
    assert_enabled("save-finish", False)
    shot("empty-01-save-disabled")
    tap("Continuar treinando")
    assert_set(0, False, "0", "10")
    open_finish()
    tap("Descartar treino")
    find("gym-home", True)
    tap("Histórico")
    assert_text("Nenhum treino concluído ainda")
    shot("empty-02-discard-keeps-history-empty")
    tap("Início")
    start_workout("physio-a")
    assert_set(0, False, "0", "10")
    top("toggle-sound")
    assert_text("PRONTO")
    shot("empty-03-restart-is-pristine")
    tap("next-exercise", True)
    top("toggle-sound")
    assert_text("Sentar e levantar")
    assert_set(0, False, "0", "8")
    assert_footer("gym-session", "finish-last-exercise")
    shot("empty-04-final-exercise-footer")
    tap("finish-last-exercise", True)
    assert_sheet()
    assert_text("Encerrar treino?")
    assert_text("Nenhuma série foi marcada.")
    assert_enabled("save-finish", False)
    shot("empty-05-final-footer-save-disabled")
    tap("Descartar treino")
    choose_provider("sample-gym", "Academia Horizonte")
    tap("Histórico")
    assert_text("382,5 kg")
    adb("shell", "input", "keyevent", "KEYCODE_HOME")
    time.sleep(1)
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "exp://127.0.0.1:8081", "-p", PACKAGE)
    find("gym-history", True)
    assert_text("382,5 kg")
    shot("lifecycle-01-background-resume-keeps-history")
    cold_reopen()
    assert_text("Academia Horizonte")
    tap("Histórico")
    assert_text("Nenhum treino concluído ainda")
    assert_absent("382,5 kg")
    shot("lifecycle-02-cold-reopen-clears-gym-history")
    for identity, title, forbidden in [("sample-personal", "Personal Marina", "120 kg"), ("sample-personal-rafael", "Personal Rafael", "96 kg")]:
        choose_provider(identity, title)
        assert_absent("TREINO EM ANDAMENTO")
        tap("Histórico")
        assert_text("Nenhum treino concluído ainda")
        assert_absent(forbidden)
        shot("lifecycle-03-cold-empty-" + identity)

    expected = {(state, width) for state in COUNTERPARTS for width, _ in VIEWPORTS}
    if {(item["state"], item["width"]) for item in paired} != expected or len(paired) != 20:
        raise RuntimeError("Incomplete original/native counterpart capture matrix")
    result = {"status": "ui-passed-awaiting-log-gate", "screenshots": len(shots), "captured_states": shots,
              "counterparts": paired, "layoutChecks": layout_checks, "fontChecks": font_checks, "audioChecks": audio_checks,
              "runtime": "Android API35 / Expo Go", "data": "sample, in-memory", "standalone": False,
              "iosDevice": False, "audibleOutputVerified": False,
              "audioLimit": "Headless emulator uses -no-audio; real Android playback-service evidence does not prove heard sound"}
    (out / "result.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--check-logs":
        finalize_log_gate(Path(sys.argv[2]))
    elif len(sys.argv) == 2:
        out = Path(sys.argv[1])
        out.mkdir(parents=True, exist_ok=True)
        (out / "result.json").write_text(json.dumps({"status": "running", "audibleOutputVerified": False}))
        try:
            run_audit()
        except Exception as error:
            failure = {"status": "failed", "error": str(error), "captured_states": shots, "counterparts": paired, "fontChecks": font_checks, "audioChecks": audio_checks}
            (out / "failure.json").write_text(json.dumps(failure, indent=2))
            (out / "result.json").write_text(json.dumps(failure, indent=2))
            raise
    else:
        raise SystemExit("usage: native-client-ui.py [--check-logs] EVIDENCE_DIRECTORY")
