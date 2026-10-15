# CURSE Remastered

Reconstrucción moderna en TypeScript y PixiJS 8 de la aventura gráfica clásica de DOS, orientada a Windows actual.

_Curse of Enchantia_ fue el primer juego al que jugué de pequeño, y por eso este proyecto tiene un significado especial para mí. Me ha hecho mucha ilusión volver a él y descubrir sus tripas: desensamblar el ejecutable, entender cómo guarda sus gráficos y recuperar sus recursos originales, con la ayuda de la IA. Todavía conservo el juego original en disquetes de 3½ pulgadas.

Lo desarrollo en mis ratos libres. Mi objetivo es que pueda ejecutarse de forma nativa en un ordenador actual y, poco a poco, intentar hacer un remaster sencillo que conserve el encanto del original. Primero toca comprender y extraer sus recursos con fidelidad; después, reconstruir el juego sobre esa base.

> Los archivos originales del juego **no están incluidos**. Debes disponer de una copia obtenida legalmente y colocarla en `original/`. Nunca subas a Git los originales, los recursos extraídos ni los informes.

## Instalación

Se necesitan Node.js 22 o superior y pnpm 10.

```powershell
pnpm install
pnpm dev
```

## Recuperación de los recursos originales

El proceso de extracción es **no destructivo**: lee `original/` y escribe los resultados en `reports/`, una carpeta excluida de Git.

```powershell
pnpm inventory
pnpm --filter @curse/asset-extractor rnc-info
pnpm --filter @curse/asset-extractor title-png
pnpm --filter @curse/asset-extractor extract-all
```

- `inventory` crea un inventario de archivos con tamaños, firmas y hashes.
- `rnc-info` examina la cabecera RNC y comprueba el CRC de los datos comprimidos.
- `title-png` descomprime `DATA/TITLE.DAT`, valida su CRC y aplica la paleta `DATA/TITLE.PAL` para generar `reports/TITLE.png` (320 × 200).
- `extract-all` recorre `original/` buscando recursos del juego. Descomprime los archivos **RNC de método 1** en `reports/extracted/<ruta-relativa-original>.bin` y genera `reports/extracted/manifest.json`. La extracción de franjas RNC2 de los fondos MAP se ha contrastado con las instrucciones originales; véase [fondos MAP y BRD](docs/map-brd-resources.md). Los formatos desconocidos se registran sin inventar su interpretación. Descomprimir correctamente un archivo no implica que ya sea una imagen visualizable.

El extractor conserva los nombres y la estructura de carpetas. No modifica ni sobrescribe los originales. No publiques recursos extraídos protegidos por derechos de autor.

## Comprobaciones de desarrollo

```powershell
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
pnpm check
```

Husky ejecuta lint-staged antes de cada commit y `pnpm check` antes de cada push. Utiliza `pnpm format` para normalizar el formato del código existente.

## Hoja de ruta

1. **Recuperación de recursos:** inventariar los archivos, validar RNC1, implementar RNC2, investigar los formatos `.MAP`, `.SPR`, `.BRD`, `.SFX` y las paletas, y crear herramientas de conversión reproducibles.
2. **Reconstrucción jugable:** implementar escenarios, zonas interactivas, acciones, navegación, animaciones, sonido y guardado/carga en TypeScript y PixiJS 8.
3. **Mejoras gráficas opcionales y no destructivas:** ofrecer **Original** (escalado entero por vecino más cercano) y **Remastered HD** (reescalado con IA fuera del juego y revisión manual). Conservar los gráficos originales, las transparencias y la coherencia entre fotogramas. Los fondos y los sprites pueden necesitar tratamientos distintos. No ejecutar IA durante la partida.

**Estado actual:** se reconstruyen los 78 fondos de recursos y 637 fotogramas BRD, con límites de extracción documentados. El visor permite recorrer escenarios y comparar paquetes gráficos; el paseo de STUDY sigue siendo provisional. La prioridad actual es recuperar el movimiento, las colisiones y las transiciones originales antes de dar por válidos los remasters. [Primer contraste de BOXDET](docs/navigation.md).

## Guía técnica: cómo funcionan los gráficos originales

Esta sección es un cuaderno vivo de ingeniería inversa. Explica los conceptos del extractor, registra lo comprobado y distingue los hechos de las hipótesis. Cada formato nuevo debe documentarse antes de implementar su lector o al mismo tiempo.

### 1. ¿Qué es un píxel y qué significa 320 × 200?

