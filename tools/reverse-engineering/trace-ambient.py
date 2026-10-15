"""Contrastar los canales iniciales de las 78 salas sin controladores de interacción."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct


def main():
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location(
        'trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = (root / 'original/CURSE.EXE').read_bytes()
    resources = json.loads(
        (root / 'reports/scenes/backgrounds/manifest.json').read_text())['results']
    trace.require(len(resources) == 78, 'Expected 78 resources')
    profiles = []
    for row in resources:
        machine = trace.Machine(exe)
        for offset, segment in ((0x10, 0x4000), (0x0e, 0x5000), (0x4aee, 0x6000)):
            machine.uc.mem_write(trace.LOAD_ADDRESS + offset, struct.pack('<H', segment))
        for bank, name in ((0x40000, 'MANA.BRD'), (0x50000, 'STD.BRD'),
                           (0x60000, row['sprite'])):
            machine.uc.mem_write(bank, (root / 'original/DATA' / name).read_bytes())
        machine.uc.mem_write(trace.DATA_ADDRESS + 0x2c0a, bytes(70 * 33))
        machine.set_word(0x8082, row['resourceId'])
        machine.uc.mem_write(trace.DATA_ADDRESS + 0xad6, b'\0')
        machine.execute(0x8ca6, 0x8d6e)
        machine.uc.mem_write(trace.DATA_ADDRESS + 0x3594, bytes(3))

        def state():
            return bytes(machine.uc.mem_read(trace.DATA_ADDRESS + 0x2c2b, 69 * 33))

        initial = state()
        seed = list(struct.unpack('<4H', machine.uc.mem_read(trace.LOAD_ADDRESS + 0x78de, 8)))
        hashes, frames, changed = [], set(), set()

        def record(data):
            for slot in range(69):
                actor = data[slot * 33:(slot + 1) * 33]
                if actor[0]:
                    frames.add((actor[31] | (actor[32] << 8), actor[1] & 127))
                if actor[:10] != initial[slot * 33:slot * 33 + 10]:
                    changed.add(slot + 1)

        record(initial)
        for _ in range(1000):
            machine.execute(0x85de, 0x8a21)
            data = state()
            record(data)
            hashes.append(hashlib.sha256(data).hexdigest())
        profiles.append({
            'resourceId': row['resourceId'], 'sprite': row['sprite'],
            'initial': [list(initial[n:n + 33]) for n in range(0, len(initial), 33)],
            'seed': seed, 'firstFreeSlot': machine.word(0x3588),
            'frames': sorted(frames), 'hashes': hashes, 'animatedSlots': sorted(changed),
            'sourceSha256': hashlib.sha256(
                (root / 'original/DATA' / row['sprite']).read_bytes()).hexdigest(),
        })
        print(json.dumps({'resourceId': row['resourceId'], 'animatedSlots': len(changed)}), flush=True)
    report = {
        'schemaVersion': 1, 'executableSha256': trace.PROFILE, 'ticks': 1000,
        'scope': 'Initial object-loader channels without player, interactions, dynamic handlers or audio',
        'profiles': profiles,
    }
    (root / 'reports/navigation/ambient-audit.json').write_text(
        json.dumps(report, separators=(',', ':')) + '\n')


if __name__ == '__main__':
    main()
