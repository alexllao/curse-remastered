# Paletas VGA de escenas (análisis estático verificado)

## Revisión del ejecutable

Perfil exclusivo para CURSE.EXE de 111606 bytes, SHA-256
`f2c0046e07b25f408516edae5d6a66c06107971fb95c55ed770fa52a6b4ecd8d`.
Las direcciones siguientes son **desplazamientos de archivo**, sin ajuste de VMA.
La cabecera MZ ocupa `0x200` bytes. El inicio en `0x233` carga el segmento
de datos relativo `0x0F31`; su base de archivo es `0xF510`. Las reubicaciones
MZ añaden el segmento de carga en ejecución. No se debe tratar `0x0F31` como
una dirección física fija ni usar esta base después de cambiar DS.

## Hechos verificados

| Archivo EXE     | Evidencia y consecuencia                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x874–0x89A`   | Abre `sprites.pal` mediante DS:08D4, busca 0x240 bytes desde la posición actual (recién abierto, cero), lee 0xC0 bytes en DS:0D2F. Son los índices 192–255 del búfer que empieza en DS:0AEF. |
| `0x4F2B–0x4F3C` | Traduce el identificador lógico de escenario a un identificador de recursos a través de DS:7482 y evita recargar recursos cuando coincide con el anterior.                                   |
| `0x50C8–0x50ED` | Indexa la tabla DS:784E con registros de 8 bytes, abre el MAP del primer puntero y lee sus primeros 0x240 bytes en DS:0AEF. Reemplaza únicamente los índices 0–191.                          |
| `0x50EF–0x5125` | Lee el siguiente uint16 del MAP para reservar memoria y carga el resto. El dato en MAP+0x240 no es parte de una paleta de 256 colores.                                                       |
| `0x5127–0x519B` | El siguiente puntero del mismo registro abre y carga el SPR. Esto prueba la asociación MAP/SPR sin inferirla del nombre.                                                                     |
| `0x5446–0x5453` | Sube DS:0AEF al DAC: SI=0AEF, CX=256, AL=0.                                                                                                                                                  |
| `0x7A7E–0x7A8D` | Escribe AL como índice inicial al puerto 0x3C8 y tres bytes RGB por color al 0x3C9 desde DS:SI, CX veces. No transforma ni remapea los índices del SPR.                                      |

La receta de la paleta base de carga es:

```text
RGB6[0..191]   = MAP[0x000..0x23F]
RGB6[192..255] = SPRITES.PAL[0x240..0x2FF]
PNG RGB8      = round(RGB6 * 255 / 63)
```

La conversión a RGB8 es la representación elegida para PNG; no pretende
simular las características analógicas de un monitor VGA.

El perfil interpreta los 78 registros con ambos punteros MAP/SPR válidos
(0–77) desde `0x16D5E`. No son 78 salas lógicas distintas. Hay 56 recetas
MAP/SPR, 54 SPR distintos y 57 archivos SPR en el directorio original.
El registro 78 tiene puntero MAP y puntero SPR nulo: se excluye y queda
pendiente entender su uso. Los demás campos no se interpretan como paletas.

Ejemplos comprobados en la tabla:

- Recurso 17 (`0x16DE6`): XROADS.MAP / XROADS.SPR.
- Recurso 24 (`0x16E1E`): BENN.MAP / BENN.SPR.
- Recursos 40 y 42: SNOWAST1.MAP y SNOWAST3.MAP usan ambos SNOWAST3.SPR.
- Recursos 65 y 77: GRAVEYD1.MAP y GRAVEYD2.MAP usan ambos GRAVEYD.SPR.
- Recurso 73: BASEBAT.MAP / OUTRO.SPR.

Todos los encabezados MAP locales tienen componentes en el rango VGA 0–63.
SPRITES.PAL completo no es una paleta global correcta: omite los colores
que el MAP aporta para la escena. La luminosidad de BASEBALL.PAL no prueba
ninguna asociación con los SPR del juego.

## Cambios dinámicos y otros recursos

- `0x79E4–0x7A79` construye un fundido hacia negro. Para cada componente
  mantiene un acumulador de punto fijo, resta su paso por fotograma y llama
  al escritor DAC tras esperar el retrazado vertical (puerto 0x3DA).
- `0xDD5C–0xDD8D` actualiza directamente el índice 255. Usa un contador que
  se reinicia a 4 y recorre 24 tripletas desde DS:B63E, con vuelta a cero.
  Esto demuestra una modificación de color en ejecución, pero todavía falta
  identificar todos los contextos y la temporización real de esa rutina. La ejecución aislada posterior la sitúa en el selector de interfaz y verifica que la cadencia también depende de carry; véase [Paletas dinámicas](palette-effects.md).
- CORE.PAL, TITLE.PAL, CAULDRN.PAL, BALCONY.PAL y BASEBALL.PAL tienen rutas
  de lectura completa (768 bytes) y subida para imágenes de introducción;
  ejemplos en `0x698`, `0x784`, `0x2B2E`, `0x2C75`, `0x2EB5`.
- En `0x4ED7–0x4EFF`, los BRD se seleccionan por una tabla distinta para
  cargar gráficos; esta lectura no sustituye el encabezado de paleta MAP.
  No se ha probado una paleta independiente por BRD ni todos sus usos.

**Alcance:** los PNG nuevos representan la paleta base de carga de cada
recurso de escena. No están verificados mediante captura del juego original
ni reproducen todos los estados de fundido o animación. FONT, ICONS y MOUSE
quedan sin asociación única de escena; el exportador no les asigna una
paleta por luminosidad o por parecido visual.

## Extracción reproducible

```powershell
pnpm --filter @curse/asset-extractor exe-palettes
pnpm --filter @curse/asset-extractor spr-decode-scenes
pnpm --filter @curse/asset-extractor spr-atlas reports/sprites/scenes reports/sprites/scene-atlases
pnpm --filter @curse/asset-extractor test
```

`spr-decode-scenes` regenera primero las paletas. El perfil rechaza una revisión
desconocida de CURSE.EXE. `reports/palettes/scenes/manifest.json` registra filas,
desplazamientos, fuentes y rangos, hashes de EXE/MAP/SPR/paleta y pendientes.
Las paletas RGB6 derivadas se guardan junto al manifiesto y nunca en Git.
La exportación comprueba hashes de SPR y paleta. Si se cambian los originales,
regenerar primero el manifiesto. Un resultado `unresolved` no equivale a un
fallo geométrico; no se genera PNG para ese SPR en este modo.

Los PNG se separan por MAP/SPR para conservar variantes de un SPR compartido.
El algoritmo geométrico no se ha modificado. El comando `spr-decode-all`
conserva su modo anterior con una paleta explícita provisional; para colores
de escena debe usarse el nuevo comando. No mezclar las dos carpetas de salida.

## Validación local

- 56 variantes, 2034 sprites exportados, cero errores de decodificación.
- 56 atlas generados y revisión visual de BENN y XROADS.
- Dimensiones y canal alfa de los 2034 PNG coinciden con la extracción anterior.
- Píxeles opacos RGB negro en BENN: 18181 → 47 (de 21689).
- Píxeles opacos RGB negro en XROADS: 24629 → 59 (de 25748).
- Pruebas sintéticas verifican el límite 191/192, rechazan truncamientos,
  componentes fuera de rango y revisiones desconocidas del ejecutable.

Las estadísticas son una comprobación del efecto, no el fundamento de la
asociación: la prueba procede del cargador y la tabla del ejecutable.

## Trabajo pendiente

1. Capturar escrituras DAC del juego completo para verificar activación y temporización. Las rutinas de fundido y selector ya se han contrastado mediante ejecución aislada; véase [Paletas dinámicas](palette-effects.md).
2. Rastrear todos los productores y consumidores del búfer de paleta y la tabla DS:B63E.
3. Completar la relación entre salas lógicas, tabla de recursos y BRD especiales.
4. Resolver la exportación contextual de los sprites compartidos de interfaz.

Las comprobaciones específicas de los archivos cambiados (ESLint, Prettier y TypeScript) pasan. La comprobación global del repositorio sigue fallando por problemas previos en rnc2.ts (ramas duplicadas), importaciones sin usar en spr-atlas.ts y spr-decode.ts, y Object.groupBy con lib ES2022 en analyze-map-spr.ts. Estos archivos no se han modificado en este cambio.
