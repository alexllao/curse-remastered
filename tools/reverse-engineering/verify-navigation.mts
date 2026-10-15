import assert from 'node:assert/strict';
import {
  originalActorOrder,
  originalForegroundOverlaps,
  type OrderedActor,
} from '../../packages/engine/src/scene-order.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  createWalkActor,
  startOriginalWalk,
  tickOriginalWalk,
  resolveOriginalContact,
  enabledOriginalRegion,
  followOriginalCamera,
  advanceOriginalScroll,
  type WalkProfile,
  type BoxRegion,
} from '../../packages/engine/src/original-walk.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const profile: WalkProfile = JSON.parse(
  await readFile(root + 'reports/navigation/walking-profile.json', 'utf8'),
);
const report = JSON.parse(
  await readFile(root + 'reports/navigation/walking-verification.json', 'utf8'),
) as {
  executableSha256: string;
  trajectories: {
    initialFrame: number;
    target: number[];
    records: number[][];
    ticks: number[][];
  }[];
  conditions: { argument: number; state: Record<string, number>; enabled: boolean }[];
  camera: { center: number; direction: string }[];
  scrolls: { direction: number; pixelOffsets: number[] }[];
};
assert.equal(
  report.executableSha256,
  'f2c0046e07b25f408516edae5d6a66c06107971fb95c55ed770fa52a6b4ecd8d',
);
for (const [index, trajectory] of report.trajectories.entries()) {
  const actor = createWalkActor(145, 127, trajectory.initialFrame);
  const regions: BoxRegion[] = trajectory.records.map(
    ([type, argument, left, top, right, bottom]) => ({ type, argument, left, top, right, bottom }),
  );
  startOriginalWalk(actor, { x: trajectory.target[0], y: trajectory.target[1] }, profile);
  for (const [tick, expected] of trajectory.ticks.entries()) {
    const previous = { x: actor.x, y: actor.y };
    tickOriginalWalk(actor, profile);
    resolveOriginalContact(actor, previous, regions);
    assert.deepEqual(
      [actor.x, actor.y, actor.frame, actor.remaining],
      expected,
      `Trajectory ${index}, tick ${tick}`,
    );
  }
}
for (const condition of report.conditions)
  assert.equal(
    enabledOriginalRegion(condition.argument, condition.state),
    condition.enabled,
    `Condition ${condition.argument}`,
  );
for (const test of report.camera) {
  const camera = followOriginalCamera(test.center - 16 + 320, 320, 960);
  assert.equal(
    Math.sign(camera - 320),
    test.direction === 'left' ? -1 : test.direction === 'right' ? 1 : 0,
  );
}
for (const scroll of report.scrolls) {
  let position = 0;
  const positions = [0];
  for (let step = 0; step < 8; step++) {
    position = advanceOriginalScroll(position, scroll.direction * 32);
    positions.push(position);
  }
  assert.deepEqual(positions, scroll.pixelOffsets, 'CRTC scrolling progression');
}
const order = JSON.parse(
  await readFile(root + 'reports/navigation/scene-order-verification.json', 'utf8'),
) as {
  executableSha256: string;
  orderCases: { actors: OrderedActor[]; previous: number[]; expected: number[] }[];
  foregroundCases: {
    piece: { x: number; y: number; width: number; height: number };
    actors: OrderedActor[];
    expected: boolean;
  }[];
};
assert.equal(order.executableSha256, report.executableSha256);
for (const test of order.orderCases)
  assert.deepEqual(originalActorOrder(test.actors, test.previous), test.expected);
for (const test of order.foregroundCases)
  assert.equal(originalForegroundOverlaps(test.piece, test.actors), test.expected);
console.log(
  `Contrastadas ${order.orderCases.length} ordenaciones de 69 actores y ${order.foregroundCases.length} superposiciones originales.`,
);
console.log(
  `Contrastados ${report.trajectories.length} recorridos ciclo a ciclo, ${report.conditions.length} condiciones y ${report.camera.length} umbrales de cámara y ambas secuencias de scroll con el ejecutable original.`,
);
