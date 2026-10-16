import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { prepareOriginalHud } from './original-hud.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unpackRnc1 } from './rnc1.js';
import { unpackRnc2 } from './rnc2.js';
import { png } from './spr-codec.js';
import { decodeBrd } from './brd-resources.js';
import { decode } from './spr-codec.js';
import { indexPalette, colorContextPixels } from './shared-palette.js';
import { composeScenePalette } from './scene-palette.js';
import { sha256 } from './scene-palette.js';

const root = fileURLToPath(new URL('../../../', import.meta.url)),
  assetsRoot = join(root, 'assets');
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
  const output = join(assetsRoot, 'original/graficos', file);
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
// DUNGEON: entrada inicial -1, MANA encadenado y canales ambientales contrastados.
const dungeon = JSON.parse(
  await readFile(join(root, 'reports/navigation/dungeon-animation.json'), 'utf8'),
);
if (
  dungeon.executableSha256 !== exeHash ||
  dungeon.detailMode !== 1 ||
  dungeon.ticks.length !== 1000
)
  throw new Error('Repeat DUNGEON animation trace');
const dungeonActions = JSON.parse(
  await readFile(join(root, 'reports/navigation/dungeon-actions.json'), 'utf8'),
);
if (dungeonActions.executableSha256 !== exeHash) throw new Error('Repeat DUNGEON action trace');
for (const [name, hash] of Object.entries(dungeonActions.sourceSha256))
  if (sha256(await readFile(join(root, 'original/DATA', name))) !== hash)
    throw new Error('DUNGEON action source changed');
const dungeonAssets = [],
  dimensions: Record<string, [number, number]> = {};
const dungeonPalette = composeScenePalette(
  await readFile(join(root, 'original/DATA/DUNGEON.MAP')),
  await readFile(join(root, 'original/DATA/SPRITES.PAL')),
);
for (const [bank, name] of [
  [16384, 'MANA.BRD'],
  [20480, 'STD.BRD'],
  [24576, 'DUNGEON.SPR'],
  ...dungeonActions.banks
    .filter((b: { mode: number }) => b.mode !== 0)
    .map((b: { bank: number; file: string }) => [b.bank, b.file] as const),
] as const) {
  const source = await readFile(join(root, 'original/DATA', name));
  if (sha256(source) !== (dungeon.sourceSha256[name] ?? dungeonActions.sourceSha256[name]))
    throw new Error('DUNGEON animation source differs');
  const decoded = name.endsWith('.BRD')
    ? decodeBrd(source, name).frames
    : decode(source, indexPalette, name);
  for (const [index, image] of decoded.entries())
    dimensions[`${bank}:${index}`] = [image.width, image.height];
  // Las acciones pueden alcanzar fotogramas que no aparecen en la animación ambiental.
  const used = new Set<number>(decoded.map((_, i) => i));
  for (const frame of used) {
    const image = decoded[frame];
    const sourceFile = `reports/scenes/layers/000/animation-${bank}-${frame}.png`;
    await writeFile(
      join(root, sourceFile),
      png(image.width, image.height, colorContextPixels(image.pixels, dungeonPalette)),
    );
    dungeonAssets.push({
      ...(await prepare(sourceFile, `escenario/000/animation-${bank}-${frame}.png`, false)),
      bank,
      frame,
    });
  }
}
Object.assign(
  scenes.find((scene) => scene.id === 0)!,
  {
    animation: {
      includePlayer: true,
      actors: dungeon.initial,
      programs: [],
      seed: dungeon.seed,
      dimensions,
      firstFreeSlot: dungeon.firstFreeSlot,
      controls: [0, 0, 0],
      bank: 0,
      collision: 0,
      pendingRoom: null,
      sounds: [],
      assets: dungeonAssets,
      cyclePulses: 5,
      referenceHz: 70,
      scope: 'DUNGEON initial and action programs; native action trace exported separately',
    },
  },
);
// Los demás recursos conservan el paseo STD y ejecutan solo sus actores ambientales.
const ambientBytes = await readFile(join(root, 'reports/navigation/ambient-audit.json'));
const ambient = JSON.parse(ambientBytes.toString('utf8'));
const ambientVerification = JSON.parse(
  await readFile(join(root, 'reports/navigation/ambient-verification.json'), 'utf8'),
);
if (
  ambient.executableSha256 !== exeHash ||
  ambient.detailMode !== 1 ||
  ambient.profiles.length !== 78 ||
  ambientVerification.reportSha256 !== sha256(ambientBytes) ||
  ambientVerification.results.length !== 78 ||
  ambientVerification.results.some((result: { verified: boolean }) => !result.verified)
)
  throw new Error('Repeat ambient trace and native comparison');
