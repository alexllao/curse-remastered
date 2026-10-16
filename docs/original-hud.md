# Interfaz original de la primera mazmorra

La vista de la barra queda separada de los controles web y de los futuros controladores de acciones. El alcance actual es la entrada encadenada de DUNGEON: apariencia, apertura, selección, acciones bloqueadas e inventario inicialmente vacío. No implementa todavía liberar a Ben, guardar/cargar ni ejecutar el resto de acciones.

## Evidencia del ejecutable

- `0xA85–0xA9E`: con el control de interacción habilitado (`DS:3595`), el botón secundario abre el selector.
- `0xDD2D–0xDD4E`: ratón con Y < 100 sitúa la barra arriba (Y=0); Y >= 100 la sitúa abajo (Y=168). Son dos posiciones de una barra de 320 × 32, no dos barras permanentes.
- `0xE096–0xE0F7`: instala los iconos 0–9 y, si el primer canal de Ben sigue activo, superpone el aspa original sobre las columnas 1 y 2 y sustituye sus acciones por el retorno al selector.
- `0xE0FB–0xE1D2`: fondo de MENU.DAT e iconos de ICONS.SPR en X=4+32×columna, Y=4.
- `0xDD9A–0xDDF5`: marco de selección de 26 × 26 desde X=3+32×columna, Y=3. Se utiliza el primer color de la tabla original; su animación temporal sigue pendiente.
- `0xE1D3–0xE1F9`: construye la barra del inventario desde DS:5225. Las diez entradas iniciales son 65535: inventario vacío.

`trace-original-hud.py` contrasta 16 posiciones de ratón y captura las diez llamadas de iconos y las dos del aspa. Las fuentes incluyen hashes del ejecutable, MENU.DAT, ICONS.SPR, SPRITES.PAL y DUNGEON.MAP. La preparación rechaza fuentes diferentes. MENU.DAT se descomprime mediante el decodificador RNC1 con CRC ya utilizado por el extractor. Su índice 0 y el del aspa usan el contexto de DUNGEON; los iconos se validan contra la cola compartida de la paleta.

```powershell
python tools/reverse-engineering/trace-dungeon.py
python tools/reverse-engineering/trace-original-hud.py
pnpm mods:prepare
```

La preparación completa incluye la nueva traza. Los PNG se generan en `reports/interface/` y se copian a `mods/graficos/original/interfaz/hud/`. Ningún gráfico ni dato derivado se versiona.

## Comportamiento disponible

Clic derecho abre la barra arriba o abajo y vuelve a cerrarla. Flechas izquierda/derecha cambian la selección, Entrar selecciona y Escape cierra primero la barra. El inventario muestra sus casillas vacías. Las acciones bloqueadas conservan el selector. Las demás acciones aún pendientes cierran la barra y avisan de que no están disponibles. No se simula su ejecución.

Mientras el selector está abierto se detienen los actores, como en el bucle modal original. Los controles del port (menú, F2, F3 y pantalla completa) quedan fuera del lienzo. La partida completa se ajusta a la ventana conservando 320:200; el futuro marco decorativo no cambia esas coordenadas.

La espera del título continúa siendo original; se añade solamente un aviso de tecla/clic. El HUD propio de opciones y los marcos se diseñarán después de completar la mazmorra.
