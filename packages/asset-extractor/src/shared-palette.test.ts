import assert from 'node:assert/strict';
import test from 'node:test';
import { colorSharedPixels, inspectIndices } from './shared-palette.js';

test('transparent pixels do not introduce a false scene-palette dependency', () => {
  const pixels = Buffer.from([0, 0, 0, 0, 192, 192, 192, 255, 254, 254, 254, 255]);
  const usage = inspectIndices(pixels);
  assert.deepEqual(usage.indices, [192, 254]);
  assert.equal(usage.sceneDependentPixels, 0);
  const palette = Buffer.alloc(768);
  palette[192 * 3] = 63;
  palette[254 * 3 + 2] = 63;
  assert.deepEqual(
    colorSharedPixels(pixels, palette),
    Buffer.from([0, 0, 0, 0, 255, 0, 0, 255, 0, 0, 255, 255]),
  );
  assert.equal(pixels[4], 192);
});
test('refuse scene and animated indices even when only one painted pixel uses them', () => {
  for (const index of [0, 191, 255]) {
    const pixels = Buffer.from([index, index, index, 255]);
    assert.throws(() => colorSharedPixels(pixels, Buffer.alloc(768)), /context/);
  }
  assert.throws(() => inspectIndices(Buffer.from([192, 193, 192, 255])), /grayscale/);
  assert.throws(() => inspectIndices(Buffer.alloc(3)), /RGBA/);
  assert.throws(() => colorSharedPixels(Buffer.alloc(0), Buffer.alloc(767)), /tail/);
  const palette = Buffer.alloc(768);
  palette[576] = 64;
  assert.throws(() => colorSharedPixels(Buffer.alloc(0), palette), /tail/);
});
