import { URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { readFileSync } from 'node:fs';
import { OriginalSceneMachine } from '../../packages/engine/src/native-scene.ts';
const folder = new URL('../../reports/navigation/corridor/', import.meta.url);
const profile = JSON.parse(readFileSync(new URL('profile.json', folder), 'utf8'));
const cases = JSON.parse(readFileSync(new URL('actions.json', folder), 'utf8'));
let passed = 0;
function compare(vm, st, label) {
  const actual = {
    actors: vm.actors(),
    controls: [0, 1, 2].map((i) => vm.byte(0x3594 + i)),
    bank: vm.byte(0x358c),
    inventory: Array.from({ length: 10 }, (_, i) => vm.word(0x5225 + i * 2)),
    score: vm.word(0x35c7),
    sounds: vm.sounds,
    walking: vm.word(0x359a),
    action: [0xad7, 0xadc, 0xae1].map((at) => vm.word(at)),
    collision: vm.byte(0xdef),
    templates: Array.from({ length: 80 }, (_, i) => vm.byte(0x35dd + i)),
    seed: Array.from(
      { length: 4 },
      (_, i) => vm.ram[0x10000 + 0x78de + i * 2] | (vm.ram[0x10000 + 0x78df + i * 2] << 8),
    ),
  };
  for (const key of Object.keys(actual))
    if (JSON.stringify(actual[key]) !== JSON.stringify(st[key])) {
      if (key === 'actors') {
        for (let i = 0; i < 69; i++)
          for (let j = 0; j < 33; j++)
            if (actual.actors[i][j] !== st.actors[i][j])
              throw new Error(
                `${label}: actor ${i + 1} byte${j}: ${actual.actors[i][j]} != ${st.actors[i][j]}`,
              );
      }
      throw new Error(
        `${label}: ${key}: ${JSON.stringify(actual[key])} != ${JSON.stringify(st[key])}`,
      );
    }
}
for (const entry of cases) {
  const vm = new OriginalSceneMachine(profile);
  try {
    vm.action(entry);
    compare(
      vm,
      entry.state,
      JSON.stringify({ kind: entry.kind, item: entry.item, verb: entry.verb, other: entry.other }),
    );
    passed++;
  } catch (error) {
    console.log({
      passed,
      entry: { kind: entry.kind, item: entry.item, verb: entry.verb, other: entry.other },
      error: String(error),
    });
    process.exit(1);
  }
}
console.log({ actions: passed });
const vm = new OriginalSceneMachine(profile);
const ticks = JSON.parse(readFileSync(new URL('ticks.json', folder), 'utf8'));
for (let i = 0; i < ticks.length; i++) {
  try {
    vm.tick();
    compare(vm, ticks[i], `tick${i}`);
  } catch (error) {
    console.log({ tick: i, error: String(error) });
    process.exit(1);
  }
}
console.log({ ticks: ticks.length });

const walking = new OriginalSceneMachine(profile);
const walks = JSON.parse(readFileSync(new URL('walks.json', folder), 'utf8'));
for (const [i, row] of walks.entries()) {
  if (row.kind === 'walk') walking.walk(row.point.x, row.point.y);
  else walking.tick();
  compare(walking, row.expected, `walking ${i}`);
}
console.log({ walkingRows: walks.length });
const series = JSON.parse(readFileSync(new URL('sequences.json', folder), 'utf8'));
for (const entry of series) {
  const vm = new OriginalSceneMachine(profile);
  vm.action(entry.command);
  for (const [i, state] of entry.states.entries()) {
    vm.tick();
    compare(vm, state, `${JSON.stringify(entry.command)} cycle ${i}`);
  }
}
console.log({ sequenceTicks: series.reduce((sum, entry) => sum + entry.states.length, 0) });
