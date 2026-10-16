import type { OrderedActor } from '../../../packages/engine/src/scene-order.js';

export const dungeonPickupArt = [
  { slot: 6, icon: 31, width: 6, height: 4, dx: -1, dy: -1.5 },
  { slot: 9, icon: 29, width: 6, height: 3, dx: -1, dy: -2 },
];

/** Dibujo independiente del fotograma vacío y del destello VGA de tres píxeles. */
export function visibleDungeonPickup(
  sceneId: number,
  slot: number,
  flags: number,
  usedPack: string,
) {
  if (sceneId !== 0 || (usedPack !== 'remaster' && usedPack !== 'original') || !flags) return null;
  const art = dungeonPickupArt.find((entry) => entry.slot === slot);
  if (!art || (slot === 9 && flags & 2)) return null;
  return art;
}

/** La altura de la gota no debe moverla de plano durante su caída. */
export function dungeonPresentationOrder(sceneId: number, actors: OrderedActor[]) {
  if (sceneId !== 0) return actors;
  const splash = actors.find((actor) => actor.slot === 15);
  if (!splash) return actors;
  const floorDepth = splash.y + splash.height + splash.depthOffset;
  return actors.map((actor) => {
    if (actor.slot === 14) return { ...actor, depthOffset: floorDepth - actor.y - actor.height };
    // La moneda visible también debe activar los primeros planos que la ocultan.
    if (actor.slot === 6 && actor.flags) return { ...actor, flags: 1 };
    return actor;
  });
}
