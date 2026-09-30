import re
import subprocess
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

action, path = sys.argv[1:]
root = ET.parse(path).getroot()
nodes = list(root.iter('node'))

def text(node):
    return ' '.join([node.attrib.get('text', ''), node.attrib.get('content-desc', '')]).strip()

def tap(node):
    match = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds', ''))
    if not match:
        raise RuntimeError('No observed bounds for selected control')
    left, top, right, bottom = map(int, match.groups())
    subprocess.run(['adb', 'shell', 'input', 'tap', str((left+right)//2), str((top+bottom)//2)], check=True)

if action == 'onboarding':
    visible = ' '.join(map(text, nodes))
    for node in nodes:
        observed = {text(node), node.attrib.get('text', ''), node.attrib.get('content-desc', '')}
        tutorial_continue = 'This is the developer menu.' in visible and 'Continue' in observed
        native_menu_close = 'Reload' in visible and 'Open DevTools' in visible and 'Close' in observed
        if native_menu_close:
            shot = Path(path).parent / '00b-expo-go-menu.png'
            if not shot.exists():
                shot.write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p']))
            print('Closing the observed Expo Go developer menu')
            tap(node)
            break
        if tutorial_continue or 'Got it' in observed:
            if tutorial_continue:
                shot = Path(path).parent / '00-expo-go-tutorial.png'
                if not shot.exists():
                    shot.write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p']))
            print('Dismissing the observed Expo Go tutorial:', text(node))
            tap(node)
            break
elif action == 'tap-home':
    matches = [node for node in nodes if 'Início' in text(node)]
    if not matches:
        raise RuntimeError('Expected home tab not observed')
    tap(matches[0])
elif action == 'assert':
    visible = ' '.join(map(text, nodes))
    if 'Início' not in visible:
        raise RuntimeError('Localized home tab missing')
    for marker in ['Something went wrong', 'Render Error', 'Uncaught Error', 'Invariant Violation', 'TypeError', 'Unable to resolve', 'Project is incompatible']:
        if marker in visible:
            raise RuntimeError('Runtime error visible: '+marker)
    print('Native home tab is visible without an error overlay')
else:
    raise RuntimeError('Unknown proof operation')
