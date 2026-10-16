# Sincronización de música y presentación

## Lo implementado

- Un solo transporte musical evita superponer versiones.
- Un mismo identificador, como `CURSE.RS1`, conserva su posición en segundos al cambiar de versión.
- Un tema diferente comienza desde cero; una nueva partida reinicia la selección musical.
- Si la posición supera la duración de la nueva versión, se usa su módulo para el bucle de revisión.
- Los archivos se repiten completos. Los puntos de bucle nativos de los RS no están implementados.
- La presentación propia de la web reproduce RS5 en bucle a volumen reducido; abrir o cerrar el menú no modifica su música. Al empezar la partida se aplica un fundido musical de 450 ms. Es una decisión del menú web, independiente de las asociaciones musicales originales.
- El aviso con el título aparece cuando el navegador confirma la reproducción.

Conservar segundos no demuestra sincronía musical entre arreglos. Las versiones remasterizadas pueden cambiar introducción, tempo, silencios y duración. No se estima BPM ni se retocan archivos para aparentar coincidencia. Las futuras marcas de compás deberán registrarse expresamente y verificarse.

## CORE y TITLE

`trace-startup.py` ejecuta `0x68D–0x812` y sustituye únicamente descompresión y copiadores VGA. Captura la subida de paleta, la espera y los 32 pasos del fundido CORE → TITLE. Sin entrada inyectada, CORE espera 2.100 retrazados, el primer paso de salida ocurre en 2.101 y el negro final en 2.132. TITLE sube su paleta en ese último retrazado; espera después la entrada del usuario. No se añade un fundido de entrada inventado.

La web usa la misma referencia de 70 Hz que la presentación: máximo de 30 segundos de espera CORE y unos 0,457 segundos de salida. Una tecla, un clic o «Continuar» adelantan la espera y conservan el fundido. La duración física en DOS sigue sin medirse. Original usa las paletas DAC capturadas y PNG derivados automáticamente; Remaster aproxima esos cambios con brillo global de la imagen proporcionada por el usuario. Su geometría y contenido no se modifican.

## Presentación y música original

La presentación mantiene los 80 cambios de página, 206 eventos imagen/DAC y 1.005 esperas contrastados previamente. Su audio no se declara sincronizado con los cinco MIDI provisionales: faltan la captura de salida MIDI del motor original y la comparación de tiempos, eventos, bucles e inicialización de instrumentos.

No hay una asociación automática inventada entre RS1–RS5 y CORE, TITLE o escenarios. RS5 está fijada únicamente para el menú web por decisión del usuario; no se interpreta como prueba de una asociación original. La configuración explícita de asociaciones se mantiene separada de las tablas verificadas del motor gráfico.
