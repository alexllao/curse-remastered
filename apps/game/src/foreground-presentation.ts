// Coordenadas lógicas del borde pintado de DUNGEON, sin editar sus PNG.
// La cuña clara queda detrás. Frontera diagonal medida sobre el PNG de 1920×1200,
// con muestras por fila lógica; no usar una recta paralela dentro de la cara oscura.
const dungeonRightContour = [
  299.5, 99, 320, 99, 320, 200, 263.333, 200, 264.333, 199.0, 265.333, 198.0, 266.333, 197.0,
  267.167, 196.0, 268.667, 195.0, 270.167, 194.0, 270.833, 193.0, 271.833, 192.0, 273.0, 191.0,
  274.0, 190.0, 275.0, 189.0, 276.167, 188.0, 277.333, 187.0, 278.167, 186.0, 279.333, 185.0, 280.5,
  184.0, 281.5, 183.0, 283.0, 182.0, 284.0, 181.0, 285.333, 180.0, 286.167, 179.0, 287.167, 178.0,
  288.333, 177.0, 289.667, 176.0, 290.5, 175.0, 292.167, 174.0, 293.0, 173.0, 293.333, 172.0,
  294.833, 171.0, 295.667, 170.0, 296.833, 169.0, 297.833, 168.0, 299, 167, 300.333, 166, 301.333,
  165, 300, 163.5, 299, 161, 298.5, 157, 298.5, 150, 298, 146, 298.5, 141, 298.5, 136, 298, 132,
  297.5, 128, 298, 123, 299, 119, 301, 116.5, 299.5, 114, 299.5, 109, 299, 105,
];

/** Solo el fondo remaster conocido usa este contorno; Original mantiene su SPR. */
export function foregroundPresentation(sceneId: number, frame: number, backgroundPack: string) {
  if (sceneId !== 0 || frame !== 2 || backgroundPack !== 'remaster') return null;
  return {
    polygon: dungeonRightContour,
    bounds: { x: 263, y: 99, width: 57, height: 101 },
  };
}
