# Sistema de audio local

## Organización

Los recursos se guardan exclusivamente en carpetas excluidas de Git:

```text
reports/audio/roms/MT32_CONTROL.ROM
reports/audio/roms/MT32_PCM.ROM
mods/musica/original/CURSE.RS1.mid
mods/musica/original/CURSE.RS1.ogg
mods/musica/medieval/CURSE.RS1.mp3
mods/musica/cinematic/CURSE.RS1.mp3
mods/musica/symphonic/CURSE.RS1.mp3
mods/sonidos/original/
reports/audio/
```

Cada versión musical conserva el mismo identificador de tema, incluido `CURSE.`. Se admiten OGG, Opus, MP3, M4A, WAV, FLAC y AAC según los decodificadores del navegador. Cuando conviven MIDI y audio renderizado con el mismo nombre, se ofrece el audio renderizado. Las versiones se descubren al arrancar y mediante «Actualizar música». Un `version.json` opcional dentro de una versión permite declarar `label` y `provisional`.

El selector gráfico recorre únicamente `mods/graficos/`. Música, sonidos y referencias no aparecen en F2. El directorio `original/` de la raíz no se sirve a la web: sus ROM permanecen locales. Las compilaciones que contienen recursos también están excluidas de Git y no deben publicarse con ellos.

## Reproducción

Gráficos, música y efectos se eligen de forma independiente; no hay selector manual de temas en el menú. La presentación propia de la web (TITLE por ahora) reproduce `CURSE.RS5` de la versión elegida en bucle y al 30 % del volumen configurado. Es una decisión de presentación de la adaptación, no una asociación atribuida al DOS. Abrir o cerrar el menú no modifica esa reproducción. «Comenzar partida» apaga esa pista mediante un fundido de 450 ms y pasa al arranque original. Los cambios de tema del juego usan únicamente el mapa explícito de escenas. Un solo elemento de audio evita superposiciones. El aviso se muestra al recibir `playing`. Si el navegador bloquea el primer sonido, el primer clic o tecla vuelve a intentarlo, sin abrir y cerrar el menú. Ocultar o abandonar la página pausa el audio. Las preferencias se guardan sin guardar la partida.

Si falta un tema en una versión, se intenta el mismo identificador en Original. Sin audio disponible se conserva el silencio. Un MIDI por sí solo se muestra como pendiente de renderizado; no se sustituye por una síntesis genérica. La selección automática necesita el mapa explícito descrito en [ORIGINAL_MUSIC_MAPPING.md](ORIGINAL_MUSIC_MAPPING.md). Mientras no esté verificado, las escenas sin asociación permanecen en silencio; RS5 solo se fija para el menú de la adaptación.

## Escucha MT-32 provisional

[Munt](https://github.com/munt/munt) proporciona la biblioteca de emulación MT-32 utilizada para el renderizado local. Se fija la revisión `6e7c01fba7e1d50c8fa705834889fd0eac136075`; el código externo y la biblioteca compilada se conservan en `reports/tools/`. Las dependencias de preparación son CMake 3.31.6 y Mido 1.3.3.

```powershell
pnpm audio:setup
pnpm audio:prepare
```

La preparación necesita Windows, Python, Git, FFmpeg y Visual Studio 2022 con C++ y Windows SDK. `CURSE_PYTHON` permite elegir Python y `--library`/`--ffmpeg` permiten indicar dependencias de renderizado alternativas. El render conserva los eventos y tiempos del MIDI suministrado, añade dos segundos de cola y genera OGG local. Registra hashes de entrada, ROM, biblioteca y salida en `reports/audio/mt32-render.json`. No sobrescribe un audio existente si no puede acreditar que es su propia salida anterior sin cambios.

Estos audios se identifican como **Original · MT-32 provisional**. Los MIDI suministrados tienen tempo/marcadores pendientes de contraste. Tampoco se ha capturado todavía la inicialización MPU-401, las asignaciones de canal ni los cambios de timbre específicos del juego. Munt ha notificado notas de percusión sin correspondencia en su configuración inicial; no se han corregido canales de oído. Disponer de las ROM no convierte esta escucha en una reproducción original verificada.

## Sonidos opcionales

Los 109 WAV aportados, procedentes de 19 SFX, figuran en `mods/sonidos/manifest.json` como `experimental_unverified`. Su frecuencia, codificación y correspondencia con eventos del juego siguen pendientes. `sourceIndex` es secuencial y empieza en 1; no se interpreta como identificador de evento. Permanecen sin activar en la partida.

Para efectos contrastados se admite un mapa explícito `mods/sonidos/original/sounds.json` con `events`, donde las claves son los argumentos de sonido originales y los valores archivos locales existentes. También se reserva el nombre numérico `42.wav` para un evento 42 ya identificado. La ausencia de archivos o asociaciones mantiene el silencio. Los canales de actores ya recogen sus solicitudes de sonido; todavía faltan los controladores completos de sala.

Los formatos, posiciones y eventos deberán contrastarse en el EXE antes de habilitar las extracciones experimentales. Los efectos de ejemplo de las pruebas son archivos sintéticos temporales y no se incluyen sonidos reales en el repositorio.

Los paquetes de efectos se descubren en `mods/sonidos/<paquete>/`; «Sin efectos» desactiva la reproducción y «Original» conserva las asociaciones originales disponibles. Las carpetas adicionales aparecen cuando contienen audio. Cada paquete puede declarar su `sounds.json`; un evento ausente vuelve al original si existe. No se enlazan los WAV experimentales por sus índices secuenciales ni se da por validado su formato al elegir «Original».
