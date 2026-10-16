import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dungeonPresentationOrder,
  visibleDungeonPickup,
  preserveDungeonGlint,
} from '../src/dungeon-visuals.ts';
import {
  originalActorOrder,
  originalForegroundOverlaps,
} from '../../../packages/engine/src/scene-order.ts';

test('la moneda conserva sus condiciones y el clip no se sustituye por un icono permanente', () => {
  for (const pack of ['original', 'remaster']) {
    assert.equal(visibleDungeonPickup(0, 6, 7, pack)?.icon, 31);
    assert.equal(visibleDungeonPickup(0, 6, 0, pack), null);
    assert.equal(visibleDungeonPickup(0, 9, 3, pack), null);
    assert.equal(visibleDungeonPickup(0, 9, 1, pack), null);
    assert.equal(visibleDungeonPickup(0, 9, 0, pack), null);
    assert.equal(visibleDungeonPickup(1, 6, 7, pack), null);
    assert.equal(visibleDungeonPickup(0, 11, 1, pack), null);
  }
});

test('la gota permanece delante de Ben detrás del charco durante toda la caída', () => {
  const actors = Array.from({ length: 69 }, (_, i) => ({
    slot: i + 1,
    flags: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    depthOffset: 0,
  }));
  actors[0] = { ...actors[0], flags: 1, x: 180, y: 92, width: 32, height: 48 };
  actors[13] = { ...actors[13], flags: 1, x: 188, y: 30, width: 8, height: 46 };
  actors[14] = { ...actors[14], flags: 1, x: 176, y: 165, width: 24, height: 10 };
  let previous = actors.map((a) => a.slot);
  for (let y = 30; y <= 143; y++) {
    actors[13].y = y;
    const order = originalActorOrder(dungeonPresentationOrder(0, actors), previous);
    assert.ok(order.indexOf(14) > order.indexOf(1), `Ben detrás, gota y=${y}`);
    previous = order;
    assert.equal(actors[13].depthOffset, 0, 'el estado de la simulación permanece intacto');
  }
  actors[0].y = 142; // Pies en190, delante del charco.
  for (let y = 30; y <= 143; y++) {
    actors[13].y = y;
    const order = originalActorOrder(dungeonPresentationOrder(0, actors), previous);
    assert.ok(order.indexOf(14) < order.indexOf(1), `Ben delante, gota y=${y}`);
    previous = order;
  }
  assert.equal(dungeonPresentationOrder(1, actors), actors);
});

test('la moneda activa el primer plano y queda detrás de la pared, sin alterar sus flags reales', () => {
  const actors = [
    { slot: 6, flags: 7, x: 290, y: 196, width: 8, height: 1, depthOffset: 0 },
    { slot: 15, flags: 0, x: 176, y: 165, width: 24, height: 10, depthOffset: 0 },
  ];
  const wall = { x: 265, y: 99, width: 48, height: 100 };
  assert.equal(originalForegroundOverlaps(wall, actors), false);
  assert.equal(originalForegroundOverlaps(wall, dungeonPresentationOrder(0, actors)), true);
  assert.equal(actors[0].flags, 7);
  actors[0].flags = 0;
  assert.equal(originalForegroundOverlaps(wall, dungeonPresentationOrder(0, actors)), false);
});

test('se mantienen los cinco fotogramas del destello original en ambos modos gráficos', () => {
  for (let frame = 42; frame <= 46; frame++)
    assert.equal(preserveDungeonGlint(0, 24576, frame), true);
  assert.equal(preserveDungeonGlint(0, 24576, 41), false);
  assert.equal(preserveDungeonGlint(0, 20480, 43), false);
  assert.equal(preserveDungeonGlint(1, 24576, 43), false);
});
