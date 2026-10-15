# Investigation notes

- Confirm executable type and compiler from actual binary evidence.
- Inventory and hash original assets locally.
- Reverse-engineer palettes, sprites and scene data using read-only tools.
- Do not commit original game assets; they belong in `original/` (ignored).

## Original palette routine harness

`trace-palettes.py` executes the original MZ palette code with Unicorn (pinned in `requirements.txt`). It captures VGA DAC writes into ignored reports and rejects unknown executable revisions. It is an isolated routine test, not a full DOS emulator or a full-game timing capture. See [setup, verified behavior and limitations](../../docs/palette-effects.md).

`trace-icon-context.py` reuses that harness to check object 175, inventory insertion and ICONS[159] selection. See [verified context and reproduction](../../docs/icon159-context.md).

## Original MAP routine harness

`trace-map-backgrounds.py` compares all exported, referenced MAP strips with the original RNC2 instructions, and tests the original VGA blitter with a synthetic pattern. Run `scene-backgrounds` first. Uses the same pinned Unicorn dependency and executable profile as `trace-palettes.py`. See [reproduction, results and limits](../../docs/map-brd-resources.md).

## Scripts originales de animación BRD

`trace-brd-scripts.py` verifica las condiciones de recurso, la instalación de secuencias, la carga DOS de CHANGE/CASTLE y los índices elegidos por el intérprete original. Contrasta los cinco fotogramas CHANGE y la selección CASTLE[23–25] con el manifiesto. Incluye la carga original del objetivo 177 en FINAL y el despacho de la acción 177/175; distingue esa prueba de las condiciones explícitas de recurso de otras rutas. Ejecutar `brd-extract` antes del ensayo, con la misma dependencia Unicorn que los demás contrastes. Véase [evidencia, entradas sintéticas y límites](../../docs/map-brd-resources.md#selección-brd-mediante-scripts).

## Límites de la tabla SMALL

`trace-brd-index.py` ejecuta el lector original sobre las entradas 0, 117 y 118. Comprueba las cabeceras reales de las válidas y usa un marcador sintético fuera del archivo para detectar la ausencia de una validación de límites. No demuestra que una partida seleccione la entrada 118. Mantiene la extracción parcial documentada y guarda los resultados en `reports/exe/small-index-verification.json`.
