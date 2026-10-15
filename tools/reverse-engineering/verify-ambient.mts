import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tickOriginalActors } from '../../packages/engine/src/actor-program.ts';
import { decode } from '../../packages/asset-extractor/src/spr-codec.ts';
import { indexPalette } from '../../packages/asset-extractor/src/shared-palette.ts';
import { decodeBrd } from '../../packages/asset-extractor/src/brd-resources.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const report = JSON.parse(await readFile(root + 'reports/navigation/ambient-audit.json', 'utf8'));
const dungeon = JSON.parse(
  await readFile(root + 'reports/navigation/dungeon-animation.json', 'utf8'),
);
assert.equal(report.profiles.length, 78);
assert.deepEqual(
  report.profiles.map((p: { resourceId: number }) => p.resourceId),
  Array.from({ length: 78 }, (_, i) => i),
);
assert.equal(report.executableSha256, dungeon.executableSha256);
const results = [];
for (const profile of report.profiles) {
  assert.equal(profile.hashes.length, 1000);
  assert.equal(
    createHash('sha256')
      .update(await readFile(root + 'original/DATA/' + profile.sprite))
      .digest('hex'),
    profile.sourceSha256,
  );
  const dimensions: Record<string, [number, number]> = {};
  for (const [bank, name] of [
    [16384, 'MANA.BRD'],
    [20480, 'STD.BRD'],
    [24576, profile.sprite],
  ]) {
    const data = await readFile(root + 'original/DATA/' + name);
    const frames = String(name).endsWith('.BRD')
      ? decodeBrd(data, String(name)).frames
      : decode(data, indexPalette, String(name));
    for (const [i, frame] of frames.entries())
      dimensions[`${bank}:${i}`] = [frame.width, frame.height];
  }
  const state = {
    actors: structuredClone(profile.initial),
    programs: dungeon.programs,
    seed: profile.seed.slice(),
    dimensions,
    firstFreeSlot: profile.firstFreeSlot,
    controls: [0, 0, 0],
    bank: 0,
    collision: 0,
    pendingRoom: null,
    sounds: [],
  };
  let count = 0;
  try {
    for (const expected of profile.hashes) {
      tickOriginalActors(state);
      count++;
      const hash = createHash('sha256').update(Buffer.from(state.actors.flat())).digest('hex');
      if (hash !== expected) throw new Error('hash mismatch');
    }
    results.push({
      resourceId: profile.resourceId,
      verified: true,
      animated: profile.animatedSlots,
    });
  } catch (error) {
    results.push({ resourceId: profile.resourceId, tick: count, error: String(error) });
  }
}
assert.equal(
  results.filter((r) => !r.verified).length,
  0,
  JSON.stringify(results.filter((r) => !r.verified)),
);
const verification = {
  schemaVersion: 1,
  executableSha256: report.executableSha256,
  reportSha256: createHash('sha256')
    .update(await readFile(root + 'reports/navigation/ambient-audit.json'))
    .digest('hex'),
  results,
};
await writeFile(
  root + 'reports/navigation/ambient-verification.json',
  JSON.stringify(verification, null, 2) + '\n',
);
console.log(
  `Contrastados ${results.length * 1000} ciclos de 69 actores en 78 recursos; ${results.filter((r) => r.animated?.length).length} recursos tienen cambios visuales en la captura.`,
);
