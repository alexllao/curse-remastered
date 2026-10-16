import { originalActorView, tickOriginalActors, type ActorPrograms } from './actor-program.js';
import {
  createWalkActor,
  startOriginalWalk,
  tickOriginalWalk,
  resolveOriginalContact,
  type BoxRegion,
  type WalkActor,
  type WalkProfile,
} from './original-walk.js';

export interface DungeonProfile {
  memory: number[];
  banks: { mode: number; file: string; bank: number }[];
}
export interface DungeonState {
  animation: ActorPrograms;
  memory: number[];
  walk: WalkActor | null;
  pending: { x: number; y: number } | null;
  exited: boolean;
  cursor: 'normal' | 'success' | 'failure' | 'empty';
}
const signed = (n: number) => (n << 16) >> 16;
export function dungeonByte(s: DungeonState, at: number): number {
  if (at >= 0x2c2b && at < 0x2c2b + 69 * 33) {
    const n = at - 0x2c2b;
    return s.animation.actors[Math.floor(n / 33)][n % 33];
  }
  if (at >= 0x3594 && at <= 0x3596) return s.animation.controls[at - 0x3594];
  if (at === 0x358c) return s.animation.bank;
  if (at === 0xdef) return s.animation.collision;
  return s.memory[at] ?? 0;
}
export const dungeonWord = (s: DungeonState, at: number) =>
  dungeonByte(s, at) | (dungeonByte(s, at + 1) << 8);
function byte(s: DungeonState, at: number, value: number) {
  value &= 255;
  if (at >= 0x2c2b && at < 0x2c2b + 69 * 33) {
    const n = at - 0x2c2b;
    s.animation.actors[Math.floor(n / 33)][n % 33] = value;
  } else if (at >= 0x3594 && at <= 0x3596) s.animation.controls[at - 0x3594] = value;
  else if (at === 0x358c) s.animation.bank = value;
  else if (at === 0xdef) s.animation.collision = value;
  else s.memory[at] = value;
}
function word(s: DungeonState, at: number, value: number) {
  byte(s, at, value);
  byte(s, at + 1, value >> 8);
}
const add = (s: DungeonState, at: number, value: number) => word(s, at, dungeonWord(s, at) + value);
export function createDungeon(animation: ActorPrograms, profile: DungeonProfile): DungeonState {
  const memory = profile.memory.slice();
  animation.programs = memory;
  animation.spriteBanks = Object.fromEntries(profile.banks.map((b) => [b.mode, b.bank]));
  return { animation, memory, walk: null, pending: null, exited: false, cursor: 'normal' };
}
export function dungeonInventory(s: DungeonState) {
  return Array.from({ length: 10 }, (_, i) => dungeonWord(s, 0x5225 + i * 2)).filter(
    (v) => v !== 65535,
  );
}
/** 0x8B1E: objetos próximos a la franja de los pies, con sus flags originales. */
export function dungeonNearby(s: DungeonState, mask: number) {
  const a = originalActorView(s.animation.actors[0], 1);
  const result: number[] = [];
  for (const raw of s.animation.actors.slice(1)) {
    const item = raw[14] | (raw[15] << 8);
    if (!raw[0] || (!(raw[0] & 4) && raw[0] & 2) || item >= 0x400) continue;
    if (!(dungeonByte(s, 0x524d + item * 2) & mask)) continue;
    const b = originalActorView(raw, 0),
      z = signed(raw[12] | (raw[13] << 8));
    if (
      !dungeonByte(s, 0x3593) &&
      (b.x > a.x + a.width + 4 ||
        b.x + b.width <= a.x - 5 ||
        b.y - z > a.y + a.height + 3 ||
        b.y + b.height + z <= a.y + a.height - 8)
    )
      continue;
    result.push(item);
  }
  return result;
}
function insert(s: DungeonState, item: number) {
  for (let i = 0; i < 10; i++)
    if (dungeonWord(s, 0x5225 + i * 2) === 65535) {
      word(s, 0x5225 + i * 2, item);
      return true;
    }
  return false;
}
function resetAction(s: DungeonState) {
  s.animation.controls = [0, 0, 0];
  s.walk = null;
  for (const at of [16, 21, 26]) {
    const a = s.animation.actors[0];
    a[at + 2] = 0;
    a[at + 3] = 1;
    a[at + 4] = 2;
  }
}
function readWalk(s: DungeonState): WalkActor {
  const a = originalActorView(s.animation.actors[0], 1);
  const walk = createWalkActor(a.x, a.y, a.frame);
  walk.channels = [16, 21, 26].map((at) => ({
    pointer: s.animation.actors[0][at] | (s.animation.actors[0][at + 1] << 8),
    index: s.animation.actors[0][at + 2],
    counter: s.animation.actors[0][at + 3],
    period: s.animation.actors[0][at + 4],
  }));
  return walk;
}
function writeWalk(s: DungeonState, walk: WalkActor) {
  const a = s.animation.actors[0];
  word(s, 0x2c2d, walk.x);
  word(s, 0x2c2f, walk.y);
  a[1] = walk.frame;
  for (const [i, at] of [16, 21, 26].entries()) {
    const c = walk.channels[i];
    word(s, 0x2c2b + at, c?.pointer ?? 0);
    if (c) {
      a[at + 2] = c.index ?? 0;
      if (c.pointer || c.counter) a[at + 3] = c.counter;
      a[at + 4] = c.period;
    }
  }
}
function begin(s: DungeonState, profile: WalkProfile) {
  resetAction(s);
  s.cursor = 'success';
  if (dungeonWord(s, 0xad7)) {
    s.pending = { x: signed(dungeonWord(s, 0x1a38)), y: signed(dungeonWord(s, 0x1a3a)) };
    const walk = readWalk(s),
      view = originalActorView(s.animation.actors[0], 1);
    startOriginalWalk(walk, s.pending, profile, { width: view.width, height: view.height });
    s.walk = walk;
    writeWalk(s, walk);
  }
}
export type DungeonAction =
  | 'help'
  | 'hello'
  | 'take-key'
  | 'take-coin'
  | 'take-clip'
  | 'unlock-chains'
  | 'push-wall'
  | 'unlock-door';
