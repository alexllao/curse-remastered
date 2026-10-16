import test from 'node:test';
import assert from 'node:assert/strict';
import { needsSceneLayers } from '../src/scene-layer-selection.ts';

test('cambiar Remaster a Original en la portada exige renovar las capas al empezar', () => {
  const loaded = { sceneId: 0, packId: 'remaster' };
  assert.equal(needsSceneLayers(true, 0, 'original', loaded), false);
  assert.equal(needsSceneLayers(false, 0, 'original', loaded), true);
  const renewed = { sceneId: 0, packId: 'original' };
  assert.equal(needsSceneLayers(false, 0, 'original', renewed), false);
});

test('el cambio inverso y cambiar de sala renuevan también las capas', () => {
  const loaded = { sceneId: 0, packId: 'original' };
  assert.equal(needsSceneLayers(false, 0, 'remaster', loaded), true);
  assert.equal(needsSceneLayers(false, 1, 'original', loaded), true);
});