Un **píxel** es una posición de una imagen digital. Una pantalla de 320 × 200 tiene 320 columnas y 200 filas: en total, **64.000 píxeles**. Muchos juegos de DOS utilizaban esta resolución por las características de las tarjetas VGA y las limitaciones de memoria.

Una imagen puede guardar los componentes rojo, verde y azul de cada píxel (**color directo**) o un número que apunta a una tabla de colores (**color indexado**). La pantalla de título utiliza color indexado.

### 2. ¿Qué es una paleta de colores?

A **palette** is a table of available colors. Instead of storing three color channels for every pixel, an 8-bit indexed image stores **one byte per pixel**, from 0 to 255. That number is an _index_ into a palette containing up to 256 colors.

Por ejemplo:

| Índice del píxel | Entrada de paleta (R, G, B) | Interpretación                |
| ---------------- | --------------------------- | ----------------------------- |
| 0                | (0, 0, 0)                   | Negro                         |
| 1                | (63, 0, 0)                  | Rojo intenso en unidades VGA  |
| 2                | (0, 63, 0)                  | Verde intenso en unidades VGA |

Son **ejemplos ilustrativos**, no los valores reales comprobados de `TITLE.PAL`.

Una paleta VGA estándar de 256 colores ocupa 256 × 3 = **768 bytes**: un valor rojo, uno verde y uno azul por color. El conversor digital-analógico (DAC) de VGA solía utilizar **6 bits por componente**, con valores entre 0 y 63. Los PNG modernos utilizan canales de 8 bits (0–255). La conversión habitual es:

```text
canalModerno = redondear(canalVGA × 255 / 63)
```

Si un píxel tiene índice `42`, el programa consulta la entrada 42 de la paleta y obtiene sus tres componentes. **El byte del píxel no es directamente un color RGB ni un valor de brillo.**

¿Por qué importa? Los mismos 64.000 índices pueden producir imágenes totalmente distintas al cambiar la paleta. Debemos identificar la paleta correcta de cada escena; elegir otra daría colores erróneos. Algunos juegos incluso animaban efectos modificando la paleta sin cambiar los índices de los píxeles.

### 3. ¿Cómo se almacena una pantalla VGA?

Una imagen indexada de 320 × 200 sin comprimir ocupa **64.000 bytes**, normalmente uno por píxel, ordenados fila a fila:

```text
desplazamiento = y × 320 + x
indicePixel = bytesImagen[desplazamiento]
rgb = paleta[indicePixel]
```

Esta distribución por filas se ha confirmado para la pantalla de título. Otros recursos pueden usar mosaicos, planos, máscaras, varios fotogramas u otras estructuras. **No debemos suponer que todos los `.MAP` o `.SPR` sean imágenes de 320 × 200.**

### 4. ¿Qué son RNC, RNC1 y RNC2?

**RNC** es un formato de compresión de datos asociado a ProPack, de Rob Northen Computing, utilizado en videojuegos para ahorrar espacio. La firma `RNC\x01` identifica el **método 1** y `RNC\x02` el **método 2**. Son métodos de compresión, **no formatos gráficos**: pueden contener imágenes, mapas o cualquier otro tipo de datos.

Un archivo RNC habitual empieza con una **cabecera de 18 bytes**:

| Desplazamiento | Bytes | Significado                       |
| -------------- | ----: | --------------------------------- |
| 0              |     3 | Firma ASCII `RNC`                 |
| 3              |     1 | Método de compresión (1 or 2)     |
| 4              |     4 | Tamaño descomprimido, big-endian  |
| 8              |     4 | Tamaño comprimido, big-endian     |
| 12             |     2 | CRC16 de los datos descomprimidos |
| 14             |     2 | CRC16 de los datos comprimidos    |
| 16             |     1 | Margen adicional                  |
| 17             |     1 | Número de bloques                 |

**Big-endian** significa que el byte más significativo se almacena primero. Por ejemplo, `00 00 FA 00` representa `0xFA00` en hexadecimal, es decir, **64.000** en decimal.

RNC1 utiliza códigos Huffman y referencias a datos anteriores: los patrones frecuentes ocupan menos bits y las secuencias repetidas pueden reutilizar bytes ya descomprimidos. RNC2 emplea otra codificación de bits y necesita su propio descompresor.

**CRC16** es una suma de comprobación de 16 bits para detectar errores accidentales. El CRC comprimido verifica los bytes originales y el descomprimido verifica el resultado. Que coincidan es una buena prueba de integridad, **pero no demuestra que el contenido sea una imagen ni que lo hayamos interpretado correctamente**.

### 5. Ejemplo real: `DATA/TITLE.DAT` y `DATA/TITLE.PAL`

