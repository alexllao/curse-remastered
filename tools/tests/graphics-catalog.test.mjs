import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { graphicsCatalog } from '../graphics-catalog.mjs';

test('descubre gráficos por versión sin incluir versiones solo musicales', async () => {
  const root = await mkdtemp(join(tmpdir(), 'curse-packs-test-'));
  try {
    await mkdir(join(root, 'remaster2', 'graficos'), { recursive: true });
    await mkdir(join(root, 'cinematic', 'musica'), { recursive: true });
    await mkdir(join(root, 'restaurados', 'sonidos'), { recursive: true });
    const result = await graphicsCatalog(root);
    assert.deepEqual(
      result.packs.map((p) => p.id),
      ['original', 'remaster', 'remaster2'],
    );
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + 'curse-packs-test-'));
    await rm(root, { recursive: true, force: true });
  }
});
