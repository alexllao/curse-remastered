import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'curse-migrate-test-'));
  try {
    await mkdir(join(root, 'tools'));
    await copyFile(
      fileURLToPath(new URL('../migrate-assets.mjs', import.meta.url)),
      join(root, 'tools/migrate-assets.mjs'),
    );
    const execute = (...args) =>
      execFileSync(process.execPath, [join(root, 'tools/migrate-assets.mjs'), ...args], {
        encoding: 'utf8',
      });
    await run(root, execute);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + 'curse-migrate-test-'));
    await rm(root, { recursive: true, force: true });
  }
}
test('migra tipos y metadatos conservando bytes y unifica remastered', () =>
  fixture(async (root, execute) => {
    await mkdir(join(root, 'mods/graficos/original'), { recursive: true });
    await mkdir(join(root, 'mods/sonidos/original'), { recursive: true });
    await mkdir(join(root, 'mods/sonidos/remastered'), { recursive: true });
    await writeFile(join(root, 'mods/graficos/original/TITLE.png'), 'graphic-fixture');
    await writeFile(join(root, 'mods/sonidos/original/42.wav'), 'audio-fixture');
    await writeFile(join(root, 'mods/sonidos/manifest.json'), 'metadata-fixture');
    execute();
    await assert.rejects(access(join(root, 'assets')));
    execute('--apply');
    assert.equal(
      await readFile(join(root, 'assets/original/graficos/TITLE.png'), 'utf8'),
      'graphic-fixture',
    );
    assert.equal(
      await readFile(join(root, 'assets/original/sonidos/42.wav'), 'utf8'),
      'audio-fixture',
    );
    assert.equal(
      await readFile(join(root, 'assets/original/sonidos/manifest.json'), 'utf8'),
      'metadata-fixture',
    );
    await access(join(root, 'assets/remaster/sonidos'));
    await assert.rejects(access(join(root, 'mods/sonidos')));
  }));
test('rechaza colisiones entre metadatos antes de mover archivos', () =>
  fixture(async (root, execute) => {
    await mkdir(join(root, 'mods/sonidos/original'), { recursive: true });
    await writeFile(join(root, 'mods/sonidos/original/manifest.json'), 'one');
    await writeFile(join(root, 'mods/sonidos/manifest.json'), 'two');
    assert.throws(() => execute('--apply'));
    assert.equal(await readFile(join(root, 'mods/sonidos/original/manifest.json'), 'utf8'), 'one');
    assert.equal(await readFile(join(root, 'mods/sonidos/manifest.json'), 'utf8'), 'two');
  }));
