/** Mantiene la mano completa dentro de la barra modal, en coordenadas del juego. */
export function hudCursorPosition(
  pointer: { x: number; y: number },
  hud: { x: number; y: number; width: number; height: number } | null,
  cursor: { width: number; height: number },
) {
  if (!hud) return pointer;
  return {
    x: Math.max(hud.x, Math.min(hud.x + Math.max(0, hud.width - cursor.width), pointer.x)),
    y: Math.max(hud.y, Math.min(hud.y + Math.max(0, hud.height - cursor.height), pointer.y)),
  };
}
