import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeBrd, readLogicalRooms } from './brd-resources.js';
import { readVerifiedBrdScriptContexts } from './brd-script-context.js';
import { composeScenePalette, sha256 } from './scene-palette.js';
import { colorContextPixels, colorSharedPixels, inspectIndices } from './shared-palette.js';
import { png } from './spr-codec.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dataDir = join(root, 'original/DATA'),
  output = join(root, 'reports/brd');
const exe = await readFile(join(root, 'original/CURSE.EXE'));
const rooms = readLogicalRooms(exe);
const scriptContexts = readVerifiedBrdScriptContexts(exe);
const shared = await readFile(join(dataDir, 'SPRITES.PAL'));
const results = [],
  errors = [];
for (const source of (await readdir(dataDir)).filter((name) => /\.BRD$/i.test(name)).sort()) {
  try {
    const data = await readFile(join(dataDir, source)),
      name = source.replace(/\.BRD$/i, '');
    const decoded = decodeBrd(data, source);
    const contexts: {
      map: string;
      status: string;
      frames?: number[];
      evidence?: unknown;
    }[] = [
      ...[...new Set(rooms.filter((room) => room.brd === source).map((room) => room.map))].map(
        (map) => ({ map, status: 'initial-room-descriptor-context' }),
      ),
      ...scriptContexts.filter((context) => context.source === source),
    ];
    const palettes = await Promise.all(
      contexts.map(async (context) => {
        const mapData = await readFile(join(dataDir, context.map));
        return {
          ...context,
          palette: composeScenePalette(mapData, shared),
          mapSha256: sha256(mapData),
        };
      }),
    );
    await mkdir(join(output, 'indexed', name), { recursive: true });
    await mkdir(join(output, 'shared', name), { recursive: true });
    const sprites = [],
      contextual = [],
      frames = [];
    for (const [index, frame] of decoded.frames.entries()) {
      const stem = 'frame-' + String(index).padStart(3, '0');
      const indexed = 'indexed/' + name + '/' + stem + '.rgba-indices.bin';
      await writeFile(join(output, indexed), frame.pixels);
      const usage = inspectIndices(frame.pixels);
      frames.push({
        index,
        width: frame.width,
        height: frame.height,
        paintedPixels: frame.paintedPixels,
        indexed,
        usedIndices: usage.indices,
        sceneDependentPixels: usage.sceneDependentPixels,
        animatedPixels: usage.animatedPixels,
      });
      if (!usage.sceneDependentPixels && !usage.animatedPixels) {
        const file = 'shared/' + name + '/' + stem + '.png';
        await writeFile(
          join(output, file),
          png(frame.width, frame.height, colorSharedPixels(frame.pixels, shared)),
        );
        sprites.push({
          index,
          width: frame.width,
          height: frame.height,
          paintedPixels: frame.paintedPixels,
          file,
        });
      } else {
        const variants = [];
        for (const {
          map,
          palette,
          mapSha256,
          status,
          frames: selectedFrames,
          evidence,
        } of palettes) {
          if (selectedFrames && !selectedFrames.includes(index)) continue;
          const folder = 'contexts/' + name + '/' + map.replace(/\.MAP$/i, '');
          await mkdir(join(output, folder), { recursive: true });
          const file = folder + '/' + stem + '.png';
          await writeFile(
            join(output, file),
            png(frame.width, frame.height, colorContextPixels(frame.pixels, palette)),
          );
          variants.push({
            map,
            file,
            mapSha256,
            paletteSha256: sha256(palette),
            status,
            evidence,
          });
        }
        contextual.push({
          index,
          variants,
          contextStatus: variants.length ? 'known-context' : 'not-yet-associated',
          note: 'Runtime script changes may select additional BRD/MAP combinations',
        });
      }
    }
    results.push({
      source,
      sourceSha256: sha256(data),
      status: 'decoded',
      integrityStatus: decoded.issues.length ? 'valid-prefix-only' : 'valid-index-table',
      indexIssues: decoded.issues,
      sourceFramesDecoded: decoded.frames.length,
      count: sprites.length,
      sprites,
      frames,
      contextual,
      initialRoomDescriptors: rooms.filter((room) => room.brd === source),
    });
  } catch (error) {
    errors.push({ source, error: String(error) });
  }
}
await mkdir(output, { recursive: true });
const summary = {
  files: results.length,
  frames: results.reduce((n, row) => n + row.sourceFramesDecoded, 0),
  sharedPngs: results.reduce((n, row) => n + row.count, 0),
  contextualFrames: results.reduce((n, row) => n + row.contextual.length, 0),
  contextualPngs: results.reduce(
    (n, row) => n + row.contextual.reduce((m, frame) => m + frame.variants.length, 0),
    0,
  ),
  unresolvedContextualFrames: results.reduce(
    (n, row) => n + row.contextual.filter((frame) => frame.variants.length === 0).length,
    0,
  ),
  partialIndexFiles: results
    .filter((row) => row.indexIssues.length)
    .map((row) => ({ source: row.source, issues: row.indexIssues })),
  errors,
};
await writeFile(
  join(output, 'manifest.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      executableSha256: sha256(exe),
      sharedSha256: sha256(shared),
      note: 'BRD frame indices decoded with the unchanged SPR geometry algorithm; indexed RGBA preserves indices and transparency. Palette contexts come from verified initial room descriptors and explicitly observed original script frame selections; runtime scripts are not exhaustively covered.',
      summary,
      rooms,
      scriptContexts,
      results,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify({ ...summary, output }, null, 2));
if (errors.length) process.exitCode = 1;
