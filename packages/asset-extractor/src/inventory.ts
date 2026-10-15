import { createHash } from 'node:crypto';
import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = resolve(root, process.argv[2] ?? 'original');
const output = resolve(root, process.argv[3] ?? 'reports/original-inventory.json');
const entries: Array<{
  path: string;
  extension: string;
  bytes: number;
  sha256: string;
  headerHex: string;
  signature: string;
}> = [];

async function walk(directory: string): Promise<void> {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isSymbolicLink()) continue;
    if (item.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!item.isFile()) continue;
    const data = await readFile(path);
    const extension = extname(item.name).toUpperCase() || '(none)';
    const signature = data.subarray(0, 2).toString('ascii') === 'MZ' ? 'DOS MZ' : 'unknown';
    entries.push({
      path: relative(source, path).replaceAll('\\', '/'),
      extension,
      bytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
      headerHex: data.subarray(0, 32).toString('hex'),
      signature,
    });
  }
}

try {
  if (!(await stat(source)).isDirectory()) throw new Error('Source is not a directory');
  await walk(source);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const extensions = Object.fromEntries(
    [...new Set(entries.map((e) => e.extension))].sort().map((extension) => [
      extension,
      {
        count: entries.filter((e) => e.extension === extension).length,
        bytes: entries
          .filter((e) => e.extension === extension)
          .reduce((sum, e) => sum + e.bytes, 0),
      },
    ]),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    totalFiles: entries.length,
    totalBytes: entries.reduce((sum, e) => sum + e.bytes, 0),
    extensions,
    files: entries,
  };
  await mkdir(resolve(output, '..'), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify(
      { output, totalFiles: report.totalFiles, totalBytes: report.totalBytes, extensions },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
