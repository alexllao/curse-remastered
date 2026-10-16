import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
/** El nombre numérico identifica el argumento del evento original, no una escena. */
export async function soundsCatalog(root) {
  let files;
  try {
    files = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1, events: {} };
    throw error;
  }
  const media = files.filter(
    (f) => f.isFile() && /\.(ogg|opus|mp3|m4a|wav|flac|aac)$/i.test(f.name),
  );
  let mapping = {};
  try {
    mapping = JSON.parse(
      (await readFile(join(root, 'sounds.json'), 'utf8')).replace(/^\uFEFF/, ''),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const events = {};
  for (const file of media) {
    const base = file.name.replace(/\.[^.]+$/, '');
    if (/^\d{1,3}$/.test(base) && Number(base) < 256) events[String(Number(base))] = file.name;
  }
  for (const [id, file] of Object.entries(mapping.events ?? {}))
    if (/^\d{1,3}$/.test(id) && Number(id) < 256 && media.some((f) => f.name === file))
      events[String(Number(id))] = file;
  return {
    schemaVersion: 1,
    events: Object.fromEntries(
      Object.entries(events).map(([id, file]) => [
        id,
        `/sonidos/original/${encodeURIComponent(file)}`,
      ]),
    ),
  };
}

async function containsAudio(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && /\.(ogg|opus|mp3|m4a|wav|flac|aac)$/i.test(entry.name)) return true;
    if (entry.isDirectory() && (await containsAudio(join(root, entry.name)))) return true;
  }
  return false;
}
/** Cada carpeta es un paquete; solo se usan asociaciones de eventos explícitas. */
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
    const pack = await soundsCatalog(join(root, folder.name));
    const prefix = `/sonidos/${encodeURIComponent(folder.name)}/`;
    versions.push({
      id: folder.name,
      label:
        { original: 'Original', restored: 'Restaurados', remastered: 'Remasterizados' }[
          folder.name
        ] ?? folder.name,
      events: Object.fromEntries(
        Object.entries(pack.events).map(([id, file]) => [
          id,
          file.replace('/sonidos/original/', prefix),
        ]),
      ),
    });
  }
  versions.sort((a, b) =>
    a.id === 'original' ? -1 : b.id === 'original' ? 1 : a.label.localeCompare(b.label),
  );
  return {
    schemaVersion: 1,
    events: versions.find((v) => v.id === 'original')?.events ?? {},
    versions,
  };
}
