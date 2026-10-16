import { Buffer } from 'node:buffer';
import { readdir, readFile, open } from 'node:fs/promises';
import { join } from 'node:path';
async function entries(path) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
const validRect = (r, width, height) =>
  r &&
  [r.x, r.y, r.width, r.height].every(Number.isInteger) &&
  r.x >= 0 &&
  r.y >= 0 &&
  r.width > 0 &&
  r.height > 0 &&
  r.x + r.width <= width &&
  r.y + r.height <= height;
/** PNG locales por paquete; los marcos nunca forman parte de los escenarios. */
export async function framesCatalog(root) {
  const frames = new Map();
  for (const pack of await entries(root)) {
    if (!pack.isDirectory() || pack.name.startsWith('.')) continue;
    const directory = join(root, pack.name, 'marcos');
    for (const file of await entries(directory)) {
      if (!file.isFile() || file.name.startsWith('.') || !/\.png$/i.test(file.name)) continue;
      let handle;
      try {
        handle = await open(join(directory, file.name), 'r');
        const header = Buffer.alloc(24);
        if (
          (await handle.read(header, 0, 24, 0)).bytesRead !== 24 ||
          !header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        )
          continue;
        const width = header.readUInt32BE(16),
          height = header.readUInt32BE(20);
        if (width < 2 || height < 1 || width > 16384 || height > 16384) continue;
        let info = {};
        try {
          info = JSON.parse(
            (await readFile(join(directory, file.name + '.json'), 'utf8')).replace(/^\uFEFF/, ''),
          );
        } catch (error) {
          if (error.code !== 'ENOENT') continue;
        }
        if (!info || typeof info !== 'object' || Array.isArray(info)) continue;
        const strip = Math.max(1, Math.floor(width / 10));
        const left = info.left ?? { x: 0, y: 0, width: strip, height };
        const right = info.right ?? { x: width - strip, y: 0, width: strip, height };
        if (!validRect(left, width, height) || !validRect(right, width, height)) continue;
        const id = file.name.slice(0, -4);
        const frame = frames.get(id) ?? {
          id,
          label: id.replaceAll('-', ' '),
          variants: {},
          contexts: [],
        };
        if (Array.isArray(info.contexts))
          frame.contexts = [
            ...new Set([
              ...frame.contexts,
              ...info.contexts.filter(
                (value) =>
                  typeof value === 'string' && /^(title|core|intro|scene:\d+)$/.test(value),
              ),
            ]),
          ];
        if (typeof info.label === 'string' && info.label.trim())
          frame.label = info.label.slice(0, 80);
        frame.variants[pack.name] = {
          url: `/graficos/${encodeURIComponent(pack.name)}/marcos/${encodeURIComponent(file.name)}`,
          width,
          height,
          fit: info.fit === 'cover' ? 'cover' : 'height',
          mirrorRight: info.mirrorRight === true,
          left,
          right,
          innerPadding: {
            left: Number.isFinite(info.innerPadding?.left)
              ? Math.max(0, Math.min(left.width / 2, info.innerPadding.left))
              : 0,
            right: Number.isFinite(info.innerPadding?.right)
              ? Math.max(0, Math.min(right.width / 2, info.innerPadding.right))
              : 0,
          },
        };
        frames.set(id, frame);
      } finally {
        await handle?.close();
      }
    }
  }
  return {
    schemaVersion: 1,
    frames: [...frames.values()].sort((a, b) => a.label.localeCompare(b.label, 'es')),
  };
}
