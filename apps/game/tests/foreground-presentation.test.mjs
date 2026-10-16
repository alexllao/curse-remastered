import test from 'node:test';
import assert from 'node:assert/strict';
import { originalForegroundOverlaps } from '../../../packages/engine/src/scene-order.ts';
import { foregroundPresentation } from '../src/foreground-presentation.ts';

test('el contorno pintado solo se aplica al fondo Remaster de la primera mazmorra', () => {
  assert.equal(foregroundPresentation(0, 2, 'original'), null);
  assert.equal(foregroundPresentation(1, 2, 'remaster'), null);
  assert.equal(foregroundPresentation(0, 1, 'remaster'), null);
  assert.equal(foregroundPresentation(0, 2, 'otro-paquete'), null);
  assert.ok(foregroundPresentation(0, 2, 'remaster'));
});

test('la extensión del contorno activa el dibujo antes de cruzar el recorte antiguo', () => {
  const { bounds } = foregroundPresentation(0, 2, 'remaster');
  const oldBounds = { x: 265, y: 99, width: 48, height: 100 };
  const actor = { slot: 1, flags: 1, x: 261, y: 197, width: 3, height: 3, depthOffset: 0 };
  assert.equal(originalForegroundOverlaps(oldBounds, [actor]), false);
  assert.equal(originalForegroundOverlaps(bounds, [actor]), true);
  assert.equal(originalForegroundOverlaps(bounds, [{ ...actor, x: 320 }]), false);
  assert.equal(originalForegroundOverlaps(bounds, [{ ...actor, flags: 0 }]), false);
});
