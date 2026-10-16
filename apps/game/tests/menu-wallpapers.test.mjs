import test from 'node:test';
import assert from 'node:assert/strict';
import { menuWallpaperCandidates } from '../src/menu-wallpapers.ts';

test('elige el wallpaper por proporción, también al cambiar monitor o fullscreen', () => {
  for (const [width, height, expected] of [
    [5120, 1440, '32x9'],
    [3840, 1080, '32x9'],
    [3840, 1440, '24x9'],
    [1920, 1080, '16x9'],
    [2560, 1600, '16x10'],
    [1080, 1920, '16x10'],
    [3440, 1440, '24x9'],
  ]) {
    const candidates = menuWallpaperCandidates(width, height);
    assert.equal(candidates[0], `/menu/graficos/WALLPAPER-${expected}.png`);
    assert.equal(new Set(candidates).size, 4);
  }
});