for (const profile of ambient.profiles) {
  if (profile.resourceId === 0) continue;
  const record = scenes.find((scene) => scene.id === profile.resourceId)!;
  const source = await readFile(join(root, 'original/DATA', profile.sprite));
  if (sha256(source) !== profile.sourceSha256) throw new Error('Ambient source differs');
  const decoded = decode(source, indexPalette, profile.sprite);
  const palette = composeScenePalette(
    await readFile(join(root, 'original/DATA', record.name + '.MAP')),
    await readFile(join(root, 'original/DATA/SPRITES.PAL')),
  );
  const assets = [],
    frameDimensions: Record<string, [number, number]> = {};
  const folder = `reports/scenes/layers/${String(record.id).padStart(3, '0')}`;
  for (const [frame, image] of decoded.entries()) {
    frameDimensions[`24576:${frame}`] = [image.width, image.height];
    const sourceFile = `${folder}/animation-24576-${frame}.png`;
    await writeFile(
      join(root, sourceFile),
      png(image.width, image.height, colorContextPixels(image.pixels, palette)),
    );
    assets.push({
      ...(await prepare(
        sourceFile,
        `escenario/${String(record.id).padStart(3, '0')}/animation-24576-${frame}.png`,
        false,
      )),
      bank: 24576,
      frame,
    });
  }
  Object.assign(record, {
    animation: {
      actors: profile.initial,
      programs: [],
      seed: profile.seed,
      dimensions: frameDimensions,
      firstFreeSlot: profile.firstFreeSlot,
      controls: [0, 0, 0],
      bank: 0,
      collision: 0,
      pendingRoom: null,
      sounds: [],
      assets,
      cyclePulses: 5,
      referenceHz: 70,
      includePlayer: false,
      scope: 'Initial ambient channels only; no interactions or dynamic handlers',
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
const core = await prepare('reports/images/DATA/CORE.png', 'interfaz/CORE.png', true);
await mkdir(join(assetsRoot, 'remaster/graficos/presentacion'), { recursive: true });
const paletteNames: Record<string, string> = {
  CORE: 'CORE',
  TITLE: 'TITLE',
  CAULDRN: 'CAULDRN',
  BALCONY: 'BALCONY',
  BASEBAL: 'BASEBALL',
  BASEBAT: 'BASEBALL',
};
const startupTrace = JSON.parse(
  await readFile(join(root, 'reports/navigation/startup.json'), 'utf8'),
);
const frames = new Map<string, { pixels: Buffer; palette: Buffer }>();
for (const name of ['CORE.DAT', 'TITLE.DAT', ...presentationTrace.uniqueImageOrder]) {
  const source = await readFile(join(root, 'original/DATA', name));
  if (sha256(source) !== (presentationTrace.sourceSha256[name] ?? startupTrace.sourceSha256[name]))
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

if (
  startupTrace.executableSha256 !== exeHash ||
  startupTrace.holdTicks !== 2100 ||
  startupTrace.durationTicks !== 2132 ||
  startupTrace.events.length !== 33
)
  throw new Error('Repeat CORE startup trace');
for (const [name, hash] of Object.entries(startupTrace.sourceSha256))
  if (sha256(await readFile(join(root, 'original/DATA', name))) !== hash)
    throw new Error('Startup resource differs');
const coreFrame = frames.get('CORE.DAT')!,
  startupEvents = [];
for (const event of startupTrace.events) {
  const rgba = Buffer.alloc(64000 * 4);
  for (let index = 0; index < 64000; index++) {
    for (let channel = 0; channel < 3; channel++)
      rgba[index * 4 + channel] = Math.round(
        (event.rgb6[coreFrame.pixels[index] * 3 + channel] * 255) / 63,
      );
    rgba[index * 4 + 3] = 255;
  }
  const key = sha256(Buffer.from(event.rgb6));
  const file = `reports/presentation/core-${key}.png`;
  await writeFile(join(root, file), png(320, 200, rgba));
  startupEvents.push({
    tick: event.tick,
    brightness: Math.max(...event.rgb6) / 63,
    asset: await prepare(file, `arranque/core-${key}.png`, false),
  });
}
const startupPlayback = {
  holdTicks: 2100,
  durationTicks: 2132,
  referenceHz: 70,
  physicalTimingVerified: false,
  events: startupEvents,
};
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
const originalHud = await prepareOriginalHud(root, prepare);
const title = await prepare('reports/TITLE.png', 'interfaz/TITLE.png', true);
await mkdir(join(assetsRoot, 'remaster/graficos/interfaz'), { recursive: true });
await mkdir(join(assetsRoot, 'remaster/graficos/fondos'), { recursive: true });
await mkdir(join(assetsRoot, 'remaster/graficos/ben'), { recursive: true });
await mkdir(join(root, 'reports/referencias'), { recursive: true });
await mkdir(join(root, 'reports/playtest'), { recursive: true });
await writeFile(
  join(root, 'reports/playtest/manifest.json'),
  JSON.stringify(
    {
      schemaVersion: 7,
      logicalWidth: 320,
      logicalHeight: 200,
      scene: 'TITLE',
      scope: 'STD walking and BOXDET test viewer; no room scripts, object use or action execution',
      background,
      title,
      core,
      startupPlayback,
      presentation,
      presentationPlayback,
      actorPrograms: dungeon.programs,
      dungeon: { memory: dungeonActions.memory, banks: dungeonActions.banks },
      scenes,
      player,
      originalHud,
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
  join(root, 'reports/referencias/Guia-remaster-x6.txt'),
  [
    'CURSE REMASTERED — TAMAÑOS ×6',
    'Originales: assets/original/graficos/. Guardar en assets/remaster/graficos/ con la misma ruta y nombre.',
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
