import type { OrderedActor } from '../../../packages/engine/src/scene-order.js';

export const dungeonPickupArt = [{ slot: 6, icon: 31, width: 6, height: 4, dx: -1, dy: -1.5 }];

/** Representación de la moneda; el clip conserva sus fotogramas de destello. */
export function visibleDungeonPickup(
  sceneId: number,
  slot: number,
  flags: number,
  usedPack: string,
) {
  if (sceneId !== 0 || (usedPack !== 'remaster' && usedPack !== 'original') || !flags) return null;
  const art = dungeonPickupArt.find((entry) => entry.slot === slot);
  if (!art) return null;
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

/** Mantener el destello original, también en Remaster, sin sustituirlo por el icono del clip. */
export function preserveDungeonGlint(sceneId: number, bank: number, frame: number) {
  return sceneId === 0 && bank === 24576 && frame >= 42 && frame <= 46;
}
