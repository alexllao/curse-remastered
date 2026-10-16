import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** Cada versión puede aportar gráficos, música, sonidos o cualquier combinación. */
export async function graphicsCatalog(root) {
  let entries = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const names = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'original') continue;
    try {
      if ((await stat(join(root, entry.name, 'graficos'))).isDirectory()) names.push(entry.name);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (!names.includes('remaster')) names.push('remaster');
  names.sort((a, b) =>
    a === 'remaster' ? -1 : b === 'remaster' ? 1 : a.localeCompare(b, 'es', { numeric: true }),
  );
  return {
    schemaVersion: 1,
    packs: [
      { id: 'original', label: 'Original' },
      ...names.map((id) => ({ id, label: id === 'remaster' ? 'Remaster' : id })),
    ],
  };
}
