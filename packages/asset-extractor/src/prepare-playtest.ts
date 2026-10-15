import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unpackRnc1 } from './rnc1.js';
import { unpackRnc2 } from './rnc2.js';
import { png } from './spr-codec.js';
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
const entries = JSON.parse(
  await readFile(join(root, 'reports/navigation/room-entries.json'), 'utf8'),
);
const exeHash = sha256(await readFile(join(root, 'original/CURSE.EXE')));
if (
  navigation.executableSha256 !== exeHash ||
  entries.executableSha256 !== exeHash ||
  entries.stdSha256 !== navigation.stdSha256 ||
  entries.entries.length !== 126 ||
  boxdet.executableSha256 !== exeHash ||
  boxdet.sourceSha256 !== sha256(await readFile(join(root, 'original/DATA/BOXDET.DAT'))) ||
  navigation.stdSha256 !== sha256(await readFile(join(root, 'original/DATA/STD.BRD'))) ||
  boxdet.resources.length !== 78 ||
  navigation.resources.length !== 78
)
  throw new Error('Navigation sources differ: repeat BOXDET and walking verification');
const layers = JSON.parse(
  await readFile(join(root, 'reports/scenes/layers/manifest.json'), 'utf8'),
);
if (layers.executableSha256 !== exeHash || layers.resources.length !== 78)
  throw new Error('Repeat scene-layers extraction');
const scenes = [];
for (const row of report.results) {
  const background = await prepare(
    `reports/scenes/backgrounds/${row.output}/background.png`,
    `fondos/${row.output}.png`,
    true,
  );
  const layer = layers.resources.find(
    (r: { resourceId: number }) => r.resourceId === row.resourceId,
  );
  const layerAssets = [];
  for (const asset of layer.assets)
    layerAssets.push({
      ...(await prepare(
        asset.file,
        `escenario/${String(row.resourceId).padStart(3, '0')}/${asset.frame}.png`,
        false,
      )),
      frame: asset.frame,
    });
  const candidates = entries.entries.filter(
    (entry: { resourceId: number }) => entry.resourceId === row.resourceId,
  );
  const ready = candidates.find(
    (entry: { status: string }) => entry.status === 'normal-walk-ready',
  );
  const regions = boxdet.resources.find(
    (r: { resourceId: number }) => r.resourceId === row.resourceId,
  ).records;
  const entryStatus =
    ready && regions.length
      ? 'normal-walk-ready'
      : candidates.some((entry: { status: string }) => entry.status === 'hidden-player')
        ? 'hidden-player'
        : 'special-entry';
  scenes.push({
    id: row.resourceId,
    name: row.map.replace(/\.MAP$/i, ''),
    background,
    animationLayers: [],
    layers: { actors: layer.actors, foreground: layer.foreground, assets: layerAssets },
    navigation: {
      ...navigation.resources.find((r: { resourceId: number }) => r.resourceId === row.resourceId),
      regions,
      entryStatus,
      spawn: entryStatus === 'normal-walk-ready' ? ready.spawn : null,
    },
  });
}
const presentationTrace = JSON.parse(
  await readFile(join(root, 'reports/navigation/presentation.json'), 'utf8'),
);
if (
  presentationTrace.executableSha256 !== exeHash ||
  presentationTrace.uniqueImageOrder.length !== 16
)
  throw new Error('Repeat original presentation trace');
