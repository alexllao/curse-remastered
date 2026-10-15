import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readIconContext } from './icon-context.js';
import { composeScenePalette, readSceneAssociations, sha256 } from './scene-palette.js';
import { indexPalette, inspectIndices, colorContextPixels } from './shared-palette.js';
import { decode, png } from './spr-codec.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const exe = await readFile(join(root, 'original/CURSE.EXE'));
const context = readIconContext(exe, 159);
const mapName = (process.argv[2] ?? context.sourceContexts[0]?.map ?? '').toUpperCase();
const associations = readSceneAssociations(exe).filter((row) => row.map === mapName);
if (!associations.length)
  throw new Error('Specify a MAP present in the verified executable resource table');
const output = resolve(
  root,
  process.argv[3] ?? 'reports/sprites/interface-context/' + mapName.replace(/\.MAP$/, ''),
);
const dataDir = join(root, 'original/DATA');
const map = await readFile(join(dataDir, mapName));
const shared = await readFile(join(dataDir, 'SPRITES.PAL'));
const palette = composeScenePalette(map, shared);
const spr = await readFile(join(dataDir, 'ICONS.SPR'));
const sprite = decode(spr, indexPalette, 'ICONS.SPR')[159];
if (!sprite) throw new Error('Missing ICONS[159]');
const pixels = colorContextPixels(sprite.pixels, palette);
await mkdir(join(output, 'ICONS'), { recursive: true });
const file = 'ICONS/sprite-159.png';
await writeFile(join(output, file), png(sprite.width, sprite.height, pixels));
const sourceScene = context.sourceContexts.some((row) => row.map === mapName);
const manifest = {
  schemaVersion: 1,
  kind: 'curse-interface-context-palette',
  context,
  activeMap: mapName,
  contextStatus: sourceScene ? 'verified-source-scene-static' : 'conditional-active-map',
  note: 'Baseline colors when this MAP is active. The source scene does not define a permanent inventory palette. Other MAP variants do not prove gameplay reachability.',
  hashes: {
    executable: sha256(exe),
    sprite: sha256(spr),
    map: sha256(map),
    sharedPalette: sha256(shared),
    composedPalette: sha256(palette),
  },
  usedIndices: inspectIndices(sprite.pixels).indices,
  results: [
    {
      source: 'ICONS.SPR',
      status: 'decoded',
      count: 1,
      sprites: [
        {
          index: 159,
          width: sprite.width,
          height: sprite.height,
          paintedPixels: sprite.paintedPixels,
          file,
        },
      ],
    },
  ],
};
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      activeMap: mapName,
      contextStatus: manifest.contextStatus,
      sourceContexts: context.sourceContexts,
      sprite: join(output, file),
      report: join(output, 'manifest.json'),
    },
    null,
    2,
  ),
);
