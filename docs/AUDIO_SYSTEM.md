# Sistema de audio local

## Organización

Los recursos se guardan exclusivamente en carpetas excluidas de Git:

```text
original/ROMS/MT32_CONTROL.ROM
original/ROMS/MT32_PCM.ROM
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

Gráficos, música y sonidos se eligen de forma independiente. El transporte musical usa un único elemento de audio: al cambiar de versión detiene la anterior y conserva los segundos del mismo tema. Se puede escuchar un tema desde el menú. El aviso temporal se muestra al recibir el evento real `playing`, no simplemente al cambiar el selector. El menú pausa el avance y la música; «Continuar partida» los reanuda. Las preferencias se guardan en este navegador, sin guardar la partida.

Si falta un tema en una versión, se intenta el mismo identificador en Original. Sin audio disponible se conserva el silencio. Un MIDI por sí solo se muestra como pendiente de renderizado; no se sustituye por una síntesis genérica. La selección automática necesita el mapa explícito descrito en [ORIGINAL_MUSIC_MAPPING.md](ORIGINAL_MUSIC_MAPPING.md). Mientras no esté verificado, se pueden escuchar los temas mediante el selector manual.

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
