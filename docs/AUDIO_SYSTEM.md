# Sistema de audio local

## Organización

Los recursos se guardan exclusivamente en carpetas excluidas de Git:

```text
reports/audio/roms/MT32_CONTROL.ROM
reports/audio/roms/MT32_PCM.ROM
assets/original/musica/CURSE.RS1.mid
assets/original/musica/CURSE.RS1.ogg
assets/medieval/musica/CURSE.RS1.mp3
assets/cinematic/musica/CURSE.RS1.mp3
assets/symphonic/musica/CURSE.RS1.mp3
assets/original/sonidos/
reports/audio/
```

Cada versión musical conserva el mismo identificador de tema, incluido `CURSE.`. Se admiten OGG, Opus, MP3, M4A, WAV, FLAC y AAC según los decodificadores del navegador. Cuando conviven MIDI y audio renderizado con el mismo nombre, se ofrece el audio renderizado. Las versiones se descubren al arrancar y mediante «Actualizar música». Un `version.json` opcional dentro de una versión permite declarar `label` y `provisional`.

El selector gráfico descubre únicamente las versiones que contienen `assets/<versión>/graficos/`. Música, sonidos y referencias no aparecen en F2. El directorio `original/` de la raíz no se sirve a la web: las ROM opcionales permanecen en `reports/audio/roms/`. Las compilaciones que contienen recursos también están excluidas de Git y no deben publicarse con ellos.

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

Los 109 WAV aportados, procedentes de 19 SFX, figuran en `assets/original/sonidos/manifest.json` como `experimental_unverified`. Ese lote sigue siendo experimental; no se activa por sus índices secuenciales. La primera mazmorra dispone ahora de una extracción independiente contrastada con el ejecutable, descrita a continuación. `sourceIndex` es secuencial y empieza en 1; no se interpreta como identificador de evento. Los archivos de ese lote permanecen sin activar directamente en la partida.

Para efectos contrastados se admite un mapa explícito `assets/original/sonidos/sounds.json` con `events`, donde las claves son los argumentos de sonido originales y los valores archivos locales existentes. También se reserva el nombre numérico `42.wav` para un evento 42 ya identificado. La ausencia de archivos o asociaciones mantiene el silencio. Los canales de actores ya recogen sus solicitudes de sonido; todavía faltan los controladores completos de sala.

Los formatos, posiciones y eventos deberán contrastarse en el EXE antes de habilitar las extracciones experimentales. Los efectos de ejemplo de las pruebas son archivos sintéticos temporales y no se incluyen sonidos reales en el repositorio.

Los paquetes de efectos se descubren en `assets/<paquete>/sonidos/`; «Sin efectos» desactiva la reproducción y «Original» conserva las asociaciones originales disponibles. Las carpetas adicionales aparecen cuando contienen audio. Cada paquete puede declarar su `sounds.json`; un evento ausente vuelve al original si existe. No se enlazan los WAV experimentales por sus índices secuenciales ni se da por validado su formato al elegir «Original».

## Efectos originales de la primera mazmorra

`trace-dungeon-sounds.py` ejecuta la selección Sound Blaster de `CURSE.EXE` (`0x5507–0x5570`) y captura los argumentos de la transferencia DMA sin ejecutar el hardware. Contrasta 21 asociaciones y 126 casos de prioridad. Los eventos 0–14 utilizan STD.SFX y los eventos 15–20 de recurso 0 utilizan DUNGEON.SFX. El mismo ID local no se reutiliza al entrar en otra sala.

Cada entrada original contiene prioridad, constante de tiempo, recorte final y número de muestra. La tabla de la muestra apunta a una longitud de dos bytes; el PCM empieza después. Los WAV se construyen con la porción que solicita el controlador, sin normalizar, remuestrear ni incluir esa cabecera. El DSP usa el comando de frecuencia 40h y la transferencia 14h de PCM mono de 8 bits. La interpretación del formato y de la constante se apoya en la [guía de programación de Creative](https://www.ardent-tool.com/sound/Sound_Blaster_HW_Programming_Guide_1st.pdf), capítulo 3. La constante 131 corresponde a 8.000 Hz; existen eventos con otras constantes, por lo que no se fuerza una frecuencia común. La cabecera WAV redondea las frecuencias fraccionarias al entero más próximo; el informe conserva el valor calculado.

```powershell
python tools/reverse-engineering/trace-dungeon-sounds.py
python tools/extract-dungeon-sounds.py
```

La preparación completa `pnpm assets:prepare` también ejecuta ambos pasos. Salidas locales:

- `assets/original/sonidos/verificados/000.wav` a `020.wav`: WAV por evento, incluidos los recortes y frecuencias distintos de una misma muestra.
- `assets/original/sonidos/sounds.json`: asociaciones explícitas globales y por sala, con prioridades.
- `reports/audio/dungeon-sounds.json`: argumentos nativos, hashes y casos de prioridad.
- `reports/audio/prepared-dungeon-sounds.json`: archivos generados y metadatos de los WAV.

Se conservan los WAV experimentales anteriores y los mapas personalizados. Una salida generada modificada manualmente no se sobrescribe sin acreditación. Ninguna de estas salidas se versiona.

En el juego se elige **Efectos de sonido → Original**. Ayuda, saludo, cadenas, recogida de objetos, pared, puerta y ambiente utilizan los eventos de sus canales originales; sus solicitudes también se comparan en la traza de 577 ciclos. La reproducción mantiene una sola voz PCM: una solicitud con prioridad igual o menor se ignora mientras suena otra. Los remasters parciales pueden sustituir cada evento y volver al original cuando falte. «Sin efectos», el cambio de sala, el menú y ocultar la página detienen la voz según el flujo existente.

Esto valida datos y solicitudes digitales, no una comparación auditiva con DOSBox ni la salida analógica de una Sound Blaster. Las pruebas automatizadas usan audio simulado y se ejecutan en silencio.

### Respuesta sonora de la bienvenida

El menú del port reutiliza provisionalmente los eventos globales 7 (señalar, 70 ms) y 4 (clic, 91 ms) de STD.SFX, desde el catálogo de efectos. Es una decisión de interfaz propia, no una asociación comprobada del DOS. Cada paquete puede sustituir esos eventos; si faltan, se utiliza el original disponible. No se duplican ni versionan WAV.

Su voz es independiente del controlador PCM del juego, sin superponer sonidos de interfaz entre sí. Respeta «Sin efectos», el volumen general, la página oculta y `?silent=1`. El hover solo responde al ratón y al foco visible de teclado, con límite entre repeticiones; los bloqueos de reproducción no se reintentan más tarde. El menú se mantiene azul y muestra el dorado al señalar o enfocar cada botón.
