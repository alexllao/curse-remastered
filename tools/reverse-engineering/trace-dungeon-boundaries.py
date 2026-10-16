"""Recorre cinco bordes desde el estado libre, usando rutinas DOS sin audio/render.

Requiere la traza dungeon-actions. Los resultados derivados permanecen en reports/.
"""
import importlib.util
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('actions', root / 'tools/reverse-engineering/trace-dungeon-actions.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
report = json.loads((root / 'reports/navigation/dungeon-actions.json').read_text())
module.t.require(report['executableSha256'] == module.t.PROFILE, 'Repeat dungeon action trace')
results = []
for target in [(319, 190), (319, 170), (319, 150), (300, 198), (1, 198)]:
    d = module.Dungeon()
    for event in report['events']:
        if event['kind'] == 'walk':
            break
        if event['kind'] == 'action':
            name = event['name']
            if name == 'take-coin':
                break
            item, address, verb, other = {
                'help': (-3, 0x34de, None, 65535),
                'take-key': (1, 0x583a, None, 65535),
                'unlock-chains': (0, 0x3d53, 0, 1),
            }[name]
            d.set_word(0xb620, item + 26)
            if verb is not None:
                d.set_word(0xb634, verb)
                d.set_word(0xb638, other)
            d.call(address, 0)
        else:
            for _ in event['states']:
                d.tick()
    d.set_word(0x9978, 0)
    d.set_word(0x997a, target[0])
    d.set_word(0x997c, target[1])
    d.set_word(0xdfa, 0x9978)
    d.uc.reg_write(module.UC_X86_REG_SI, 0x9978)
    d.call(0x115f)
    initial = d.state()
    states = []
    for _ in range(100):
        d.tick()
        states.append(d.state())
    results.append({'target': target, 'initial': initial, 'states': states})
    print(target, states[-1]['actors'][0][:10], states[-1]['walking'])
(root / 'reports/navigation/dungeon-boundaries.json').write_text(json.dumps(results))
