import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { advanceSelector, fadePaletteFrame } from './palette-effects.js';
import { executableSha256, sha256 } from './scene-palette.js';

type Frame = { firstIndex: number; rgb6: number[]; writerFileOffset: number };
type Fade = { allocationFailure: boolean; sourceBufferUnchanged: boolean; frames: Frame[] };
type Selector = {
  loopEntryCarry: number;
  periodInLoopIterations: number;
  events: (Frame & { iteration: number; tableIndex: number })[];
};
type Trace = {
  status: string;
  executableSha256: string;
  syntheticFadeCallTests: Fade[];
  alternateRetracePhaseTest: Fade;
  allocationFailureTest: Fade;
  palettes: { source: string; sha256: string; trace: Fade }[];
  selectorTests: Selector[];
};
const root = fileURLToPath(new URL('../../../', import.meta.url));
const report = JSON.parse(
  await readFile(resolve(root, process.argv[2] ?? 'reports/exe/palette-trace.json'), 'utf8'),
) as Trace;
assert.equal(report.status, 'verified-isolated-execution');
assert.equal(report.executableSha256, executableSha256);
function checkFade(trace: Fade, source: Buffer): void {
  assert.equal(trace.sourceBufferUnchanged, true);
  assert.equal(trace.frames.length, 32);
  trace.frames.forEach((frame, index) => {
    assert.equal(frame.firstIndex, 0);
    assert.equal(frame.writerFileOffset, 0x7a82);
    assert.deepEqual(Buffer.from(frame.rgb6), fadePaletteFrame(source, index + 1));
  });
}
const synthetic = Buffer.from(Array.from({ length: 768 }, (_, index) => index % 64));
assert.equal(report.syntheticFadeCallTests.length, 8);
for (const trace of report.syntheticFadeCallTests) checkFade(trace, synthetic);
checkFade(report.alternateRetracePhaseTest, synthetic);
assert.equal(report.allocationFailureTest.allocationFailure, true);
assert.equal(report.allocationFailureTest.frames.length, 0);
for (const palette of report.palettes) {
  const source = await readFile(resolve(root, palette.source));
  assert.equal(sha256(source), palette.sha256);
  checkFade(palette.trace, source);
}
// Read the original table locally; never embed game color data in source code.
const exe = await readFile(resolve(root, 'original/CURSE.EXE'));
assert.equal(sha256(exe), executableSha256);
const table = exe.subarray(0x1ab4e, 0x1ab4e + 72);
assert.equal(report.selectorTests.length, 6);
for (const trace of report.selectorTests) {
  assert.ok(trace.loopEntryCarry === 0 || trace.loopEntryCarry === 1);
  let state = { countdown: 1, nextColor: 0 };
  let eventIndex = 0;
  for (let iteration = 1; iteration <= 193; iteration++) {
    const next = advanceSelector(state, trace.loopEntryCarry === 1);
    state = next.state;
    if (next.tableIndex === undefined) continue;
    const event = trace.events[eventIndex++];
    assert.equal(event.iteration, iteration);
    assert.equal(event.tableIndex, next.tableIndex);
    assert.equal(event.firstIndex, 255);
    assert.equal(event.writerFileOffset, 0xdd85);
    assert.deepEqual(
      Buffer.from(event.rgb6),
      table.subarray(next.tableIndex * 3, next.tableIndex * 3 + 3),
    );
  }
  assert.equal(eventIndex, trace.events.length);
  assert.equal(trace.periodInLoopIterations, trace.loopEntryCarry ? 24 : 96);
}
console.log(
  JSON.stringify(
    {
      status: 'matched-original-execution',
      fadeCallSites: 8,
      realPalettes: report.palettes.length,
      selectorCases: 6,
    },
    null,
    2,
  ),
);
