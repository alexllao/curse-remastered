# DUNGEON: la rata y la pared superpuesta

La investigación de esta sala tiene prioridad hasta completarla. Este contraste no demuestra todavía la cadencia real DOS ni implementa las interacciones pendientes.

## Resultado contrastado

El primer plano no es un recorte nuevo inventado por el port. El cargador original instala dos piezas de DUNGEON.SPR: fotograma 1 en (0,169), de 40 × 31, y fotograma 2 en (265,99), de 48 × 100. La rutina `0xEE12–0xEE89` decide cuándo volver a dibujarlas, después de los actores. Busca solapamientos con registros cuyo byte de estado es exactamente 1.

`trace-dungeon-occlusion.py` ejecuta esa selección sobre el estado inicial detallado y los 1.000 estados originales de `trace-dungeon.py`. `verify-dungeon-occlusion.mts` contrasta esas 1.001 decisiones con `originalForegroundOverlaps`. La rata está visible en 124 estados y recorre X=0…295: la comprobación alcanza ambos extremos de la sala.

Además se ejecuta el blitter original `0x6F8C–0x746C` para ambas piezas, registrando sus escrituras y la selección de los cuatro planos VGA. Los 487 píxeles pintados del primer plano izquierdo y los 1.952 del derecho coinciden exactamente, en posición e índice, con el decodificador actual. No se cambia la geometría, transparencia ni posición de los sprites.

## Discontinuidad en los recursos

Con la paleta de escena extraída, la pieza izquierda altera 123 píxeles negros del fondo: índice 0 → índice 1. En DUNGEON.MAP son RGB6 (0,0,0) y (0,0,2), respectivamente. La pieza derecha altera 970 píxeles: 914 tienen ese mismo cambio y 56 presentan otras diferencias. Por ello, activar la pieza puede revelar un parche aun cuando la ocultación se dibuje con los índices originales.

El informe distingue este hecho de una grabación completa del juego: no se ha capturado el DAC de una sesión DOS en ese instante, ni se ha reproducido su restauración incremental de regiones entre páginas VGA. La prueba verifica la selección, las posiciones y los índices que escribe el blitter; no atribuye todavía toda percepción visual al original.

En Remaster se mantiene otra limitación: el fondo remasterizado se combina actualmente con piezas originales de primer plano. Sus texturas pueden hacer más visible la discontinuidad. Esta auditoría conserva el modo Original para comprobar la fidelidad antes de trabajar en remasters.

## Repetir la comprobación local, sin audio

```powershell
python tools/reverse-engineering/trace-dungeon.py
python tools/reverse-engineering/trace-dungeon-occlusion.py
pnpm --filter @curse/asset-extractor exec tsx ../../tools/reverse-engineering/verify-dungeon-occlusion.mts
```

Se necesita el ejecutable contrastado, los recursos locales y las dependencias de las demás trazas Python. El informe `reports/navigation/dungeon-occlusion.json`, sus píxeles e índices permanecen excluidos de Git. Solo se versionan herramientas y documentación.
