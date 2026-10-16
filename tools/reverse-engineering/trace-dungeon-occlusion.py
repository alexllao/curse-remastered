"""Contrastar los primeros planos de DUNGEON y sus escrituras VGA, sin audio."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
from unicorn import UC_HOOK_CODE, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_AX, UC_X86_REG_DS, UC_X86_REG_ES, UC_X86_REG_SI, UC_X86_REG_SP


def main():
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location('trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = (root / 'original/CURSE.EXE').read_bytes()
    sprites = (root / 'original/DATA/DUNGEON.SPR').read_bytes()
    dungeon = json.loads((root / 'reports/navigation/dungeon-animation.json').read_text())
    trace.require(dungeon['executableSha256'] == trace.PROFILE and dungeon['detailMode'] == 1,
                  'Repeat detailed dungeon trace')
    trace.require(dungeon['sourceSha256']['DUNGEON.SPR'] == hashlib.sha256(sprites).hexdigest(),
                  'Dungeon sprites changed')

    class VgaMachine(trace.Machine):
        def __init__(self):
            self.mask = 0
            self.writes = {}
            super().__init__(exe)
        def output_port(self, uc, port, size, value, context):
            trace.require(size == 1 and port in (0x3c4, 0x3c5), 'Unexpected blitter output')
            if port == 0x3c4:
                trace.require(value == 2, 'Unexpected sequencer register')
            else:
                trace.require(value in (1, 2, 4, 8), 'Unexpected VGA map mask')
                self.mask = value
        def capture_write(self, uc, access, address, size, value, context):
            if not 0x70000 <= address < 0x78000:
                return
            trace.require(self.mask != 0, 'VGA write without plane selection')
            for n in range(size):
                offset = address - 0x70000 + n
                y, column = divmod(offset, 112)
                plane = self.mask.bit_length() - 1
                x = column * 4 + plane
                trace.require(x < 320 and y < 200, 'Blitter wrote outside visible viewport')
                self.writes[y * 320 + x] = (value >> (n * 8)) & 255

    pieces = []
    for frame, x, y in ((1, 0, 169), (2, 265, 99)):
        machine = VgaMachine()
        machine.uc.mem_write(0x60000, sprites)
        for row in range(200):
            machine.uc.mem_write(trace.LOAD_ADDRESS + 0x6bfc + row * 2, struct.pack('<H', row * 112))
        machine.uc.mem_write(trace.LOAD_ADDRESS + 0xbf7, b'\0')
        machine.uc.reg_write(UC_X86_REG_DS, 0x6000 + struct.unpack_from('<H', sprites, frame * 2)[0])
        machine.uc.reg_write(UC_X86_REG_ES, 0x7000)
        machine.uc.reg_write(UC_X86_REG_SI, 0)
        machine.uc.reg_write(UC_X86_REG_AX, 0)
        machine.uc.mem_write(0x70000 + machine.uc.reg_read(UC_X86_REG_SP) + 2, struct.pack('<HH', x, y))
        machine.uc.hook_add(UC_HOOK_MEM_WRITE, machine.capture_write)
        machine.execute(0x6f8c, 0x746c)
        pieces.append({'frame': frame, 'x': x, 'y': y, 'writes': sorted(machine.writes.items())})

    # Ejecutar la selección real con todos los estados capturados: incluir la rata.
    machine = trace.Machine(exe)
    machine.uc.mem_write(0x60000, sprites)
    machine.uc.mem_write(trace.LOAD_ADDRESS + 0x4aee, struct.pack('<H', 0x6000))
    machine.uc.mem_write(trace.DATA_ADDRESS + 0xad6, b'\1')
    machine.set_word(0x8082, 0)
    machine.execute(0x8ca6, 0x8d6e)
    draws = []
    def capture(uc, address, size, context):
        if address == trace.LOAD_ADDRESS + 0xee6e - 512:
            # La CALL solo recibe la pieza; el blitter se contrasta arriba.
            draws.append(list(struct.unpack('<HH', uc.mem_read(0x70000 + uc.reg_read(UC_X86_REG_SP), 4))))
            uc.reg_write(trace.UC_X86_REG_IP, uc.reg_read(trace.UC_X86_REG_IP) + 3)
    machine.uc.hook_add(UC_HOOK_CODE, capture)
    cases = []
    for tick, actors in enumerate([dungeon['initial'], *dungeon['ticks']]):
        machine.uc.mem_write(trace.DATA_ADDRESS + 0x2c2b, bytes(v for actor in actors for v in actor))
        draws.clear()
        machine.execute(0xee12, 0xee89)
        cases.append({'tick': tick, 'draws': draws.copy()})
    report = {'schemaVersion': 1, 'executableSha256': trace.PROFILE,
              'spriteSha256': hashlib.sha256(sprites).hexdigest(), 'pieces': pieces, 'cases': cases,
              'limitations': ['Isolated VGA map-mask writes; not a DOS gameplay capture',
                              'No physical timing, palette DAC execution or room interactions']}
    (root / 'reports/navigation/dungeon-occlusion.json').write_text(json.dumps(report, separators=(',', ':'))+'\n')
    print(json.dumps({'pieces': len(pieces), 'states': len(cases), 'paintedPixels': [len(p['writes']) for p in pieces]}))


if __name__ == '__main__':
    main()
