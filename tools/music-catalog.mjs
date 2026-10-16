import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const priorities = ['.ogg', '.opus', '.mp3', '.m4a', '.wav', '.flac', '.aac', '.mid', '.midi'];
const labels = {
  original: 'Original',
  remaster: 'Remaster',
  amiga: 'Amiga',
  adlib: 'AdLib (OPL2)',
  medieval: 'Medieval',
  cinematic: 'Cinematic',
  symphonic: 'Symphonic',
};
async function entries(path) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
async function metadata(path) {
  try {
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}
/** Solo publica archivos locales; las asociaciones de música son explícitas. */
export async function musicCatalog(root, { enabledVersions } = {}) {
  const versions = [],
    config = await metadata(join(root, 'music.json'));
  for (const folder of await entries(root)) {
    if (!folder.isDirectory() || folder.name.startsWith('.') || folder.name === 'menu') continue;
    if (enabledVersions && !enabledVersions.includes(folder.name)) continue;
    const selected = new Map();
    const loopInfo = await metadata(join(root, folder.name, 'musica', 'loops.json'));
    for (const file of await entries(join(root, folder.name, 'musica'))) {
      if (!file.isFile() || file.name.startsWith('.')) continue;
      const dot = file.name.lastIndexOf('.'),
        extension = file.name.slice(dot).toLowerCase();
      if (!priorities.includes(extension)) continue;
      const id = file.name.slice(0, dot).toUpperCase();
      const track = {
        id,
        label: file.name.slice(0, dot),
        file: `/${encodeURIComponent(folder.name)}/musica/${encodeURIComponent(file.name)}`,
        midi: extension === '.mid' || extension === '.midi',
      };
      const loop = loopInfo.schemaVersion === 1 ? loopInfo.tracks?.[id] : undefined;
      if (
        loop &&
        Number.isFinite(loop.start) &&
        Number.isFinite(loop.end) &&
        loop.start >= 0 &&
        loop.end > loop.start &&
        loop.file === file.name &&
        typeof loop.sha256 === 'string' &&
        /^[a-f0-9]{64}$/.test(loop.sha256)
      ) {
        const hash = createHash('sha256')
          .update(await readFile(join(root, folder.name, 'musica', file.name)))
          .digest('hex');
        if (hash === loop.sha256) {
          track.loopRegion = { start: loop.start, end: loop.end };
          if (loop.transport === 'media') track.loopRegion.transport = 'media';
          track.file += `?v=${hash}`;
        }
      }
      const previous = selected.get(id);
      if (!previous || priorities.indexOf(extension) < previous.priority)
        selected.set(id, { track, priority: priorities.indexOf(extension) });
    }
    if (!selected.size) continue;
    const info = await metadata(join(root, folder.name, 'musica', 'version.json'));
    versions.push({
      id: folder.name,
      label:
        typeof info.label === 'string'
          ? info.label.slice(0, 80)
          : (labels[folder.name] ?? folder.name),
      provisional: info.provisional === true,
      tracks: [...selected.values()]
        .map((item) => item.track)
        .sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true })),
    });
  }
  versions.sort((a, b) =>
    a.id === 'original' ? -1 : b.id === 'original' ? 1 : a.label.localeCompare(b.label, 'es'),
  );
  const native = await metadata(join(root, 'original', 'musica', 'native-contexts.json'));
  const contexts = {};
  if (native.schemaVersion === 1 && native.contexts && typeof native.contexts === 'object')
    for (const [context, track] of Object.entries(native.contexts))
      if (
        /^(?:scene:\d+|core|title|intro)$/.test(context) &&
        typeof track === 'string' &&
        /^CURSE\.RS[1-5]$/.test(track)
      )
        contexts[context] = track;
  if (config.contexts && typeof config.contexts === 'object')
    for (const [context, track] of Object.entries(config.contexts))
      if (typeof track === 'string') contexts[context] = track.toUpperCase();
  let menuTrack;
  try {
    const bytes = await readFile(join(root, 'menu', 'musica', 'menu.mp3'));
    const hash = createHash('sha256').update(bytes).digest('hex');
    menuTrack = {
      id: 'WEB.MENU',
      label: 'Audio de presentación',
      file: `/menu/musica/menu.mp3?v=${hash}`,
      midi: false,
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return { schemaVersion: 1, versions, contexts, ...(menuTrack ? { menuTrack } : {}) };
}
