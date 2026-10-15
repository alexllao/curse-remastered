# Paletas compartidas de la interfaz

Este paso se resuelve con el ejecutable, los SPR y SPRITES.PAL locales.
No requiere ejecutar ni modificar DOSBox. Los tiempos de una partida son
una comprobación distinta y siguen fuera del alcance de esta extracción.

## Evidencia

El cargador verificado de CURSE.EXE lee los últimos 192 bytes de SPRITES.PAL
para los índices VGA 192–255 (`0x874–0x89A`). Cada cambio de escena sustituye
solo los índices 0–191 desde el MAP. Véase [la receta de escena](palette-loading.md).

La ruta de MOUSE.SPR está documentada en `0x518–0x581`; su dibujado usa el
segmento DS:2C29 en `0xEC51` y llega al decodificador `0x6F8C`.
ICONS.SPR se carga en `0xD949–0xD9BD` y FONT.SPR en `0xD9BE–0xDA2E`.
La barra de interfaz indexa ICONS.SPR y llama al decodificador en
`0xE173–0xE195`. No remapea sus índices a otra paleta.

Se ha inspeccionado cada **píxel opaco dentro de las dimensiones** usando el
mismo decodificador ya validado: la paleta de diagnóstico representa cada
índice con el mismo valor en R, G y B. La transparencia se mantiene en alfa,
por lo que los píxeles transparentes con valor cero no cuentan como uso del
índice de escenario 0. No se cuentan literales recortados fuera del ancho.

| Archivo   | Sprites | Exportables con paleta compartida | Dependientes del contexto |
| --------- | ------- | --------------------------------- | ------------------------- |
| MOUSE.SPR | 3       | 3                                 | 0                         |
| FONT.SPR  | 46      | 46                                | 0                         |
| ICONS.SPR | 163     | 162                               | 1                         |
| Total     | 212     | 211                               | 1                         |

Los 211 sprites exportados utilizan exclusivamente índices 192–254.
No usan el 255, que el selector puede modificar durante su animación.
Por tanto, sus colores de base son independientes del MAP de la escena.
Esto no elimina el efecto visual de los fundidos sobre el DAC.

## Excepción: ICONS.SPR, sprite 159

Índice contado desde cero. Dimensiones 24 × 24. Contiene siete píxeles opacos
que utilizan seis índices inferiores a 192. Esos píxeles están dentro del
rectángulo; no son relleno, transparencia ni datos descartados por recorte.

La extracción registra sus dimensiones, histograma e índices dependientes
del escenario, pero **no genera un PNG RGB con una asociación inventada**.
Sigue pendiente localizar el contexto de uso de ese icono y la paleta activa
en ese punto. No se ha modificado su geometría ni se han corregido esos
píxeles por parecer excepcionales.

## Comandos y salidas

```powershell
pnpm --filter @curse/asset-extractor spr-decode-ui
pnpm --filter @curse/asset-extractor spr-atlas reports/sprites/interface reports/sprites/interface-atlases
pnpm --filter @curse/asset-extractor test
```

Los PNG se guardan en `reports/sprites/interface/{MOUSE,FONT,ICONS}/`.
Los nombres y las etiquetas conservan los índices originales aunque se
omita el icono 159. El manifiesto incluye hashes de EXE, SPR y PAL, la
procedencia de la paleta, los índices usados y las excepciones.
Los tres atlas se generan en `reports/sprites/interface-atlases/`.
Todos estos archivos derivados siguen fuera de Git.

`spr-decode-scenes` conserva los tres archivos de interfaz como no asociados
a un MAP: ese informe sigue describiendo únicamente asociaciones de escena.
`spr-decode-ui` resuelve por separado la paleta compartida a nivel de sprite.

## Validación

- Seis pruebas del paquete superadas, incluidas la distinción entre índice
  cero y transparencia, la frontera 191/192 y la exclusión del índice 255.
- 211 PNG nuevos coinciden byte por byte con los mismos sprites de la
  extracción anterior con SPRITES.PAL; ahora su uso de esa paleta está
  respaldado por los índices pintados y por el cargador del ejecutable.
- Revisión visual de los atlas MOUSE y FONT.
- El cuerpo del algoritmo geométrico se ha movido sin cambios a
  `spr-codec.ts`, para compartirlo entre ambos comandos.
- Se han regenerado los 2034 PNG de variantes de escena y sus hashes
  coinciden con los anteriores al movimiento del código.
- ESLint, Prettier y TypeScript de los archivos cambiados pasan. Los errores
  globales previos del repositorio permanecen documentados en el informe
  de paletas de escena.
