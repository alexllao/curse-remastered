"""Contrastar el cargador BOXDET y consultas rectangulares originales aisladas.

Emula DOS, no una partida. Los casos de consulta usan rectángulos sintéticos.
"""
import importlib.util
import hashlib
import json
from pathlib import Path
import struct
from unicorn.x86_const import (
    UC_X86_REG_AX, UC_X86_REG_BX, UC_X86_REG_CX, UC_X86_REG_DX,
    UC_X86_REG_DS, UC_X86_REG_EFLAGS,
)


def main():
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location('trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = (root / 'original/CURSE.EXE').read_bytes()
    data = (root / 'original/DATA/BOXDET.DAT').read_bytes()

    class BoxMachine(trace.Machine):
        def __init__(self):
            self.cursor = 0
            self.reads = []
            self.opened = False
            super().__init__(exe)

        def interrupt(self, uc, number, _):
            ax = uc.reg_read(UC_X86_REG_AX)
            ah = ax >> 8
            trace.require(number == 0x21, 'Unexpected interrupt')
            address = uc.reg_read(UC_X86_REG_DS) * 16 + uc.reg_read(UC_X86_REG_DX)
            bx = uc.reg_read(UC_X86_REG_BX)
            count = uc.reg_read(UC_X86_REG_CX)
            if ah == 0x3d:
                name = bytes(uc.mem_read(address, 12)).split(b'\0')[0]
                trace.require(name == b'boxdet.dat', 'Unexpected resource')
                self.cursor = 0
                self.opened = True
                uc.reg_write(UC_X86_REG_AX, 5)
            elif ah == 0x42:
                trace.require(self.opened and bx == 5 and ax == 0x4200 and count == 0, 'Unexpected seek')
                self.cursor = uc.reg_read(UC_X86_REG_DX)
                uc.reg_write(UC_X86_REG_AX, self.cursor)
                uc.reg_write(UC_X86_REG_DX, 0)
            elif ah == 0x3f:
                trace.require(self.opened and bx == 5 and self.cursor + count <= len(data), 'Invalid read')
                chunk = data[self.cursor:self.cursor + count]
                if chunk:
                    uc.mem_write(address, chunk)
                self.reads.append({'fileOffset': self.cursor, 'bytes': count})
                self.cursor += count
                uc.reg_write(UC_X86_REG_AX, count)
            elif ah == 0x48:
                trace.require(bx <= 0x1000, 'Unexpected allocation')
                uc.reg_write(UC_X86_REG_AX, 0x5000)
            elif ah == 0x3e:
                trace.require(self.opened and bx == 5, 'Invalid close')
                self.opened = False
            else:
                raise RuntimeError(f'Unsupported DOS service {ah:x}')
            uc.reg_write(UC_X86_REG_EFLAGS, uc.reg_read(UC_X86_REG_EFLAGS) & ~1)

    exports = json.loads((root / 'reports/navigation/boxdet.json').read_text())
    trace.require(exports['executableSha256'] == trace.PROFILE, 'Wrong export profile')
    trace.require(exports['sourceSha256'] == hashlib.sha256(data).hexdigest(), 'Wrong BOXDET source hash')
    results = []
    for resource in range(78):
        machine = BoxMachine()
        machine.set_word(0x8082, resource)
        machine.execute(0x524f, 0x52cc)
        pointer = struct.unpack_from('<H', data, resource * 2)[0]
        count = struct.unpack_from('<H', data, pointer)[0] if pointer else 0
        trace.require(machine.word(0xdf0) == count, 'Record count differs')
        if pointer:
            segment = struct.unpack('<H', machine.uc.mem_read(trace.LOAD_ADDRESS + 0x18, 2))[0]
            actual = bytes(machine.uc.mem_read(segment * 16, count * 10))
            trace.require(actual == data[pointer + 2:pointer + 2 + count * 10], 'Loaded bytes differ')
        records = exports['resources'][resource]['records']
        trace.require(len(records) == count, 'Exporter count differs')
        for index, record in enumerate(records):
            expected = struct.unpack_from('<BB4h', data, pointer + 2 + index * 10)
            actual = tuple(record[key] for key in ('type', 'argument', 'left', 'top', 'right', 'bottom'))
            trace.require(expected == actual, 'Exporter record differs')
        trace.require(not machine.opened, 'File remained open')
        results.append({'resourceId': resource, 'recordCount': count, 'reads': machine.reads})

    def query(records, box):
        machine = BoxMachine()
        machine.uc.mem_write(trace.LOAD_ADDRESS + 0x18, struct.pack('<H', 0x5000))
        machine.set_word(0xdf0, len(records))
        machine.uc.mem_write(0x50000, b''.join(struct.pack('<BB4h', *r) for r in records))
        # Deshabilitar el rectángulo dinámico previo con una región lejana explícita.
        for offset in (0x18f5, 0x18f7, 0x18f9, 0x18fb):
            machine.set_word(offset, 30000)
        for register, value in zip((UC_X86_REG_AX, UC_X86_REG_BX, UC_X86_REG_CX, UC_X86_REG_DX), box):
            machine.uc.reg_write(register, value & 65535)
        machine.execute(0x274a, 0x2ab1)
        trace.require(not machine.frames, 'Unexpected palette effect')
        return machine.uc.reg_read(UC_X86_REG_AX), machine.uc.reg_read(UC_X86_REG_BX) & 255

    region = (0, 7, 10, 20, 30, 40)
    cases = []
    for box, expected in [((30, 40, 30, 40), (1, 7)),
                          ((31, 40, 31, 40), (0, 40)),
                          ((9, 19, 10, 20), (1, 7)),
                          ((9, 19, 9, 19), (0, 19)),
                          ((-5, -5, -1, -1), (0, 251))]:
        actual = query([region], box)
        trace.require(actual[0] == expected[0] and (not actual[0] or actual[1] == expected[1]), 'Rectangle boundary differs')
        cases.append({'box': box, 'result': actual})
    trace.require(query([region, (0, 9, 10, 20, 30, 40)], (15, 25, 15, 25)) == (1, 9), 'Last type-zero overlap did not win')
    trace.require(query([(1, 3, 10, 20, 30, 40), region], (15, 25, 15, 25)) == (4, 3), 'Type-one action differs')
    trace.require(query([(3, 9, 10, 20, 30, 40), region], (15, 25, 15, 25)) == (8, 9), 'Type-three action differs')
    report = {'schemaVersion': 1, 'status': 'verified-isolated-execution',
              'executableSha256': trace.PROFILE, 'sourceSha256': exports['sourceSha256'],
              'loaderFileOffsets': [0x524f, 0x52cc], 'queryFileOffsets': [0x274a, 0x2ab1],
              'resources': results, 'syntheticBoundaryCases': cases,
              'overlapLastTypeZeroWins': True, 'typeOneAndThreeEarlyReturnVerified': True,
              'limitations': ['Synthetic DOS allocation and file services',
                              'Conditional type-two actions and dynamic actor rectangle not tested',
                              'No movement timing, pathfinding, camera or full-game validation']}
    output = root / 'reports/exe/boxdet-verification.json'
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'resources': len(results),
                      'records': sum(r['recordCount'] for r in results), 'syntheticCases': len(cases) + 3}))


if __name__ == '__main__':
    main()