Estos valores se comprobaron en los archivos originales de la pantalla de título:

| Propiedad                     | Valor observado      |
| ----------------------------- | -------------------- |
| Firma                         | `RNC\x01` (method 1) |
| Tamaño total de `TITLE.DAT`   | 47,064 bytes         |
| Datos comprimidos             | 47,046 bytes         |
| Datos descomprimidos          | 64,000 bytes         |
| CRC16 descomprimido           | `51cb`               |
| CRC16 comprimido              | `af5f`               |
| Bloques indicados en cabecera | 6                    |
| Tamaño de `TITLE.PAL`         | 768 bytes            |
| Dimensiones de imagen         | 320 × 200 pixels     |

La cabecera de 18 bytes y los 47.046 bytes comprimidos suman los 47.064 bytes del archivo. Los 64.000 bytes descomprimidos corresponden a 320 × 200 píxeles indexados de 8 bits. Al aplicar la paleta de 256 colores obtenemos la imagen original del título.

El proceso es:

```text
TITLE.DAT -> leer cabecera RNC -> validar CRC comprimido
          -> descomprimir RNC1 -> validar CRC descomprimido
          -> 64.000 índices de color --+
                                        +-> PNG indexado (320 × 200)
TITLE.PAL -> 256 colores RGB ----------+
```

PNG es un formato moderno de imagen compatible con editores y motores gráficos. Nuestro conversor escribe un **PNG indexado** (tipo de color 3), con un bloque `PLTE` que contiene la paleta. PNG también comprime los datos de imagen, pero **no utiliza el formato RNC**.

### 6. ¿Qué son los archivos `.MAP`, `.SPR`, `.BRD` y `.SFX`?

El juego original contiene archivos con estas extensiones. Su estructura interna **todavía no se ha documentado completamente**.

| Extensión | Hipótesis de trabajo                                | Qué falta comprobar                                          |
| --------- | --------------------------------------------------- | ------------------------------------------------------------ |
| `.MAP`    | Datos de escenas, fondos o mapas                    | Compresión, dimensiones, capas y paletas                     |
| `.SPR`    | Sprites o colecciones de sprites                    | Fotogramas, desplazamientos, transparencias y paletas        |
| `.BRD`    | Posibles animaciones u otros recursos estructurados | Firma, records, purpose and decoder                          |
| `.SFX`    | Efectos de sonido                                   | Codificación, frecuencia de muestreo, canales y reproducción |
| `.DAT`    | Datos generales del juego                           | Pueden estar comprimidos o tener estructuras propias         |
| `.PAL`    | Datos de paleta                                     | Asociación con recursos y codificación de canales            |

**Importante:** las extensiones son pistas, no especificaciones. Verificaremos cada formato examinando cabeceras, patrones de bytes, resultados visuales y, cuando sea necesario, el ejecutable original. El extractor debe indicar los formatos no compatibles en vez de generar imágenes engañosas.

### 7. ¿En qué consiste la ingeniería inversa del proyecto?

Partimos de los archivos originales y del comportamiento observado del juego para reconstruir sus estructuras de datos y su lógica. Seguimos un proceso reproducible:

1. Inventariar archivos, tamaños, hashes y firmas.
2. Identificar cabeceras de compresión y contenedores.
3. Descomprimir sin modificar los originales y verificar los CRC.
4. Identificar dimensiones, tablas de fotogramas, desplazamientos, máscaras y paletas.
5. Exportar PNG, audio o JSON una vez validados.
6. Comparar los resultados con el juego original y documentar los hallazgos.
7. Construir un motor moderno que cargue los recursos recuperados.

Cada descompresor o lector debe gestionar de forma segura archivos incompletos o malformados y distinguir los detalles **comprobados** de los **deducidos**.

### 8. ¿Cómo mostrará PixiJS los gráficos?

PixiJS 8 es el sistema moderno de renderizado 2D. Dibujará fondos, personajes, interfaz y efectos a partir de los recursos extraídos. El **motor del juego** gestionará por separado las acciones, las zonas interactivas, los cambios de escena y el estado de la partida.

En el modo original, el escalado por **vecino más cercano** mantiene los bordes definidos de los píxeles. También tendremos en cuenta la relación de aspecto y el tamaño de la ventana: en los monitores CRT los píxeles VGA no siempre se mostraban cuadrados.

### 9. ¿Por qué no aplicamos el upscaling inmediatamente?

El _upscaling_ amplía la imagen creando o interpolando píxeles; **no recupera información original perdida**. Aplicarlo antes de terminar la extracción dificultaría comprobar que los gráficos recuperados son fieles.

