"""Black-box native QA: use fresh UI nodes before each tap, preserve all states."""
import json
import re
import subprocess
import sys
import time
from pathlib import Path
import xml.etree.ElementTree as ET

out = Path(sys.argv[1])
errors = ["Something went wrong", "Render Error", "Uncaught Error", "Invariant Violation", "TypeError", "Unable to resolve", "Project is incompatible"]
shots = []

def adb(*args):
    return subprocess.check_output(["adb", *args], timeout=30)

def observe():
    size = adb("shell", "wm", "size").decode()
    width, height = re.findall(r"(\d+)x(\d+)", size)[-1]
    adb("shell", "rm", "-f", "/sdcard/client.xml")
    adb("shell", "CLASSPATH=/data/local/tmp/gym-dump.jar:/system/framework/uiautomator.jar",
        "app_process", "/system/bin", "GymDump", "/sdcard/client.xml", width, height)
    adb("pull", "/sdcard/client.xml", str(out / "current-client.xml"))
    nodes = list(ET.parse(out / "current-client.xml").getroot().iter("node"))
    visible = " ".join(n.attrib.get("text", "") + " " + n.attrib.get("content-desc", "") for n in nodes)
    for marker in errors:
        if marker in visible:
            raise RuntimeError("Runtime error visible: " + marker)
    return nodes

def matches(node, value, by_id=False):
    if by_id:
        identity = node.attrib.get("resource-id", "")
        return identity == value or identity.endswith(":id/" + value)
    return value in (node.attrib.get("text", ""), node.attrib.get("content-desc", ""))

def bounds(node):
    found = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not found:
        raise RuntimeError("Observed element has no valid bounds")
    return tuple(map(int, found.groups()))

def viewport_scroll(nodes, direction):
    choices = [n for n in nodes if n.attrib.get("scrollable") == "true"]
    if not choices:
        raise RuntimeError("No observed scrollable viewport")
    left, top, right, bottom = bounds(choices[0])
    x = (left + right) // 2
    near_top, near_bottom = top + (bottom - top) // 5, bottom - (bottom - top) // 5
    start, end = (near_bottom, near_top) if direction == "down" else (near_top, near_bottom)
    adb("shell", "input", "swipe", str(x), str(start), str(x), str(end), "350")

def find(value, by_id=False, scroll=False):
    for attempt in range(12):
        nodes = observe()
        candidates = [n for n in nodes if matches(n, value, by_id) and bounds(n)[2] > bounds(n)[0] and bounds(n)[3] > bounds(n)[1]]
        if candidates:
            return candidates[0]
        if scroll:
            viewport_scroll(nodes, "down" if attempt < 6 else "up")
        else:
            time.sleep(0.5)
    raise RuntimeError("Expected control not visible: " + value)

