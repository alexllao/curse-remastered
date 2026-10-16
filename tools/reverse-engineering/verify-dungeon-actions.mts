import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  createDungeon,
  performDungeonAction,
  tickDungeon,
  dungeonWord,
  walkDungeon,
  dungeonNearby,
  type DungeonAction,
} from '../../packages/engine/src/dungeon.js';
import { decode } from '../../packages/asset-extractor/src/spr-codec.js';
import { decodeBrd } from '../../packages/asset-extractor/src/brd-resources.js';
import { indexPalette } from '../../packages/asset-extractor/src/shared-palette.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const report = JSON.parse(await readFile(root + 'reports/navigation/dungeon-actions.json', 'utf8'));
const base = JSON.parse(await readFile(root + 'reports/navigation/dungeon-animation.json', 'utf8'));
const navigation = JSON.parse(
  await readFile(root + 'reports/navigation/walking-profile.json', 'utf8'),
);
const boxdet = JSON.parse(await readFile(root + 'reports/navigation/boxdet.json', 'utf8'));
assert.equal(navigation.executableSha256, report.executableSha256);
assert.equal(boxdet.executableSha256, report.executableSha256);
const dimensions = {};
for (const bank of [
  { bank: 20480, file: 'STD.BRD' },
  { bank: 24576, file: 'DUNGEON.SPR' },
  ...report.banks,
]) {
  const bytes = await readFile(root + 'original/DATA/' + bank.file);
  const frames = bank.file.endsWith('.BRD')
    ? decodeBrd(bytes, bank.file).frames
    : decode(bytes, indexPalette, bank.file);
  for (const [i, f] of frames.entries()) dimensions[`${bank.bank}:${i}`] = [f.width, f.height];
}
const animation = {
  actors: structuredClone(report.initial.actors),
  programs: [],
  seed: report.initial.seed.slice(),
  dimensions,
  firstFreeSlot: base.firstFreeSlot,
  controls: report.initial.controls.slice(),
  bank: report.initial.bank,
  collision: report.initial.collision,
  pendingRoom: null,
  sounds: [],
};
const state = createDungeon(animation, report),
  profile = {
    programBase: navigation.programBase,
    programs: navigation.programs,
    profile: navigation.profile,
  },
  regions = boxdet.resources.find((resource) => resource.resourceId === 0).records;
let freeState: typeof state | undefined;
let cycle = 0;
function compare(expected, label) {
  const differences = animation.actors.flatMap((a, i) =>
    a.flatMap((v, j) =>
      v === expected.actors[i][j] ? [] : [[i + 1, j, v, expected.actors[i][j]]],
    ),
  );
  assert.deepEqual(differences.slice(0, 12), [], `${label}: actors @${cycle}`);
  assert.deepEqual(animation.sounds, expected.sounds, `${label}: sound requests @${cycle}`);
  assert.deepEqual(animation.controls, expected.controls, `${label}: controls @${cycle}`);
  assert.equal(animation.bank, expected.bank, `${label}: bank @${cycle}`);
  assert.deepEqual(animation.seed, expected.seed, `${label}: seed @${cycle}`);
  assert.deepEqual(
    Array.from({ length: 10 }, (_, i) => dungeonWord(state, 0x5225 + i * 2)),
    expected.inventory,
    `${label}: inventory`,
  );
  assert.equal(dungeonWord(state, 0x35c7), expected.score, `${label}: score`);
  assert.deepEqual(
    state.memory.slice(0x35dd, 0x35dd + 80),
    expected.templates,
    `${label}: templates`,
  );
}
compare(report.initial, 'initial');
for (const event of report.events) {
  if (event.kind === 'action') {
    if (event.name === 'take-coin') freeState = structuredClone(state);
    performDungeonAction(state, event.name as DungeonAction, profile);
    compare(event.expected, event.name + ' setup');
  } else if (event.kind === 'walk') {
    walkDungeon(state, event.point, profile);
    compare(event.expected, 'walk setup');
  } else
    for (const expected of event.states) {
      cycle++;
      tickDungeon(state, profile, regions);
      compare(expected, 'tick');
    }
}
console.log(
  `DUNGEON: ${cycle} ciclos, siete acciones, inventario, bancos y puerta contrastados con el EXE.`,
);
assert.equal(state.exited, true);
let menuProbes = 0;
for (const stage of report.menuStages) {
  const a = {
    ...animation,
    actors: structuredClone(stage.state.actors),
    controls: stage.state.controls.slice(),
    bank: stage.state.bank,
  };
  const s = createDungeon(a, report);
  for (const probe of stage.probes) {
    a.actors[0][2] = probe.x & 255;
    a.actors[0][3] = probe.x >> 8;
    a.actors[0][4] = probe.y & 255;
    a.actors[0][5] = probe.y >> 8;
    assert.deepEqual(
      dungeonNearby(s, probe.mask),
      probe.items,
      `${stage.label} nearby ${probe.x},${probe.y}/${probe.mask}`,
    );
    menuProbes++;
  }
}
console.log(`Salida al corredor y ${menuProbes} consultas de objetos contrastadas.`);

const boundaries = JSON.parse(
  await readFile(root + 'reports/navigation/dungeon-boundaries.json', 'utf8'),
);
assert.ok(freeState);
let boundaryCycles = 0;
for (const probe of boundaries) {
  const branch = structuredClone(freeState);
  walkDungeon(branch, { x: probe.target[0], y: probe.target[1] }, profile);
  assert.deepEqual(branch.animation.actors[0], probe.initial.actors[0]);
  for (const expected of probe.states) {
    tickDungeon(branch, profile, regions);
    assert.deepEqual(
      branch.animation.actors[0],
      expected.actors[0],
      `Borde ${probe.target}, ciclo ${boundaryCycles}`,
    );
    boundaryCycles++;
  }
  assert.equal(branch.walk, null, 'El choque debe retirar los canales de paseo');
}
console.log(
  `${boundaryCycles} ciclos de Ben hacia cinco bordes contrastados; sin deriva tras chocar.`,
);
