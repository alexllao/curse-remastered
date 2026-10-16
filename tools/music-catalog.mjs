import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const priorities = ['.ogg', '.opus', '.mp3', '.m4a', '.wav', '.flac', '.aac', '.mid', '.midi'];
const labels = {
  original: 'Original',
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
export async function musicCatalog(root) {
  const versions = [],
    config = await metadata(join(root, 'music.json'));
  for (const folder of await entries(root)) {
    if (!folder.isDirectory() || folder.name.startsWith('.')) continue;
    const selected = new Map();
    for (const file of await entries(join(root, folder.name))) {
      if (!file.isFile() || file.name.startsWith('.')) continue;
      const dot = file.name.lastIndexOf('.'),
        extension = file.name.slice(dot).toLowerCase();
      if (!priorities.includes(extension)) continue;
      const id = file.name.slice(0, dot).toUpperCase();
      const track = {
        id,
        label: file.name.slice(0, dot),
        file: `/musica/${encodeURIComponent(folder.name)}/${encodeURIComponent(file.name)}`,
        midi: extension === '.mid' || extension === '.midi',
      };
      const previous = selected.get(id);
      if (!previous || priorities.indexOf(extension) < previous.priority)
        selected.set(id, { track, priority: priorities.indexOf(extension) });
    }
    if (!selected.size) continue;
    const info = await metadata(join(root, folder.name, 'version.json'));
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
  const contexts = {};
  if (config.contexts && typeof config.contexts === 'object')
    for (const [context, track] of Object.entries(config.contexts))
      if (typeof track === 'string') contexts[context] = track.toUpperCase();
  return { schemaVersion: 1, versions, contexts };
}
