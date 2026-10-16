import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import assert from 'node:assert/strict';
import console from 'node:console';
import { OriginalSceneMachine } from '../../packages/engine/src/native-scene.ts';
const dir = new URL('../../reports/navigation/drop/', import.meta.url);
const profile = JSON.parse(readFileSync(new URL('profile.json', dir), 'utf8'));
const expected = JSON.parse(readFileSync(new URL('sequence.json', dir), 'utf8'));
assert.equal(expected.executableSha256, profile.executableSha256);
const vm = new OriginalSceneMachine(profile);
for (const [i, state] of expected.states.entries()) {
  vm.tick();
  assert.deepEqual(vm.actors(), state.actors, `actors at cycle ${i}`);
  assert.deepEqual(
    [0, 1, 2].map((n) => vm.byte(0x3594 + n)),
    state.controls,
    `controls ${i}`,
  );
  assert.equal(vm.byte(0x358c), state.bank, `bank ${i}`);
  assert.deepEqual(vm.sounds, state.sounds, `sounds ${i}`);
  assert.deepEqual(
    Array.from({ length: 10 }, (_, n) => vm.word(0x5225 + n * 2)),
    state.inventory,
    `inventory ${i}`,
  );
  assert.equal(vm.word(0x35c7), state.score, `score ${i}`);
}
assert.equal(vm.pendingRoom, expected.exit.logicalRoomId);
assert.equal(vm.word(0x7482 + vm.pendingRoom * 2), expected.exit.resourceId);
console.log({
  dropCycles: expected.states.length,
  exit: expected.exit,
  sounds: expected.states.flatMap((s, cycle) => s.sounds.map((event) => ({ cycle, event }))),
});
