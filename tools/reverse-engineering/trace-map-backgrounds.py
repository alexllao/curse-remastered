"""Compare extracted MAP strips with the original RNC2 routine and VGA blitter.

Isolated instruction tests only: no DOSBox, no game modifications, no timing claims.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

from unicorn import UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_AX, UC_X86_REG_BX, UC_X86_REG_CX, UC_X86_REG_DI, UC_X86_REG_DS, UC_X86_REG_ES, UC_X86_REG_SI, UC_X86_REG_EFLAGS


def main():
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=root / 'reports/scenes/backgrounds/manifest.json')
    parser.add_argument('--exe', type=Path, default=root / 'original/CURSE.EXE')
    parser.add_argument('--output', type=Path, default=root / 'reports/exe/map-background-verification.json')
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('palette_trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = args.exe.read_bytes()
    machine = trace.Machine(exe)
    report = json.loads(args.manifest.read_text(encoding='utf-8'))
    trace.require(report['executableSha256'] == trace.PROFILE, 'Unverified manifest executable')
    verified = []
    seen = set()
    for scene in report['results']:
        trace.require(scene['status'] == 'decoded', 'Background export is incomplete')
        data = (root / 'original/DATA' / scene['map']).read_bytes()
        trace.require(hashlib.sha256(data).hexdigest() == scene['hashes']['map'], 'MAP hash mismatch')
        for strip in scene['strips']:
            key = (scene['map'], strip['fileOffset'])
            if key in seen:
                continue
            seen.add(key)
            offset = strip['fileOffset']
            packed = data[offset:offset + strip['packedBytes']]
            trace.require(packed[:4] == b'RNC\x02' and struct.unpack_from('>I', packed, 4)[0] == 6400, 'Invalid strip header')
            trace.require(len(packed) == struct.unpack_from('>I', packed, 8)[0] + 18, 'Invalid compressed span')
            expected = (args.manifest.parent / scene['output'] / 'strips' / (str(strip['index']).zfill(3) + '.bin')).read_bytes()
            trace.require(hashlib.sha256(expected).hexdigest() == strip['sha256'], 'Exported strip hash mismatch')
            machine.uc.mem_write(0x40000, packed)
            machine.uc.mem_write(0x50000, b'\xa5' * 6400)
            for register, value in [(UC_X86_REG_DS, 0x4000), (UC_X86_REG_ES, 0x5000),
                                    (UC_X86_REG_SI, 0), (UC_X86_REG_DI, 0), (UC_X86_REG_EFLAGS, 2)]:
                machine.uc.reg_write(register, value)
            machine.execute(0x69bc, 0x6ba1)
            actual = bytes(machine.uc.mem_read(0x50000, 6400))
            trace.require(actual == expected, f'Original decompressor mismatch: {key}')
            verified.append({'map': scene['map'], 'strip': strip['index'], 'fileOffset': offset, 'sha256': strip['sha256']})

    class Blitter(trace.Machine):
        def __init__(self, original):
            self.mask = 0
            self.planes = [bytearray(65536) for _ in range(4)]
            super().__init__(original)
            self.uc.hook_add(UC_HOOK_MEM_WRITE, self.video_write, None, 0x80000, 0x8ffff)

        def output_port(self, uc, port, size, value, userdata):
            if port == 0x3c4:
                trace.require(size == 1 and value == 2, 'Unexpected sequencer index')
            elif port == 0x3c5:
                trace.require(size == 1 and value in (1, 2, 4, 8), 'Unexpected plane mask')
                self.mask = value
            else:
                super().output_port(uc, port, size, value, userdata)

        def video_write(self, _uc, _access, address, size, value, _userdata):
            trace.require(size == 1 and self.mask in (1, 2, 4, 8), 'Unexpected VGA memory operation')
            self.planes[self.mask.bit_length() - 1][address - 0x80000] = value

    blitter = Blitter(exe)
    pattern = bytes((x * 7 + y * 13) % 256 for y in range(200) for x in range(32))
    blitter.uc.mem_write(0x40000, pattern)
    for register, value in [(UC_X86_REG_DS, 0x4000), (UC_X86_REG_ES, 0x8000), (UC_X86_REG_DI, 0),
                            (UC_X86_REG_AX, 32), (UC_X86_REG_BX, 200), (UC_X86_REG_CX, 320)]:
        blitter.uc.reg_write(register, value)
    blitter.execute(0x7836, 0x7874)
    for y in range(200):
        for x in range(32):
            trace.require(blitter.planes[x % 4][y * 80 + x // 4] == pattern[y * 32 + x], 'VGA layout mismatch')
    summary = {'status': 'matched-original-instructions', 'executableSha256': trace.PROFILE,
               'scope': 'Original RNC2 outputs and synthetic VGA blit only; not a game capture',
               'resourceBackgrounds': len(report['results']), 'uniqueMapStripsVerified': len(verified),
               'vgaRowMajorLayoutVerified': True, 'decompressor': '0x69BC-0x6BA1', 'blitter': '0x7836-0x7874'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({**summary, 'strips': verified}, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
