import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeScenePalette, readSceneAssociations, sha256 } from './scene-palette.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const absolute = (p: string): string => (isAbsolute(p) ? p : resolve(root, p));
const exePath = absolute(process.argv[2] ?? 'original/CURSE.EXE');
const dataDir = absolute(process.argv[3] ?? 'original/DATA');
const outputDir = absolute(process.argv[4] ?? 'reports/palettes/scenes');
const exe = await readFile(exePath);
const associations = readSceneAssociations(exe);
const names = await readdir(dataDir);
const byName = new Map(names.map((name) => [name.toUpperCase(), name]));
const resourcePath = (name: string): string => {
  const actual = byName.get(name);
  if (!actual) throw new Error('Missing resource: ' + name);
  return join(dataDir, actual);
};
const shared = await readFile(resourcePath('SPRITES.PAL'));
await mkdir(outputDir, { recursive: true });
const recipes = [];
for (const [mapName, spriteName] of new Map(associations.map((row) => [row.map, row.sprite]))) {
  const mapPath = resourcePath(mapName);
  const map = await readFile(mapPath);
  const palette = composeScenePalette(map, shared);
  const palettePath = join(outputDir, mapName.replace(/\.MAP$/, '.PAL'));
  await writeFile(palettePath, palette);
  recipes.push({
    map: mapName,
    sprite: spriteName,
    resourceIds: associations
      .filter((row) => row.map === mapName && row.sprite === spriteName)
      .map((row) => row.resourceId),
    status: 'verified-static' as const,
    mapSha256: sha256(map),
    spriteSha256: sha256(await readFile(resourcePath(spriteName))),
    paletteSha256: sha256(palette),
    palette: relative(root, palettePath).replaceAll('\\', '/'),
    sources: [
      { file: relative(root, mapPath).replaceAll('\\', '/'), offset: 0, bytes: 576, firstIndex: 0 },
      {
        file: relative(root, resourcePath('SPRITES.PAL')).replaceAll('\\', '/'),
        offset: 576,
        bytes: 192,
        firstIndex: 192,
      },
    ],
  });
}
const associated = new Set(recipes.map((row) => row.sprite));
const report = {
  schemaVersion: 1,
  kind: 'curse-scene-palettes',
  status: 'verified-static',
  scope:
    'Baseline scene-load DAC palette, not every runtime state. Index 255 can be animated; fades also change the DAC.',
  executableSha256: sha256(exe),
  sharedSha256: sha256(shared),
  evidence: {
    dataSegment: '0x0F31',
    tableFileOffset: '0x16D5E',
    tableStride: 8,
    mapPaletteRead: '0x50E5-0x50ED',
    spriteLoad: '0x512C-0x519B',
    sharedRead: '0x874-0x89A',
    dacWriter: '0x7A7E-0x7A8D',
    sceneUpload: '0x5446-0x5453',
  },
  associations,
  recipes,
  unresolvedSprites: names
    .filter((name) => /\.SPR$/i.test(name) && !associated.has(name.toUpperCase()))
    .sort(),
  pending: [
    'Runtime captures for fades and animated index 255',
    'Shared/UI sprites have no single verified scene association',
    'Table record 78 has a MAP pointer but no SPR pointer; excluded',
  ],
};
const target = join(outputDir, 'manifest.json');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      associations: associations.length,
      palettes: recipes.length,
      unresolvedSprites: report.unresolvedSprites,
      report: target,
    },
    null,
    2,
  ),
);
