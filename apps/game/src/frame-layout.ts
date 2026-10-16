/** Encuadre de presentación; las coordenadas DOS siguen siendo 320 × 200. */
export function presentationBounds(width: number, height: number, framed = false) {
  const scale = Math.min(width / (framed ? 348 : 320), height / 200);
  return {
    scale,
    x: Math.floor((width - 320 * scale) / 2),
    y: Math.floor((height - 200 * scale) / 2),
  };
}
/** Recortar desde fuera; nunca aplicar escalas distintas a los dos ejes. */
export function panelBounds(
  panelWidth: number,
  panelHeight: number,
  padding: number,
  margin: number,
  overlap: number,
  gameY: number,
  gameHeight: number,
  innerEdge: number,
  right: boolean,
  cover: boolean,
) {
  const body = Math.max(1, panelWidth - padding);
  const scale = Math.max(gameHeight / panelHeight, cover ? (margin + overlap) / body : 0);
  return {
    scale,
    x: right ? innerEdge - overlap - padding * scale : innerEdge + overlap - body * scale,
    y: gameY + (gameHeight - panelHeight * scale) / 2,
  };
}
export function chooseFrame<T extends { id: string; contexts?: string[] }>(
  frames: T[],
  selection: string,
  context: string,
) {
  if (selection !== 'auto') return frames.find((frame) => frame.id === selection);
  return (
    frames.find((frame) => frame.contexts?.includes(context)) ??
    frames.find((frame) => frame.id === 'default') ??
    frames.find((frame) => frame.id === 'castillo') ??
    frames[0]
  );
}
