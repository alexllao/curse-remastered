"""Contrastar el estado inicial y los canales animados de DUNGEON sin acciones."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_AX, UC_X86_REG_BX, UC_X86_REG_ES, UC_X86_REG_IP


def main():
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location('trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = (root / 'original/CURSE.EXE').read_bytes()
    machine = trace.Machine(exe)
    for offset, segment in ((0x10, 0x4000), (0x0e, 0x5000), (0x4aee, 0x6000)):
        machine.uc.mem_write(trace.LOAD_ADDRESS + offset, struct.pack('<H', segment))
    for bank, name in ((0x40000, 'MANA.BRD'), (0x50000, 'STD.BRD'), (0x60000, 'DUNGEON.SPR')):
        machine.uc.mem_write(bank, (root / 'original/DATA' / name).read_bytes())
    machine.uc.mem_write(trace.DATA_ADDRESS + 0x2c0a, bytes(70 * 33))
    machine.set_word(0x8082, 0)
    machine.uc.mem_write(trace.DATA_ADDRESS + 0xad6, b'\x01')
    machine.execute(0x8ca6, 0x8d6e)
    machine.uc.reg_write(UC_X86_REG_BX, 65535)
    machine.uc.reg_write(UC_X86_REG_ES, trace.DATA_SEGMENT)
    machine.execute(0x4d55, 0x4e89)
    machine.uc.mem_write(trace.DATA_ADDRESS + 0x358c, b'\0')
    machine.execute(0x4f04, 0x4f2b)
    machine.uc.mem_write(trace.DATA_ADDRESS + 0x3594, bytes(3))
    def state():
        return [list(machine.uc.mem_read(trace.DATA_ADDRESS + 0x2c0a + slot * 33, 33)) for slot in range(1,70)]
    initial = state()
    seed = list(struct.unpack('<4H', machine.uc.mem_read(trace.LOAD_ADDRESS + 0x78de, 8)))
    ticks = []
    for tick in range(1000):
        machine.execute(0x85de, 0x8a21)
        ticks.append(state())
    changes = []
    for index, row in enumerate(initial):
        seen = {tuple(row[:10])}
        seen.update(tuple(states[index][:10]) for states in ticks)
        if len(seen) > 1:
            changes.append({'slot': index + 1, 'states': len(seen)})
    random_cases = []
    for initial_seed in ([0, 0, 0, 0], [1, 2, 3, 4], [65535, 0, 65535, 1], [5, 12345, 54321, 65535]):
        for limit in (1, 2, 3, 7, 32, 255, 256, 65535):
            random_machine = trace.Machine(exe)
            random_machine.uc.mem_write(trace.LOAD_ADDRESS + 0x78de, struct.pack('<4H', *initial_seed))
            random_machine.uc.reg_write(UC_X86_REG_AX, limit)
            random_machine.execute(0x7a8e, 0x7add)
            random_cases.append({'seed': list(initial_seed), 'limit': limit,
                                 'result': random_machine.uc.reg_read(UC_X86_REG_AX),
                                 'nextSeed': list(struct.unpack('<4H', random_machine.uc.mem_read(trace.LOAD_ADDRESS + 0x78de, 8)))})
    clock_cases = []
    for pulses in (0, 4, 5, 6, 255):
        clock = trace.Machine(exe)
        clock.uc.mem_write(trace.LOAD_ADDRESS + 0x275, bytes((pulses,)))
        reached = []
        def clock_boundary(uc, address, _size, _):
            if address == trace.LOAD_ADDRESS + 0xed3b - 512:
                reached.append(True)
                uc.emu_stop()
        clock.uc.hook_add(UC_HOOK_CODE, clock_boundary)
        clock.uc.emu_start(trace.LOAD_ADDRESS + 0xed33 - 512, 0, count=100)
        trace.require(bool(reached) == (pulses >= 5), 'Unexpected timer gate')
        clock_cases.append({'pulses': pulses, 'ready': bool(reached)})
    trace.require(exe[0x3ae:0x3b1] == bytes.fromhex('b8 50 42'), 'Unexpected PIT divisor')
    report = {'schemaVersion': 1, 'detailMode': 1, 'executableSha256': hashlib.sha256(exe).hexdigest(),
              'sourceSha256': {name: hashlib.sha256((root / 'original/DATA' / name).read_bytes()).hexdigest() for name in ('MANA.BRD', 'STD.BRD', 'DUNGEON.SPR')},
              'resourceId': 0, 'logicalRoomId': -1, 'initial': initial, 'ticks': ticks,
              'randomCases': random_cases, 'clockCases': clock_cases,
              'controlsAfterTicks': list(machine.uc.mem_read(trace.DATA_ADDRESS + 0x3594, 3)),
              'seed': seed, 'firstFreeSlot': machine.word(0x3588), 'animated': changes,
              'programs': list(exe[0xf510:0xf510+0x9978]),
              'limitations': ['Initial actor channels only; no interaction, dynamic handlers, audio or wall-clock timing', 'Deterministic executable seed; not a captured live session']}
    (root / 'reports/navigation/dungeon-animation.json').write_text(json.dumps(report, separators=(',', ':'))+'\n')
    print(json.dumps({'initialPlayer': initial[0][:10], 'animated': changes, 'ticks': len(ticks)}))


if __name__ == '__main__':
    main()
