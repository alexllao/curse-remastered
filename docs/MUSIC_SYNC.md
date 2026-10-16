# Sincronización de música y presentación

## Lo implementado

- Un solo transporte musical evita superponer versiones.
- Un mismo identificador, como `CURSE.RS1`, conserva su posición en segundos al cambiar de versión.
- Un tema diferente comienza desde cero; una nueva partida reinicia la selección musical.
- Si la posición supera la duración de la nueva versión, se usa su módulo para el bucle de revisión.
- Original usa los puntos de bucle verificados de los RS mediante Web Audio. Otros paquetes siguen repitiendo su archivo completo hasta disponer de puntos propios verificados. Véase [ORIGINAL_MUSIC_VERIFICATION.md](ORIGINAL_MUSIC_VERIFICATION.md).
- La presentación propia de la web reproduce RS5 en bucle a volumen reducido; abrir o cerrar el menú no modifica su música. Al empezar la partida se aplica un fundido musical de 450 ms. Es una decisión del menú web, independiente de las asociaciones musicales originales.
- El aviso con el título aparece cuando el navegador confirma la reproducción.

Conservar segundos no demuestra sincronía musical entre arreglos. Las versiones remasterizadas pueden cambiar introducción, tempo, silencios y duración. No se estima BPM ni se retocan archivos para aparentar coincidencia. Las futuras marcas de compás deberán registrarse expresamente y verificarse.

## CORE y TITLE

`trace-startup.py` ejecuta `0x68D–0x812` y captura las paletas y los 32 pasos del fundido CORE → TITLE. El perfil aislado sin entrada y con modo de teclado agota un contador de 2.100 retrazados: no demuestra una duración universal del logotipo. La conversión de ese ensayo a «30 segundos» con la referencia de 70 Hz no constituye una medición del juego real.

La revisión verifica además que CORE consulta `SS:0xAD5`: el ensayo debe modelar la pila en el segmento de datos. En modo ratón, la rutina `0x6CDC` llama a INT 33h sin preservar CX, que también usa el bucle. Por tanto, su resultado puede alterar la espera. Tres casos controlados comprueban la salida con una tecla inyectada en el retrazado 70 y con distintos valores sintéticos de CX devueltos por la consulta. No representan una captura de un driver de ratón real.

La web abre su propia presentación TITLE antes de comenzar. Tras «Comenzar partida», CORE usa una espera abreviada de 2,5 segundos y conserva el fundido capturado de 32 pasos. **Esa espera breve es una decisión del port, no un tiempo DOS demostrado.** TITLE espera después la entrada del jugador como verifica el tramo `0x812–0x871`. Original usa las paletas DAC capturadas; Remaster aproxima el fundido con brillo global. La duración física y las entradas reales en DOS siguen pendientes de captura.

## Presentación y música original

La presentación mantiene los 80 cambios de página, 206 eventos imagen/DAC y 1.005 esperas contrastados previamente. Los cinco MIDI ya tienen tiempos, eventos y repeticiones contrastados con el reproductor nativo. La sincronía audiovisual completa de la presentación sigue sin medirse mediante un recorrido DOS: no se deduce únicamente de validar el MIDI.

CORE, TITLE e intro siguen sin asociación musical automática verificada. Los escenarios usan ahora el selector RS del ejecutable, descrito a continuación. RS5 está fijada únicamente para el menú web por decisión del usuario; no se interpreta como prueba de una asociación original. La configuración explícita de asociaciones se mantiene separada de las tablas verificadas del motor gráfico.

## Selector musical de las salas (RS/MPU)

`prepareOriginalMusic` extrae del ejecutable verificado la tabla de 78 recursos en DS:0x80CD y los cinco registros de DS:0x80B9. La primera mazmorra (recurso 0) carga **CURSE.RS1**. El resultado queda fuera de Git en `assets/original/musica/native-contexts.json`; el catálogo aplica estas asociaciones a todas las versiones musicales y permite sustituirlas mediante `assets/music.json`.

`tools/reverse-engineering/trace-music.py` ejecuta 156 casos del tramo 0x4FD5–0x5017: una carga inicial y una entrada con el mismo tema para cada recurso. Si el índice coincide con DS:0x80B8, salta directamente a 0x5098; conserva la pista. Si cambia, 0x7F5D activa DS:0x9955 y espera a que el controlador termine antes de liberar y cargar el RS. La respuesta sintética F0 en 0x7FF9 emite los bytes 00 FC hacia el puerto MPU 0x330. No aplica una rampa de volumen en esta ruta: el port cambia de tema directamente y conserva su posición cuando sigue el mismo RS. Los fundidos de paleta de 0x79E4 no demuestran un fundido musical.

El ensayo cubre el selector **RS/MPU**, sin audio ni tiempos físicos; no certifica los demás controladores, una grabación completa en DOS ni los bucles internos del RS. La captura y verificación posterior de los cinco RS se documenta en ORIGINAL_MUSIC_VERIFICATION.md; Original ya usa sus bucles internos. La pista RS5 y el fundido de 450 ms del menú web siguen siendo decisiones propias de esa pantalla.