const presentation = [];
for (const name of presentationTrace.uniqueImageOrder) {
  const png = name.replace(/\.DAT$/i, '.png');
  presentation.push({
    name: name.replace(/\.DAT$/i, ''),
    asset: await prepare(`reports/images/DATA/${png}`, `presentacion/${png}`, true),
  });
}
await prepare('reports/images/DATA/CORE.png', 'interfaz/CORE.png', true);
await mkdir(join(mods, 'remaster/presentacion'), { recursive: true });
const paletteNames: Record<string, string> = {
  TITLE: 'TITLE',
  CAULDRN: 'CAULDRN',
  BALCONY: 'BALCONY',
  BASEBAL: 'BASEBALL',
  BASEBAT: 'BASEBALL',
};
const frames = new Map<string, { pixels: Buffer; palette: Buffer }>();
for (const name of ['TITLE.DAT', ...presentationTrace.uniqueImageOrder]) {
  const source = await readFile(join(root, 'original/DATA', name));
  if (sha256(source) !== presentationTrace.sourceSha256[name])
    throw new Error('Presentation source differs');
  const family = name.replace(/\d*\.DAT$/, '');
  const palette = await readFile(join(root, 'original/DATA', paletteNames[family] + '.PAL'));
  const pixels = Buffer.from(source[3] === 1 ? unpackRnc1(source) : unpackRnc2(source));
  if (pixels.length !== 64000 || palette.length !== 768)
    throw new Error('Invalid presentation image');
  frames.set(name, { pixels, palette });
}
const playbackEvents = [];
const generated = new Map<string, Awaited<ReturnType<typeof prepare>>>();
await mkdir(join(root, 'reports/presentation'), { recursive: true });
for (const event of presentationTrace.timeline) {
  const frame = frames.get(event.file)!;
  const key = sha256(Buffer.concat([Buffer.from(event.file), Buffer.from(event.rgb6)]));
  let asset = generated.get(key);
  if (!asset) {
    const rgba = Buffer.alloc(64000 * 4);
    for (let index = 0; index < 64000; index++) {
      for (let channel = 0; channel < 3; channel++)
        rgba[index * 4 + channel] = Math.round(
          (event.rgb6[frame.pixels[index] * 3 + channel] * 255) / 63,
        );
      rgba[index * 4 + 3] = 255;
    }
    const file = `reports/presentation/${key}.png`;
    await writeFile(join(root, file), png(320, 200, rgba));
    asset = await prepare(file, `presentacion/fundidos/${key}.png`, false);
    generated.set(key, asset);
  }
  const index =
    event.file === 'TITLE.DAT' ? 0 : presentationTrace.uniqueImageOrder.indexOf(event.file) + 1;
  playbackEvents.push({
    tick: event.tick,
    index,
    asset,
    brightness: Math.max(...event.rgb6) / Math.max(...frame.palette),
  });
}
const presentationPlayback = {
  referenceHz: 70,
  physicalTimingVerified: false,
  durationTicks: presentationTrace.durationTicks,
  events: playbackEvents,
};
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
const title = await prepare('reports/TITLE.png', 'interfaz/TITLE.png', true);
await mkdir(join(mods, 'remaster/interfaz'), { recursive: true });
await mkdir(join(mods, 'remaster/fondos'), { recursive: true });
await mkdir(join(mods, 'remaster/ben'), { recursive: true });
await mkdir(join(mods, 'referencias'), { recursive: true });
await writeFile(
  join(mods, 'manifest.json'),
  JSON.stringify(
    {
      schemaVersion: 5,
      logicalWidth: 320,
      logicalHeight: 200,
      scene: 'TITLE',
      scope: 'STD walking and BOXDET test viewer; no room scripts, object use or action execution',
      background,
      title,
      presentation,
      presentationPlayback,
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

const remasterScale = 6;
const guideRows = [
  { name: '0 · TITLE', asset: title },
  ...presentation.map((item, index) => ({
    name: `${index + 1} · ${item.name}`,
    asset: item.asset,
  })),
  ...scenes.map((item, index) => ({
    name: `${index + 17} · ${item.name}`,
    asset: item.background,
  })),
];
await writeFile(
  join(mods, 'referencias/Guia-remaster-x6.txt'),
  [
    'CURSE REMASTERED — TAMAÑOS ×6',
    'Originales: mods/original/. Guardar en mods/remaster/ con la misma ruta y nombre.',
    'Conservar proporción y encuadre. En presentación mantener continuidad entre fotogramas.',
    'Más resolución solo se considera una mejora si aporta detalle real y mantiene la geometría.',
    'Los archivos presentacion/fundidos/ son derivados automáticos; no se remasterizan individualmente.',
    '',
    'Pantalla | Archivo | Original | Remaster ×6',
    ...guideRows.map(
      ({ name, asset }) =>
        `${name} | ${asset.file} | ${asset.width} × ${asset.height} | ${asset.width * remasterScale} × ${asset.height * remasterScale}`,
    ),
  ].join('\n') + '\n',
);
