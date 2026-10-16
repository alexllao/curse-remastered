import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { framesCatalog } from '../frames-catalog.mjs';
async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'curse-frames-test-'));
  try {
    await run(root);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + 'curse-frames-test-'));
    await rm(root, { recursive: true, force: true });
  }
}
function header() {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.write('IHDR', 12);
  bytes.writeUInt32BE(1600, 16);
  bytes.writeUInt32BE(900, 20);
  return bytes;
}
test('agrupa variantes del marco sin confundirlas con escenarios o paquetes', () =>
  fixture(async (root) => {
    for (const pack of ['original', 'remaster', 'remaster2']) {
      await mkdir(join(root, pack, 'marcos'), { recursive: true });
      await writeFile(join(root, pack, 'marcos', 'castillo.png'), header());
      await writeFile(join(root, pack, 'fondo.png'), header());
    }
    const result = await framesCatalog(root);
    assert.equal(result.frames.length, 1);
    assert.deepEqual(Object.keys(result.frames[0].variants), ['original', 'remaster', 'remaster2']);
    assert.equal(result.frames[0].variants.original.left.width, 160);
    assert.equal(result.frames[0].variants.original.right.x, 1440);
  }));
test('respeta las bandas declaradas e ignora metadatos inválidos y falsos PNG', () =>
  fixture(async (root) => {
    const directory = join(root, 'original', 'marcos');
    await mkdir(directory, { recursive: true });
    for (const file of ['Piedra y oro.png', 'fuera.png', 'nulo.png'])
      await writeFile(join(directory, file), header());
    await writeFile(join(directory, 'falso.png'), 'not a PNG');
    await writeFile(
      join(directory, 'Piedra y oro.png.json'),
      JSON.stringify({
        label: 'Piedra',
        fit: 'cover',
        contexts: ['scene:0', 'title', 'scene:0', '../invalid', null],
        left: { x: 0, y: 0, width: 80, height: 900 },
        right: { x: 1520, y: 0, width: 80, height: 900 },
      }),
    );
    await writeFile(
      join(directory, 'fuera.png.json'),
      JSON.stringify({ left: { x: 1500, y: 0, width: 200, height: 900 } }),
    );
    await writeFile(join(directory, 'nulo.png.json'), 'null');
    const result = await framesCatalog(root);
    assert.equal(result.frames.length, 1);
    assert.equal(result.frames[0].label, 'Piedra');
    assert.deepEqual(result.frames[0].contexts, ['scene:0', 'title']);
    assert.equal(result.frames[0].variants.original.fit, 'cover');
    assert.equal(result.frames[0].variants.original.left.width, 80);
    assert.ok(result.frames[0].variants.original.url.endsWith('/Piedra%20y%20oro.png'));
  }));
