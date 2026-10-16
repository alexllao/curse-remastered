# Interfaz original de la primera mazmorra

La vista de la barra queda separada de los controles web, del controlador compartido de submenús y de las reglas de la sala. La primera mazmorra incorpora ayuda, llave, cadenas, moneda opcional, pared, clip, puerta y salida. Guardar/cargar sigue pendiente. El estado de validación se mantiene en `ESTADO_DEL_PROYECTO.md`.

## Evidencia del ejecutable

- `0xA85–0xA9E`: con el control de interacción habilitado (`DS:3595`), el botón secundario abre el selector.
- `0xDD2D–0xDD4E`: ratón con Y < 100 sitúa la barra arriba (Y=0); Y >= 100 la sitúa abajo (Y=168). Son dos posiciones de una barra de 320 × 32, no dos barras permanentes.
- `0xE096–0xE0F7`: instala los iconos 0–9 y, si el primer canal de Ben sigue activo, superpone el aspa original sobre las columnas 1 y 2 y sustituye sus acciones por el retorno al selector.
- `0xE0FB–0xE1D2`: fondo de MENU.DAT e iconos de ICONS.SPR en X=4+32×columna, Y=4.
- `0xDD9A–0xDDF5`: marco de selección de 26 × 26 desde X=3+32×columna, Y=3. El borde usa el índice 255, cuya paleta recorre los 24 colores originales; el temporizador se reinicia a 4 en `0xDD62` y el índice vuelve a 0 después de 24 tonos. La traza valida 96 vueltas modales y 24 escrituras DAC. La reproducción usa 70 Hz como referencia de refresco, pendiente de medir en DOSBox.
- `0xE1D3–0xE1F9`: construye la barra del inventario desde DS:5225. Las diez entradas iniciales son 65535: inventario vacío.

`trace-original-hud.py` contrasta 16 posiciones de ratón y captura las diez llamadas de iconos y las dos del aspa. La inicialización del temporizador (`0xDD1C`) y el ciclo de paleta (`0xDD53–0xDD8E`) se contrastan además mediante ejecución nativa aislada. Las fuentes incluyen hashes del ejecutable, MENU.DAT, ICONS.SPR, MOUSE.SPR, SPRITES.PAL y DUNGEON.MAP. La preparación rechaza fuentes diferentes. MENU.DAT se descomprime mediante el decodificador RNC1 con CRC ya utilizado por el extractor. Su índice 0 y el del aspa usan el contexto de DUNGEON; los iconos y cursores se colorean con la paleta activa de DUNGEON, incluidos los que usan índices fuera de la cola compartida.

```powershell
python tools/reverse-engineering/trace-dungeon.py
python tools/reverse-engineering/trace-original-hud.py
pnpm assets:playtest
```

La preparación completa incluye la nueva traza. Los PNG se generan en `reports/interface/` y se copian a `assets/original/graficos/interfaz/hud/`. Ningún gráfico ni dato derivado se versiona.

## Comportamiento disponible

Clic derecho abre la barra arriba o abajo y vuelve a cerrarla. Flechas izquierda/derecha cambian la selección, Entrar selecciona y Escape cierra primero la barra. El inventario muestra los objetos recogidos. Los submenús consultan los objetos próximos y sus flags originales. Las acciones bloqueadas conservan el selector. Las reglas reconstruidas de la primera mazmorra se ejecutan en `dungeon.ts`; las acciones aún sin implementar no se dan por resueltas.

Mientras el selector está abierto se detienen los actores, como en el bucle modal original. Los controles del port (menú, F2, F3 y pantalla completa) quedan fuera del lienzo. La partida completa se ajusta a la ventana conservando 320:200; el marco decorativo opcional no cambia esas coordenadas.

La espera del título continúa siendo original; se añade solamente un aviso de tecla/clic. El HUD propio de opciones sigue pendiente. Por petición del usuario se ha añadido una capa de marcos opcionales, con selector y reborde mínimo, separada de la interfaz DOS.

## Comprobación de acciones

`trace-dungeon-actions.py` recorre la secuencia original y exporta un informe local. `verify-dungeon-actions.mts` reproduce las mismas entradas en el motor del port y contrasta 577 ciclos, inventario, bancos, puntuación y 135 consultas de objetos. Las trazas son aisladas: no verifican por sí mismas el aspecto visual ni los tiempos físicos de DOSBox. La preparación utiliza los informes de navegación directamente, sin necesitar un manifiesto de partida generado previamente.
