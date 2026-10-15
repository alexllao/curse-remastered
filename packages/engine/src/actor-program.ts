/** Intérprete de canales de actores DOS. Los programas y dimensiones se cargan localmente. */
export interface ActorPrograms {
  actors: number[][];
  programs: number[];
  seed: number[];
  firstFreeSlot: number;
  dimensions: Record<string, [number, number]>;
  controls: number[];
  bank: number;
  collision: number;
  pendingRoom: number | null;
  sounds: number[];
}
const word = (actor: number[], at: number) => actor[at] | (actor[at + 1] << 8);
const signed = (n: number) => (n << 16) >> 16;
const setWord = (actor: number[], at: number, value: number) => {
  actor[at] = value & 255;
  actor[at + 1] = (value >> 8) & 255;
};
export function originalRandom(seed: number[], limit: number): number {
  if (!limit) throw new Error('Original random divisor is zero');
  let [ax, bx, cx, dx] = seed;
  let carry = 0;
  for (let index = 0; index < 4; index++) {
    const next = dx >>> 15;
    dx = ((dx << 1) | carry) & 65535;
    if (index < 3) {
      carry = cx >>> 15;
      cx = ((cx << 1) | next) & 65535;
    }
  }
  cx -= 7;
  if (cx < 0) dx = (dx - 1) & 65535;
  cx &= 65535;
  ax ^= cx;
  bx ^= dx;
  seed.splice(0, 4, cx, bx, ax, dx);
  return bx % limit;
}
export function originalActorView(actor: number[], slot: number) {
  return {
    slot,
    flags: actor[0],
    frame: actor[1],
    x: signed(word(actor, 2)),
    y: signed(word(actor, 4)),
    width: word(actor, 6),
    height: word(actor, 8),
    depthOffset: signed(word(actor, 10)),
    bank: word(actor, 31),
  };
}
function deactivate(actor: number[]) {
  actor[0] = 0;
  for (const at of [16, 21, 26]) setWord(actor, at, 0);
}
/** Un ciclo de 0x85DE–0x8A21; los controladores e interacciones son otra fase. */
export function tickOriginalActors(state: ActorPrograms) {
  state.sounds = [];
  for (const actor of state.actors) {
    if (!actor[0]) continue;
    let removed = false;
    for (const channel of [16, 21, 26]) {
      let pointer = word(actor, channel);
      if (!pointer) continue;
      // OR BX borra CF; DEC conserva ese CF y JBE comprueba el resultado cero.
      const previousCounter = actor[channel + 3];
      actor[channel + 3] = (previousCounter - 1) & 255;
      if (actor[channel + 3]) continue;
      actor[channel + 3] = actor[channel + 4];
      let extra = 0;
      const read = () => {
        const at = pointer + actor[channel + 2];
        if (at < 0 || at >= state.programs.length)
          throw new Error('Actor program outside exported range');
        actor[channel + 2] = (actor[channel + 2] + 1) & 255;
        return state.programs[at];
      };
      let ended = false;
      for (let guard = 0; guard < 256; guard++) {
        const value = read();
        if (channel !== 16 && value === 128) {
          extra = (extra + 100) & 65535;
          continue;
        }
        if (value === 127) {
          actor[channel + 2] = 0;
          continue;
        }
        if (value === 126) {
          const low = read(),
            high = read();
          pointer = low | (high << 8);
          setWord(actor, channel, pointer);
          actor[channel + 2] = 0;
          continue;
        }
        if (value === 125) {
          deactivate(actor);
          removed = true;
          ended = true;
          break;
        }
        if (value === 124) {
          setWord(actor, channel, 0);
          ended = true;
          break;
        }
        if (value === 123) {
          actor[channel + 3] = (read() * actor[channel + 4]) & 255;
          ended = true;
          break;
        }
        if (value === 122) {
          actor[channel + 4] = actor[channel + 3] = read();
          continue;
        }
        if (value === 121) {
          actor[channel + 2] = (actor[channel + 2] - 2) & 255;
          continue;
        }
        if (value === 120) {
          const delay = (originalRandom(state.seed, read()) + read()) & 255;
          actor[channel + 3] = delay;
          for (const at of channel === 16 ? [24, 29] : channel === 21 ? [29] : [])
            actor[at] = delay;
          removed = true;
          ended = true;
          break;
        }
        if (channel === 16) {
          if (value === 255 || value === 254) {
            actor[0] = value === 255 ? actor[0] & 253 : actor[0] | 2;
            ended = true;
            break;
          }
          if (value === 253) {
            state.controls = [1, 1, 1];
            continue;
          }
          if (value === 252) {
            state.controls[1] = 1;
            continue;
          }
          if (value === 251) {
            state.sounds.push(read());
            continue;
          }
          if (value === 250 || value === 249) {
            state.collision = value === 250 ? 1 : 0;
            continue;
          }
          if (value === 248)
            throw new Error('Actor sprite bank switch not yet verified in this profile');
          let frame = value;
          if (value === 247) {
            const range = read(),
              base = read();
            let attempt = 0;
            do {
              frame = (originalRandom(state.seed, range) + base) & 255;
              if (++attempt > 1024) throw new Error('Non-terminating random frame');
            } while (frame === actor[1]);
          }
          if (value === 246) state.pendingRoom = frame = read();
          actor[1] = frame;
          const dimensions = state.dimensions[`${word(actor, 31)}:${frame & 127}`];
          if (!dimensions) throw new Error('Unverified actor frame dimensions');
          setWord(actor, 6, dimensions[0]);
          setWord(actor, 8, dimensions[1]);
        } else {
          const delta = (value << 24) >> 24;
          const coordinate = channel === 21 ? 2 : 4;
          setWord(
            actor,
            coordinate,
            word(actor, coordinate) + delta + (delta < 0 ? -extra : extra),
          );
        }
        ended = true;
        break;
      }
      if (!ended) throw new Error('Non-terminating actor program');
      if (removed) break;
    }
  }
  for (let slot = state.firstFreeSlot; slot < 70; slot++) {
    const actor = state.actors[slot - 1];
    const view = originalActorView(actor, slot);
    if (
      view.flags &&
      (view.x >= 384 ||
        signed(view.x + view.width) < -64 ||
        view.y >= 250 ||
        signed(view.y + view.height) < -50)
    )
      deactivate(actor);
  }
}
