import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationBounds, panelBounds, chooseFrame } from '../src/frame-layout.ts';

test('el juego conserva 320:200 y deja sitio al marco en todos los formatos', () => {
  for (const ratio of [16 / 10, 16 / 9, 21 / 9, 24 / 9, 32 / 9]) {
    const width = Math.round(1080 * ratio),
      height = 1080;
    const bounds = presentationBounds(width, height, true);
    const gameWidth = bounds.scale * 320,
      gameHeight = bounds.scale * 200;
    assert.ok(Math.abs(gameWidth / gameHeight - 1.6) < 1e-12);
    assert.ok(bounds.x > 0 && width - bounds.x - gameWidth > 0);
    assert.ok(gameWidth <= width && gameHeight <= height);
    for (const right of [false, true]) {
      const margin = right ? width - bounds.x - gameWidth : bounds.x;
      const edge = right ? bounds.x + gameWidth : bounds.x;
      const panel = panelBounds(580, 724, 10, margin, 4, bounds.y, gameHeight, edge, right, true);
      assert.ok(panel.scale * 724 >= gameHeight);
      assert.ok(panel.y <= bounds.y);
      if (right) {
        assert.ok(panel.x + 580 * panel.scale >= width - 0.001);
        assert.ok(Math.abs(panel.x + 10 * panel.scale - (edge - 4)) < 0.001);
      } else {
        assert.ok(panel.x <= 0.001);
        assert.ok(Math.abs(panel.x + 570 * panel.scale - (edge + 4)) < 0.001);
      }
    }
  }
  const noFrame = presentationBounds(1920, 1200);
  assert.deepEqual(noFrame, { scale: 6, x: 0, y: 0 });
});

test('el marco automático respeta asociaciones, respaldo y elección manual', () => {
  const frames = [
    { id: 'bosque', contexts: ['scene:12'] },
    { id: 'castillo' },
    { id: 'mazmorra', contexts: ['scene:0'] },
  ];
  assert.equal(chooseFrame(frames, 'auto', 'scene:0').id, 'mazmorra');
  assert.equal(chooseFrame(frames, 'auto', 'scene:12').id, 'bosque');
  assert.equal(chooseFrame(frames, 'auto', 'scene:99').id, 'castillo');
  assert.equal(chooseFrame(frames, 'bosque', 'scene:0').id, 'bosque');
  assert.equal(chooseFrame([frames[0]], 'auto', 'title').id, 'bosque');
  assert.equal(chooseFrame([], 'auto', 'title'), undefined);
});
