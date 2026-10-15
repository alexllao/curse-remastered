# Paletas dinámicas: ejecución aislada del código original

## Resultado y alcance

Las instrucciones de CURSE.EXE se han ejecutado en Unicorn 2.1.4, en modo
x86 de 16 bits. El arnés carga la imagen MZ, aplica sus reubicaciones y ejecuta
la inicialización de segmentos original (`0x227–0x238`). No recompila ni
sustituye las instrucciones de las rutinas analizadas.

Es **ejecución aislada de rutinas**, no una captura del juego completo.
Se sustituyen la reserva/liberación DOS de memoria temporal y las lecturas
de retrazado VGA. No se emulan interrupciones de reloj ni la pantalla VGA.
El bloque central que dibuja y gestiona la interfaz se omite. Por tanto,
los resultados verifican colores, aritmética y condiciones de salto, pero
no autorizan convertir sus contadores a segundos.

Ejecutable admitido: el mismo SHA-256 documentado en [paletas de escena](palette-loading.md).
Se rechaza cualquier otra revisión antes de ejecutarla.

## Fundido hacia negro

Los ocho puntos de llamada localizados preparan `AX=32`, `BX=256` y
`SI=0x0AEF` antes de llamar a la rutina de archivo `0x79E4`:
`0x769`, `0xCDB`, `0x2AD9`, `0x2C4A`, `0x2E9F`, `0x3126`, `0x4D26`, `0xD798`.
Son los ocho puntos identificados por análisis estático; no se ha probado
la ausencia de otros accesos indirectos.

El arnés ejecuta esos preparativos y cada CALL original hasta su retorno,
con un vector sintético que contiene todos los valores de componente 0–63.
Además, ejecuta la llamada de transición de escena con las paletas compuestas
de BENN y XROADS.

Resultados comprobados:

- 32 selecciones del índice 0 mediante OUT al puerto 0x3C8, desde `0x7A82`.
- Cada selección va seguida de 768 componentes RGB6 al puerto 0x3C9.
- La última subida contiene exclusivamente ceros.
- El búfer original DS:0AEF permanece intacto: se modifica el DAC y una copia
  temporal, no la paleta base. No encadenar fundidos usando el último PNG negro
  como si fuera la fuente que conserva el juego.
- Se reserva un bloque de 0xF0 párrafos (3840 bytes), que se libera al terminar.
- Si falla la reserva DOS, no se escribe al DAC, no se libera un bloque y
  la rutina devuelve carry activado.
- La espera de retrazado funciona empezando con el bit 3 a cero o a uno.
  El valor del bit se alterna artificialmente en esta prueba; el número de
  lecturas no representa una frecuencia real de refresco.

Para un componente RGB6 `v`, la instrucción prepara un acumulador `v * 256`
y un decremento entero `(v * 256) / 32 = v * 8`. Tras el paso `k` (1–32):

```text
componente_DAC(k) = (v * 256 - v * 8 * k) >> 8
```

El resultado se trunca. Un interpolador que redondea al entero más cercano
no reproduce todos los colores: por ejemplo, `v=2` ya produce 1 en el primer
paso. `fadePaletteFrame` implementa esta regla en TypeScript para la extracción.
El paso 0 representa la paleta fuente; la rutina original empieza subiendo el
paso 1, no añade una subida del paso 0.

## Índice 255: marco del selector de interfaz

El bloque `0xDD53–0xDD8D` selecciona el índice 255 y escribe una tripleta
del ejecutable. La tabla de 24 colores ocupa 72 bytes desde el desplazamiento
de archivo `0x1AB4E` (DS:B63E). Sus bytes se leen localmente y solo aparecen
en los informes ignorados, nunca en el código del repositorio.

Su contexto es el selector de diez posiciones de la barra de interfaz:

- `0xDCE2` es llamado desde el bucle de entrada en `0x92F`, `0x95C`, `0xA9E`
  y `0xB0F`.
- `0xDD1C–0xDD28` inicializa el contador de color a 1 y el índice de tabla a 0.
- `0xDD9A–0xDDF5` dibuja el marco usando píxeles con índice 255, en una
  columna alineada a 32 píxeles.
- `0xE010–0xE02B` divide la posición horizontal por 32 y despacha una de las
  diez entradas de acción en DS:B60C.
