"""Contrastar orden de actores y activación de primeros planos sin ejecutar VGA."""
import importlib.util
import json
from pathlib import Path
import struct
from unicorn import UC_HOOK_CODE


def main():
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location('trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = (root / 'original/CURSE.EXE').read_bytes()
    cases = []
    for seed in range(12):
        machine = trace.Machine(exe)
        actors = []
        for slot in range(1, 70):
            at = 0x2c0a + slot * 33
            y = ((slot * 19 + seed * 23) % 17 - 8) * 5000
            y = ((y + 32768) % 65536) - 32768
            height = (slot * 13 + seed) % 60
            offset = (slot % 5 - 2) * 200
            machine.set_word(at + 4, y & 65535)
            machine.set_word(at + 8, height)
            machine.set_word(at + 10, offset & 65535)
            actors.append({'slot': slot, 'flags': 1, 'x': 0, 'y': y, 'width': 32, 'height': height, 'depthOffset': offset})
        order = list(range(1, 70))
        if seed % 2:
            order.reverse()
        for index, slot in enumerate(order):
            machine.set_word(0xbdd4 + index * 4, 0x2c0a + slot * 33)
        machine.execute(0xf49a, 0xf50e)
        actual = [(machine.word(0xbdd4 + index * 4) - 0x2c0a) // 33 for index in range(69)]
        cases.append({'actors': actors, 'previous': order, 'expected': actual})

    foreground = []
    for x, y, flags in ((10, 20, 1), (40, 20, 1), (41, 20, 1), (-1, 20, 1),
                         (10, 40, 1), (10, 41, 1), (10, 20, 0), (10, 20, 3)):
        machine = trace.Machine(exe)
        machine.uc.mem_write(trace.DATA_ADDRESS + 0x2c2b, bytes(69 * 33))
        actor = {'slot': 1, 'flags': flags, 'x': x, 'y': y, 'width': 10, 'height': 10, 'depthOffset': 0}
        machine.uc.mem_write(trace.DATA_ADDRESS + 0x2c2b, struct.pack('<BBhhHH', flags, 0, x, y, 10, 10))
        piece = {'x': 10, 'y': 20, 'width': 31, 'height': 21}
        machine.uc.mem_write(trace.DATA_ADDRESS + 0x3510, struct.pack('<hhHHHH', 10, 20, 31, 21, 0x6000, 0))
        machine.set_word(0x358a, 1)
        reached = []
        def stop(uc, address, _size, _):
            if address == trace.LOAD_ADDRESS + 0xee6e - 512:
                reached.append(True)
                uc.emu_stop()
            elif address == trace.LOAD_ADDRESS + 0xee89 - 512:
                reached.append(False)
                uc.emu_stop()
        machine.uc.hook_add(UC_HOOK_CODE, stop)
        machine.uc.emu_start(trace.LOAD_ADDRESS + 0xee12 - 512, 0, count=10000)
        trace.require(len(reached) == 1, 'Foreground did not reach a boundary')
        foreground.append({'piece': piece, 'actors': [actor], 'expected': reached[0]})
    output = root / 'reports/navigation/scene-order-verification.json'
    output.write_text(json.dumps({'schemaVersion': 1, 'executableSha256': trace.PROFILE,
                                 'orderCases': cases, 'foregroundCases': foreground,
                                 'limitations': ['Synthetic actors and piece bounds', 'VGA blitter not executed',
                                                 'Room scripts and dynamic frame selection excluded']}, indent=2) + '\n')
    print(json.dumps({'actorOrderCases': len(cases), 'foregroundCases': len(foreground)}))


if __name__ == '__main__':
    main()