Los modos previstos son:

- **Original:** gráficos extraídos sin modificar, con escalado entero por vecino más cercano.
- **Remastered HD:** reescalado con ayuda de IA fuera del juego y retoque manual, sin sustituir los archivos originales.

Los fondos y los sprites animados requieren tratamientos distintos. Todos los fotogramas deben mantener coherencia y respetar transparencias y puntos de interacción. La IA puede inventar detalles, por lo que su resultado será una reinterpretación artística opcional, no una recuperación exacta de píxeles perdidos.

### 10. Glosario

| Término        | Significado                                                   |
| -------------- | ------------------------------------------------------------- |
| Asset          | Recurso del juego, como una imagen, sprite, sonido o mapa     |
| Byte           | Ocho bits; pueden representar un índice de paleta de 0 a 255  |
| Bit            | Un dígito binario (0 o 1)                                     |
| Hexadecimal    | Sistema de base 16 para representar bytes; `0xFA00` = 64.000  |
| Indexed color  | Los píxeles guardan índices de paleta en lugar de valores RGB |
| Palette        | Tabla que relaciona índices de píxeles con colores RGB        |
| RGB            | Canales rojo, verde y azul                                    |
| VGA DAC        | Conversor de colores de las tarjetas VGA clásicas             |
| RNC            | Formato de compresión de datos                                |
| Huffman coding | Codificación de longitud variable utilizada en RNC1           |
| Back-reference | Instrucción para reutilizar bytes ya descomprimidos           |
| CRC            | Código de comprobación para detectar errores                  |
| PNG            | Formato moderno de imagen sin pérdida                         |
| Sprite         | Imagen o fotograma de un objeto o personaje                   |
| Hotspot        | Zona interactiva de una escena                                |
| Upscaling      | Ampliación de imágenes generando o interpolando píxeles       |

## Resultado de la extracción: 15 de octubre de 2026

El primer `reports/extracted/manifest.json` generado en el equipo registra **192 archivos de recursos**: **3 RNC1 extraídos**, **16 RNC2 todavía no compatibles** y **173 sin formato reconocido**. Son **estados de extracción**, no porcentajes de contenido del juego recuperado. El inventario general anterior incluía más archivos porque también contaba otras extensiones.

Datos comprobados en el manifiesto:

- **RNC1:** `DATA/TITLE.DAT` (64.000 bytes descomprimidos), `DATA/CORE.DAT` (64.000) y `DATA/MENU.DAT` (10.240). El extractor informa de CRC comprimidos válidos; el descompresor RNC1 también valida el CRC descomprimido antes de guardar.
- **RNC2:** 16 archivos, entre ellos `BALCONY1`–`BALCONY5`, `BASEBAL1`–`BASEBAL6`, `BASEBAT` y `CAULDRN1`–`CAULDRN4`. Todos declaran 64.000 bytes descomprimidos y tienen un CRC comprimido válido. **Probablemente** sean pantallas o fotogramas indexados de 320 × 200, pero falta confirmarlo visualmente.
- **Sin reconocer:** 173 archivos, incluidos `.MAP`, `.SPR`, `.BRD`, `.SFX` y `.PAL`. El estado `raw` solo significa que el programa **no ha reconocido una cabecera RNC**, no que el archivo esté descomprimido o dañado.

### Próximos pasos de investigación

1. Implementar **RNC2** y validar los CRC. Exportar los 16 bloques de 64.000 bytes, identificar sus paletas y comprobar visualmente las imágenes.
2. Investigar las cabeceras binarias de **`.MAP`** y la representación de escenas, comparando patrones y tamaños de varios archivos.
3. Descifrar los fotogramas, máscaras y transparencias de **`.SPR`**, empezando por `MOUSE.SPR`, `FONT.SPR` e `ICONS.SPR`.
4. Investigar las estructuras de `.BRD` y el audio `.SFX` a partir de sus bytes reales.
5. Seguir añadiendo al README los hallazgos comprobados, ejemplos y comandos. No subir a Git los recursos originales ni los extraídos.

### Avance del descompresor RNC2

