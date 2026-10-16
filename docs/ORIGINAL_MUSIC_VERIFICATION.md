# Música original: verificación RS / MT-32

## Resultado y alcance

Los cinco RS se convierten con el tempo del EXE y se contrastan **evento por evento y tiempo por tiempo** con capturas del reproductor nativo dentro de DOSBox-X. Se comprueba una primera pasada completa, como mínimo una vuelta posterior completa y todos los eventos de las vueltas parciales restantes. La captura MIDI tiene resolución de 1 ms; la máxima diferencia observada frente a los ticks reconstruidos es 2 ms. Los MIDI exportados conservan **120 PPQ**, tempos musicales y marcadores de bucle.

| Tema | BPM del EXE | Entrada nativa al bucle | Fin de primera pasada | Duración de cada vuelta |
| ---- | ----------: | ----------------------: | --------------------: | ----------------------: |
| RS1  |         140 |                    36 s |          135,428571 s |             99,428571 s |
| RS2  |         135 |              7,111111 s |           35,555556 s |             28,444444 s |
| RS3  |         140 |             41,142857 s |           68,571429 s |             27,428571 s |
| RS4  |         125 |                     0 s |              122,88 s |                122,88 s |
| RS5  |         110 |             43,636364 s |           78,545455 s |             34,909091 s |

El EXE fija el tempo en DS:80B9 y ejecuta el salto `FF <puntero little endian>` al final de cada RS. F8 suma **240 ticks**; el siguiente E1 aporta otros 225. En RS1, F8 E1 son por tanto **465 ticks**, frente a los 480 supuestos anteriormente. F9 marca fin de compás sin introducir una espera de 480 ticks. Las esperas explícitas ya completan los compases.

El running status MIDI continúa al saltar. En RS5, el primer evento del tramo repetido cambia de canal respecto a su primera visita: es una nota de velocidad cero. El exportador conserva ese comportamiento nativo en la vuelta expandida; no restaura un estado supuesto.

Las notas, velocidades, instrumentos y controles de la primera pasada coinciden con el RS. El problema de los MIDI previos era el tempo fijo de 120 BPM, la espera de RS1 y la omisión de los saltos internos. **Los arreglos anteriores se conservan**: sus melodías no quedan invalidadas por esta corrección. La fidelidad temporal de un remaster deberá revisarse individualmente. RS5 Remaster permanece intacta.

## Captura reproducible y límites

EXE SHA-256: `f2c0046e07b25f408516edae5d6a66c06107971fb95c55ed770fa52a6b4ecd8d`.

Se usa [DOSBox-X 2026.10.01, revisión b6abbd5](https://github.com/joncampbell123/dosbox-x/releases/tag/dosbox-x-v2026.10.01), paquete MinGW SDL2 de 64 bits. Configuración: MPU-401 intelligent, MT-32, ROM locales, CPU normal / 12000 ciclos, salida y entrada SDL dummy. Se desactiva Sound Blaster en la copia aislada para registrar solo música. El EXE del juego no se modifica.

El arnés invoca mediante el depurador la rutina musical original (CS:4DD5), con un recurso seleccionado y el índice previo invalidado; para antes de cargar el fondo (CS:4E98), restaura todos los registros y FLAGS y deja ejecutar el reproductor/IRQ en TITLE. Esto verifica el reproductor nativo, **no constituye un recorrido de juego** por todas las salas. Las asociaciones se verifican por separado mediante trace-music.py.

El capturador de DOSBox-X está instrumentado en un único byte: offset de archivo 0x4C6AC1, 01 → 05. Activa MIDI además de WAV cuando empieza la captura WAV. La herramienta exige el SHA-256 del ejecutable oficial antes de aplicar el cambio. No altera MPU, síntesis ni el EXE del juego. La huella antes/después queda en recorder-instrumentation.json.

Informes locales en reports/audio/native-verified/: verification.json, render.json, hashes de RS, MIDI capturados/exportados, ROM, DLL Munt y OGG. El render usa salida analógica 2, 48000 Hz, 32 parciales, DAC 0, nice amp ramp activado y reverb de las ROM, como la configuración del ensayo DOSBox. No se declara igualdad bit a bit entre grabaciones ni comparación con un MT-32 físico. No se ha realizado escucha humana ni una prueba de audio real en navegador por el agente.

Las ROM y los datos derivados permanecen fuera de Git. Los anteriores MIDI/OGG se guardan en assets/original/musica/anteriores/pre-captura-nativa-2026-10-16/.

## Reproducción y preparación

Los MIDI principales contienen una primera pasada y marcas NATIVE_LOOP_START / NATIVE_LOOP_END. Los `.expanded.mid` incluyen otra vuelta nativa explícita para conservar su estado de canal. El audio se genera a partir de estos últimos. Su región de reproducción repetida corresponde a esa segunda vuelta, después de haber tocado toda la primera pasada; así no se reinician instrumentos ni la introducción.

assets/original/musica/loops.json declara archivo, límites en segundos y SHA-256. El catálogo solo aplica límites si coincide el hash del archivo y añade una versión a la URL para evitar audio antiguo en caché. El transporte Web Audio usa AudioBufferSourceNode.loopStart / loopEnd: no depende del evento ended ni de un temporizador de interfaz. Los archivos sin metadatos verificados conservan el transporte HTML Audio. Se respetan silencio, pausa, volumen, fundido, cambios de tema y el modo de pruebas silencioso.

Preparación (Python con mido, Munt compilado y FFmpeg disponibles):

```powershell
$env:CURSE_CAPTURE_WORK = 'RUTA_ABSOLUTA_DE_TRABAJO'
# Descomprimir el paquete oficial en runtime/ bajo esa carpeta.
python tools/reverse-engineering/enable-native-midi-recorder.py
python tools/reverse-engineering/capture-native-music.py --track 1 --seconds 310
# Repetir: RS2 105 s; RS3 175 s; RS4 285 s; RS5 195 s.
python tools/reverse-engineering/verify-rs-midi.py --root . --captures $env:CURSE_CAPTURE_WORK --output reports/audio/native-verified
python tools/render-native-mt32.py --input reports/audio/native-verified
```

La verificación y el render escriben en preparación, **no publican automáticamente** los archivos activos. La herramienta anterior `pnpm audio:prepare` sigue siendo el renderizador histórico provisional y no debe usarse para sustituir este lote; sus comprobaciones de huellas impiden sobrescribirlo sin coincidencia.
