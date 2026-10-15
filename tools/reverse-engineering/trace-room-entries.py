"""Contrastar entradas de sala con el intérprete original, sin simular una partida."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_BX, UC_X86_REG_ES, UC_X86_REG_IP


def main():
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location('trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = (root / 'original/CURSE.EXE').read_bytes()
    std = (root / 'original/DATA/STD.BRD').read_bytes()
    profile = json.loads((root / 'reports/navigation/walking-profile.json').read_text())
    trace.require(profile['executableSha256'] == hashlib.sha256(exe).hexdigest(), 'Wrong executable')
    entries = []
    for room in profile['rooms']:
        result = {**room, 'status': 'special-entry', 'spawn': None}
        result['programs'] = list(struct.unpack_from('<3H', exe, 0xf510 + 0x85ac + room['logicalRoomId'] * 14 + 6))
        if room['flags'] == 0:
            result['status'] = 'hidden-player'
        elif room['brdSelector'] == 255:
            machine = trace.Machine(exe)
            machine.uc.mem_write(trace.DATA_ADDRESS + 0x2c0a, bytes(70 * 33))
            machine.uc.mem_write(trace.DATA_ADDRESS + 0x3594, bytes(3))
            machine.uc.mem_write(0x50000, std)
            machine.uc.reg_write(UC_X86_REG_BX, room['logicalRoomId'])
            machine.uc.reg_write(UC_X86_REG_ES, trace.DATA_SEGMENT)
            machine.execute(0x4d55, 0x4e89)
            machine.set_word(0x2c4a, 0x5000)
            machine.set_word(0x3588, 2)

            blocked = []
            # No sustituir sonidos, azar ni cambios de banco por comportamientos inventados.
            boundaries = {trace.LOAD_ADDRESS + p - 512: name for p, name in
                          ((0x5488, 'sound'), (0x7a8e, 'random'), (0x8715, 'sprite-bank-change'))}
            def guard(uc, address, _size, _):
                if address in boundaries:
                    blocked.append(boundaries[address])
                    uc.emu_stop()
            machine.uc.hook_add(UC_HOOK_CODE, guard)
            ticks = []
            for _ in range(512):
                # execute() exige alcanzar el final; los límites especiales usan emu_start.
                machine.stop_address = trace.LOAD_ADDRESS + 0x8a21 - 512
                machine.uc.emu_start(trace.LOAD_ADDRESS + 0x85de - 512, 0, count=2000000)
                if blocked:
                    result['blockedBy'] = blocked[0]
                    break
                trace.require(machine.uc.reg_read(UC_X86_REG_IP) == 0x8821, f'Entry interpreter did not stop: room {room} IP {machine.uc.reg_read(UC_X86_REG_IP):x}')
                raw = bytes(machine.uc.mem_read(trace.DATA_ADDRESS + 0x2c2b, 33))
                flags, frame, x, y, width, height = struct.unpack_from('<BBhhHH', raw)
                controls = list(machine.uc.mem_read(trace.DATA_ADDRESS + 0x3594, 3))
                channels = [struct.unpack_from('<H', raw, p)[0] for p in (16, 21, 26)]
                ticks.append([flags, frame, x, y, width, height, *controls, *channels])
                if not any(channels):
                    if flags == 1 and (frame & 127) < 27 and width == 32 and height == 48 and controls[2] == 1:
                        result['status'] = 'normal-walk-ready'
                        result['spawn'] = {**room, 'x': x, 'y': y, 'frame': frame}
                    elif flags == 0:
                        result['status'] = 'hidden-player'
                    break
            result['ticks'] = ticks
        entries.append(result)
    report = {'schemaVersion': 1, 'executableSha256': trace.PROFILE,
              'stdSha256': hashlib.sha256(std).hexdigest(), 'entries': entries,
              'scope': 'Isolated entry interpreter, zero actors/state, no room actions or transitions',
              'limitations': ['Special entries remain unavailable; endpoints are not a saved game state',
                              'Does not update dynamic collision regions or play ambient animation']}
    (root / 'reports/navigation/room-entries.json').write_text(json.dumps(report, indent=2) + '\n')
    from collections import Counter
    print(json.dumps(dict(Counter(e['status'] for e in entries))))


if __name__ == '__main__':
    main()