Se ha añadido `packages/asset-extractor/src/rnc2.ts` y se ha integrado en `extract-all`. El decodificador interpreta los bits de control en orden MSB, las secuencias literales y las referencias hacia atrás, y exige que coincidan el tamaño y ambos CRC16 antes de considerar válida una extracción. Se ha tomado como referencia técnica el algoritmo RNC2 documentado en [ancient, de Teemu Suutari](https://sources.debian.org/src/ancient/2.2.0-1/src/RNCDecompressor.cpp).

**Estado: implementación inicial sin validación con los 16 archivos reales.** Hay que ejecutar nuevamente `pnpm --filter @curse/asset-extractor extract-all` y comprobar `reports/extracted/manifest.json`. Si aparece un error de CRC o de descompresión, el archivo se marcará como no compatible y no se guardará un resultado incorrecto. No debemos dar por recuperados los recursos RNC2 hasta superar estas pruebas.

### Corrección del 15 de octubre: longitudes RNC2

La segunda extracción mostró 16 errores `Invalid RNC2 back-reference`. Los archivos `BALCONY1.DAT`, `BALCONY2.DAT` y `BALCONY3.DAT` fallaban en el mismo punto: 231 bytes producidos, intento de retroceder 440 bytes, longitud 8. La investigación del algoritmo de referencia permitió detectar una tabla de **códigos de longitud RNC2 incorrecta** en nuestra implementación. Se corrigió a los prefijos `00→4`, `10→5`, `010→6`, `011→7`, `110→8` y `111→9` (el valor 9 señala una secuencia de literales).

**Pendiente:** ejecutar de nuevo el extractor con los archivos originales y verificar los CRC. La corrección todavía no demuestra que los 16 archivos se recuperen correctamente.

### Extracción RNC1 y RNC2 completada (15 de octubre de 2026)

Después de corregir la tabla de longitudes del decodificador RNC2, la ejecución local del extractor ha informado de **192 recursos examinados, 19 extraídos, 0 no compatibles y 173 sin interpretar**. Por tanto, los **3 archivos RNC1 y los 16 RNC2** se han descomprimido sin errores según el resumen facilitado. El código comprueba el tamaño y los CRC16 antes de guardar los datos. Esta validación **no implica** que los archivos extraídos ya se hayan identificado o comprobado visualmente como imágenes.

**Siguiente fase:** convertir los bloques de 64.000 bytes en PNG indexados de 320 × 200 cuando exista una paleta de 768 bytes asociable, comparar visualmente los resultados y documentar qué relación entre archivos y paletas queda realmente confirmada. Después se investigarán los formatos propios `.MAP` y `.SPR`.

## Conversión de pantallas extraídas a PNG (fase de validación visual)

Se ha añadido el comando:

```powershell
pnpm --filter @curse/asset-extractor images-png
```

Lee `reports/extracted/manifest.json` y convierte los recursos extraídos de **64.000 bytes** en PNG indexados de **320 × 200**. Conserva los índices de píxel y aplica una paleta VGA de 768 bytes. Los PNG se guardan en `reports/images/DATA/` y el resultado de cada conversión en `reports/images/manifest.json`. Los archivos originales no se modifican ni se suben a Git.

Las asociaciones de paleta son **hipótesis basadas en los nombres**, todavía pendientes de comprobación visual:

| Pantallas                                      | Paleta candidata                            |
| ---------------------------------------------- | ------------------------------------------- |
| `BALCONY1.DAT` a `BALCONY5.DAT`                | `BALCONY.PAL`                               |
| `BASEBAL1.DAT` a `BASEBAL6.DAT`, `BASEBAT.DAT` | `BASEBALL.PAL`                              |
| `CAULDRN1.DAT` a `CAULDRN4.DAT`                | `CAULDRN.PAL`                               |
| `TITLE.DAT`                                    | `TITLE.PAL` (asociación ya comprobada)      |
| `CORE.DAT`                                     | `CORE.PAL` (pendiente de inspección visual) |

`MENU.DAT` se omite porque tiene 10.240 bytes y no es una pantalla completa de 320 × 200. El conversor rechaza paletas que no tengan 768 bytes o que incluyan componentes superiores a 63, en lugar de inventar colores. **Una conversión técnicamente correcta no demuestra por sí sola que la paleta elegida sea la adecuada.**

### Resultado de la primera conversión por lotes

La ejecución local comunicada por el usuario produjo **18 PNG**, **1 recurso omitido** y **0 errores**. La omisión prevista es `MENU.DAT` (10.240 bytes, no corresponde a una pantalla completa de 320 × 200). Falta confirmar en el manifiesto de imágenes el nombre exacto del archivo omitido y revisar visualmente las imágenes y las paletas candidatas antes de dar por validadas las escenas.

### Validación visual de la introducción

El usuario ha revisado las imágenes PNG generadas y confirma que se ven correctamente y corresponden a la animación de introducción del juego. Con esta comprobación quedan validados visualmente los fotogramas y las paletas utilizados en esta fase, además de las verificaciones de tamaño y CRC de la extracción. La próxima investigación se centrará en los formatos propios `.MAP` y `.SPR`; todavía no debe asumirse su estructura interna por la extensión del archivo.

## Investigación de los formatos MAP y SPR

Se ha incorporado un analizador **de solo lectura** que inventaría los archivos `.MAP` y `.SPR` de `original/` sin asumir de antemano que contienen escenarios o sprites ni modificar los originales.

```powershell
pnpm --filter @curse/asset-extractor analyze-map-spr
```

El comando guarda `reports/map-spr-analysis.json` con los tamaños por extensión, los primeros bytes en hexadecimal y ASCII imprimible, los primeros valores de 16 y 32 bits en ambos órdenes de bytes, la entropía, la proporción de ceros, el número de valores distintos y la frecuencia de bytes consecutivos repetidos. Estos indicadores servirán para comparar estructuras y plantear hipótesis verificables sobre cabeceras, dimensiones, índices y compresión. **Aún no existe un decodificador confirmado de MAP o SPR.** El informe puede compartirse sin incluir los archivos originales; conviene revisar que sus cabeceras no contengan datos privados antes de publicarlo.

### Primeros hallazgos de los 113 archivos MAP/SPR (15 de octubre de 2026)

A partir del informe local `reports/map-spr-analysis.json`:

- **56 archivos MAP:** todos cumplen `tamaño = 16 × N + 2`. En 54 de 56, los dos primeros bytes son `00 00`; hay dos excepciones. Esto apunta a una estructura regular, pero **no demuestra** que los datos estén organizados en registros de 16 bytes.
- **57 archivos SPR:** todos tienen tamaño múltiplo de 16. Sus primeras palabras interpretadas como enteros de 16 bits little-endian suelen formar secuencias crecientes; en los 57 casos, el segundo valor es menor que el tamaño total del archivo. Una posible explicación es una tabla de desplazamientos, pendiente de verificar contra el contenido binario.
- Ejemplos: `BENN.SPR` comienza por `3, 32, 62, 94, 124`; `CAVE.SPR` por `2, 83, 164, 245, 268`.

**Próximo paso:** analizar offsets, longitudes de segmentos y cabeceras con muestras binarias originales, y contrastar varias interpretaciones antes de generar gráficos. No hay todavía decodificación MAP/SPR validada.

### Verificación binaria de BENN.SPR y BENN.MAP

Se han examinado muestras locales originales (no se incorporan al repositorio).

- `BENN.SPR` mide **32.976 bytes**. Los primeros **22 valores uint16 little-endian** constituyen un índice de posiciones en unidades de **16 bytes**. El primer valor es `3` (posición 48); el último es `1957` (posición 31.312). Los 44 bytes del índice están seguidos de 4 bytes de relleno.
- Los **22 offsets** llevan a cabeceras consistentes. Sus dos primeras palabras parecen dimensiones `ancho × alto`: ejemplos `24×23`, `24×21`, `176×102`, `32×45`, `48×32`. **Pendiente** validar visualmente el contenido de los sprites.
- Cada entrada termina donde empieza la siguiente, alineada a 16 bytes. El último bloque llega al final del archivo. Los bytes siguientes a las dimensiones incluyen campos aún no interpretados y datos probablemente codificados por filas o segmentos; no se ha demostrado el algoritmo de dibujo.
- `BENN.MAP` mide **30.450 bytes** (`16×1903+2`). Comienza con `00 00 00 00 00 02 02 00 ...`, con secuencias iniciales de valores pequeños; más adelante cambia su distribución de bytes. **No está demostrada** su relación exacta con los sprites ni el significado de los registros.

Siguiente trabajo: crear un lector de índices SPR con validación de rangos y un visor experimental de bloques, sin suponer que los datos son píxeles sin comprimir.

### Inspección reproducible de índices SPR

```powershell
pnpm --filter @curse/asset-extractor spr-index
```

Lee por defecto `original/DATA/BENN.SPR` y escribe `reports/sprites/BENN-index.json`. El primer entero little-endian se interpreta como desplazamiento del primer bloque en unidades de 16 bytes; el índice se recorre hasta la primera entrada cero y se validan posiciones crecientes, alineadas y dentro del archivo. Cada bloque incluye los cinco primeros enteros de 16 bits y dimensiones candidatas. Esta herramienta **no dibuja aún sprites**: falta identificar de forma comprobable la codificación de los datos de píxel. El fichero original permanece intacto.

### Investigación experimental del flujo de píxeles SPR

```powershell
pnpm --filter @curse/asset-extractor spr-stream
```

El comando inspecciona los bloques de `BENN.SPR` y prueba, **sin darla por válida**, una gramática de secuencias `00 [FF opcional] longitud colores...` a partir del byte 12 de cada bloque. Guarda `reports/sprites/BENN-stream.json` con las secuencias detectadas, los bytes consumidos y los restantes. Los marcadores, el desplazamiento inicial de datos y la semántica de transparencia siguen por demostrar. No produce PNG ni modifica los originales.

### Análisis de cabeceras y estructura de bloques SPR

El informe de `spr-stream` mostró que la hipótesis de secuencias `00 [FF] longitud colores` solo interpreta 20 secuencias (115 bytes) del sprite 0 y ninguna de los otros 21. **No es un decodificador validado**.

```powershell
pnpm --filter @curse/asset-extractor spr-layout
```

Genera `reports/sprites/BENN-layout.json`, con las primeras palabras de cada cabecera, relaciones aritméticas candidatas, muestras hexadecimales al inicio y al final de los datos, histogramas y posiciones de marcadores. El propósito es identificar límites y tipos de secciones antes de reconstruir los píxeles. No se añaden datos originales al repositorio.

### Hipótesis de registros por línea en sprites

El informe `BENN-layout.json` confirma patrones recurrentes en 22 bloques: las primeras dos palabras son compatibles con ancho y alto; los tres valores siguientes presentan relaciones aritméticas frecuentes (`160 = 117 + 43`, `445 = 296 + 149`) pero no universales. Los bytes sugieren registros de desplazamiento, cantidad y colores; esto **todavía no demuestra** el códec gráfico.

```powershell
pnpm --filter @curse/asset-extractor spr-rows
```

El diagnóstico `reports/sprites/BENN-rows.json` prueba varias posiciones iniciales (10, 12, 14 y 16 bytes), interpreta provisionalmente registros `[desplazamiento firmado, cantidad, colores...]`, y compara cuántas filas encajan con la altura y el ancho declarados. Los resultados son hipótesis para contrastar, no sprites renderizados.

### Primera previsualización PNG experimental de sprites

```powershell
pnpm --filter @curse/asset-extractor spr-preview
```

Produce `reports/sprites/BENN-experimental.png` (mosaico de 22 bloques) y `BENN-experimental.json` (estadísticas). El dibujo es **solo diagnóstico**: interpreta tentativamente registros `00 (00|FF) longitud colores`, centra las secuencias en filas sucesivas y muestra los índices de color en escala de grises, sin la paleta original ni posiciones verificadas. La finalidad es comprobar si aparece estructura reconocible; **no equivale a una extracción correcta**.

### Análisis estático del ejecutable DOS original

Guarda tu copia legítima de `CURSE.EXE` en `original/CURSE.EXE` (fuera de Git). Ejecuta:

```powershell
pnpm --filter @curse/asset-extractor analyze-exe
```

El comando escribe `reports/exe/curse-analysis.json` con la cabecera MZ, punto de entrada, tabla de reubicaciones y ubicaciones de cadenas como `benn.spr`, `benn.map` y `sprites.pal`. Los posibles operandos inmediatos que muestra son **candidatos, no referencias de código verificadas**. El paso siguiente es desensamblar las funciones de apertura/lectura y seguir las llamadas hasta el renderizado de sprites. No subas el EXE original al repositorio.

### Extraer todos los sprites con colores

Con los recursos originales en `original/DATA/` (no versionados), ejecuta:

```powershell
pnpm --filter @curse/asset-extractor spr-decode-all
```

El comando recorre recursivamente los archivos `.SPR`, reconstruye los cuatro planos VGA, conserva la transparencia y genera PNG individuales en `reports/sprites/all/<NOMBRE>/`. También escribe `reports/sprites/all/manifest.json` con los resultados y errores de cada archivo. Un error en un recurso no interrumpe la extracción de los demás; el comando termina con código de error si hubo fallos.

Por defecto usa `original/DATA/SPRITES.PAL` (256 colores VGA de 6 bits por canal) como **paleta candidata global**. La asociación de paleta a cada escena todavía requiere validación visual; los colores no deben considerarse definitivos hasta contrastarlos con el juego original. Puedes indicar carpetas y paleta alternativas:

```powershell
pnpm --filter @curse/asset-extractor spr-decode-all original/DATA reports/sprites/all original/DATA/SPRITES.PAL
```

No subas los `.SPR`, `.PAL` ni los PNG derivados al repositorio.

### Atlas de revisión visual de sprites

Después de ejecutar `spr-decode-all`, genera una hoja visual por cada archivo `.SPR`:

```powershell
pnpm --filter @curse/asset-extractor spr-atlas
```

Las hojas se guardan en `reports/sprites/atlases/` y el índice en `reports/sprites/atlases/manifest.json`. Cada casilla incluye número de sprite, dimensiones y número de píxeles dibujados (`p`). El fondo ajedrezado distingue transparencia y el escalado usa vecino más cercano. Las imágenes son para revisión, no sustituyen a los PNG individuales. Si una hoja falla, el comando intenta procesar las restantes e informa del error.

## Paletas de escena verificadas

El cargador original combina 192 colores del encabezado MAP con los 64 finales de SPRITES.PAL. No debe usarse una PAL global para todos los SPR. Véase [evidencia, alcance y pendientes](docs/palette-loading.md).

```powershell
pnpm --filter @curse/asset-extractor spr-decode-scenes
pnpm --filter @curse/asset-extractor spr-atlas reports/sprites/scenes reports/sprites/scene-atlases
```

Los manifiestos con hashes, las paletas derivadas y los PNG permanecen en `reports/` (excluido de Git).

La ejecución aislada del código original también verifica los fundidos y el ciclo del índice 255 de la interfaz. Véase [captura reproducible, modelos TypeScript y límites](docs/palette-effects.md).

### Sprites de interfaz con paleta compartida

```powershell
pnpm --filter @curse/asset-extractor spr-decode-ui
pnpm --filter @curse/asset-extractor spr-atlas reports/sprites/interface reports/sprites/interface-atlases
```

Exporta 211 sprites de MOUSE, FONT e ICONS usando únicamente colores compartidos verificados. ICONS[159] se exporta por separado con la paleta del MAP activo porque siete píxeles usan índices del escenario. Véase [evidencia y resultados](docs/interface-palettes.md).

```powershell
pnpm --filter @curse/asset-extractor spr-decode-ui-context
```

Genera ICONS[159] en su contexto de origen STUDY. Es el icono del objeto 175, que puede incorporarse al inventario y usa la paleta de la escena activa; [evidencia y alcance](docs/icon159-context.md).

## Fondos y animaciones originales

```powershell
pnpm --filter @curse/asset-extractor scene-backgrounds
pnpm --filter @curse/asset-extractor brd-extract
pnpm --filter @curse/asset-extractor spr-atlas reports/brd reports/brd/atlases
```

Reconstruye 78 fondos según las tablas del ejecutable y extrae 637 fotogramas BRD. Las vistas de objetos son composiciones estáticas de revisión. SMALL.BRD tiene una tabla parcialmente válida y tres fotogramas de CHANGE.BRD siguen pendientes de contexto de color. Véase [evidencia, reproducción y límites](docs/map-brd-resources.md).

## Galería de escenarios y primera prueba de movimiento

La galería prepara los 78 fondos originales, incluidos los panoramas completos. **F3** avanza de escenario y **Mayús+F3** retrocede. Las flechas izquierda y derecha recorren los fondos anchos. **F2** alterna Original, Remaster y los paquetes gráficos locales detectados, manteniendo el encuadre. Un contador discreto muestra los FPS arriba a la derecha.

```powershell
pnpm mods:prepare
pnpm dev
pnpm --filter @curse/engine test
```

La preparación necesita los resultados de `scene-backgrounds` y `brd-extract`. Abre `http://127.0.0.1:8787/`. En desarrollo, basta crear una carpeta como `mods/remaster2/` y pulsar F2 para detectarla, aunque esté vacía. Cada imagen se busca en **paquete seleccionado → remaster → original**. Véase [carpetas, nombres y proceso gradual](mods/README.md).

Los sprites de Ben permanecen originales sin interpolar. Solo STUDY permite caminar por una zona de prueba dibujada a mano: todavía no reproduce la navegación original. Las demás pantallas son un visor de fondos. No hay salidas, inventario, interacciones ni scripts de sala implementados. El empaquetado como aplicación nativa de Windows sigue pendiente.

Los fondos remasterizados son propuestas artísticas provisionales: la IA puede desplazar elementos y conservar la proporción del PNG no demuestra que su geometría encaje. Para validarlos habrá que comparar con el movimiento y los límites originales. Se ha empezado a extraer y contrastar [BOXDET.DAT y las consultas del ejecutable](docs/navigation.md); estos datos aún no sustituyen la zona provisional del motor.

La prueba de luces y F4 se han retirado. Se reserva una capa de presentación independiente para futuras animaciones, sin implementarlas ahora. Todos los recursos locales de `mods/`, originales y derivados, y las compilaciones que los contienen permanecen fuera de Git.
