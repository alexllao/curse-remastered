import assert from 'node:assert/strict';
import test from 'node:test';
import { composeScenePalette, readSceneAssociations } from './scene-palette.js';

test('scene palette replaces exactly indices 0-191 and preserves shared 192-255', () => {
  const map = Buffer.alloc(578, 17);
  map[576] = 255; // Allocation metadata must not become a color.
  const shared = Buffer.alloc(768, 42);
  const result = composeScenePalette(map, shared);
  assert.equal(result.length, 768);
  assert.deepEqual(result.subarray(0, 576), Buffer.alloc(576, 17));
  assert.deepEqual(result.subarray(576), Buffer.alloc(192, 42));
  assert.equal(map[576], 255);
});
test('reject truncated and non-VGA inputs and unknown executable revisions', () => {
  assert.throws(() => composeScenePalette(Buffer.alloc(577), Buffer.alloc(768)), /truncated/);
  assert.throws(() => composeScenePalette(Buffer.alloc(578), Buffer.alloc(767)), /768/);
  const map = Buffer.alloc(578);
  map[575] = 64;
  assert.throws(() => composeScenePalette(map, Buffer.alloc(768)), /non-VGA/);
  const shared = Buffer.alloc(768);
  shared[576] = 64;
  assert.throws(() => composeScenePalette(Buffer.alloc(578), shared), /non-VGA/);
  assert.throws(() => readSceneAssociations(Buffer.alloc(64)), /Unknown/);
});