- `0xE0FB` dibuja la barra y sus iconos. La acción `0xE1D3` construye la lista
  a partir de DS:5225; esto sitúa también el inventario dentro de esa interfaz.

No hay evidencia aquí de que este ciclo sea una animación global de todos
los escenarios. Tampoco se debe aplicar el índice 255 animado a todos los
PNG de sprites como un cambio permanente de su paleta base.

### El contador depende de carry

El contador se reinicia a 4 después de actualizar un color. Eso, por sí solo,
**no demuestra una actualización cada cuatro vueltas**:

1. `0xDD5C` ejecuta DEC sobre el contador; DEC conserva carry (CF).
2. `0xDD60` ejecuta JA, cuya condición es `CF=0` y `ZF=0`.
3. Si CF ya vale 1 al entrar, JA no salta aunque el contador siga siendo 3.
   Se actualiza el color y se reinicia el contador a 4 en cada vuelta.

El arnés ejecuta 193 entradas al bloque por caso. En dos casos controla CF
explícitamente y en otros cuatro ejecuta la cola original `0xDFF9–0xE00D`
para producirlo. Las condiciones del ratón son entradas sintéticas declaradas.

| Caso probado                                     | CF al entrar | Actualizaciones en 193 vueltas | Período de 24 colores |
| ------------------------------------------------ | ------------ | ------------------------------ | --------------------- |
| CF fijado a 0                                    | 0            | 49                             | 96 vueltas            |
| CF fijado a 1                                    | 1            | 193                            | 24 vueltas            |
| Cola original con modo de entrada 0              | 1            | 193                            | 24 vueltas            |
| Cola original con modo de entrada 2              | 0            | 49                             | 96 vueltas            |
| Cola original con modo 1 y límite Y superior 199 | 1            | 193                            | 24 vueltas            |
| Cola original con modo 1 y límite Y superior 16  | 0            | 49                             | 96 vueltas            |

En modo 1, la cola fija DX=16 y llama al limitador de cursor `0x6D46`.
Su último CMP depende de los límites configurados y deja CF para el bloque
siguiente. No se ha capturado todavía qué límites están activos al abrir
cada interfaz en una partida real. Los modos 0/1/2 son los valores del campo
DS:0AD5; la tabla anterior no es una medición de dispositivos físicos.

`advanceSelector` reproduce DEC/JA y la vuelta del índice 23 al 0, incluido
el acarreo de entrada. No normaliza la conducta del ejecutable a una velocidad
fija. También conserva la aritmética uint16 si el contador entra con cero.

## Reproducir la captura

Desde la raíz del repositorio, con Python y Node disponibles:

```powershell
python -m pip install --target reports/tool-deps -r tools/reverse-engineering/requirements.txt
$env:PYTHONPATH = (Resolve-Path reports/tool-deps).Path
pnpm --filter @curse/asset-extractor exe-palettes
python tools/reverse-engineering/trace-palettes.py --palette reports/palettes/scenes/BENN.PAL --palette reports/palettes/scenes/XROADS.PAL
pnpm --filter @curse/asset-extractor palette-effects-verify
pnpm --filter @curse/asset-extractor test
```

La traza se guarda en `reports/exe/palette-trace.json`, con versión del
emulador, hash del ejecutable, fuentes y hashes de las paletas, escrituras
DAC y límites de la prueba. El arnés tiene un límite de instrucciones por
tramo y rechaza puertos e interrupciones que no estén previstos.

El verificador TypeScript compara sus resultados con **todas** las subidas
capturadas de los fundidos y todos los eventos de los seis casos del selector.
Lee la tabla del ejecutable local para validar las tripletas; no incorpora
colores originales al repositorio.

## Verificaciones y pendientes

Pasan las cuatro pruebas del paquete, el contraste con la ejecución original
y ESLint, Prettier y TypeScript de los archivos cambiados. Continúan los
fallos globales previos descritos en el informe de paletas de escena.
El decodificador geométrico y las imágenes extraídas no se han modificado.

Sigue pendiente una captura del juego completo en un emulador DOS con registro
de puertos: activación de cada interfaz, límites reales del cursor, rutas de
entrada/salida, restauración del índice 255 y tiempos de retrazado. El arnés
actual no pretende sustituir esa comprobación.
