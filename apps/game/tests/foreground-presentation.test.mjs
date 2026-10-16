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
  const actor = { slot: 1, flags: 1, x: 314, y: 197, width: 3, height: 3, depthOffset: 0 };
  assert.equal(originalForegroundOverlaps(oldBounds, [actor]), false);
  assert.equal(originalForegroundOverlaps(bounds, [actor]), true);
  assert.equal(originalForegroundOverlaps(bounds, [{ ...actor, x: 320 }]), false);
  assert.equal(originalForegroundOverlaps(bounds, [{ ...actor, flags: 0 }]), false);
});

test('la cuña clara queda detrás de Ben y solo la cara oscura oculta su pierna', () => {
  const { polygon } = foregroundPresentation(0, 2, 'remaster');
  function contains(x, y) {
    let inside = false;
    for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) {
      const ax = polygon[i],
        ay = polygon[i + 1],
        bx = polygon[j],
        by = polygon[j + 1];
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    }
    return inside;
  }
  // Puntos del zócalo claro que el contorno anterior tapaba por error.
  assert.equal(contains(288, 174), false);
  assert.equal(contains(280, 185), false);
  assert.equal(contains(265, 198), false);
  assert.equal(contains(296, 180), true);
  assert.equal(contains(283, 195), true);
});
