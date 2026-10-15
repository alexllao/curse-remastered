import { open } from 'node:fs/promises';
import { basename } from 'node:path';
const path = process.argv[2];
if (!path) { console.error('Usage: pnpm inspect <path-to-file>'); process.exitCode = 1; }
else { const f = await open(path, 'r'); try { const size = (await f.stat()).size; const bytes = Buffer.alloc(Math.min(size,64)); await f.read(bytes,0,bytes.length,0); console.log(JSON.stringify({file:basename(path),size,format:bytes.subarray(0,2).toString('ascii')==='MZ'?'DOS MZ':'unknown',header:bytes.toString('hex')},null,2)); } finally { await f.close(); } }
