"""Genera WAV por evento contrastado; conserva las extracciones experimentales."""
import hashlib
import io
import json
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    report = json.loads((ROOT / 'reports/audio/dungeon-sounds.json').read_text(encoding='utf-8'))
    if sha((ROOT / 'original/CURSE.EXE').read_bytes()) != report['executableSha256']:
        raise RuntimeError('Repetir la traza de sonidos para este ejecutable')
    sources = {name: (ROOT / 'original/DATA' / name).read_bytes() for name in report['sourceSha256']}
    for name, data in sources.items():
        if sha(data) != report['sourceSha256'][name]:
            raise RuntimeError(f'Fuente modificada: {name}')
    folder = ROOT / 'assets/original/sonidos'
    map_path = folder / 'sounds.json'
    receipt_path = ROOT / 'reports/audio/prepared-dungeon-sounds.json'
    previous = json.loads(receipt_path.read_text(encoding='utf-8')) if receipt_path.exists() else {'files': {}}
    mapping = json.loads(map_path.read_text(encoding='utf-8-sig')) if map_path.exists() else {'schemaVersion': 1}
    outputs = {}
    descriptions = []
    # Preparar y validar todo antes de escribir, incluidos archivos personalizados.
    for entry in report['events']:
        raw = sources[entry['source']][entry['byteOffset']:entry['byteOffset'] + entry['byteLength']]
        if len(raw) != entry['byteLength'] or sha(raw) != entry['sha256Pcm']:
            raise RuntimeError('Muestra distinta de la traza')
        stream = io.BytesIO()
        rate = round(entry['sampleRateHz'])
        with wave.open(stream, 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(1)
            wav.setframerate(rate)
            wav.writeframes(raw)
        relative = f'verificados/{entry["event"]:03}.wav'
        data = stream.getvalue()
        target = folder / relative
        if target.exists() and target.read_bytes() != data and sha(target.read_bytes()) != previous['files'].get(relative):
            raise RuntimeError(f'No se sobrescribe un sonido personalizado: {target}')
        outputs[relative] = data
        group = mapping if entry['resourceId'] is None else mapping.setdefault('scenes', {}).setdefault(str(entry['resourceId']), {})
        events = group.setdefault('events', {})
        key = str(entry['event'])
        if key not in events or events[key] == relative:
            events[key] = relative
            group.setdefault('priorities', {})[key] = entry['priority']
        descriptions.append({**entry, 'file': relative, 'wavSampleRateHz': rate, 'sha256Wav': sha(data)})
    # CORRIDOR comparte grupo de sonidos 0 con DUNGEON en esta revisión.
    exe = (ROOT / 'original/CURSE.EXE').read_bytes()
    data_offset = 0xf510
    if exe[data_offset + 0x9048:data_offset + 0x904a] != b'\0\0':
        raise RuntimeError('Repetir la asociación de sonidos de CORRIDOR')
    corridor = mapping.setdefault('scenes', {}).setdefault('1', {})
    for field in ('events', 'priorities'):
        target = corridor.setdefault(field, {})
        for key, value in mapping['scenes']['0'][field].items():
            target.setdefault(key, value)
    for relative, data in outputs.items():
        target = folder / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    map_path.write_text(json.dumps(mapping, indent=2) + '\n', encoding='utf-8')
    receipt_path.write_text(json.dumps({'schemaVersion': 1, 'executableSha256': report['executableSha256'],
        'files': {relative: sha(data) for relative, data in outputs.items()}, 'events': descriptions,
        'limitations': report['limitations'] + ['WAV sample rates rounded to nearest integer Hz']}, indent=2) + '\n', encoding='utf-8')
    print(f'Generados {len(outputs)} WAV verificados por evento; extracciones anteriores conservadas.')


if __name__ == '__main__':
    main()