def tap(value, by_id=False, scroll=False):
    node = find(value, by_id, scroll)
    left, top, right, bottom = bounds(node)
    adb("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))
    time.sleep(0.3)

def assert_text(value):
    visible = " ".join(n.attrib.get("text", "") + " " + n.attrib.get("content-desc", "") for n in observe())
    if value not in visible:
        raise RuntimeError("Expected text not visible: " + value)

def assert_absent(value):
    visible = " ".join(n.attrib.get("text", "") + " " + n.attrib.get("content-desc", "") for n in observe())
    if value in visible:
        raise RuntimeError("Unexpected cross-tenant text visible: " + value)

def shot(name):
    observe()
    (out / (name + ".xml")).write_bytes((out / "current-client.xml").read_bytes())
    (out / (name + ".png")).write_bytes(adb("exec-out", "screencap", "-p"))
    shots.append(name)
    print("Captured", name, flush=True)

def fill(identity, value, hide=True):
    node = find(identity, True)
    tap(identity, True)
    adb("shell", "input", "keyevent", "KEYCODE_MOVE_END")
    count = len(node.attrib.get("text", "")) + 3
    adb("shell", "input", "keyevent", *(["KEYCODE_DEL"] * count))
    adb("shell", "input", "text", value)
    if hide:
        adb("shell", "input", "keyevent", "KEYCODE_BACK")

def choose_provider(identity, title):
    tap("provider-switch", True, True)
    tap("provider-" + identity, True)
    find("gym-home", True)
    assert_text(title)

def start_workout(identity):
    tap("workout-" + identity, True, True)
    find("gym-workout-detail", True)
    tap("start-workout", True, True)
    find("gym-session", True)

def complete_one_and_save(volume):
    tap("toggle-set-0", True, True)
    tap("finish-workout", True, True)
    tap("save-finish", True)
    find("gym-summary", True)
    assert_text(volume)
    tap("Voltar à ficha", scroll=True)
    find("gym-home", True)
    tap("Histórico")
    find("gym-history", True)
    assert_text(volume + " kg")

find("gym-home", True)
shot("01-home-phone")
tap("workout-gym-a", True, True)
find("gym-workout-detail", True)
shot("02-prescribed-workout")
tap("start-workout", True, True)
find("gym-session", True)
shot("03-session-ready")
tap("edit-set-0", True, True)
find("set-editor", True)
fill("set-load-input", "40kg", hide=False)
tap("save-set", True, True)
assert_text("Use carga de 0")
shot("04-invalid-load")
tap("Cancelar", scroll=True)
find("gym-session", True)
tap("edit-set-0", True, True)
if find("set-load-input", True).attrib.get("text") != "40":
    raise RuntimeError("Cancel changed the stored load")
fill("set-load-input", "42,5")
fill("set-reps-input", "9", hide=False)
shot("05-keyboard-safe-set-editor")
tap("save-set", True, True)
find("gym-session", True)
assert_text("42,5 kg")
shot("06-recorded-load")
tap("start-set", True, True)
tap("pause-timer", True, True)
assert_text("PAUSADO")
shot("07-paused-timer")
tap("pause-timer", True, True)
tap("complete-set", True, True)
assert_text("INTERVALO")
tap("+15 segundos", scroll=True)
shot("08-rest-timer")
tap("Pular intervalo", scroll=True)
tap("Voltar à ficha", scroll=True)
find("gym-home", True)
choose_provider("sample-physio", "Fisioterapia Movimento")
shot("09-physiotherapy-client-space")
tap("Histórico")
find("gym-history", True)
assert_text("Seu primeiro treino começa aqui")
shot("10-isolated-empty-history")
choose_provider("sample-gym", "Academia Horizonte")
tap("home-open-workout", True, True)
find("gym-session", True)
tap("finish-workout", True, True)
shot("11-partial-workout-confirmation")
tap("Continuar treinando")
tap("finish-workout", True, True)
tap("save-finish", True)
find("gym-summary", True)
assert_text("382,5")
shot("12-completed-set-summary")
tap("Voltar à ficha", scroll=True)
find("gym-home", True)
tap("Histórico")
find("gym-history", True)
assert_text("382,5 kg")
shot("13-saved-gym-history")
choose_provider("sample-personal", "Personal Marina")
start_workout("personal-a")
assert_text("12 kg × 10")
tap("Voltar à ficha", scroll=True)
find("gym-home", True)
choose_provider("sample-personal-rafael", "Personal Rafael")
start_workout("personal-rafael-a")
assert_text("8 kg × 12")
shot("14-rafael-independent-active-session")
tap("Voltar à ficha", scroll=True)
find("gym-home", True)
choose_provider("sample-personal", "Personal Marina")
tap("home-open-workout", True, True)
find("gym-session", True)
assert_text("12 kg × 10")
shot("15-marina-session-survives-provider-switch")
complete_one_and_save("120")
assert_absent("382,5 kg")
shot("16-marina-only-history")
choose_provider("sample-personal-rafael", "Personal Rafael")
tap("Histórico")
find("gym-history", True)
assert_text("Seu primeiro treino começa aqui")
assert_absent("120 kg")
shot("17-rafael-isolated-empty-history")
tap("Início")
find("gym-home", True)
tap("home-open-workout", True, True)
find("gym-session", True)
complete_one_and_save("96")
assert_absent("120 kg")
shot("18-rafael-only-history")
choose_provider("sample-personal", "Personal Marina")
tap("Histórico")
find("gym-history", True)
assert_text("120 kg")
assert_absent("96 kg")
choose_provider("sample-physio", "Fisioterapia Movimento")
start_workout("physio-a")
tap("finish-workout", True, True)
if find("save-finish", True).attrib.get("enabled") != "false":
    raise RuntimeError("Empty session save must be disabled")
shot("19-empty-session-save-disabled")
tap("Descartar treino")
find("gym-home", True)
tap("Histórico")
find("gym-history", True)
assert_text("Seu primeiro treino começa aqui")
shot("20-discard-keeps-history-empty")
tap("Início")
find("gym-home", True)
start_workout("physio-a")
assert_text("Série 1: Pendente")
tap("finish-workout", True, True)
tap("Descartar treino")
find("gym-home", True)
choose_provider("sample-gym", "Academia Horizonte")
tap("Histórico")
find("gym-history", True)
assert_text("382,5 kg")
adb("shell", "input", "keyevent", "KEYCODE_HOME")
time.sleep(1)
adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "exp://127.0.0.1:8081", "-p", "host.exp.exponent")
find("gym-history", True)
shot("21-background-resume")
adb("shell", "wm", "size", "1280x800")
time.sleep(2)
tap("Início")
find("gym-home", True)
shot("22-wide-home")
adb("shell", "wm", "size", "390x844")
adb("shell", "am", "force-stop", "host.exp.exponent")
adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", "exp://127.0.0.1:8081", "-p", "host.exp.exponent")
find("gym-home", True)
tap("Histórico")
find("gym-history", True)
assert_text("Seu primeiro treino começa aqui")
shot("23-cold-reopen-clears-demo-history")
result = {"status": "passed", "screenshots": len(shots), "captured_states": shots, "runtime": "Android API35 / Expo Go", "data": "sample, in-memory", "standalone": False, "iosDevice": False}
(out / "result.json").write_text(json.dumps(result, indent=2))
print(json.dumps(result), flush=True)
