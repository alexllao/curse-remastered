# Tercera mazmorra: DROP

Àlex ha autorizado preparar esta pantalla y validar después CORRIDOR y DROP juntas.
Se conserva la vista original de 320 × 200, con fondo Remaster a 1920 × 1200.

## Secuencia original

La entrada es la sala lógica 1, recurso 2. El cargador original sitúa a Ben en
(156, 33), con fotograma STD 14 y los tres canales de entrada originales.
Durante la secuencia los controles permanecen deshabilitados: el juego ejecuta
la reacción, el cartel HELP, la caída y la salida sin pedir una acción al usuario.
El menú de pausa del port sigue funcionando.

`trace-drop.py` ejecuta la secuencia completa y genera el perfil local para
`OriginalSceneMachine`. `verify-drop.mjs` contrasta los 58 ciclos, los actores,
controles, banco, inventario, puntos y sonidos. Se carga FALL.BRD al cambiar al
modo 4. La salida nativa llega a la sala lógica 3, recurso 3; no se remasteriza
esa cuarta pantalla en este lote.

Los efectos se disparan en ciclos 0 (evento 16), 17 (7) y 37 (0). DROP comparte
el grupo SFX 0/DUNGEON.SFX con las dos mazmorras previas. La música continúa en
CURSE.RS1; la asociación original de la sala siguiente cambia a CURSE.RS3.

## Arte e integración

Se preparan 125 fotogramas en total. Se reutilizan STD y MANA del Ben aprobado y se preparan FALL y los 36 fotogramas
DROP: trampillas, losa, agua, salpicaduras y Ben alejándose. Todos conservan sus
lienzos y cajas originales ×6, sin mover las coordenadas del juego.
El agua conserva alpha propio; se separa su caja azul de la piedra copiada por
el sprite DOS para dejar visible el fondo remasterizado.

Másteres, referencias y prompts exactos de la herramienta integrada de imágenes
se guardan en `reports/remaster/drop/`. Recursos activos en
`assets/remaster/graficos/fondos/002-DROP.png` y `escenario/002/`.
Los marcos propios `drop.png` en Original y Remaster se asocian a `scene:2`.
La variante Original es arte del port reducido para acompañar al modo pixelado.
Las pequeñas gotas de los fotogramas 23–26 mantienen su dibujo nativo ampliado.

F2 conserva el estado de la caída al cambiar gráficos; F4 conmuta sus marcos.
F10/F11 permiten repetir la secuencia al volver desde otra pantalla.
El inventario y los puntos pasan desde CORRIDOR sin reiniciar la partida.

## Revisión

La traza completa y las comprobaciones de código y recursos no sustituyen la
validación de Àlex en Firefox. Las vistas de referencia generadas localmente son
composiciones técnicas; no se presentan como capturas de una partida del navegador.
Quedan para esa revisión el encaje visual en movimiento y la escucha del conjunto.

`python tools/remaster-drop.py` reproduce la normalización desde los másteres
guardados (requiere Pillow), sin llamar al generador ni modificar el modo Original.
`pnpm assets:prepare` genera y contrasta el perfil nativo de las dos salas.