/** Ramas de 0x3503, 0x587E, 0x58A6, 0x58D0 y 0x9A9E–0x9B91. */
export function performDungeonAction(s: DungeonState, action: DungeonAction, profile: WalkProfile) {
  s.cursor = 'failure';
  switch (action) {
    case 'help':
      if (!dungeonByte(s, 0x3607)) return false;
      for (const [at, value] of [
        [0x2c3b, 0x241a],
        [0x2d22, 0x2495],
        [0x2d27, 0x24dc],
        [0x2d2c, 0x24f7],
        [0x2cbf, 0x2512],
        [0x2cc4, 0x2521],
        [0x2d85, 0x252c],
        [0x2d8a, 0x2537],
        [0x2d8f, 0x254b],
      ])
        word(s, at, value);
      for (const [at, value] of [
        [0x2d24, 0],
        [0x2d25, 1],
        [0x2d29, 0],
        [0x2d2a, 42],
        [0x2d2e, 0],
        [0x2d2f, 42],
        [0x2cc2, 40],
        [0x2cc7, 40],
        [0x2d88, 84],
        [0x2d8d, 86],
        [0x2d92, 86],
        [0x3607, 0],
        [0x3622, 0],
      ])
        byte(s, at, value);
      begin(s, profile);
      return true;
    case 'hello':
      s.animation.sounds.push(1);
      s.cursor = 'empty';
      return false;
    case 'take-key':
      if (!insert(s, 1)) return false;
      byte(s, 0x3622, 0);
      word(s, 0x2d85, 0x1a2e);
      byte(s, 0x2d87, 0);
      byte(s, 0x2d88, 3);
      byte(s, 0x2d89, 1);
      word(s, 0x2c3b, 0x9723);
      begin(s, profile);
      return true;
    case 'unlock-chains':
      if (s.animation.bank !== 0 || !dungeonInventory(s).includes(1)) return false;
      byte(s, 0x3622, 0);
      word(s, 0x2d85, 0x1a2e);
      byte(s, 0x2d87, 0);
      byte(s, 0x2d88, 3);
      byte(s, 0x2d89, 1);
      word(s, 0x2c3b, 0x99cb);
      word(s, 0x2c40, 0x99e8);
      word(s, 0x2c45, 0x99fe);
      add(s, 0x35c7, 5);
      begin(s, profile);
      if (s.animation.actors[0][1] !== 0)
        for (const at of [18, 23, 28]) s.animation.actors[0][at] = 3;
      return true;
    case 'push-wall':
      if (s.animation.actors[3][1] !== 3) return false;
      word(s, 0x2c9e, 0x9a59);
      byte(s, 0x2ca1, 10);
      word(s, 0x2ca8, 0x9a64);
      byte(s, 0x2cab, 10);
      byte(s, 0x35e4, 10);
      add(s, 0x35e7, 27);
      byte(s, 0x3611, 42);
      byte(s, 0x2d33, 1);
      word(s, 0x1a38, 210);
      word(s, 0x1a3a, 157);
      word(s, 0xad7, 0x9a14);
      word(s, 0xadc, 0x9a26);
      add(s, 0x35c7, 5);
      begin(s, profile);
      return true;
    case 'take-clip':
      if (!insert(s, 3)) return false;
      byte(s, 0x3610, 0);
      byte(s, 0x2d33, 0);
      word(s, 0x1a38, 200);
      word(s, 0x1a3a, 157);
      word(s, 0xad7, 0x972c);
      word(s, 0xadc, 0x9738);
      begin(s, profile);
      return true;
    case 'take-coin': {
      add(s, 0x35c7, 1);
      const at = 0x2cd0;
      word(s, 0x1a38, dungeonWord(s, at + 2) + 5);
      word(s, 0x1a3a, dungeonWord(s, at + 4) + dungeonWord(s, at + 8) - 2);
      byte(s, 0x35f5, 0);
      word(s, at + 16, 0x1a2e);
      byte(s, at + 18, 0);
      byte(s, at + 20, 1);
      word(s, 0xad7, 0x96c0);
      word(s, 0xadc, 0x96c9);
      begin(s, profile);
      byte(s, at + 19, (s.walk?.remaining || 1) + 6);
      return true;
    }
    case 'unlock-door':
      if (!dungeonInventory(s).includes(3)) return false;
      byte(s, 0x35ed, 16);
      add(s, 0x35ee, 17);
      word(s, 0x1a38, 55);
      word(s, 0x1a3a, 156);
      word(s, 0xad7, 0x9a2c);
      word(s, 0xadc, 0x9a46);
      word(s, 0x9c, 0x2caf);
      word(s, 0x9e, 0x215);
      word(s, 0xa0, 0x9a6c);
      word(s, 0xa2, 0x9a73);
      add(s, 0x35c7, 5);
      begin(s, profile);
      return true;
  }
}
export function walkDungeon(
  s: DungeonState,
  point: { x: number; y: number },
  profile: WalkProfile,
) {
  if (!s.animation.controls[0] || !s.animation.controls[2] || s.exited) return;
  const walk = readWalk(s),
    v = originalActorView(s.animation.actors[0], 1);
  startOriginalWalk(walk, point, profile, { width: v.width, height: v.height });
  s.walk = walk;
  writeWalk(s, walk);
  s.cursor = 'normal';
}
function completeApproach(s: DungeonState) {
  const p = s.pending!;
  s.pending = null;
  const a = originalActorView(s.animation.actors[0], 1);
  word(s, 0x2c2d, p.x - (a.width >> 1) + 1);
  word(s, 0x2c2f, p.y - a.height + 1);
  for (let i = 0; i < 15; i++) byte(s, 0x2c3b + i, dungeonByte(s, 0xad7 + i));
  for (const at of [0xad7, 0xadc, 0xae1]) word(s, at, 0);
  for (let at = 0x9c; at < 0x9c + 70 * 10; at += 10) {
    const target = dungeonWord(s, at);
    word(s, at, 0);
    if (!target) break;
    for (const [i, ch] of [16, 21, 26].entries()) {
      const pointer = dungeonWord(s, at + 4 + i * 2);
      word(s, at + 4 + i * 2, 0);
      if (!pointer) continue;
      word(s, target + ch, pointer);
      byte(s, target + ch + 2, 0);
      word(s, target + ch + 3, dungeonWord(s, at + 2));
    }
  }
}
/** Un ciclo compartido: movimiento → canales → contacto. */
export function tickDungeon(s: DungeonState, profile: WalkProfile, regions: BoxRegion[]) {
  if (s.exited) return;
  const a = s.animation.actors[0],
    previous = { x: signed(dungeonWord(s, 0x2c2d)), y: signed(dungeonWord(s, 0x2c2f)) };
  let skipBen = false;
  if (s.walk) {
    tickOriginalWalk(s.walk, profile);
    writeWalk(s, s.walk);
    skipBen = true;
    if (!s.walk.remaining) {
      if (s.pending) {
        completeApproach(s);
        skipBen = false;
      }
      s.walk = null;
    }
  }
  const flags = a[0];
  if (skipBen) a[0] = 0;
  tickOriginalActors(s.animation);
  if (skipBen) a[0] = flags;
  if (s.animation.controls[2]) {
    const walker = s.walk ?? readWalk(s);
    const state = { '11440': dungeonWord(s, 0x2cb0) };
    const candidate = structuredClone(walker);
    const contact = resolveOriginalContact(walker, previous, regions, state);
    if (contact.code === 2 && contact.argument === 0 && s.animation.actors[4][1] === 16) {
      s.exited = true;
      Object.assign(walker, candidate);
    }
    // Un choque puede agotar los pasos: conservar el paseo hasta el siguiente
    // ciclo permite que 0x0B6D retire sus canales antes de actualizar actores.
    writeWalk(s, walker);
  }
}
