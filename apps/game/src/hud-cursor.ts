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

/** Coloca la punta del índice, no la esquina del PNG, en el centro de la selección. */
export function hudKeyboardCursorPosition(
  selected: number,
  hudY: number,
  selection: { xInset: number; yInset: number; width: number; height: number },
  usedPack: string,
) {
  const fingertip = usedPack === 'original' ? 1 : 0.5;
  return {
    x: selected * 32 + selection.xInset + selection.width / 2 - fingertip,
    y: hudY + selection.yInset + selection.height / 2 - fingertip,
  };
}
