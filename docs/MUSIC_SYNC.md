# Sincronización de música y presentación

## Lo implementado

- Un solo transporte musical evita superponer versiones.
- Un mismo identificador, como `CURSE.RS1`, conserva su posición en segundos al cambiar de versión.
- Un tema diferente comienza desde cero; una nueva partida reinicia la selección musical.
- Si la posición supera la duración de la nueva versión, se usa su módulo para el bucle de revisión.
- Original usa los puntos de bucle verificados de los RS mediante HTML Audio con búsqueda al terminar. Otros paquetes siguen repitiendo su archivo completo hasta disponer de puntos propios verificados. Véase [ORIGINAL_MUSIC_VERIFICATION.md](ORIGINAL_MUSIC_VERIFICATION.md).
- La presentación propia de la web reproduce su `menu.mp3` independiente en bucle a volumen reducido; abrir o cerrar el menú no modifica su música. Al empezar la partida se aplica un fundido musical de 450 ms. Es una decisión del menú web, independiente de las asociaciones musicales originales.
- El aviso de cambio solo aparece por una acción explícita del jugador; la confirmación de reproducción puede actualizarlo sin abrir otro.

Conservar segundos no demuestra sincronía musical entre arreglos. Las versiones remasterizadas pueden cambiar introducción, tempo, silencios y duración. No se estima BPM ni se retocan archivos para aparentar coincidencia. Las futuras marcas de compás deberán registrarse expresamente y verificarse.

## CORE y TITLE

`trace-startup.py` ejecuta `0x68D–0x812` y captura las paletas y los 32 pasos del fundido CORE → TITLE. El perfil aislado sin entrada y con modo de teclado agota un contador de 2.100 retrazados: no demuestra una duración universal del logotipo. La conversión de ese ensayo a «30 segundos» con la referencia de 70 Hz no constituye una medición del juego real.

La revisión verifica además que CORE consulta `SS:0xAD5`: el ensayo debe modelar la pila en el segmento de datos. En modo ratón, la rutina `0x6CDC` llama a INT 33h sin preservar CX, que también usa el bucle. Por tanto, su resultado puede alterar la espera. Tres casos controlados comprueban la salida con una tecla inyectada en el retrazado 70 y con distintos valores sintéticos de CX devueltos por la consulta. No representan una captura de un driver de ratón real.

La web abre su bienvenida propia antes de comenzar. CORE espera una entrada por decisión de Àlex; se ha eliminado el avance automático abreviado de 2,5 segundos. TITLE también espera entrada. La captura DOSBox del 16-10-2026 muestra que, en ese perfil, CORE avanza automáticamente tras 2100 fotogramas (~29,96 s): no se atribuye al original una espera infinita universal. Original conserva las 32 paletas DAC; Remaster aproxima el fundido con brillo global.

La captura de vídeo VGA mide 2190197/31250 Hz (~70,0863 Hz). CORE empieza a atenuarse en el fotograma 2110, llega al negro en 2141 y TITLE comienza a dibujarse en 2165 (completo en 2166). Se conserva el fundido de 32 retrazados y se añaden 24 retrazados negros antes de mostrar TITLE (~0,34 s). Esa pausa reproduce la carga observada con CPU fija a 12000 ciclos, no una duración universal de todos los PC. El vídeo y los cambios de imagen permanecen en los archivos de investigación locales, fuera de Git.

## Presentación y música original

La presentación mantiene los 80 cambios de página, 206 eventos imagen/DAC y 1.005 esperas contrastados previamente. Los cinco MIDI ya tienen tiempos, eventos y repeticiones contrastados con el reproductor nativo. La sincronía audiovisual completa de la presentación sigue sin medirse mediante un recorrido DOS: no se deduce únicamente de validar el MIDI.

La captura de arranque normal confirma RS5 durante CORE, TITLE e intro. Los escenarios usan ahora el selector RS del ejecutable, descrito a continuación. El menú web reproduce un MP3 propio, separado de estas asociaciones originales. La configuración explícita de asociaciones se mantiene separada de las tablas verificadas del motor gráfico.

## Selector musical de las salas (RS/MPU)

`prepareOriginalMusic` extrae del ejecutable verificado la tabla de 78 recursos en DS:0x80CD y los cinco registros de DS:0x80B9. La primera mazmorra (recurso 0) carga **CURSE.RS1**. El resultado queda fuera de Git en `assets/original/musica/native-contexts.json`; el catálogo aplica estas asociaciones a todas las versiones musicales y permite sustituirlas mediante `assets/music.json`.

