export interface WalkChannel {
  pointer: number;
  counter: number;
  period: number;
  index?: number;
}
export interface WalkProfile {
  programBase: number;
  programs: number[];
  profile: Record<string, { frame: number; channels: WalkChannel[] }>;
}
export interface BoxRegion {
  type: number;
  argument: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export interface WalkActor {
  x: number;
  y: number;
  frame: number;
  remaining: number;
  minorX: number;
  minorY: number;
  fractionX: number;
  fractionY: number;
  channels: WalkChannel[];
  stalls: number;
}
const signed = (n: number) => (n << 16) >> 16;
const baseFrame = (frame: number) => (frame >= 128 ? 128 : frame >= 18 ? 18 : frame >= 9 ? 9 : 0);
export function createWalkActor(x: number, y: number, frame = 9): WalkActor {
  return {
    x,
    y,
    frame,
    remaining: 0,
    minorX: 0,
    minorY: 0,
    fractionX: 0,
    fractionY: 0,
    channels: [],
    stalls: 2,
  };
}
export function stopOriginalWalk(actor: WalkActor) {
  actor.remaining = 0;
  actor.frame = baseFrame(actor.frame);
  actor.channels = [];
}
export function startOriginalWalk(
  actor: WalkActor,
  target: { x: number; y: number },
  data: WalkProfile,
) {
  const dx = Math.trunc(target.x) - actor.x - 15,
    dy = Math.trunc(target.y) - actor.y - 47;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  let steps = horizontal ? ((Math.abs(dx) >> 1) + 1) >> 1 : (Math.abs(dy) + 1) >> 1;
  if (!steps) return;
  const direction = horizontal ? (dx < 0 ? 8 : 4) : dy < 0 ? 2 : 1;
  const base = baseFrame(actor.frame);
  if (
    (direction === 4 && base === 128) ||
    (direction === 8 && base === 0) ||
    (direction === 1 && base === 18) ||
    (direction === 2 && base === 9)
  )
    steps++;
  const selection = data.profile[`${base}:${direction}`];
  if (!selection) throw new Error('Missing verified walking selection');
  actor.remaining = steps;
  actor.minorX = horizontal ? 0 : Math.trunc((dx * 256) / steps);
  actor.minorY = horizontal ? Math.trunc((dy * 256) / steps) : 0;
  actor.fractionX = actor.fractionY = 0;
  actor.stalls = 2;
  const alreadySelected = Object.entries(data.profile).some(
    ([key, entry]) =>
      key.endsWith(`:${direction}`) && entry.channels[0].pointer === actor.channels[0]?.pointer,
  );
  if (!alreadySelected)
    actor.channels = selection.channels.map((channel) => ({ ...channel, index: 0 }));
}
function channelStep(channel: WalkChannel, data: WalkProfile): number | undefined {
  if (!channel.pointer) return;
  channel.counter = (channel.counter - 1) & 255;
  if (channel.counter) return;
  channel.counter = channel.period;
  const read = () => {
    const at = channel.pointer - data.programBase + (channel.index ?? 0);
    if (at < 0 || at >= data.programs.length)
      throw new Error('Walking program outside verified range');
    channel.index = ((channel.index ?? 0) + 1) & 255;
    return data.programs[at];
  };
  for (let guard = 0; guard < 32; guard++) {
    const value = read();
    if (value === 127) {
      channel.index = 0;
      continue;
    }
    if (value === 126) {
      const low = read(),
        high = read();
      channel.pointer = low | (high << 8);
      channel.index = 0;
      continue;
    }
    if (value === 124) {
      channel.pointer = 0;
      return;
    }
    if (value === 122) {
      channel.period = channel.counter = read();
      continue;
    }
    if (value === 123) {
      channel.counter = (read() * channel.period) & 255;
      return;
    }
    return value;
  }
  throw new Error('Non-terminating walking program');
}
/** Un ciclo lógico original; no fija la frecuencia temporal de DOS. */
export function tickOriginalWalk(actor: WalkActor, data: WalkProfile) {
  if (!actor.remaining) {
    if (actor.channels.length) stopOriginalWalk(actor);
    return;
  }
  actor.fractionX += actor.minorX;
  actor.fractionY += actor.minorY;
  const deltaX = Math.floor(actor.fractionX / 256),
    deltaY = Math.floor(actor.fractionY / 256);
  actor.x = signed(actor.x + deltaX);
  actor.y = signed(actor.y + deltaY);
  actor.fractionX -= deltaX * 256;
  actor.fractionY -= deltaY * 256;
  if (--actor.remaining === 0) {
    stopOriginalWalk(actor);
    return;
  }
  const frame = channelStep(actor.channels[0], data);
  if (frame !== undefined) actor.frame = frame;
  const x = channelStep(actor.channels[1], data),
    y = channelStep(actor.channels[2], data);
  if (x !== undefined) actor.x = signed(actor.x + ((x << 24) >> 24));
  if (y !== undefined) actor.y = signed(actor.y + ((y << 24) >> 24));
}
export interface RegionContact {
  code: number;
  argument: number;
  region?: BoxRegion;
  conditional?: boolean;
}
export type NavigationState = Record<string, number>;
export function enabledOriginalRegion(
  argument: number,
  state: NavigationState,
): boolean | undefined {
  const byte = (at: number) =>
    state[at.toString()] === undefined ? undefined : state[at.toString()] & 255;
  const equal = (at: number, value: number, word = false) => {
    const actual = word ? state[at.toString()] : byte(at);
    return actual === undefined ? undefined : actual === value;
  };
  const negate = (value: boolean | undefined) => (value === undefined ? undefined : !value);
  switch (argument) {
    case 0:
      return equal(0x2cb0, 16);
    case 17:
      return equal(0x2c4d, 13);
    case 35:
    case 38:
      return negate(equal(0x2c4c, 1));
    case 36: {
      const value = byte(0x35c9);
      return value === undefined ? undefined : !(value & 4);
    }
    case 63:
      return equal(0x358c, 255);
    case 66:
      return equal(0x2cd0, 1);
    case 68:
      return equal(0x2c6d, 1);
    case 69:
      return equal(0x2c90, 295, true);
    case 72:
      return equal(0x2f44, 68);
    case 74:
      return equal(0x2c8e, 1);
    case 83:
      return equal(0x2c6d, 0);
    case 84:
      return equal(0x2d16, 30, true);
    case 91:
      return equal(0x4b2c, 1);
    case 93:
      return equal(0x4b35, 1);
    case 95:
      return equal(0x4b3e, 1);
    case 97:
      return equal(0x4b47, 1);
    case 99:
      return equal(0x4b50, 1);
    case 101:
      return equal(0x4b59, 1);
    case 103:
      return equal(0x358c, 24);
    case 116: {
      const a = equal(0x2cd1, 22),
        b = equal(0x2c4c, 0);
      return a === undefined || b === undefined ? undefined : !a && b;
    }
    case 124:
      return equal(0x2c6f, 155, true);
    default:
      return true;
  }
}
/** Regiones condicionadas permanecen sin ejecutar en el visor de recorridos. */
export function queryOriginalRegions(
  regions: BoxRegion[],
  box: { left: number; top: number; right: number; bottom: number },
  state: NavigationState = {},
): RegionContact {
  let contact: RegionContact = { code: 0, argument: 0 };
  for (const region of regions) {
    if (
      box.left > region.right ||
      box.top > region.bottom ||
      box.right < region.left ||
      box.bottom < region.top
    )
      continue;
    if (region.type === 0)
      contact = { code: region.argument === 255 ? 0 : 1, argument: region.argument, region };
    if (region.type === 1) return { code: 4, argument: region.argument, region };
    if (region.type === 2) {
      const enabled = enabledOriginalRegion(region.argument, state);
      if (enabled !== false)
        return {
          code: enabled === undefined ? 16 : 2,
          argument: region.argument,
          region,
          conditional: true,
        };
    }
    if (region.type === 3 && [0, 1, 2, 3, 4, 9, 10, 11].includes(region.argument))
      return { code: 8, argument: region.argument, region };
  }
  return contact;
}
export function actorContact(
  actor: WalkActor,
  regions: BoxRegion[],
  state: NavigationState = {},
): RegionContact {
  return queryOriginalRegions(
    regions,
    { left: actor.x + 6, right: actor.x + 25, top: actor.y + 44, bottom: actor.y + 47 },
    state,
  );
}
/** Correcciones de las ramas 0x0CFE–0x0DA0, sin activar acciones ni salidas. */
export function resolveOriginalContact(
  actor: WalkActor,
  previous: { x: number; y: number },
  regions: BoxRegion[],
  state: NavigationState = {},
): RegionContact {
  const old = { ...previous };
  let adjusted = false;
  const candidateY = actor.y;
  for (let guard = 0; guard < 8; guard++) {
    const contact = actorContact(actor, regions, state);
    if (contact.code && contact.code !== 1) {
      actor.x = previous.x;
      actor.y = previous.y;
      stopOriginalWalk(actor);
      return contact;
    }
    if (!contact.code) {
      if (actor.x === old.x && actor.y === old.y && --actor.stalls <= 0) actor.remaining = 0;
      else if (actor.x !== old.x || actor.y !== old.y) actor.stalls = 2;
      return contact;
    }
    if (!adjusted) {
      adjusted = true;
      if ((contact.argument === 1 || contact.argument === 2) && !actor.channels[2]?.pointer) {
        const dy = contact.argument === 1 ? 1 : -1;
        actor.y += dy;
        old.y += dy;
        continue;
      }
    }
    if (old.y !== actor.y) {
      actor.y = old.y;
      actor.fractionY = 0;
      if (old.x !== actor.x) continue;
    } else if (old.x !== actor.x) {
      actor.x = old.x;
      actor.y = candidateY;
      actor.fractionX = actor.fractionY = 0;
      continue;
    }
    if (--actor.stalls <= 0) actor.remaining = 0;
    return contact;
  }
  actor.x = previous.x;
  actor.y = previous.y;
  stopOriginalWalk(actor);
  return { code: 1, argument: 0 };
}
/** Cámara de 32 píxeles con umbrales originales 64/223 sobre el centro de Ben. */
export function followOriginalCamera(actorX: number, cameraX: number, width: number) {
  const maximum = Math.max(0, width - 320);
  let camera = Math.max(0, Math.min(maximum, Math.trunc(cameraX / 32) * 32));
  while (actorX + 16 - camera <= 64 && camera > 0) camera -= 32;
  while (actorX + 16 - camera >= 223 && camera < maximum) camera += 32;
  return camera;
}

/** Un paso CRTC equivale a cuatro píxeles; ocho pasos completan una franja. */
export function advanceOriginalScroll(current: number, target: number) {
  return current + Math.sign(target - current) * Math.min(4, Math.abs(target - current));
}
