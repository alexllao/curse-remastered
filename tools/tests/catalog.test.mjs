import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { musicCatalog } from '../music-catalog.mjs';
import { soundsCatalog, soundPacksCatalog } from '../sounds-catalog.mjs';
async function fixture(run) {
  const prefix = join(tmpdir(), 'curse-audio-test-'),
    root = await mkdtemp(prefix);
  try {
    return await run(root);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + 'curse-audio-test-'));
    await rm(root, { recursive: true, force: true });
  }
}
test('descubre versiones, prefiere audio a MIDI y no inventa asociaciones', () =>
  fixture(async (root) => {
    await mkdir(join(root, 'original'));
    await mkdir(join(root, 'cinematic'));
    await writeFile(join(root, 'original', 'CURSE.RS1.mid'), 'fixture');
    await writeFile(join(root, 'original', 'CURSE.RS1.ogg'), 'fixture');
    await writeFile(join(root, 'cinematic', 'CURSE.RS1.mp3'), 'fixture');
    const result = await musicCatalog(root);
    assert.equal(result.versions.length, 2);
    assert.equal(result.versions[0].tracks.length, 1);
    assert.equal(result.versions[0].tracks[0].midi, false);
    assert.deepEqual(result.contexts, {});
  }));
test('solo utiliza el mapa explícito y conserva nombres con espacios', () =>
  fixture(async (root) => {
    await mkdir(join(root, 'medieval'));
    await writeFile(join(root, 'medieval', 'CURSE RS1.mp3'), 'fixture');
    await writeFile(join(root, 'music.json'), JSON.stringify({ contexts: { title: 'CURSE RS1' } }));
    const result = await musicCatalog(root);
    assert.equal(result.contexts.title, 'CURSE RS1');
    assert.match(result.versions[0].tracks[0].file, /CURSE%20RS1/);
  }));
test('sonidos ausentes son opcionales; los eventos solo enlazan archivos existentes', () =>
  fixture(async (root) => {
    assert.deepEqual((await soundsCatalog(join(root, 'no-existe'))).events, {});
    await writeFile(join(root, '42.wav'), 'fixture');
    await writeFile(join(root, 'puerta.ogg'), 'fixture');
    await writeFile(
      join(root, 'sounds.json'),
      JSON.stringify({ events: { 7: 'puerta.ogg', 8: '../fuera.wav', 9: 'ausente.ogg' } }),
    );
    const result = await soundsCatalog(root);
    assert.equal(result.events['42'], '/sonidos/original/42.wav');
    assert.equal(result.events['7'], '/sonidos/original/puerta.ogg');
    assert.equal(result.events['8'], undefined);
    assert.equal(result.events['9'], undefined);
  }));

test('detecta paquetes de efectos y mantiene separados sus eventos', () =>
  fixture(async (root) => {
    await mkdir(join(root, 'original'));
    await mkdir(join(root, 'restaurados'));
    await writeFile(join(root, 'original', '42.wav'), 'fixture');
    await writeFile(join(root, 'restaurados', '42.ogg'), 'fixture');
    const result = await soundPacksCatalog(root);
    assert.equal(result.events['42'], '/sonidos/original/42.wav');
    assert.equal(
      result.versions.find((v) => v.id === 'restaurados').events['42'],
      '/sonidos/restaurados/42.ogg',
    );
  }));

test('los mapas explícitos admiten subcarpetas verificadas y mantienen eventos por sala', () =>
  fixture(async (root) => {
    await mkdir(join(root, 'original', 'verificados'), { recursive: true });
    await writeFile(join(root, 'original', 'verificados', 'ayuda original.wav'), 'fixture');
    await writeFile(join(root, 'original', 'verificados', 'puerta.wav'), 'fixture');
    await writeFile(join(root, 'fuera.wav'), 'fixture');
    await writeFile(
      join(root, 'original', 'sounds.json'),
      JSON.stringify({
        events: { 0: 'verificados/ayuda original.wav', 8: '../fuera.wav', 9: '/fuera.wav' },
        priorities: { 0: 255, 8: 50 },
        scenes: { 0: { events: { 15: 'verificados/puerta.wav' }, priorities: { 15: 100 } } },
      }),
    );
    const result = await soundPacksCatalog(root);
    assert.equal(result.events['0'], '/sonidos/original/verificados/ayuda%20original.wav');
    assert.equal(result.events['8'], undefined);
    assert.equal(result.events['9'], undefined);
    assert.equal(result.events['15'], undefined);
    assert.equal(result.priorities['0'], 255);
    assert.equal(result.scenes['0'].events['15'], '/sonidos/original/verificados/puerta.wav');
    assert.equal(result.versions[0].scenes['0'].priorities['15'], 100);
  }));
