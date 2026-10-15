export interface OrderedActor {
  slot: number;
  flags: number;
  x: number;
  y: number;
  width: number;
  height: number;
  depthOffset: number;
}
/** Ordenación por saltos de 0xF49A; conserva la permutación de la llamada previa. */
export function originalActorOrder(actors: OrderedActor[], previous: number[]): number[] {
  const bySlot = new Map(actors.map((actor) => [actor.slot, actor]));
  const result = [...previous];
  if (
    result.length !== 69 ||
    new Set(result).size !== 69 ||
    result.some((slot) => !bySlot.has(slot))
  )
    throw new Error('Expected original 69 actor slots');
  const depth = (slot: number) => {
    const actor = bySlot.get(slot)!;
    return ((actor.y + actor.height + actor.depthOffset) << 16) >> 16;
  };
  let gap = 69,
    swapped = true;
  while (gap > 1 || swapped) {
    if (gap > 1) {
      gap = Math.floor((gap * 3) / 4);
      if (gap === 9 || gap === 10) gap = 11;
    }
    swapped = false;
    for (let index = 0; index + gap < result.length; index++) {
      if (depth(result[index]) > depth(result[index + gap])) {
        [result[index], result[index + gap]] = [result[index + gap], result[index]];
        swapped = true;
      }
    }
  }
  return result;
}
export function originalForegroundOverlaps(
  piece: { x: number; y: number; width: number; height: number },
  actors: OrderedActor[],
) {
  return actors.some(
    (actor) =>
      actor.flags === 1 &&
      piece.x + piece.width - 1 >= actor.x &&
      piece.x < actor.x + actor.width &&
      piece.y + piece.height - 1 >= actor.y &&
      piece.y < actor.y + actor.height,
  );
}
