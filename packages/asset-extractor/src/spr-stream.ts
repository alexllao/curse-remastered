import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = resolve(root, process.argv[2] ?? 'original/DATA/BENN.SPR');
const output = resolve(root, process.argv[3] ?? 'reports/sprites/BENN-stream.json');
const data = await readFile(source);
const first = data.readUInt16LE(0) * 16;
const starts: number[] = [];
for (let p = 0; p + 1 < first; p += 2) {
  const value = data.readUInt16LE(p);
  if (!value) break;
  starts.push(value * 16);
}
const sprites = starts.map((start, index) => {
  const end = starts[index + 1] ?? data.length;
  const width = data.readUInt16LE(start);
  const height = data.readUInt16LE(start + 2);
  const header = data.subarray(start, start + 12);
  // This is a diagnostic hypothesis, not a confirmed pixel decoder.
  // Repeated sequences in BENN resemble 00 [optional FF] count colorIndices...
  const candidates: Array<{ at: number; marker: string; count: number; colors: string }> = [];
  let p = start + 12;
  let stoppedAt = p;
  while (p < end && candidates.length < 2048) {
    if (data[p] !== 0) break;
    const at = p;
    p++;
    let marker = '00';
    if (p < end && data[p] === 255) { marker = '00ff'; p++; }
    if (p >= end) break;
    const count = data[p++];
    if (!count || p + count > end) break;
    candidates.push({ at: at - start, marker, count, colors: data.subarray(p, p + count).toString('hex') });
    p += count;
    stoppedAt = p;
  }
  return {
    index, start, end, widthCandidate: width, heightCandidate: height,
    first12Hex: header.toString('hex'), parsedCandidateRuns: candidates.length,
    parsedBytes: stoppedAt - (start + 12), remainingBytes: end - stoppedAt,
    runs: candidates,
    note: '00/00ff + length + literal colors is only a candidate grammar, not a validated image codec.',
  };
});
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ source: 'local original SPR', sprites }, null, 2) + '\n');
console.log(JSON.stringify({ sprites: sprites.length, first: {
  width: sprites[0]?.widthCandidate, height: sprites[0]?.heightCandidate,
  candidateRuns: sprites[0]?.parsedCandidateRuns,
  parsedBytes: sprites[0]?.parsedBytes, remainingBytes: sprites[0]?.remainingBytes,
}, report: output }, null, 2));
