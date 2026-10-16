import { URL } from 'node:url';
import console from 'node:console';
import { readFileSync } from 'node:fs';
import { OriginalSceneMachine } from '../../packages/engine/src/native-scene.ts';
const folder = new URL('../../reports/navigation/lakebed/', import.meta.url);
const profile = JSON.parse(readFileSync(new URL('profile.json', folder), 'utf8'));

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
const vm = new OriginalSceneMachine(profile);
const sequence = JSON.parse(readFileSync(new URL('sequence.json', folder), 'utf8'));
let ticks = 0;
for (const [i, event] of sequence.events.entries()) {
  if (event.kind === 'ticks')
    for (const state of event.states) {
      vm.tick();
      compare(vm, state, `event ${i} tick ${ticks++}`);
    }
  else {
    if (event.kind === 'action') vm.action(event.command);
    else vm.walk(event.point.x, event.point.y);
    compare(vm, event.expected, `event ${i}`);
  }
}
console.log({ ticks, events: sequence.events.length, scene: 'LAKEBED' });

const cases = JSON.parse(readFileSync(new URL('actions.json', folder), 'utf8'));
for (const [i, entry] of cases.entries()) {
  const actionVm = new OriginalSceneMachine(profile);
  for (let n = 0; n < 100; n++) actionVm.tick();
  actionVm.action(entry.command);
  compare(actionVm, entry.initial, `action ${i}`);
  for (const [n, state] of entry.states.entries()) {
    actionVm.tick();
    compare(actionVm, state, `action ${i} cycle ${n}`);
  }
}
console.log({
  actions: cases.length,
  actionTicks: cases.reduce((sum, e) => sum + e.states.length, 0),
});
