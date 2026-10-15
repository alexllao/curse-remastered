import { open } from 'node:fs/promises';
import { basename, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve relative input paths from the workspace root, not pnpm's package cwd.
const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const input = process.argv[2];
if (!input) {
  console.error('Usage: pnpm inspect original/CURSE.EXE');
  process.exitCode = 1;
} else {
  const path = isAbsolute(input) ? input : resolve(workspaceRoot, input);
  const file = await open(path, 'r');
  try {
    const size = (await file.stat()).size;
    const bytes = Buffer.alloc(Math.min(size, 64));
    await file.read(bytes, 0, bytes.length, 0);
    console.log(JSON.stringify({
      file: basename(path),
      size,
      format: bytes.subarray(0, 2).toString('ascii') === 'MZ' ? 'DOS MZ' : 'unknown',
      header: bytes.toString('hex')
    }, null, 2));
  } finally {
    await file.close();
  }
}
