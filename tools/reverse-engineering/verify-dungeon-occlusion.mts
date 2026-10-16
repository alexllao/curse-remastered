import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { decode } from '../../packages/asset-extractor/src/spr-codec.js';
import {
  composeScenePalette,
  sha256,
  executableSha256,
} from '../../packages/asset-extractor/src/scene-palette.js';
import { indexPalette } from '../../packages/asset-extractor/src/shared-palette.js';
import { originalActorView } from '../../packages/engine/src/actor-program.js';
import { originalForegroundOverlaps } from '../../packages/engine/src/scene-order.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const report = JSON.parse(
  await readFile(root + 'reports/navigation/dungeon-occlusion.json', 'utf8'),
);
const dungeon = JSON.parse(
  await readFile(root + 'reports/navigation/dungeon-animation.json', 'utf8'),
);
const manifest = JSON.parse(await readFile(root + 'reports/playtest/manifest.json', 'utf8'));
const source = await readFile(root + 'original/DATA/DUNGEON.SPR');
assert.equal(report.executableSha256, executableSha256);
assert.equal(sha256(await readFile(root + 'original/CURSE.EXE')), executableSha256);
assert.equal(report.spriteSha256, sha256(source));
assert.equal(dungeon.detailMode, 1);
const sprites = decode(source, indexPalette, 'DUNGEON.SPR');
const foreground = manifest.scenes[0].layers.foreground;
assert.equal(report.pieces.length, foreground.length);
for (const piece of report.pieces) {
  const sprite = sprites[piece.frame];
  const expected: number[][] = [];
  for (let y = 0; y < sprite.height; y++)
    for (let x = 0; x < sprite.width; x++) {
      const at = (y * sprite.width + x) * 4;
      if (sprite.pixels[at + 3])
        expected.push([(piece.y + y) * 320 + piece.x + x, sprite.pixels[at]]);
    }
  assert.deepEqual(piece.writes, expected, `Native VGA differs for foreground ${piece.frame}`);
}
const states = [dungeon.initial, ...dungeon.ticks];
assert.equal(report.cases.length, states.length);
for (const sample of report.cases) {
  const actors = states[sample.tick].map((raw: number[], index: number) =>
    originalActorView(raw, index + 1),
  );
  const expected = foreground
    .filter((piece: { x: number; y: number; width: number; height: number }) =>
      originalForegroundOverlaps(piece, actors),
    )
    .map((piece: { x: number; y: number }) => [piece.x, piece.y]);
  assert.deepEqual(sample.draws, expected, `Foreground selection differs at tick ${sample.tick}`);
}
const background = await readFile(
  root + 'reports/scenes/backgrounds/000-DUNGEON/background.indices.bin',
);
const palette = composeScenePalette(
  await readFile(root + 'original/DATA/DUNGEON.MAP'),
  await readFile(root + 'original/DATA/SPRITES.PAL'),
);
for (const piece of report.pieces) {
  let different = 0;
  const changes = new Map<string, number>();
  for (const [position, index] of piece.writes) {
    const before = background[position];
    if (
      !palette
        .subarray(index * 3, index * 3 + 3)
        .equals(palette.subarray(before * 3, before * 3 + 3))
    ) {
      different++;
      const key = `${before}→${index}`;
      changes.set(key, (changes.get(key) ?? 0) + 1);
    }
  }
  console.log(
    `Pared ${piece.frame}: ${piece.writes.length} píxeles VGA coinciden; ${different} difieren del fondo. ${JSON.stringify([...changes])}`,
  );
}
console.log(
  `DUNGEON: ${states.length} selecciones de primeros planos coinciden con el ejecutable.`,
);
