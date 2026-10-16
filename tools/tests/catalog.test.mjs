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
    await mkdir(join(root, 'original', 'musica'), { recursive: true });
    await mkdir(join(root, 'cinematic', 'musica'), { recursive: true });
    await writeFile(join(root, 'original', 'musica', 'CURSE.RS1.mid'), 'fixture');
    await writeFile(join(root, 'original', 'musica', 'CURSE.RS1.ogg'), 'fixture');
    await writeFile(join(root, 'cinematic', 'musica', 'CURSE.RS1.mp3'), 'fixture');
    const result = await musicCatalog(root);
    assert.equal(result.versions.length, 2);
    assert.equal(result.versions[0].tracks.length, 1);
    assert.equal(result.versions[0].tracks[0].midi, false);
    assert.deepEqual(result.contexts, {});
  }));
test('solo utiliza el mapa explícito y conserva nombres con espacios', () =>
  fixture(async (root) => {
    await mkdir(join(root, 'medieval', 'musica'), { recursive: true });
    await writeFile(join(root, 'medieval', 'musica', 'CURSE RS1.mp3'), 'fixture');
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
    assert.equal(result.events['42'], '/original/sonidos/42.wav');
    assert.equal(result.events['7'], '/original/sonidos/puerta.ogg');
    assert.equal(result.events['8'], undefined);
    assert.equal(result.events['9'], undefined);
  }));

test('detecta paquetes de efectos y mantiene separados sus eventos', () =>
  fixture(async (root) => {
    await mkdir(join(root, 'original', 'sonidos', 'sonidos'), { recursive: true });
    await mkdir(join(root, 'restaurados', 'sonidos', 'sonidos'), { recursive: true });
    await writeFile(join(root, 'original', 'sonidos', '42.wav'), 'fixture');
    await writeFile(join(root, 'restaurados', 'sonidos', '42.ogg'), 'fixture');
    const result = await soundPacksCatalog(root);
    assert.equal(result.events['42'], '/original/sonidos/42.wav');
    assert.equal(
      result.versions.find((v) => v.id === 'restaurados').events['42'],
      '/restaurados/sonidos/42.ogg',
    );
  }));

test('los mapas explícitos admiten subcarpetas verificadas y mantienen eventos por sala', () =>
  fixture(async (root) => {
    await mkdir(join(root, 'original', 'sonidos', 'verificados'), { recursive: true });
    await writeFile(
      join(root, 'original', 'sonidos', 'verificados', 'ayuda original.wav'),
      'fixture',
    );
    await writeFile(join(root, 'original', 'sonidos', 'verificados', 'puerta.wav'), 'fixture');
    await writeFile(join(root, 'fuera.wav'), 'fixture');
    await writeFile(
      join(root, 'original', 'sonidos', 'sounds.json'),
      JSON.stringify({
        events: { 0: 'verificados/ayuda original.wav', 8: '../fuera.wav', 9: '/fuera.wav' },
        priorities: { 0: 255, 8: 50 },
        scenes: { 0: { events: { 15: 'verificados/puerta.wav' }, priorities: { 15: 100 } } },
      }),
    );
    const result = await soundPacksCatalog(root);
    assert.equal(result.events['0'], '/original/sonidos/verificados/ayuda%20original.wav');
    assert.equal(result.events['8'], undefined);
    assert.equal(result.events['9'], undefined);
    assert.equal(result.events['15'], undefined);
    assert.equal(result.priorities['0'], 255);
    assert.equal(result.scenes['0'].events['15'], '/original/sonidos/verificados/puerta.wav');
    assert.equal(result.versions[0].scenes['0'].priorities['15'], 100);
  }));

test('publica asociaciones nativas y permite sustituirlas mediante configuración explícita', () =>
  fixture(async (root) => {
    await mkdir(join(root, 'original', 'musica'), { recursive: true });
    await writeFile(
      join(root, 'original', 'musica', 'native-contexts.json'),
      JSON.stringify({
        schemaVersion: 1,
        contexts: {
          'scene:0': 'CURSE.RS1',
          'scene:1': 'CURSE.RS1',
          'scene:3': 'CURSE.RS3',
          title: 'CURSE.RS5',
          'scene:8': '../invalid',
        },
      }),
    );
    await writeFile(
      join(root, 'music.json'),
      JSON.stringify({ contexts: { 'scene:3': 'CURSE.RS2' } }),
    );
    assert.deepEqual((await musicCatalog(root)).contexts, {
      'scene:0': 'CURSE.RS1',
      'scene:1': 'CURSE.RS1',
      'scene:3': 'CURSE.RS2',
      title: 'CURSE.RS5',
    });
  }));

test('los bucles se aplican solo al audio verificado de su versión', async () => {
  const { createHash } = await import('node:crypto');
  const root = await mkdtemp(join(tmpdir(), 'curse-loop-'));
  try {
    const folder = join(root, 'original', 'musica');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'CURSE.RS1.ogg'), 'native');
    const sha256 = createHash('sha256').update('native').digest('hex');
    await writeFile(
      join(folder, 'loops.json'),
      JSON.stringify({
        schemaVersion: 1,
        tracks: {
          'CURSE.RS1': { file: 'CURSE.RS1.ogg', start: 12, end: 40, sha256 },
        },
      }),
    );
    const track = (await musicCatalog(root)).versions[0].tracks[0];
    assert.deepEqual(track.loopRegion, { start: 12, end: 40 });
    assert.match(track.file, /\?v=[a-f0-9]{64}$/);
    await writeFile(join(folder, 'CURSE.RS1.ogg'), 'replacement');
    assert.equal((await musicCatalog(root)).versions[0].tracks[0].loopRegion, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('se pueden desactivar paquetes musicales conservando todos sus archivos', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curse-music-enabled-'));
  try {
    for (const version of ['original', 'remaster', 'amiga']) {
      await mkdir(join(root, version, 'musica'), { recursive: true });
      await writeFile(join(root, version, 'musica', 'CURSE.RS5.mp3'), version);
    }
    assert.deepEqual(
      (await musicCatalog(root, { enabledVersions: ['original'] })).versions.map((v) => v.id),
      ['original'],
    );
    assert.equal((await musicCatalog(root)).versions.length, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('el MP3 propio del menú no es una versión y cambia de URL al reemplazarlo', () =>
  fixture(async (root) => {
    const folder = join(root, 'menu', 'musica');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'menu.mp3'), 'primera');
    const first = await musicCatalog(root, { enabledVersions: ['dosbox-mt32'] });
    assert.deepEqual(first.versions, []);
    assert.equal(first.menuTrack.id, 'WEB.MENU');
    assert.match(first.menuTrack.file, /^\/menu\/musica\/menu\.mp3\?v=[a-f0-9]{64}$/);
    await writeFile(join(folder, 'menu.mp3'), 'segunda');
    const second = await musicCatalog(root);
    assert.notEqual(first.menuTrack.file, second.menuTrack.file);
    assert.deepEqual(second.versions, []);
  }));
