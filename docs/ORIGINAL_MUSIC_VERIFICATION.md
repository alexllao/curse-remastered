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

`assets/dosbox-mt32/musica/loops.json` declara archivo, límites en segundos y SHA-256. El catálogo solo aplica límites si coincide el hash y añade una versión a la URL para evitar audio antiguo en caché. El transporte activo es HTML Audio; véanse sus límites más abajo.

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

## Audio activo y límites actuales

El menú web tiene recursos propios: `assets/menu/graficos/WALLPAPER.png` y `assets/menu/musica/menu.mp3`. El MP3 lo aporta Àlex y se conserva sin sobrescribirlo; puede reemplazarlo sin cambiar la música del juego. El altavoz controla su estado independiente, guardado en localStorage. No muestra nombres de controladores. Al comenzar se aplica un fundido de 450 ms.

Durante la partida se ofrece `assets/dosbox-mt32/musica/CURSE.RS1.mp3` a `CURSE.RS5.mp3`: capturas desde arranque limpio de DOSBox-X con Munt y las ROM MT-32 locales. Son grabaciones, no un reproductor RS nativo. La captura limpia de RS1 fue aprobada por Àlex; las comprobaciones MIDI no sustituyen la escucha de cada pista. `dosbox-adlib/musica` queda reservado y vacío: no aparece en F5 hasta disponer de audio. Remaster se conserva en `archive/remaster/musica`, fuera de los recursos públicos; Amiga también permanece desactivada. Esto no desactiva los gráficos Remaster.

El transporte activo usa HTML Audio y los puntos de `loops.json`: al terminar busca el tramo repetido. **No garantiza una unión sin huecos a nivel de muestra.** El transporte Web Audio experimental se retiró tras los problemas de escucha. Los MIDI corregidos y los renders anteriores se conservan como investigación; aún no se ha demostrado una causa única de las diferencias del render con Munt. La API inmediata usada por el renderizador y la cola de eventos usada por DOSBox requieren comparación, especialmente al agotar voces; es una hipótesis pendiente, no un resultado certificado.

La captura normal de arranque confirma RS5 durante CORE, TITLE y la presentación, seguida por RS1 en la mazmorra. El extractor publica esas asociaciones y las de los 78 escenarios. Seguir con el mismo RS conserva su reproducción; cambiar de RS lo reinicia. La sincronía audiovisual completa todavía necesita contraste de recorrido.

Esc pausa la partida y su música sin mostrar la cabecera de depuración. Continuar reanuda la misma posición; Volver al inicio recupera el menú y su MP3 propio. Intro permite avanzar la presentación con un fundido. F2 cambia gráficos, F4 marcos, F5 música y F10/F11 retroceden/avanzan salas para pruebas. La carpeta `menu` está excluida del catálogo gráfico y de las versiones musicales. Los avisos de cambio solo aparecen por acciones explícitas.

Los efectos globales y de la sala actual se precargan y reutilizan. Se mantienen las prioridades de la única voz PCM original. La precarga solicita datos al navegador; no garantiza latencia cero ni sustituye una prueba de escucha en Firefox.
