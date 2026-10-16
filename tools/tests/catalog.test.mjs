import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { musicCatalog } from '../music-catalog.mjs';
import { soundsCatalog } from '../sounds-catalog.mjs';
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
