# Dirección musical del remaster

Criterio permanente acordado con Àlex el 16 de octubre de 2026.

- La referencia aprobada es `assets/remaster/musica/CURSE.RS5.mp3`, la música de la presentación. Conservar esta versión sin cambios.
- Toda nueva música remasterizada debe mantener una dirección orquestal coherente con RS5. Para la mazmorra: cuerdas, maderas, arpa y metales discretos; misterio y tensión contenidos, sin tapar las acciones ni los efectos.
- Igualar la sonoridad percibida de cada pista con RS5 en el propio archivo de audio. No compensar diferencias entre canciones cambiando los controles de volumen del juego.
- Medir sonoridad integrada y picos reales antes y después de exportar. Referencia actual RS5: aproximadamente **−19,34 LUFS integrados**, **−6,30 dBTP**, rango de sonoridad **5 LU**, medidos con FFmpeg loudnorm sobre el MP3 local. Estos valores describen esta copia, no un objetivo universal de producción. Repetir la medida si cambia el archivo de referencia; procurar una diferencia de sonoridad integrada no mayor de 0,5 LU sin saturación.
- Conservar los ajustes de volumen elegidos por el jugador. La atenuación propia del menú de presentación es independiente de la igualación entre archivos; no elevar las pistas del juego para contrarrestar esa atenuación.
- Guardar nuevas propuestas por separado y conservar las versiones anteriores hasta aprobar la sustitución. Las propuestas se distinguen de los remasters fieles. El paquete Alternativa se ha retirado por petición de Àlex. RS1 Remaster usa la orquestación de su MIDI, pendiente de comparación auditiva.
- La síntesis con muestras de instrumentos produce una maqueta orquestal. No describirla como grabación de una orquesta real ni dar por comprobado su resultado auditivo mediante medidas numéricas.

## Alternativas históricas parciales

Los identificadores `amiga` (etiqueta Amiga) y `adlib` (etiqueta AdLib (OPL2)) quedan reservados para paquetes musicales independientes de los gráficos. Amiga contiene ya el título; AdLib conserva solo las instrucciones de importación. Los paquetes aparecen cuando contienen audio compatible. No se han inventado pistas ausentes.

- Àlex identifica el enlace de [KHInsider Amiga](https://downloads.khinsider.com/game-soundtracks/album/curse-of-enchantia-amiga-gamerip-1992/Curse%2528Titlemusic%2529.mp3) como RS5 / título. Es una correspondencia aportada por el usuario; el sitio bloqueó la consulta automática. Se puede importar una copia local como `assets/amiga/musica/CURSE.RS5.mp3`.
- [VGMRips](https://vgmrips.net/packs/pack/curse-of-enchantia-pc) lista YM3812 y una única pista Main BGM. No afirmar que esto sea el catálogo de cinco RS/MPU ni que demuestre toda la música de Amiga. Falta verificar su correspondencia antes de importarla.
- Un paquete parcial puede volver a Original para el mismo identificador ausente, como ya hace el reproductor. No duplicar una sola canción bajo todos los nombres RS para aparentar un paquete completo.
- Propuesta de mazmorra «Bajo la piedra»: composición nueva, maqueta orquestal de 91,43 segundos, no reproduce la melodía original. Su paquete Alternativa se ha eliminado por petición de Àlex; la propuesta previa queda únicamente entre los archivos de trabajo y propuestas, fuera del selector. La versión anterior se conserva en `assets/remaster/musica/anteriores/`. Sonoridad exportada −19,61 LUFS frente a −19,34 LUFS de RS5; pico real −6,23 dBTP. Instrumentos de GeneralUser GS, de [S. Christian Collins](https://www.schristiancollins.com/generaluser), sintetizados con TinySoundFont. Proyecto MIDI y mediciones conservados localmente fuera de Git.

## Fidelidad y versiones activas

- Un remaster debe conservar la melodía reconocible, el ritmo y la estructura de la música original. Cambiar la instrumentación y la producción no autoriza sustituir la composición. Àlex señaló que «Bajo la piedra» sonaba bien pero no era reconocible como el tema original.
- RS1 Remaster usa la versión orquestal v2 de 159,87 segundos. Se han conservado los 3.125 eventos de nota del MIDI provisional local, con sus tiempos, duraciones y velocidades; cambian instrumentos, balance y reverberación. Esto verifica fidelidad al MIDI disponible, no demuestra una captura exacta de la temporización DOS. Sonoridad −19,61 LUFS y pico real −7,95 dBTP; RS5 sigue intacta.
- El paquete Alternativa se ha eliminado por petición de Àlex; deja de aparecer en el selector y en el ciclo de F5. Las versiones musicales disponibles son Original, Remaster y Amiga, además de Sin música.
- Amiga incorpora RS5 / título desde el enlace FLAC directo aportado por Àlex en vgmtreasurechest. Se conserva el FLAC intacto en `assets/amiga/musica/fuentes/` y una copia MP3 ajustada a RS5 en `assets/amiga/musica/CURSE.RS5.mp3`. Dura 148,98 segundos; las pistas RS1–RS4 ausentes vuelven a Original. La página de KHInsider bloqueó el acceso automático, pero el enlace directo aportado posteriormente funcionó.

El título Amiga importado mide -19.59 LUFS integrados, frente a -19.34 LUFS de RS5 Remaster; pico real -2.26 dBTP. No se han alterado los controles de volumen del juego ni el archivo de referencia.

Procedencia del título Amiga indicada por Àlex: [álbum Curse of Enchantia (Amiga) en KHInsider](https://downloads.khinsider.com/game-soundtracks/album/curse-of-enchantia-amiga-gamerip-1992). El manifiesto local registra esta página y conserva también el enlace directo del FLAC descargado.
