"""Verificar selección BRD mediante scripts originales aislados.

No ejecuta una partida completa. Las condiciones de entrada y posiciones fuera de
pantalla son explícitas; se conserva la rutina original y se emulan solo lecturas DOS.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

from unicorn.x86_const import (
    UC_X86_REG_AX, UC_X86_REG_BX, UC_X86_REG_CX, UC_X86_REG_DX,
    UC_X86_REG_DS, UC_X86_REG_EFLAGS, UC_X86_REG_SI,
)


def main():
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=root / 'reports/exe/brd-script-verification.json')
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('palette_trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = (root / 'original/CURSE.EXE').read_bytes()

    class ScriptMachine(trace.Machine):
        def __init__(self):
            self.files = []
            self.current_file = None
            super().__init__(exe)
            for offset, segment in [(0x10, 0x4000), (0x0e, 0x5000)]:
                self.uc.mem_write(trace.LOAD_ADDRESS + offset, struct.pack('<H', segment))
            self.uc.mem_write(0x50000, (root / 'original/DATA/STD.BRD').read_bytes())

        def interrupt(self, uc, number, _):
            ah = uc.reg_read(UC_X86_REG_AX) >> 8
            trace.require(number == 0x21 and ah in (0x3d, 0x3f, 0x3e), 'Unexpected DOS interrupt')
            address = uc.reg_read(UC_X86_REG_DS) * 16 + uc.reg_read(UC_X86_REG_DX)
            if ah == 0x3d:
                name = bytes(uc.mem_read(address, 40)).split(b'\0')[0].decode('ascii').upper()
                trace.require(name in ('CHANGE.BRD', 'CASTLE.BRD'), 'Unexpected BRD filename')
                self.current_file = name
                self.files.append(name)
                uc.reg_write(UC_X86_REG_AX, 5)
            elif ah == 0x3f:
                trace.require(self.current_file is not None and uc.reg_read(UC_X86_REG_BX) == 5, 'Invalid file handle')
                data = (root / 'original/DATA' / self.current_file).read_bytes()
                trace.require(uc.reg_read(UC_X86_REG_CX) == 0xfa00 and address == 0x40000, 'Unexpected read buffer')
                uc.mem_write(address, data)
                uc.reg_write(UC_X86_REG_AX, len(data))
            else:
                trace.require(uc.reg_read(UC_X86_REG_BX) == 5, 'Invalid close handle')
            uc.reg_write(UC_X86_REG_EFLAGS, uc.reg_read(UC_X86_REG_EFLAGS) & ~1)

    cases = [
        (25, 'CHANGE.MAP', 'CHANGE.BRD', 0x450f, 0x454b, 0x1b8e, [0, 1, 2, 3, 4]),
        (72, 'FINAL.MAP', 'CASTLE.BRD', 0x4b25, 0x4b4b, 0x2b61, [22]),
    ]
    results = []
    shared = (root / 'original/DATA/SPRITES.PAL').read_bytes()
    for resource, map_name, brd, start, stop, script, expected in cases:
        machine = ScriptMachine()
        machine.set_word(0x8082, resource)
        machine.uc.mem_write(trace.DATA_ADDRESS + 0x35ca, b'\0')
        map_data = (root / 'original/DATA' / map_name).read_bytes()
        palette = map_data[:576] + shared[576:768]
        machine.uc.mem_write(trace.DATA_ADDRESS + 0xaef, palette)
        machine.execute(start, stop)
        pointer = machine.word(0xad7 if resource == 25 else 0x2c3b)
        trace.require(pointer == script, 'Unexpected installed script')
        if resource == 25:
            # Copia original de los canales pendientes al actor, una vez terminada la ruta.
            machine.execute(0xbe2, 0xbf1)
            trace.require(machine.word(0x2c3b) == script, 'Script was not copied to actor')
        actor = 0x2c2b
        machine.uc.mem_write(trace.DATA_ADDRESS + actor, bytes(16))
        machine.uc.mem_write(trace.DATA_ADDRESS + actor, b'\x01\x09')
        machine.set_word(actor + 2, 500)  # Omite sonido mediante el recorte original.
        machine.set_word(actor + 6, 32)
        machine.set_word(actor + 8, 48)
        machine.set_word(actor + 0x1f, 0x5000)
        machine.uc.mem_write(trace.DATA_ADDRESS + actor + 0x13, b'\x01\x01')
        machine.uc.reg_write(UC_X86_REG_SI, actor)
        frames = []
        for tick in range(400):
            machine.uc.reg_write(UC_X86_REG_BX, machine.word(actor + 0x10))
            machine.execute(0x85fc, 0x8800)
            if machine.word(actor + 0x1f) == 0x4000:
                frame = machine.uc.mem_read(trace.DATA_ADDRESS + actor + 1, 1)[0] & 127
                if frame not in frames:
                    frames.append(frame)
            if machine.word(actor + 0x10) == 0:
                break
        trace.require(machine.word(actor + 0x10) == 0, 'Script did not end')
        trace.require(machine.files == [brd] and frames == expected, 'Unexpected script selection')
        trace.require(machine.word(0x8082) == resource and not machine.frames, 'Script changed resource or wrote the DAC')
        trace.require(bytes(machine.uc.mem_read(trace.DATA_ADDRESS + 0xaef, 768)) == palette, 'Palette buffer changed')
        # Una sala distinta debe rechazar la misma rama antes de instalar la secuencia.
        negative = ScriptMachine()
        negative.set_word(0x8082, resource - 1)
        negative.execute(start, 0x8aa0)
        trace.require(not negative.files and negative.word(0xad7 if resource == 25 else 0x2c3b) != script,
                      'Resource gate accepted the wrong scene')
        results.append({
            'resourceId': resource, 'map': map_name, 'source': brd,
            'gateFileOffset': start, 'scriptFileOffset': 0xf510 + script,
            'selectedFrames': frames, 'ticks': tick + 1, 'wrongResourceRejected': True,
            'paletteUnchanged': True, 'dacWrites': 0,
            'sourceSha256': hashlib.sha256((root / 'original/DATA' / brd).read_bytes()).hexdigest(),
            'mapSha256': hashlib.sha256(map_data).hexdigest(),
        })
    # Acción final: el despacho exige los objetos 177 y 175, no un recurso.
    # Se comprueba por separado la creación original del objetivo en FINAL.
    machine = ScriptMachine()
    machine.set_word(0x8082, 72)
    scene_data = (root / 'original/DATA/FINAL.SPR').read_bytes()
    machine.uc.mem_write(0x60000, scene_data)
    machine.uc.mem_write(trace.LOAD_ADDRESS + 0x4aee, struct.pack('<H', 0x6000))
    machine.uc.mem_write(trace.DATA_ADDRESS + 0xad6, b'\0')
    machine.execute(0x8ca6, 0x8d6e)
    targets = [0x2c4c + index * 33 for index in range(machine.word(0x3588) - 2)
               if machine.word(0x2c4c + index * 33 + 14) == 177]
    trace.require(len(targets) == 1 and machine.uc.mem_read(trace.DATA_ADDRESS + targets[0], 1)[0] != 0,
                  'Original loader did not create active object 177 in FINAL')
    map_data = (root / 'original/DATA/FINAL.MAP').read_bytes()
    palette = map_data[:576] + shared[576:768]
    machine.uc.mem_write(trace.DATA_ADDRESS + 0xaef, palette)
    machine.uc.reg_write(UC_X86_REG_AX, 177)
    machine.uc.reg_write(UC_X86_REG_BX, 175)
    machine.execute(0x438a, 0x4c2f)
    trace.require(machine.word(0x2c3b) == 0x2ba8, 'Final action did not install expected script')
    actor = 0x2c2b
    machine.uc.mem_write(trace.DATA_ADDRESS + actor, bytes(16))
    machine.uc.mem_write(trace.DATA_ADDRESS + actor, b'\x01\x09')
    machine.set_word(actor + 2, 500)
    machine.set_word(actor + 0x1f, 0x5000)
    machine.uc.mem_write(trace.DATA_ADDRESS + actor + 0x13, b'\x01\x01')
    machine.uc.reg_write(UC_X86_REG_SI, actor)
    frames = []
    for tick in range(400):
        machine.uc.reg_write(UC_X86_REG_BX, machine.word(actor + 0x10))
        machine.execute(0x85fc, 0x8800)
        if machine.word(actor + 0x1f) == 0x4000:
            frame = machine.uc.mem_read(trace.DATA_ADDRESS + actor + 1, 1)[0] & 127
            if frame not in frames:
                frames.append(frame)
            if frame == 25:
                break
    trace.require(frames == [23, 24, 25] and machine.files == ['CASTLE.BRD'], 'Final CASTLE selection mismatch')
    trace.require(machine.word(0x8082) == 72 and not machine.frames, 'Final script changed scene or DAC')
    trace.require(bytes(machine.uc.mem_read(trace.DATA_ADDRESS + 0xaef, 768)) == palette, 'Final palette changed')
    for target, item in [(176, 175), (177, 174)]:
        negative = ScriptMachine()
        negative.uc.reg_write(UC_X86_REG_AX, target)
        negative.uc.reg_write(UC_X86_REG_BX, item)
        negative.execute(0x438a, 0x8aa0)
        trace.require(negative.word(0x2c3b) != 0x2ba8, 'Wrong action pair accepted')
    results.append({
        'resourceId': 72, 'map': 'FINAL.MAP', 'source': 'CASTLE.BRD',
        'actionDispatchFileOffset': 0x438a, 'scriptFileOffset': 0xf510 + 0x2ba8,
        'targetObjectId': 177, 'itemObjectId': 175, 'originalTargetCreated': True,
        'selectedFrames': frames, 'ticks': tick + 1, 'stopAfterFrame': 25,
        'wrongActionPairsRejected': True, 'paletteUnchanged': True, 'dacWrites': 0,
        'resourceScope': 'Initial target location and explicit active FINAL context; dispatch checks object IDs, not resource ID',
        'sourceSha256': hashlib.sha256((root / 'original/DATA/CASTLE.BRD').read_bytes()).hexdigest(),
        'sceneSpritesSha256': hashlib.sha256(scene_data).hexdigest(),
        'mapSha256': hashlib.sha256(map_data).hexdigest(),
    })
    manifest = json.loads((root / 'reports/brd/manifest.json').read_text(encoding='utf-8'))
    trace.require(manifest['executableSha256'] == trace.PROFILE, 'Unverified export executable')
    recorded = manifest['scriptContexts']
    trace.require(len(recorded) == 2, 'Unexpected script context count')
    for context, observed in zip(recorded, [results[0], results[-1]]):
        trace.require(context['frames'] == observed['selectedFrames']
                      and context['resourceId'] == observed['resourceId']
                      and context['map'] == observed['map']
                      and context['source'] == observed['source'], 'Export context differs from original selection')
        exported = next(row for row in manifest['results'] if row['source'] == context['source'])
        trace.require(exported['sourceSha256'] == observed['sourceSha256'], 'Stale BRD export')
        for frame in exported['contextual']:
            variants = [variant for variant in frame['variants'] if variant['status'] == 'original-script-frame-selection']
            trace.require(bool(variants) == (frame['index'] in observed['selectedFrames']), 'Unobserved frame exported as script-verified')
            for variant in variants:
                trace.require(variant['map'] == observed['map'] and variant['mapSha256'] == observed['mapSha256'], 'Wrong exported palette context')
    report = {
        'status': 'matched-original-instructions', 'executableSha256': trace.PROFILE,
        'scope': 'Resource gates, script installation, BRD loading and frame selection only; no full-game reachability or timing claim',
        'syntheticInputs': {'actorX': 500, 'initialFrame': 9, 'initialSpeed': 1, 'castleState': 0},
        'sharedSha256': hashlib.sha256(shared).hexdigest(), 'results': results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
