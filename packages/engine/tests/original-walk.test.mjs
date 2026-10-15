import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enabledOriginalRegion,
  queryOriginalRegions,
  followOriginalCamera,
} from '../src/original-walk.ts';

test('las condiciones desconocidas detienen la prueba y las inactivas permiten consultar el fondo', () => {
  const box = { left: 10, top: 20, right: 30, bottom: 40 };
  const regions = [
    { ...box, type: 2, argument: 17 },
    { ...box, type: 0, argument: 7 },
  ];
  assert.equal(queryOriginalRegions(regions, box).code, 16);
  assert.equal(queryOriginalRegions(regions, box, { [0x2c4d]: 13 }).code, 2);
  assert.equal(queryOriginalRegions(regions, box, { [0x2c4d]: 12 }).argument, 7);
  assert.equal(enabledOriginalRegion(36, { [0x35c9]: 0 }), true);
  assert.equal(enabledOriginalRegion(36, { [0x35c9]: 4 }), false);
});
test('la cámara sigue los umbrales originales y respeta los extremos del panorama', () => {
  assert.equal(followOriginalCamera(47, 0, 960), 0);
  assert.equal(followOriginalCamera(207, 0, 960), 32);
  assert.equal(followOriginalCamera(688, 640, 960), 608);
  assert.equal(followOriginalCamera(900, 640, 960), 640);
  assert.equal(followOriginalCamera(250, 0, 320), 0);
});
