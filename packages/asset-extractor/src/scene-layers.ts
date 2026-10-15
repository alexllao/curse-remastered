import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, png } from './spr-codec.js';
import { composeScenePalette, sha256, executableSha256 } from './scene-palette.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
interface Actor {
  slot: number;
  flags: number;
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
  depthOffset: number;
}
interface Foreground {
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
const data = JSON.parse(
  await readFile(join(root, 'reports/navigation/walking-profile.json'), 'utf8'),
) as {
  executableSha256: string;
  resources: {
    resourceId: number;
    sprite: string;
    spriteSha256: string;
    actors: Actor[];
    foreground: Foreground[];
  }[];
};
if (
  data.executableSha256 !== executableSha256 ||
  sha256(await readFile(join(root, 'original/CURSE.EXE'))) !== executableSha256
)
  throw new Error('Unverified layer profile');
const backgrounds = JSON.parse(
  await readFile(join(root, 'reports/scenes/backgrounds/manifest.json'), 'utf8'),
) as { results: { resourceId: number; map: string }[] };
const shared = await readFile(join(root, 'original/DATA/SPRITES.PAL'));
const resources = [];
for (const row of data.resources) {
  const source = await readFile(join(root, 'original/DATA', row.sprite));
  if (sha256(source) !== row.spriteSha256)
    throw new Error('Scene SPR differs from layer verification');
  const background = backgrounds.results.find((s) => s.resourceId === row.resourceId)!;
  const palette = composeScenePalette(
    await readFile(join(root, 'original/DATA', background.map)),
    shared,
  );
  const sprites = decode(source, palette, row.sprite);
  const actors = row.actors.filter((a) => a.flags !== 0 && !(a.flags & 2) && a.frame !== 255);
  const frames = new Set([
    ...actors.map((a) => a.frame & 127),
    ...row.foreground.map((f) => f.frame),
  ]);
  const folder = `reports/scenes/layers/${String(row.resourceId).padStart(3, '0')}`;
  await mkdir(join(root, folder), { recursive: true });
  const assets = [];
  for (const frame of frames) {
    const sprite = sprites[frame];
    if (!sprite) throw new Error(`Missing layer sprite ${row.resourceId}:${frame}`);
    const file = `${folder}/${frame}.png`;
    await writeFile(join(root, file), png(sprite.width, sprite.height, sprite.pixels));
    assets.push({ frame, file, width: sprite.width, height: sprite.height });
  }
  for (const object of [...actors, ...row.foreground]) {
    const frame = 'slot' in object ? object.frame & 127 : object.frame;
    const image = assets.find((a) => a.frame === frame)!;
    if (object.width !== image.width || object.height !== image.height)
      throw new Error('Original loader and sprite dimensions differ');
  }
  resources.push({
    resourceId: row.resourceId,
    actors: row.actors,
    foreground: row.foreground,
    assets,
  });
}
await writeFile(
  join(root, 'reports/scenes/layers/manifest.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      executableSha256,
      scope: 'Initial visible actors and type-zero foreground; room scripts excluded',
      resources,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    resources: resources.length,
    foreground: resources.reduce((n, r) => n + r.foreground.length, 0),
    assets: resources.reduce((n, r) => n + r.assets.length, 0),
  }),
);
