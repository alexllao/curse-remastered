"""Escucha MT-32 local de MIDI provisionales; no valida el motor temporal DOS."""
import argparse
import ctypes as c
import hashlib
import json
from pathlib import Path
import subprocess
import wave
import mido


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--library', type=Path, default=root / 'reports/tools/munt-build/Release/mt32emu-2.dll')
    parser.add_argument('--ffmpeg', default='ffmpeg')
    args = parser.parse_args()
    roms = [root / 'original/ROMS/MT32_CONTROL.ROM', root / 'original/ROMS/MT32_PCM.ROM']
    for path in [args.library, *roms]:
        if not path.is_file():
            raise RuntimeError(f'Falta la dependencia local: {path}')
    library = c.CDLL(str(args.library.resolve()))

    def bind(name, result, arguments):
        function = getattr(library, 'mt32emu_' + name)
        function.restype, function.argtypes = result, arguments
        return function

    create = bind('create_context', c.c_void_p, [c.c_void_p, c.c_void_p])
    free = bind('free_context', None, [c.c_void_p])
    add = bind('add_rom_file', c.c_int, [c.c_void_p, c.c_char_p])
    open_synth = bind('open_synth', c.c_int, [c.c_void_p])
    rate = bind('get_actual_stereo_output_samplerate', c.c_uint, [c.c_void_p])
    message_now = bind('play_msg_now', None, [c.c_void_p, c.c_uint])
    sysex_now = bind('play_sysex_now', None, [c.c_void_p, c.POINTER(c.c_ubyte), c.c_uint])
    render = bind('render_bit16s', None, [c.c_void_p, c.POINTER(c.c_int16), c.c_uint])
    folder = root / 'mods/musica/original'
    report_folder = root / 'reports/audio'
    report_folder.mkdir(parents=True, exist_ok=True)
    report_path = report_folder / 'mt32-render.json'
    report = json.loads(report_path.read_text()) if report_path.exists() else {
        'schemaVersion': 1, 'status': 'provisional', 'files': {},
        'limitations': ['Timing and loops of supplied MIDI are not verified against DOS',
                        'No capture of game MPU-401 initialisation or custom patch changes'],
    }
    rom_hashes = {path.name: sha(path) for path in roms}
    previous_library = report.get('librarySha256')
    report['librarySha256'] = sha(args.library)
    for path in sorted(folder.glob('*.mid')):
        output = path.with_suffix('.ogg')
        fingerprint = {'midiSha256': sha(path), 'romSha256': rom_hashes, 'librarySha256': report['librarySha256']}
        previous = report['files'].get(path.name)
        if previous and 'librarySha256' not in previous:
            previous['librarySha256'] = previous_library
        if output.exists():
            if previous and all(previous.get(key) == value for key, value in fingerprint.items()) and previous['outputSha256'] == sha(output):
                print(f'Conservado: {output.name}', flush=True)
                continue
            raise RuntimeError(f'No se sobrescribe el audio existente: {output}')
        context = create(None, None)
        if not context:
            raise RuntimeError('No se pudo crear el sintetizador')
        try:
            for rom in roms:
                if add(context, str(rom.resolve()).encode('utf-8')) < 0:
                    raise RuntimeError(f'ROM no reconocida: {rom.name}')
            if open_synth(context) != 0:
                raise RuntimeError('No se pudo abrir el sintetizador')
            sample_rate = rate(context)
            temporary = report_folder / (path.stem + '-mt32.wav')
            buffer = (c.c_int16 * (4096 * 2))()
            with wave.open(str(temporary), 'wb') as stream:
                stream.setnchannels(2)
                stream.setsampwidth(2)
                stream.setframerate(sample_rate)

                def advance(frames):
                    while frames:
                        length = min(frames, 4096)
                        render(context, buffer, length)
                        stream.writeframesraw(bytes(buffer)[:length * 4])
                        frames -= length

                elapsed, rendered, events = 0.0, 0, 0
                for message in mido.MidiFile(str(path)):
                    elapsed += message.time
                    target = round(elapsed * sample_rate)
                    advance(target - rendered)
                    rendered = target
                    if message.is_meta:
                        continue
                    data = message.bytes()
                    if message.type == 'sysex':
                        packed = (c.c_ubyte * len(data))(*data)
                        sysex_now(context, packed, len(data))
                    else:
                        message_now(context, sum(value << (8 * index) for index, value in enumerate(data)))
                    events += 1
                advance(sample_rate * 2)
            subprocess.run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-n', '-i', str(temporary), '-c:a', 'libvorbis', '-q:a', '5', str(output)], check=True)
            report['files'][path.name] = {**fingerprint, 'outputSha256': sha(output),
                                        'events': events, 'midiSeconds': elapsed, 'tailSeconds': 2,
                                        'sampleRate': sample_rate, 'output': str(output.relative_to(root))}
            report_path.write_text(json.dumps(report, indent=2) + '\n')
            print(f'Escucha provisional: {output.name}, {elapsed:.3f} segundos MIDI', flush=True)
        finally:
            free(context)
    report_path.write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
