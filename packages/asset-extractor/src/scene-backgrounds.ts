import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSceneObjects } from './icon-context.js';
import {
  readBackgroundLayouts,
  readMapStrip,
  assembleStrips,
  indexedRgba,
  overlaySprite,
} from './scene-background.js';
import { composeScenePalette, sha256 } from './scene-palette.js';
import { colorContextPixels, indexPalette } from './shared-palette.js';
import { decode, png } from './spr-codec.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const exe = await readFile(join(root, 'original/CURSE.EXE'));
const base = exe.readUInt16LE(8) * 16 + 0x0f31 * 16;
const shared = await readFile(join(root, 'original/DATA/SPRITES.PAL'));
const output = join(root, 'reports/scenes/backgrounds');
await mkdir(output, { recursive: true });
const results = [];
for (const layout of readBackgroundLayouts(exe)) {
  try {
    const map = await readFile(join(root, 'original/DATA', layout.map));
    const palette = composeScenePalette(map, shared);
    const strips = new Map(
      [...new Set(layout.stripOrder.filter((index) => index !== 255))].map((index) => [
        index,
        readMapStrip(map, index),
      ]),
    );
    const background = assembleStrips(layout.stripOrder.map((index) => strips.get(index)?.pixels));
    const rgba = colorContextPixels(indexedRgba(background.indices), palette);
    const name =
      String(layout.resourceId).padStart(3, '0') + '-' + layout.map.replace(/\.MAP$/, '');
    const dir = join(output, name);
    await mkdir(join(dir, 'strips'), { recursive: true });
    await writeFile(join(dir, 'background.png'), png(background.width, background.height, rgba));
    await writeFile(join(dir, 'background.indices.bin'), background.indices);
    for (const strip of strips.values())
      await writeFile(
        join(dir, 'strips', String(strip.index).padStart(3, '0') + '.bin'),
        strip.pixels,
      );
    const spriteData = await readFile(join(root, 'original/DATA', layout.sprite));
    const sprites = decode(spriteData, indexPalette, layout.sprite);
    const ptr = exe.readUInt16LE(base + 0x53b5 + layout.resourceId * 2);
    const objects = parseSceneObjects(exe, base, ptr, layout.resourceId).map((object) => {
      const at = object.recordFileOffset,
        attributes = object.attributesFileOffset;
      const initialFlags = exe[at + 1],
        frame = object.sceneSpriteIndex & 127;
      const sprite = sprites[frame];
      return {
        ...object,
        x: exe.readInt16LE(at + 3),
        y: exe.readInt16LE(at + 5),
        descriptorFlags: exe[at],
        initialFlags,
        frame,
        mirrored: !!(object.sceneSpriteIndex & 128),
        width: sprite?.width,
        height: sprite?.height,
        depthOffset: exe.readInt16LE(attributes),
        visibleInStaticPreview:
          !!sprite &&
          object.sceneSpriteIndex !== 255 &&
          initialFlags !== 0 &&
          !(initialFlags & 2) &&
          !(exe[at] & 128),
      };
    });
    const preview = Buffer.from(rgba);
    const ordered = objects
      .filter((object) => object.visibleInStaticPreview)
      .sort(
        (a, b) => a.y + (a.height ?? 0) + a.depthOffset - (b.y + (b.height ?? 0) + b.depthOffset),
      );
    for (const object of ordered) {
      const sprite = sprites[object.frame];
      overlaySprite(
        preview,
        background.width,
        background.height,
        { ...sprite, pixels: colorContextPixels(sprite.pixels, palette) },
        object.x,
        object.y,
        object.mirrored,
      );
    }
    await writeFile(
      join(dir, 'objects-preview.png'),
      png(background.width, background.height, preview),
    );
    const report = {
      ...layout,
      status: 'decoded',
      scope:
        'Verified background layout and static-record object preview; not a gameplay screenshot. Scripts, player/BRD, foreground scenery and equal-depth ordering are not fully reconstructed.',
      hashes: { map: sha256(map), sceneSprites: sha256(spriteData), palette: sha256(palette) },
      strips: [...strips.values()].map(({ index, fileOffset, packedBytes, pixels }) => ({
        index,
        fileOffset,
        packedBytes,
        decodedBytes: pixels.length,
        sha256: sha256(pixels),
      })),
      objects,
      output: name,
    };
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
    results.push(report);
  } catch (error) {
    results.push({
      resourceId: layout.resourceId,
      map: layout.map,
      status: 'error',
      error: String(error),
    });
  }
}
await writeFile(
  join(output, 'manifest.json'),
  JSON.stringify({ schemaVersion: 1, executableSha256: sha256(exe), results }, null, 2) + '\n',
);
const errors = results.filter((row) => row.status === 'error');
console.log(
  JSON.stringify(
    { resources: results.length, decoded: results.length - errors.length, errors, output },
    null,
    2,
  ),
);
if (errors.length) process.exitCode = 1;
