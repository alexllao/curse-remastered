import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  tickOriginalActors,
  originalRandom,
  type ActorPrograms,
} from '../../packages/engine/src/actor-program.js';
import { decode } from '../../packages/asset-extractor/src/spr-codec.js';
import { indexPalette } from '../../packages/asset-extractor/src/shared-palette.js';
import { decodeBrd } from '../../packages/asset-extractor/src/brd-resources.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const report = JSON.parse(
  await readFile(root + 'reports/navigation/dungeon-animation.json', 'utf8'),
);
const dimensions: ActorPrograms['dimensions'] = {};
for (const [bank, name] of [
  [16384, 'MANA.BRD'],
  [20480, 'STD.BRD'],
  [24576, 'DUNGEON.SPR'],
] as const) {
  const bytes = await readFile(root + 'original/DATA/' + name);
  const frames = name.endsWith('.BRD')
    ? decodeBrd(bytes, name).frames
    : decode(bytes, indexPalette, name);
  for (const [index, frame] of frames.entries())
    dimensions[`${bank}:${index}`] = [frame.width, frame.height];
}
const state: ActorPrograms = {
  actors: structuredClone(report.initial),
  programs: report.programs,
  seed: report.seed.slice(),
  dimensions,
  firstFreeSlot: report.firstFreeSlot,
  controls: [0, 0, 0],
  bank: 0,
  collision: 0,
  pendingRoom: null,
  sounds: [],
};
for (const [index, expected] of report.ticks.entries()) {
  tickOriginalActors(state);
  assert.deepEqual(state.actors, expected, `DUNGEON differs at tick ${index + 1}`);
}
console.log('DUNGEON: 1000 ciclos de 69 actores coinciden byte a byte con el intérprete original.');

assert.deepEqual(state.controls, report.controlsAfterTicks);
for (const sample of report.randomCases) {
  const seed = sample.seed.slice();
  assert.equal(originalRandom(seed, sample.limit), sample.result);
  assert.deepEqual(seed, sample.nextSeed);
}
assert.deepEqual(
  report.clockCases.map((sample: { ready: boolean }) => sample.ready),
  [false, false, true, true, true],
);
console.log(
  'Contrastados también 32 casos aleatorios y el umbral de cinco pulsos del temporizador.',
);
