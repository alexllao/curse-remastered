"""Ejecutar el control de la presentación; capturar cargas y páginas VGA.

Sustituye la carga/descompresión de imágenes por capturas. Ejecuta los fundidos originales.
Las esperas usan retrazados sintéticos: no se afirman tiempos DOS reales.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_AX, UC_X86_REG_BX, UC_X86_REG_CX, UC_X86_REG_DX, UC_X86_REG_DI, UC_X86_REG_DS, UC_X86_REG_IP, UC_X86_REG_EFLAGS


def main():
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location('trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = (root / 'original/CURSE.EXE').read_bytes()
    class PresentationMachine(trace.Machine):
        def __init__(self):
            self.ticks = 0
            self.was_retrace = False
            self.visible_file = None
            self.timeline = []
            self.dac = [0] * 768
            self.dac_index = 0
            self.pages = {}
            self.loads = []
            self.frames = []
            self.palette_reads = []
            self.palette = None
            self.file = b''
            super().__init__(exe)
        def name(self):
            address = self.uc.reg_read(UC_X86_REG_DS) * 16 + self.uc.reg_read(UC_X86_REG_DX)
            return bytes(self.uc.mem_read(address, 24)).split(b'\0')[0].decode('ascii').upper()
        def interrupt(self, uc, number, _):
            ax = uc.reg_read(UC_X86_REG_AX)
            trace.require(number == 0x21, 'Unexpected interrupt')
            if ax >> 8 == 0x48:
                trace.require(uc.reg_read(UC_X86_REG_BX) in (0x1001, 0xf0), 'Unexpected allocation')
                uc.reg_write(UC_X86_REG_AX, 0x5000)
            elif ax >> 8 == 0x3d:
                self.palette = self.name()
                trace.require(self.palette in ('CAULDRN.PAL', 'BALCONY.PAL', 'BASEBALL.PAL'), 'Unexpected palette')
                self.palette_reads.append(self.palette)
                self.file = (root / 'original/DATA' / self.palette).read_bytes()
                uc.reg_write(UC_X86_REG_AX, 5)
            elif ax >> 8 == 0x3f:
                count = uc.reg_read(UC_X86_REG_CX)
                trace.require(count == len(self.file) == 768, 'Unexpected read')
                address = uc.reg_read(UC_X86_REG_DS) * 16 + uc.reg_read(UC_X86_REG_DX)
                uc.mem_write(address, self.file)
                uc.reg_write(UC_X86_REG_AX, count)
            else:
                trace.require(ax >> 8 in (0x3e, 0x49), 'Unexpected DOS service')
            uc.reg_write(UC_X86_REG_EFLAGS, uc.reg_read(UC_X86_REG_EFLAGS) & ~1)
        def input_port(self, uc, port, size, context):
            trace.require(port == 0x3da and size == 1, 'Unexpected input port')
            offset = uc.reg_read(UC_X86_REG_IP) + 512
            instruction = exe[offset:offset + 5]
            # Espera de flanco ascendente: IN / TEST 8 / JZ al mismo IN.
            # Las consultas previas ven fase baja; no alternar por cada lectura,
            # porque eso contaría flancos artificiales entre dos bucles contiguos.
            if instruction == bytes.fromhex('ec a8 08 74 fb'):
                self.ticks += 1
                return 8
            trace.require(instruction[:3] == bytes.fromhex('ec a8 08'), 'Unknown retrace wait')
            return 0
        def event(self, kind):
            if self.visible_file:
                event = {'tick': self.ticks, 'file': self.visible_file, 'kind': kind, 'rgb6': self.dac.copy()}
                if self.timeline and self.timeline[-1]['tick'] == self.ticks:
                    self.timeline[-1] = event
                else:
                    self.timeline.append(event)
        def output_port(self, uc, port, size, value, _):
            if port == 0x3c8 and size == 1:
                self.dac_index = value * 3
                return
            if port == 0x3c9 and size == 1:
                trace.require(value <= 63 and self.dac_index < 768, 'Unexpected DAC component')
                self.dac[self.dac_index] = value
                self.dac_index += 1
                if self.dac_index == 768:
                    self.event('palette')
                return
            if port == 0x3c4 and size == 2:
                return
            trace.require(port == 0x3d4 and size == 2, 'Unexpected VGA output')
            if value & 255 == 12:
                page = (value >> 8) << 8
                if page in self.pages:
                    self.visible_file = self.pages[page]
                    self.frames.append({'file': self.visible_file, 'palette': self.palette,
                                        'tick': self.ticks,
                                        'writerFileOffset': uc.reg_read(UC_X86_REG_IP) + 512})
                    self.event('page')
    # Referencias estáticas de arranque: CORE, TITLE y llamada a la introducción.
    for offset, expected in ((0x698, 'ba0609'), (0x6b0, 'ba0f09'), (0x784, 'baf208'), (0x79c, 'bafc08'), (0x871, 'e83e22')):
        trace.require(exe[offset:offset+3].hex() == expected, 'Startup reference differs')
    machine = PresentationMachine()
    title_palette = (root / 'original/DATA/TITLE.PAL').read_bytes()
    machine.dac = list(title_palette)
    machine.visible_file = 'TITLE.DAT'
    machine.uc.mem_write(trace.DATA_ADDRESS + 0xaef, title_palette)
    machine.event('initial')
    def capture(uc, address, _size, _):
        offset = address - trace.LOAD_ADDRESS + 512
        if offset == 0x7a8c:
            machine.event('palette')
        if not 0x2ab2 <= offset < 0x3118 or exe[offset] != 0xe8:
            return
        target = (offset + 3 + int.from_bytes(exe[offset+1:offset+3], 'little', signed=True) - 512) % 65536 + 512
        if target == 0x3150:
            name = machine.name()
            page = uc.reg_read(UC_X86_REG_DI)
            machine.pages[page] = name
            machine.loads.append({'file': name, 'page': page, 'callFileOffset': offset})
        else:
            return
        uc.reg_write(UC_X86_REG_IP, uc.reg_read(UC_X86_REG_IP) + 3)
    machine.uc.hook_add(UC_HOOK_CODE, capture)
    # El fundido final está antes de RET: ejecutar también la salida, sin el RET.
    machine.execute(0x2ab2, 0x314f)
    order = list(dict.fromkeys(frame['file'] for frame in machine.frames))
    expected = [f'CAULDRN{i}.DAT' for i in range(1,5)] + [f'BALCONY{i}.DAT' for i in range(1,6)] + [f'BASEBAL{i}.DAT' for i in range(1,7)] + ['BASEBAT.DAT']
    trace.require(order == expected, f'Unexpected presentation order: {order}')
    report = {'schemaVersion': 1, 'executableSha256': hashlib.sha256(exe).hexdigest(),
              'startupOrder': ['CORE.DAT', 'TITLE.DAT', 'presentation', 'logical-room--1'],
              'initialResource': 0, 'initialBrdSelector': 0,
              'sourceSha256': {name: hashlib.sha256((root / 'original/DATA' / name).read_bytes()).hexdigest() for name in ['TITLE.DAT', *expected]},
              'timeline': machine.timeline, 'durationTicks': machine.ticks,
              'loads': machine.loads, 'frames': machine.frames, 'uniqueImageOrder': order,
              'palettes': machine.palette_reads,
              'limitations': ['Original control flow, CRTC pages, DAC palettes and retrace counts; no audio or physical timing',
                              'Core/title ordering checked by static operands; intro can be skipped by input']}
    (root / 'reports/navigation/presentation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'order': order, 'pageSelections': len(machine.frames), 'ticks': machine.ticks, 'events': len(machine.timeline)}))


if __name__ == '__main__':
    main()




