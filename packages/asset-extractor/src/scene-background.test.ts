import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assembleStrips,
  indexedRgba,
  overlaySprite,
  readBackgroundLayouts,
  readMapStrip,
} from './scene-background.js';

test('strip rows preserve executable order, duplicates and blank columns', () => {
  const a = Buffer.alloc(6400, 7),
    b = Buffer.alloc(6400, 9);
  a[32] = 11;
  const result = assembleStrips([b, a, undefined, a]);
  assert.equal(result.width, 128);
  assert.equal(result.height, 200);
  assert.equal(result.indices[0], 9);
  assert.equal(result.indices[32], 7);
  assert.equal(result.indices[64], 0);
  assert.equal(result.indices[128 + 32], 11);
  assert.equal(result.indices[128 + 96], 11);
  assert.equal(indexedRgba(result.indices)[64 * 4 + 3], 255);
  assert.throws(() => assembleStrips([Buffer.alloc(1)]), /length/);
  assert.throws(() => readMapStrip(Buffer.alloc(579), 0), /request/);
  const map = Buffer.alloc(620);
  map.writeUInt16LE(2, 578);
  assert.throws(() => readMapStrip(map, 16), /table/);
  assert.throws(() => readMapStrip(map, 0), /pointer/);
  assert.throws(() => readBackgroundLayouts(Buffer.alloc(64)), /revision/);
});
test('object preview clips negative positions, mirrors and preserves transparency', () => {
  const sprite = {
    width: 3,
    height: 1,
    pixels: Buffer.from([1, 1, 1, 255, 2, 2, 2, 0, 3, 3, 3, 255]),
  };
  const canvas = Buffer.alloc(12, 8);
  overlaySprite(canvas, 3, 1, sprite, -1, 0);
  assert.deepEqual([...canvas], [8, 8, 8, 8, 3, 3, 3, 255, 8, 8, 8, 8]);
  const mirrored = Buffer.alloc(12);
  overlaySprite(mirrored, 3, 1, sprite, 0, 0, true);
  assert.equal(mirrored[0], 3);
  assert.equal(mirrored[8], 1);
  assert.equal(mirrored[7], 0);
});
