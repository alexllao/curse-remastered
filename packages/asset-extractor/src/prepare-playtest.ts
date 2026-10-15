import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './scene-palette.js';

const root = fileURLToPath(new URL('../../../', import.meta.url)),
  mods = join(root, 'mods');
function pngDimensions(data: Buffer) {
  if (
    data.length < 33 ||
    !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error('Expected extractor PNG');
  const width = data.readUInt32BE(16),
    height = data.readUInt32BE(20);
  if (!width || !height) throw new Error('Invalid PNG dimensions');
  return { width, height };
}
async function prepare(source: string, file: string, remaster = false) {
  const bytes = await readFile(join(root, source)),
    { width, height } = pngDimensions(bytes);
  const output = join(mods, 'original', file);
  await mkdir(join(output, '..'), { recursive: true });
  let existing: Buffer | undefined;
  try {
    existing = await readFile(output);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (existing && sha256(existing) !== sha256(bytes))
    throw new Error('Local original differs: ' + file);
  if (!existing) await copyFile(join(root, source), output);
  return { file, width, height, remaster, source, sourceSha256: sha256(bytes) };
}
const report = JSON.parse(
  await readFile(join(root, 'reports/scenes/backgrounds/manifest.json'), 'utf8'),
) as { results: { resourceId: number; output: string; map: string; status: string }[] };
if (report.results.length !== 78 || report.results.some((row) => row.status !== 'decoded'))
  throw new Error('Expected 78 verified background exports');
const boxdet = JSON.parse(await readFile(join(root, 'reports/navigation/boxdet.json'), 'utf8'));
const navigation = JSON.parse(
  await readFile(join(root, 'reports/navigation/walking-profile.json'), 'utf8'),
);
const exeHash = sha256(await readFile(join(root, 'original/CURSE.EXE')));
if (
  navigation.executableSha256 !== exeHash ||
  boxdet.executableSha256 !== exeHash ||
  boxdet.sourceSha256 !== sha256(await readFile(join(root, 'original/DATA/BOXDET.DAT'))) ||
  navigation.stdSha256 !== sha256(await readFile(join(root, 'original/DATA/STD.BRD'))) ||
  boxdet.resources.length !== 78 ||
  navigation.resources.length !== 78
)
  throw new Error('Navigation sources differ: repeat BOXDET and walking verification');
const scenes = [];
for (const row of report.results) {
  const background = await prepare(
    `reports/scenes/backgrounds/${row.output}/background.png`,
    `fondos/${row.output}.png`,
    true,
  );
  scenes.push({
    id: row.resourceId,
    name: row.map.replace(/\.MAP$/i, ''),
    background,
    animationLayers: [],
    navigation: {
      ...navigation.resources.find((r: { resourceId: number }) => r.resourceId === row.resourceId),
      regions: boxdet.resources.find((r: { resourceId: number }) => r.resourceId === row.resourceId)
        .records,
    },
  });
}
const background = scenes.find((scene) => scene.id === 70)!.background;
const player = [];
for (let index = 0; index < 27; index++)
  player.push(
    await prepare(
      `reports/brd/shared/STD/frame-${String(index).padStart(3, '0')}.png`,
      `ben/STD-${String(index).padStart(3, '0')}.png`,
      false,
    ),
  );
await mkdir(join(mods, 'remaster/fondos'), { recursive: true });
await mkdir(join(mods, 'remaster/ben'), { recursive: true });
await mkdir(join(mods, 'referencias'), { recursive: true });
await writeFile(
  join(mods, 'manifest.json'),
  JSON.stringify(
    {
      schemaVersion: 3,
      logicalWidth: 320,
      logicalHeight: 200,
      scene: 'STUDY',
      scope: 'STD walking and BOXDET test viewer; no room scripts, object use or action execution',
      background,
      scenes,
      player,
      navigationProfile: {
        programBase: navigation.programBase,
        programs: navigation.programs,
        profile: navigation.profile,
      },
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Preparados los 78 fondos y 27 fotogramas originales de Ben. Datos de paseo STD y BOXDET incorporados. No se han modificado tus remasters.',
);
