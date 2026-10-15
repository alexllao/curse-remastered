import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBackgroundLayouts } from './scene-background.js';
import { executableSha256, sha256 } from './scene-palette.js';
import { readBoxdet } from './boxdet.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const exe = await readFile(join(root, 'original/CURSE.EXE'));
const data = await readFile(join(root, 'original/DATA/BOXDET.DAT'));
const resources = readBackgroundLayouts(exe).map((scene) => ({
  ...readBoxdet(data, scene.resourceId),
  map: scene.map,
  width: scene.width,
  height: scene.height,
}));
const output = join(root, 'reports/navigation');
await mkdir(output, { recursive: true });
await writeFile(
  join(output, 'boxdet.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      kind: 'curse-boxdet-records',
      executableSha256,
      source: 'original/DATA/BOXDET.DAT',
      sourceSha256: sha256(data),
      status: 'extracted-raw-records',
      limitations: [
        'Resource backgrounds are not logical rooms or complete game states',
        'Types and arguments are preserved; conditional actions are not evaluated',
        'No pathfinding, camera conversion, actor footprint or room transitions implemented',
      ],
      resources,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    resources: resources.length,
    records: resources.reduce((n, r) => n + r.records.length, 0),
    output,
  }),
);