`tools/reverse-engineering/trace-music.py` ejecuta 156 casos del tramo 0x4FD5–0x5017: una carga inicial y una entrada con el mismo tema para cada recurso. Si el índice coincide con DS:0x80B8, salta directamente a 0x5098; conserva la pista. Si cambia, 0x7F5D activa DS:0x9955 y espera a que el controlador termine antes de liberar y cargar el RS. La respuesta sintética F0 en 0x7FF9 emite los bytes 00 FC hacia el puerto MPU 0x330. No aplica una rampa de volumen en esta ruta: el port cambia de tema directamente y conserva su posición cuando sigue el mismo RS. Los fundidos de paleta de 0x79E4 no demuestran un fundido musical.

El ensayo cubre el selector **RS/MPU**, sin audio ni tiempos físicos; no certifica los demás controladores, una grabación completa en DOS ni los bucles internos del RS. La captura y verificación posterior de los cinco RS se documenta en ORIGINAL_MUSIC_VERIFICATION.md; Original ya usa sus bucles internos. El MP3 independiente y el fundido de 450 ms del menú web son decisiones propias de esa pantalla.

## Audio activo y límites actuales

El menú web tiene recursos propios: `assets/menu/graficos/WALLPAPER.png` y `assets/menu/musica/menu.mp3`. El MP3 lo aporta Àlex y se conserva sin sobrescribirlo; puede reemplazarlo sin cambiar la música del juego. El altavoz controla su estado independiente, guardado en localStorage. No muestra nombres de controladores. Al comenzar se aplica un fundido de 450 ms.

Durante la partida se ofrece `assets/dosbox-mt32/musica/CURSE.RS1.mp3` a `CURSE.RS5.mp3`: capturas desde arranque limpio de DOSBox-X con Munt y las ROM MT-32 locales. Son grabaciones, no un reproductor RS nativo. La captura limpia de RS1 fue aprobada por Àlex; las comprobaciones MIDI no sustituyen la escucha de cada pista. `dosbox-adlib/musica` queda reservado y vacío: no aparece en F5 hasta disponer de audio. Remaster se conserva en `archive/remaster/musica`, fuera de los recursos públicos; Amiga también permanece desactivada. Esto no desactiva los gráficos Remaster.

El transporte activo usa HTML Audio y los puntos de `loops.json`: al terminar busca el tramo repetido. **No garantiza una unión sin huecos a nivel de muestra.** El transporte Web Audio experimental se retiró tras los problemas de escucha. Los MIDI corregidos y los renders anteriores se conservan como investigación; aún no se ha demostrado una causa única de las diferencias del render con Munt. La API inmediata usada por el renderizador y la cola de eventos usada por DOSBox requieren comparación, especialmente al agotar voces; es una hipótesis pendiente, no un resultado certificado.

La captura normal de arranque confirma RS5 durante CORE, TITLE y la presentación, seguida por RS1 en la mazmorra. El extractor publica esas asociaciones y las de los 78 escenarios. Seguir con el mismo RS conserva su reproducción; cambiar de RS lo reinicia. La sincronía audiovisual completa todavía necesita contraste de recorrido.

Esc pausa la partida y su música sin mostrar la cabecera de depuración. Continuar reanuda la misma posición; Volver al inicio recupera el menú y su MP3 propio. Intro permite avanzar la presentación con un fundido. F2 cambia gráficos, F4 marcos, F5 música y F10/F11 retroceden/avanzan salas para pruebas. La carpeta `menu` está excluida del catálogo gráfico y de las versiones musicales. Los avisos de cambio solo aparecen por acciones explícitas.

Los efectos globales y de la sala actual se precargan y reutilizan. Se mantienen las prioridades de la única voz PCM original. La precarga solicita datos al navegador; no garantiza latencia cero ni sustituye una prueba de escucha en Firefox.

## Continuidad del fundido de TITLE

La transición conserva el último fotograma (negro al terminar CORE) durante la carga; no restaura CORE ni la imagen base de la presentación. El brillo vuelve a uno al instalar el siguiente fondo. Por petición de Àlex, TITLE aparece con un fundido de 32 retrazados (~0,46 s), añadido por el port; no se atribuye a la captura DOS original. Sin presentación habilitada, también sale con fundido antes de entrar en la mazmorra. Con presentación se conserva su secuencia de paletas de salida. La entrada de TITLE se pausa con el menú y respeta movimiento reducido.
