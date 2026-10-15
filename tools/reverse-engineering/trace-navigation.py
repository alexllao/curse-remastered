"""Exportar paseo STD y contrastar recorridos, condiciones y umbrales de cámara.

Ensayos aislados con estado explícito; sin partida, uso de objetos ni render VGA.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_AX, UC_X86_REG_BX, UC_X86_REG_CX, UC_X86_REG_DX, UC_X86_REG_SI


def main():
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location('trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = (root / 'original/CURSE.EXE').read_bytes()
    brd = (root / 'original/DATA/STD.BRD').read_bytes()
    boxdet = json.loads((root / 'reports/navigation/boxdet.json').read_text())
    trace.require(hashlib.sha256(exe).hexdigest() == trace.PROFILE, 'Unknown executable')
    trace.require(boxdet['executableSha256'] == trace.PROFILE, 'Wrong BOXDET export')
    source = (root / 'original/DATA/BOXDET.DAT').read_bytes()
    trace.require(boxdet['sourceSha256'] == hashlib.sha256(source).hexdigest(), 'Wrong BOXDET hash')
    profile = {}
    for frame in (0, 9, 18, 128):
        for direction in (0, 1, 2, 4, 8):
            machine = trace.Machine(exe)
            machine.uc.mem_write(trace.DATA_ADDRESS + 0x2c2b, bytes(33))
            machine.uc.mem_write(trace.DATA_ADDRESS + 0x2c2b, bytes((1, frame)))
            machine.set_word(0x8082, 70)
            machine.uc.mem_write(trace.DATA_ADDRESS + 0x358c, b'\xff')
            machine.uc.reg_write(UC_X86_REG_SI, direction)
            if not direction:
                machine.set_word(0x2c3b, 0xa8e)
            machine.execute(0xdf8, 0x115e)
            profile[f'{frame}:{direction}'] = {
                'frame': machine.uc.mem_read(trace.DATA_ADDRESS + 0x2c2c, 1)[0],
                'channels': [{'pointer': machine.word(p),
                              'counter': machine.uc.mem_read(trace.DATA_ADDRESS + p + 3, 1)[0],
                              'period': machine.uc.mem_read(trace.DATA_ADDRESS + p + 4, 1)[0]}
                             for p in (0x2c3b, 0x2c40, 0x2c45)]}

    def trajectory(frame, target, records):
        machine = trace.Machine(exe)
        machine.uc.mem_write(trace.DATA_ADDRESS + 0x2c0a, bytes(70 * 33))
        machine.uc.mem_write(trace.DATA_ADDRESS + 0x2c2b, bytes((1, frame)))
        for off, val in ((0x2c2d, 145), (0x2c2f, 127), (0x2c31, 32), (0x2c33, 48),
                         (0x2c4a, 0x5000), (0x8082, 70), (0xdfa, 0x9978), (0xdf0, len(records))):
            machine.set_word(off, val)
        machine.uc.mem_write(0x50000, brd)
        machine.uc.mem_write(trace.LOAD_ADDRESS + 0x18, struct.pack('<H', 0x6000))
        if records:
            machine.uc.mem_write(0x60000, b''.join(struct.pack('<BB4h', *r) for r in records))
        for off in (0x18f5, 0x18f7, 0x18f9, 0x18fb):
            machine.set_word(off, 30000)
        machine.uc.mem_write(trace.DATA_ADDRESS + 0x3596, b'\x01')
        machine.uc.mem_write(trace.DATA_ADDRESS + 0x358c, b'\xff')
        machine.uc.mem_write(trace.DATA_ADDRESS + 0x9978, struct.pack('<Hhh', 0, *target))
        machine.uc.reg_write(UC_X86_REG_SI, 0x9978)
        machine.execute(0x115f, 0x12eb)
        ticks = []
        for _ in range(300):
            machine.set_word(0xae6, machine.word(0x2c2d))
            machine.set_word(0xae8, machine.word(0x2c2f))
            machine.execute(0xb6d, 0xc59)
            machine.execute(0x85de, 0x8a21)
            machine.execute(0xc78, 0xda6)
            x, y = machine.word(0x2c2d), machine.word(0x2c2f)
            ticks.append([x if x < 32768 else x - 65536, y if y < 32768 else y - 65536,
                          machine.uc.mem_read(trace.DATA_ADDRESS + 0x2c2c, 1)[0], machine.word(0x359a)])
            if not machine.word(0x359a):
                break
        trace.require(not machine.word(0x359a), 'Walking did not stop')
        return {'initialFrame': frame, 'target': target, 'records': records, 'ticks': ticks}

    traces = []
    obstacles = ([], [(0, 0, 190, 0, 200, 199)], [(0, 1, 170, 0, 210, 174)],
                 [(0, 2, 170, 175, 210, 199)])
    for frame in (0, 9, 18, 128):
        for target in ((200, 174), (120, 174), (160, 140), (160, 195), (205, 190),
                       (120, 140), (161, 174), (162, 174), (240, 165), (180, 154)):
            for records in obstacles:
                traces.append(trajectory(frame, target, records))
    for frame in (0, 9, 18, 128):
        for dx in range(-5, 6):
            for dy in range(-5, 6):
                traces.append(trajectory(frame, (160 + dx, 174 + dy), []))

    conditions = []
    gates = [(0, 0x2cb0, 16), (17, 0x2c4d, 13), (35, 0x2c4c, 1),
             (36, 0x35c9, 4), (38, 0x2c4c, 1), (63, 0x358c, 255),
             (66, 0x2cd0, 1), (68, 0x2c6d, 1), (69, 0x2c90, 295),
             (72, 0x2f44, 68), (74, 0x2c8e, 1), (83, 0x2c6d, 0),
             (84, 0x2d16, 30), (91, 0x4b2c, 1), (93, 0x4b35, 1),
             (95, 0x4b3e, 1), (97, 0x4b47, 1), (99, 0x4b50, 1),
             (101, 0x4b59, 1), (103, 0x358c, 24), (116, 0x2cd1, 22), (124, 0x2c6f, 155)]
    for argument, offset, equal in gates:
        for value in sorted(set((0, equal, equal + 1))):
            machine = trace.Machine(exe)
            machine.set_word(0xdf0, 1)
            machine.uc.mem_write(trace.LOAD_ADDRESS + 0x18, struct.pack('<H', 0x6000))
            machine.uc.mem_write(0x60000, struct.pack('<BB4h', 2, argument, 10, 20, 30, 40))
            for p in (0x18f5, 0x18f7, 0x18f9, 0x18fb):
                machine.set_word(p, 30000)
            machine.set_word(0x2c4c, 0)
            machine.set_word(0x3591, 0)
            machine.set_word(offset, value)
            for reg, val in zip((UC_X86_REG_AX, UC_X86_REG_BX, UC_X86_REG_CX, UC_X86_REG_DX), (15, 25, 15, 25)):
                machine.uc.reg_write(reg, val)
            machine.execute(0x274a, 0x2ab1)
            code = machine.uc.reg_read(UC_X86_REG_AX)
            trace.require(code in (0, 2), 'Unexpected conditional result')
            conditions.append({'argument': argument, 'state': {str(0x2c4c): 0, str(0x3591): 0, str(offset): value},
                               'enabled': code == 2})

    camera = []
    for center in (63, 64, 65, 222, 223, 224):
        machine = trace.Machine(exe)
        machine.set_word(0x2c31, 32)
        machine.set_word(0x2c2d, center - 16)
        machine.set_word(0x358d, 64)
        machine.set_word(0x358f, 223)
        reached = []
        boundaries = {trace.LOAD_ADDRESS + p - 512: label for p, label in ((0xed0d, 'left'), (0xed1a, 'right'), (0xed1f, 'none'))}
        def stop(uc, address, _size, _):
            if address in boundaries:
                reached.append(boundaries[address])
                uc.emu_stop()
        machine.uc.hook_add(UC_HOOK_CODE, stop)
        machine.uc.emu_start(trace.LOAD_ADDRESS + 0xecfe - 512, 0, count=100)
        trace.require(len(reached) == 1, 'Camera selector did not reach a boundary')
        camera.append({'center': center, 'direction': reached[0] if reached else 'none'})

    class ScrollMachine(trace.Machine):
        def __init__(self):
            self.crtc = []
            super().__init__(exe)
        def output_port(self, _uc, port, size, value, _):
            trace.require(port == 0x3d4 and size == 2, 'Unexpected scrolling OUT')
            self.crtc.append(value)
    scrolls = []
    for start, stop, direction in ((0xef9d, 0xf14a, 1), (0xf2b8, 0xf465, -1)):
        machine = ScrollMachine()
        machine.uc.mem_write(trace.LOAD_ADDRESS + 8, struct.pack('<H', 0x6000))
        machine.execute(start, stop)
        trace.require(len(machine.crtc) == 18, 'Expected nine CRTC position writes')
        positions = []
        for high, low in zip(machine.crtc[::2], machine.crtc[1::2]):
            trace.require(high & 255 == 12 and low & 255 == 13, 'Unexpected CRTC registers')
            positions.append((high & 0xff00) | (low >> 8))
        differences = [((position - positions[0]) * direction) & 65535 for position in positions]
        trace.require(differences == list(range(9)), 'Scroll address progression differs')
        scrolls.append({'direction': direction, 'pixelOffsets': [n * 4 * direction for n in differences],
                        'retraceReads': machine.retrace_reads, 'originalHz': None})

    rooms = []
    for room in range(126):
        resource = struct.unpack_from('<H', exe, 0xf510 + 0x7482 + room * 2)[0]
        at = 0xf510 + 0x85ac + room * 14
        flags, frame, x, y = struct.unpack_from('<BBhh', exe, at)
        rooms.append({'logicalRoomId': room, 'resourceId': resource, 'flags': flags, 'frame': frame,
                      'x': x, 'y': y, 'cameraX': exe[at + 12] * 32, 'brdSelector': exe[at + 13]})

    output = root / 'reports/navigation'
    resources = []
    # Usa los nombres contrastados del manifiesto de fondos, sin deducirlos del MAP.
    backgrounds = json.loads((root / 'reports/scenes/backgrounds/manifest.json').read_text())
    for row in boxdet['resources']:
        resource = row['resourceId']
        scene = next(s for s in backgrounds['results'] if s['resourceId'] == resource)
        machine = trace.Machine(exe)
        machine.set_word(0x8082, resource)
        sprite_name = scene.get('sprite', scene.get('sourceSprite'))
        if not sprite_name:
            # Tabla de asociaciones comprobada: registro de ocho bytes por recurso.
            pointer = struct.unpack_from('<H', exe, 0xf510 + 0x784e + resource * 8 + 2)[0]
            raw = exe[0xf510 + pointer:]
            sprite_name = raw.split(b'\0')[0].decode('ascii')
        sprite_data = (root / 'original/DATA' / sprite_name.upper()).read_bytes()
        machine.uc.mem_write(0x60000, sprite_data)
        machine.uc.mem_write(trace.LOAD_ADDRESS + 0x4aee, struct.pack('<H', 0x6000))
        machine.uc.mem_write(trace.DATA_ADDRESS + 0xad6, b'\0')
        machine.execute(0x8ca6, 0x8d6e)
        state = {str(at): machine.word(at) for at in sorted(set(gate[1] for gate in gates))}
        state[str(0x358c)] = 255  # Contexto explícito del probador: Ben normal STD.
        state[str(0x3591)] = 0   # Actores y rectángulos expresados en coordenadas del mundo.
        candidates = [room for room in rooms if room['resourceId'] == resource and room['brdSelector'] == 255]
        def signed_word(at):
            value = machine.word(at)
            return value if value < 32768 else value - 65536
        actors = []
        for slot in range(2, 70):
            at = 0x2c0a + slot * 33
            actors.append({'slot': slot, 'flags': machine.uc.mem_read(trace.DATA_ADDRESS + at, 1)[0],
                           'frame': machine.uc.mem_read(trace.DATA_ADDRESS + at + 1, 1)[0],
                           'x': signed_word(at + 2), 'y': signed_word(at + 4),
                           'width': machine.word(at + 6), 'height': machine.word(at + 8),
                           'depthOffset': signed_word(at + 10)})
        pointer = struct.unpack_from('<H', exe, 0xf510 + 0x53b5 + resource * 2)[0]
        at = 0xf510 + pointer
        foreground = []
        while exe[at] != 255:
            if exe[at] == 0:
                _, flags, frame, x, y, _ = struct.unpack_from('<BBBhhH', exe, at)
                foreground.append({'frame': frame, 'x': x, 'y': y, 'recordFileOffset': at})
            at += 9
        trace.require(len(foreground) == machine.word(0x358a), 'Foreground count differs')
        for index, record in enumerate(foreground):
            at = 0x3510 + index * 12
            trace.require(record['x'] == signed_word(at) and record['y'] == signed_word(at + 2), 'Foreground position differs')
            record['width'] = machine.word(at + 4)
            record['height'] = machine.word(at + 6)
        resources.append({'resourceId': resource, 'state': state, 'spawn': candidates[0] if candidates else None,
                          'actors': actors, 'foreground': foreground, 'sprite': sprite_name.upper(),
                          'spriteSha256': hashlib.sha256(sprite_data).hexdigest(),
                          'stateScope': 'Initial object loader, normal branch; room scripts are not executed'})
    profile_data = {'schemaVersion': 1, 'executableSha256': trace.PROFILE,
                    'stdSha256': hashlib.sha256(brd).hexdigest(), 'programBase': 0xa7e,
                    'programs': list(exe[0xf510 + 0xa7e:0xf510 + 0xac2]), 'profile': profile, 'rooms': rooms, 'resources': resources}
    (output / 'walking-profile.json').write_text(json.dumps(profile_data, indent=2) + '\n')
    (output / 'walking-verification.json').write_text(json.dumps({
        'schemaVersion': 1, 'executableSha256': trace.PROFILE, 'trajectories': traces,
        'conditions': conditions, 'camera': camera, 'scrolls': scrolls,
        'limitations': ['Standard STD walking only; special BRD and scripted movement excluded',
                        'Synthetic obstacles and actor state; no live room object updates',
                        'No original wall-clock cadence or VGA scrolling animation verification']}, indent=2) + '\n')
    print(json.dumps({'trajectories': len(traces), 'conditions': len(conditions), 'cameraCases': len(camera)}))


if __name__ == '__main__':
    main()
