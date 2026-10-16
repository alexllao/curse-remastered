// Coordenadas lógicas del borde pintado de DUNGEON, sin editar sus PNG.
// La cuña clara del zócalo pertenece al fondo: la diagonal sigue la cara oscura.
const dungeonRightContour = [
  299.5, 99, 320, 99, 320, 200, 267, 200, 269, 198, 274, 193, 279, 188, 284, 183, 289, 178, 294,
  173, 299, 168, 302, 166.5, 300, 164.5, 299, 161, 298.5, 157, 298.5, 150, 298, 146, 298.5, 141,
  298.5, 136, 298, 132, 297.5, 128, 298, 123, 299, 119, 301, 116.5, 299.5, 114, 299.5, 109, 299,
  105,
];

/** Solo el fondo remaster conocido usa este contorno; Original mantiene su SPR. */
export function foregroundPresentation(sceneId: number, frame: number, backgroundPack: string) {
  if (sceneId !== 0 || frame !== 2 || backgroundPack !== 'remaster') return null;
  return {
    polygon: dungeonRightContour,
    bounds: { x: 267, y: 99, width: 53, height: 101 },
  };
}
