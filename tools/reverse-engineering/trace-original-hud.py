"""Barra contextual inicial de DUNGEON: posiciones, iconos y acciones bloqueadas."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_CX, UC_X86_REG_DX, UC_X86_REG_DS, UC_X86_REG_SI, UC_X86_REG_SP, UC_X86_REG_IP, UC_X86_REG_EFLAGS


def main():
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location('trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = (root / 'original/CURSE.EXE').read_bytes()
    sprites = (root / 'original/DATA/ICONS.SPR').read_bytes()
    menu = (root / 'original/DATA/MENU.DAT').read_bytes()
    dungeon = json.loads((root / 'reports/navigation/dungeon-animation.json').read_text())
    trace.require(dungeon['executableSha256'] == trace.PROFILE and dungeon['detailMode'] == 1, 'Repeat dungeon trace')
    positions = []
    for x in (0, 31, 32, 319):
        for y in (0, 99, 100, 199):
            machine = trace.Machine(exe)
            machine.uc.mem_write(trace.DATA_ADDRESS + 0xad5, b'\1')
            def mouse(uc, address, size, context):
                if address == trace.LOAD_ADDRESS + 0xdd34 - 512:
                    uc.reg_write(UC_X86_REG_CX, x)
                    uc.reg_write(UC_X86_REG_DX, y)
                    uc.reg_write(UC_X86_REG_IP, uc.reg_read(UC_X86_REG_IP) + 3)
            machine.uc.hook_add(UC_HOOK_CODE, mouse)
            machine.execute(0xdd2d, 0xdd4e)
            offset = machine.word(0xb608)
            trace.require(offset in (0, 0x4980), 'Unexpected bar row')
            positions.append({'x': x, 'y': y, 'barY': offset // 112, 'selectionX': machine.word(0xb60a) // 32 * 32})
    machine = trace.Machine(exe)
    machine.uc.mem_write(0x60000, sprites)
    for at, value in ((0xd57a, 0x6000), (0xd57e, 0x8000), (0xd580, 0x9000)):
        machine.uc.mem_write(trace.LOAD_ADDRESS + at, struct.pack('<H', value))
    machine.uc.mem_write(trace.DATA_ADDRESS + 0x2c2b, bytes(dungeon['initial'][0]))
    calls = []
    def drawing(uc, address, size, context):
        offset = address - trace.LOAD_ADDRESS + 512
        if offset == 0xe112:
            uc.reg_write(UC_X86_REG_IP, uc.reg_read(UC_X86_REG_IP) + 3)
        elif offset in (0xe195, 0xe0d5, 0xe0e8):
            stack = uc.reg_read(UC_X86_REG_SP)
            x, y = struct.unpack('<HH', uc.mem_read(0x70000 + stack, 4))
            segment = uc.reg_read(UC_X86_REG_DS)
            frame = next((n for n in range(10) if segment == 0x6000 + struct.unpack_from('<H', sprites, n * 2)[0]), None)
            calls.append({'frame': frame, 'x': x, 'y': y, 'blockedOverlay': offset != 0xe195})
            uc.reg_write(UC_X86_REG_IP, uc.reg_read(UC_X86_REG_IP) + 3)
    machine.uc.hook_add(UC_HOOK_CODE, drawing)
    machine.execute(0xe096, 0xe0f7)
    trace.require(len(calls) == 12 and [c['frame'] for c in calls[:10]] == list(range(10)), 'Unexpected initial icons')
    handlers = [machine.word(0xb60c + n * 2) + 512 for n in range(10)]
    trace.require(handlers[1:3] == [0xe096, 0xe096], 'Unexpected disabled actions')
    selection_machine = trace.Machine(exe)
    selection_machine.execute(0xdd1c, 0xdd2d)
    initial_counter = selection_machine.word(0xb63a)
    initial_index = selection_machine.word(0xb63c)
    for _ in range(96):
        # 0xDCDC AND AL,FC termina la copia previa con CF=0.
        selection_machine.uc.reg_write(UC_X86_REG_EFLAGS, 2)
        selection_machine.execute(0xdd53, 0xdd8e)
    colors = list(exe[0x1ab4e:0x1ab4e+72])
    trace.require(initial_counter == 1 and initial_index == 0, 'Unexpected selection initial phase')
    trace.require(len(selection_machine.frames) == 24, 'Unexpected selection period')
    trace.require(all(frame['firstIndex'] == 255 and frame['rgb6'] == colors[i*3:i*3+3]
                      for i, frame in enumerate(selection_machine.frames)), 'Unexpected selection palette cycle')
    report = {'schemaVersion': 1, 'executableSha256': trace.PROFILE,
              'sources': {name: hashlib.sha256((root / 'original/DATA' / name).read_bytes()).hexdigest()
                          for name in ('MENU.DAT', 'ICONS.SPR', 'MOUSE.SPR', 'SPRITES.PAL', 'DUNGEON.MAP')},
              'positions': positions, 'calls': calls, 'initialHandlers': handlers,
              'width': 320, 'height': 32,
              'selection': {'xInset': 3, 'yInset': 3, 'width': 26, 'height': 26},
              'selectionAnimation': {'modalCyclesPerColor': 4, 'colors': 24, 'testedModalCycles': 96},
              'selectionColorsRgb6': list(exe[0x1ab4e:0x1ab4e+72]),
              'limitations': ['Isolated calls and synthetic mouse; no physical timing capture',
                              'Initial DUNGEON layout only; action execution is covered separately by trace-dungeon-actions.py']}
    (root / 'reports/navigation/original-hud.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({'positions': len(positions), 'icons': 10, 'blocked': [1, 2]}))


if __name__ == '__main__':
    main()
