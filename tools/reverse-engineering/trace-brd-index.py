"""Contrastar el acceso a la tabla SMALL con instrucciones originales aisladas.

El ensayo no deduce cuántos fotogramas usa una partida. Un marcador sintético
fuera del archivo permite comprobar si el lector original valida sus límites.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

from unicorn import UC_HOOK_MEM_READ
from unicorn.x86_const import UC_X86_REG_AX, UC_X86_REG_SI


def main():
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=root / 'reports/exe/small-index-verification.json')
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('palette_trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = (root / 'original/CURSE.EXE').read_bytes()
    data = (root / 'original/DATA/SMALL.BRD').read_bytes()
    results = []
    for index in (0, 117, 118):
        machine = trace.Machine(exe)
        source_base = 0x40000
        machine.uc.mem_write(source_base, data)
        paragraph = struct.unpack_from('<H', data, index * 2)[0]
        byte_offset = paragraph * 16
        header_in_file = byte_offset + 4 <= len(data)
        address = source_base + byte_offset
        reads = []
        def capture(_uc, _access, at, size, _value, _userdata):
            reads.append({'address': at, 'bytes': size})
        machine.uc.hook_add(UC_HOOK_MEM_READ, capture, None, address, address + 3)
        if not header_in_file:
            # No se atribuye este contenido sintético al juego original.
            machine.uc.mem_write(address, struct.pack('<HH', 0x1234, 0x5678))
        actor = 0x2c2b
        machine.set_word(actor + 0x1f, source_base // 16)
        machine.uc.reg_write(UC_X86_REG_SI, actor)
        machine.uc.reg_write(UC_X86_REG_AX, index)
        machine.execute(0x87de, 0x8800)
        actual = (machine.word(actor + 6), machine.word(actor + 8))
        expected = struct.unpack_from('<HH', data, byte_offset) if header_in_file else (0x1234, 0x5678)
        trace.require(actual == expected and len(reads) == 2, 'Unexpected original header access')
        results.append({
            'index': index, 'rawParagraph': paragraph, 'byteOffset': byte_offset,
            'headerInsideSourceFile': header_in_file,
            'dimensions': list(actual) if header_in_file else None,
            'syntheticOutsideMarkerConsumed': not header_in_file,
            'emulatedReads': reads,
        })
    trace.require(results[-1]['byteOffset'] == 258048 and len(data) == 41520, 'Unexpected SMALL revision')
    report = {
        'status': 'matched-original-instructions', 'executableSha256': trace.PROFILE,
        'sourceSha256': hashlib.sha256(data).hexdigest(), 'sourceBytes': len(data),
        'lookupFileOffsets': ['0x87DE', '0x8800'], 'results': results,
        'conclusion': 'The original lookup does not validate the file boundary. Entry 118 would read beyond SMALL.BRD if selected; whether normal gameplay selects it remains unverified. Preserve valid-prefix-only.',
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
