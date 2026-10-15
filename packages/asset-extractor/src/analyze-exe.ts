import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = resolve(root, process.argv[2] ?? 'original/CURSE.EXE');
const target = resolve(root, process.argv[3] ?? 'reports/exe/curse-analysis.json');
const data = await readFile(source);
if (data.length < 64 || data.toString('ascii', 0, 2) !== 'MZ')
  throw new Error('Expected a DOS MZ executable');
const word = (offset: number) => data.readUInt16LE(offset);
const bytesLastPage = word(2),
  pages = word(4),
  relocations = word(6);
const headerBytes = word(8) * 16;
const declaredBytes = (pages - 1) * 512 + (bytesLastPage || 512);
const entry = { cs: word(22), ip: word(20), ss: word(14), sp: word(16) };
const entryFileOffset = headerBytes + entry.cs * 16 + entry.ip;
const relocationTableOffset = word(24);
const relocationEntries = Array.from({ length: relocations }, (_, index) => {
  const at = relocationTableOffset + index * 4;
  if (at + 4 > headerBytes) throw new Error('Relocation table exceeds MZ header');
  const offset = word(at),
    segment = word(at + 2);
  return { offset, segment, fileOffset: headerBytes + segment * 16 + offset };
});
const names = ['benn.spr', 'benn.map', 'sprites.pal', 'mouse.spr', 'dungeon.spr', 'dungeon.map'];
const lower = data.toString('latin1').toLowerCase();
const resources = names.map((name) => {
  const fileOffset = lower.indexOf(name);
  if (fileOffset < 0) return { name, found: false };
  const imageOffset = fileOffset - headerBytes;
  const segmentAligned = Math.floor(imageOffset / 16);
  const candidates: Array<{ fileOffset: number; instruction: string; immediate: number }> = [];
  // Search for immediate operands that could reference this string through
  // different possible DS base segments. These are hints, NOT confirmed xrefs.
  for (let p = headerBytes; p + 3 < data.length; p++) {
    if (
      data[p] !== 0xba &&
      data[p] !== 0xbe &&
      data[p] !== 0xbf &&
      data[p] !== 0xbb &&
      data[p] !== 0xb8
    )
      continue;
    const immediate = word(p + 1);
    if (immediate > imageOffset) continue;
    const inferredDs = imageOffset - immediate;
    if (inferredDs % 16 !== 0) continue;
    // Bound candidate data segment to MZ image size.
    if (inferredDs < 0 || inferredDs > data.length - headerBytes) continue;
    if (candidates.length < 40)
      candidates.push({ fileOffset: p, instruction: 'mov reg16, imm16', immediate });
  }
  return {
    name,
    found: true,
    fileOffset,
    imageOffset,
    segmentAligned,
    offsetInParagraph: imageOffset % 16,
    possibleImmediateLoads: candidates.slice(0, 12),
    candidateCountCapped: candidates.length,
  };
});
const report = {
  warning:
    'Static structural analysis only; possibleImmediateLoads are not validated code cross-references.',
  source: 'local user-supplied executable',
  mz: {
    fileBytes: data.length,
    declaredBytes,
    headerBytes,
    imageBytes: declaredBytes - headerBytes,
    relocations,
    relocationTableOffset,
    entry,
    entryFileOffset,
    relocationEntries,
  },
  resources,
};
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      mz: { fileBytes: data.length, headerBytes, relocations, entryFileOffset },
      resources: resources.map(({ name, found, fileOffset }) => ({ name, found, fileOffset })),
      report: target,
    },
    null,
    2,
  ),
);
