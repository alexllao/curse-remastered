# Segunda mazmorra: CORRIDOR

La primera mazmorra queda aprobada por Àlex. El trabajo actual se limita al recurso 1,
pasillo panorámico de 1216 × 200; DROP se aborda después de revisar esta sala.

## Juego e interfaz

`OriginalSceneMachine` ejecuta instrucciones decodificadas del ejecutable local, con
memoria, bancos, scripts de actores, inventario, colisiones y callbacks del pasillo.
No es un emulador completo de DOS. El hardware de audio/VGA se sustituye por el audio
y el HUD del port. Las instrucciones o bancos ausentes producen error, sin inventar
comportamientos. El perfil y las instrucciones derivadas permanecen fuera de Git.

El selector contextual utiliza los objetos próximos y flags nativos. Conserva su
manejo con ratón o teclado, inventario, acciones y página de información según el
modo gráfico. Guardar y cargar siguen pendientes en el proyecto.

El paso desde la celda conserva inventario, vocabulario, flags de objetos y puntos.
F2 cambia el aspecto conservando el estado del pasillo. F4 conmuta marcos; F10/F11
permiten inspeccionar salas. Los cambios de sala nativos se reciben por la rutina
de salida y por la orden F6 de los programas de actor.

## Recursos

- Fondo Remaster: `assets/remaster/graficos/fondos/001-CORRIDOR.png`, 7296 × 1200.
- Animaciones: `assets/remaster/graficos/escenario/001/`, bancos CORRIDOR, STD, MANA,
  DIG y SPLAT. Se reutiliza el Ben aprobado de la primera mazmorra.
- Iconos de inventario 32, 33 y 34: recipiente, pez y gema.
- Marcos `corridor.png` en `assets/original/graficos/marcos/` y
  `assets/remaster/graficos/marcos/`, asociados automáticamente a `scene:1`.
  El marco Original es arte nuevo del port reducido a 64 × 200 y 64 colores;
  no se presenta como un recurso del DOS original.
- Música: CURSE.RS1, con continuidad respecto a la celda. El recurso 1 comparte
  el grupo SFX 0 y DUNGEON.SFX; eventos 15–20 y prioridades se conservan.

`python tools/remaster-corridor.py` repite la normalización de los másteres locales
(requiere Pillow), conservando una copia de los recursos anteriores.

El arte se generó con la herramienta integrada de imágenes. Másteres y prompts
exactos: `reports/remaster/corridor/generados/` y `prompts.json`. Referencias de
entrada y recibos de instalación están en esa misma carpeta. Sprites independientes
conservan alpha generado y se ajustan a la caja nativa ×6. Los fotogramas 6 y 8
repiten el propio fondo con máscara original. Párpados y fragmentos diminutos
(3–5 y 13–17) mantienen el dibujo original ampliado técnicamente.

## Comprobaciones y límites

`pnpm assets:prepare` genera el perfil, compara las rutinas y prepara los recursos.
También se puede ejecutar `node --experimental-strip-types
tools/reverse-engineering/verify-corridor.mjs` con las trazas locales disponibles.

Contrastes registrados: 213 acciones inmediatas, 500 ciclos de espera, 130 filas
de recorrido y 1500 ciclos de secuencias que incluyen recoger y cambios DIG/SPLAT.
Los casos que solicitan submenús VGA se registran aparte; no se contabilizan como
acciones verificadas. Hay regresiones sintéticas de pila, segmentos, inmediatos,
bancos permitidos y petición de sala F6, sin incluir bytes del juego en Git.

Estas pruebas comparan actores, controles, banco, inventario, puntuación y eventos
de sonido; no certifican la reproducción audible ni un recorrido manual completo
del puzle. El panorama se monta con cortes en solapes de sus referencias; necesita
revisión visual en movimiento, especialmente uniones, retratos y apoyos de llamas.
No se ha realizado una prueba interactiva completa en Firefox en esta sesión.
