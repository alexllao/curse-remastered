import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { join, sep } from 'node:path';
const audioExtension = /\.(ogg|opus|mp3|m4a|wav|flac|aac)$/i;
const eventId = (id) => /^\d{1,3}$/.test(id) && Number(id) < 256;

/** Asociaciones explícitas: los índices secuenciales de los WAV no son eventos. */
export async function soundsCatalog(root, prefix = '/sonidos/original/') {
  let files;
  try {
    files = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1, events: {} };
    throw error;
  }
  let mapping = {};
  try {
    mapping = JSON.parse(
      (await readFile(join(root, 'sounds.json'), 'utf8')).replace(/^\uFEFF/, ''),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const realRoot = await realpath(root);
  async function localFile(file) {
    if (typeof file !== 'string' || !audioExtension.test(file) || file.includes('\\')) return;
    const parts = file.split('/');
    if (parts.some((part) => !part || part === '.' || part === '..' || part.includes(':'))) return;
    try {
      const path = await realpath(join(root, ...parts));
      if (!path.startsWith(realRoot + sep) || !(await stat(path)).isFile()) return;
      return prefix + parts.map(encodeURIComponent).join('/');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  async function group(source, numeric = false) {
    const events = {},
      priorities = {};
    if (numeric)
      for (const file of files) {
        const base = file.name.replace(/\.[^.]+$/, '');
        if (file.isFile() && audioExtension.test(file.name) && eventId(base))
          events[String(Number(base))] = prefix + encodeURIComponent(file.name);
      }
    for (const [id, file] of Object.entries(source?.events ?? {})) {
      if (!eventId(id)) continue;
      const url = await localFile(file);
      if (url) events[String(Number(id))] = url;
    }
    for (const [id, priority] of Object.entries(source?.priorities ?? {}))
      if (
        eventId(id) &&
        events[String(Number(id))] &&
        Number.isInteger(priority) &&
        priority >= 0 &&
        priority <= 255
      )
        priorities[String(Number(id))] = priority;
    return { events, ...(Object.keys(priorities).length ? { priorities } : {}) };
  }
  const global = await group(mapping, true),
    scenes = {};
  for (const [resource, source] of Object.entries(mapping.scenes ?? {}))
    if (eventId(resource)) scenes[String(Number(resource))] = await group(source);
  return { schemaVersion: 1, ...global, ...(Object.keys(scenes).length ? { scenes } : {}) };
}

async function containsAudio(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && audioExtension.test(entry.name)) return true;
    if (entry.isDirectory() && (await containsAudio(join(root, entry.name)))) return true;
  }
  return false;
}
export async function soundPacksCatalog(root) {
  let folders;
  try {
    folders = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1, events: {}, versions: [] };
    throw error;
  }
  const versions = [];
  for (const folder of folders) {
    if (!folder.isDirectory() || folder.name.startsWith('.')) continue;
    if (folder.name !== 'original' && !(await containsAudio(join(root, folder.name)))) continue;
    const pack = await soundsCatalog(
      join(root, folder.name),
      `/sonidos/${encodeURIComponent(folder.name)}/`,
    );
    versions.push({
      id: folder.name,
      label:
        { original: 'Original', restored: 'Restaurados', remastered: 'Remasterizados' }[
          folder.name
        ] ?? folder.name,
      events: pack.events,
      ...(pack.priorities ? { priorities: pack.priorities } : {}),
      ...(pack.scenes ? { scenes: pack.scenes } : {}),
    });
  }
  versions.sort((a, b) =>
    a.id === 'original' ? -1 : b.id === 'original' ? 1 : a.label.localeCompare(b.label),
  );
  const original = versions.find((v) => v.id === 'original');
  return {
    schemaVersion: 1,
    events: original?.events ?? {},
    versions,
    ...(original?.priorities ? { priorities: original.priorities } : {}),
    ...(original?.scenes ? { scenes: original.scenes } : {}),
  };
}
