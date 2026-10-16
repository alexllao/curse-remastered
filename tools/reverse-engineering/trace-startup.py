"""Capturar la espera y el fundido CORE → TITLE con el código original."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_AX, UC_X86_REG_BX, UC_X86_REG_CX, UC_X86_REG_DX, UC_X86_REG_DS, UC_X86_REG_IP, UC_X86_REG_EFLAGS


def main():
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location('trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = (root / 'original/CURSE.EXE').read_bytes()

    class StartupMachine(trace.Machine):
        def __init__(self):
            self.ticks, self.index = 0, 0
            self.dac, self.timeline, self.loads = [0] * 768, [], []
            self.visible, self.file = None, b''
            super().__init__(exe)

        def interrupt(self, uc, number, _):
            ax = uc.reg_read(UC_X86_REG_AX)
            trace.require(number == 0x21, 'Unexpected startup interrupt')
            if ax >> 8 == 0x48:
                size = uc.reg_read(UC_X86_REG_BX)
                trace.require(size in (0xfa1, 0xf0), 'Unexpected startup allocation')
                uc.reg_write(UC_X86_REG_AX, 0x4000 if size == 0xfa1 else 0x5000)
            elif ax >> 8 == 0x3d:
                at = uc.reg_read(UC_X86_REG_DS) * 16 + uc.reg_read(UC_X86_REG_DX)
                name = bytes(uc.mem_read(at, 24)).split(b'\0')[0].decode('ascii').upper()
                trace.require(name in ('CORE.PAL', 'CORE.DAT', 'TITLE.PAL', 'TITLE.DAT'), 'Unexpected startup resource')
                self.file = (root / 'original/DATA' / name).read_bytes()
                self.loads.append(name)
                uc.reg_write(UC_X86_REG_AX, 5)
            elif ax >> 8 == 0x3f:
                data = self.file[:uc.reg_read(UC_X86_REG_CX)]
                uc.mem_write(uc.reg_read(UC_X86_REG_DS) * 16 + uc.reg_read(UC_X86_REG_DX), data)
                uc.reg_write(UC_X86_REG_AX, len(data))
            else:
                trace.require(ax >> 8 in (0x3e, 0x49), 'Unsupported startup DOS service')
            uc.reg_write(UC_X86_REG_EFLAGS, uc.reg_read(UC_X86_REG_EFLAGS) & ~1)

        def input_port(self, uc, port, size, _):
            trace.require(port == 0x3da and size == 1, 'Unexpected startup input')
            at = uc.reg_read(UC_X86_REG_IP) + 512
            instruction = exe[at:at + 5]
            if instruction == bytes.fromhex('ec a8 08 74 fb'):
                self.ticks += 1
                return 8
            trace.require(instruction[:3] == bytes.fromhex('ec a8 08'), 'Unknown startup wait')
            return 0

        def output_port(self, _uc, port, size, value, _):
            if port == 0x3c8 and size == 1:
                self.index = value * 3
            elif port == 0x3c9 and size == 1:
                trace.require(value <= 63 and self.index < 768, 'Unexpected startup DAC')
                self.dac[self.index] = value
                self.index += 1
                if self.index == 768 and self.visible:
                    event = {'tick': self.ticks, 'file': self.visible, 'rgb6': self.dac.copy()}
                    if self.timeline and self.timeline[-1]['tick'] == self.ticks and self.timeline[-1]['file'] == self.visible:
                        self.timeline[-1] = event
                    else:
                        self.timeline.append(event)
            else:
                trace.require(port in (0x3d4, 0x3c4) and size == 2, 'Unexpected startup VGA output')

    machine = StartupMachine()
    machine.uc.mem_write(trace.LOAD_ADDRESS + 8, struct.pack('<H', 0xa000))

    def substitute(uc, address, _size, _):
        at = address - trace.LOAD_ADDRESS + 512
        # Se sustituyen únicamente la descompresión y los copiadores VGA.
        if at not in (0x6d1, 0x6e9, 0x77c, 0x7bd, 0x7d5):
            return
        if at == 0x6e9:
            machine.visible = 'CORE.DAT'
        elif at == 0x7d5:
            machine.visible = 'TITLE.DAT'
        uc.reg_write(UC_X86_REG_IP, uc.reg_read(UC_X86_REG_IP) + 3)

    machine.uc.hook_add(UC_HOOK_CODE, substitute)
    machine.execute(0x68d, 0x812)
    core = [event for event in machine.timeline if event['file'] == 'CORE.DAT']
    trace.require(len(core) == 33 and core[0]['tick'] == 0, 'Unexpected CORE palette events')
    trace.require(core[1]['tick'] == 2101 and not any(core[-1]['rgb6']), 'Unexpected CORE hold/fade')
    trace.require(machine.loads == ['CORE.PAL', 'CORE.DAT', 'TITLE.PAL', 'TITLE.DAT'], 'Unexpected startup order')
    report = {'schemaVersion': 1, 'executableSha256': trace.PROFILE,
              'sourceSha256': {name: hashlib.sha256((root / 'original/DATA' / name).read_bytes()).hexdigest() for name in machine.loads},
              'holdTicks': 2100, 'durationTicks': machine.ticks, 'events': core,
              'limitations': ['No injected skip input', 'Synthetic VGA retraces; physical timing not measured', 'No audio or VGA copying']}
    (root / 'reports/navigation/startup.json').write_text(json.dumps(report, separators=(',', ':')) + '\n')
    print(json.dumps({'holdTicks': report['holdTicks'], 'durationTicks': machine.ticks, 'paletteEvents': len(core)}))


if __name__ == '__main__':
    main()

