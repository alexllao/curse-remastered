# Fondos MAP, objetos y animaciones BRD

## Evidencia y alcance

Perfil exclusivo de CURSE.EXE con SHA-256 `f2c0046e07b25f408516edae5d6a66c06107971fb95c55ed770fa52a6b4ecd8d`. Las direcciones de código son desplazamientos de archivo. DS designa el segmento de datos original, cuya base de archivo es `0xF510`.

Se reconstruyen 78 fondos de recursos, asociados a 126 entradas de salas lógicas. No son 78 salas distintas. Los PNG usan la paleta base verificada: 192 colores del MAP y 64 de SPRITES.PAL. No reproducen fundidos ni todos los cambios de ejecución.

## Fondos MAP verificados

Los primeros 576 bytes contienen RGB6. El uint16 siguiente reserva memoria en párrafos; el contenido gráfico empieza en MAP+578. Contiene una tabla de desplazamientos en párrafos, relativos al inicio de ese contenido. Cada bloque utilizado comienza con una cabecera RNC2 de 18 bytes y produce 6400 índices: una franja de 32 × 200 píxeles, ordenados por filas.

La tabla del EXE en DS:757E tiene un puntero por identificador de recursos. Cada registro apuntado contiene un contador seguido de los índices de franjas, en el orden del panorama. El valor 255 representa una columna vacía con índice de color cero, opaca. Puede haber repeticiones y distintos órdenes para un mismo MAP. No debe deducirse el número de franjas válidas a partir del relleno de la tabla MAP.

| Código EXE      | Evidencia                                                          |
| --------------- | ------------------------------------------------------------------ |
| `0x5098–0x50A9` | Obtiene el orden de franjas del recurso.                           |
| `0x52D2–0x5338` | Dibuja diez columnas de la ventana y trata las columnas vacías.    |
| `0x69BC–0x6BA1` | Descompresor RNC2 original.                                        |
| `0x7836–0x7874` | Copia la franja a los cuatro planos VGA, con máscaras 1, 2, 4 y 8. |

La ejecución aislada de las instrucciones originales coincide byte por byte con las **736 franjas únicas utilizadas por los 78 fondos**. Otra prueba ejecuta el copiador VGA con un patrón sintético y comprueba la posición de cada píxel. Esto valida descompresión y distribución de píxeles; no es una captura del juego completo.

Ejemplos: CORRIDOR tiene 1216 × 200 píxeles; LAKEBED, 1600 × 200; EDGE, 2144 × 200. El ancho procede del orden del ejecutable, no de una suposición de 320 píxeles.

## Objetos: vista estática de revisión

La tabla DS:53B5 apunta a registros de nueve bytes. Tipo 255 termina la lista; tipo cero corresponde a elementos de escenario que esta vista no reconstruye. Se conservan los 707 registros de objetos de los recursos, con coordenadas firmadas, indicadores iniciales, índice de sprite, espejo horizontal y atributos.

El cargador está en `0x8CA6–0x8D6E` y `0x8DA0–0x8DDF`. El dibujo en `0xEDBD` consulta los indicadores y el sprite; la ordenación original en `0xF49A` utiliza `y + altura + desplazamiento de profundidad`. El bit alto del índice selecciona el espejo. Las coordenadas negativas se recortan al componer la imagen.

`objects-preview.png` es una composición diagnóstica del estado de los registros: omite scripts, jugador/BRD, elementos de tipo cero y la reproducción exacta del orden entre objetos de igual profundidad. Usa la rama normal DS:0AD6=0 y excluye los descriptores con bit 128. No debe presentarse como una captura fiel de una partida.

## BRD y contexto de color

Los BRD utilizan la misma geometría por planos que los SPR. Se reutiliza el decodificador existente sin modificarlo. La tabla DS:7482 traduce 126 salas lógicas a recursos. DS:85AC contiene sus descriptores iniciales de 14 bytes, seleccionados en `0x4D55` y leídos en `0x4E43–0x4E89`.

El byte 13 del descriptor selecciona BRD: 255 usa STD.BRD, 254 usa el SPR del escenario y los demás valores indexan la tabla de nombres DS:0918. La selección y carga están en `0x4E8D–0x4F28`. Estos descriptores prueban contextos iniciales; los scripts pueden seleccionar otros durante la partida.

Resultados locales:

- 29 archivos BRD presentes y 637 fotogramas decodificados.
- 583 PNG con colores compartidos; 26 atlas de estos fotogramas.
- 54 fotogramas dependen del escenario. Hay 44 variantes PNG con contexto inicial identificado: EMERGE/POOL, PLUNGE/LAKEBED y GRAVE/GRAVE.
- La investigación de scripts añade cinco PNG de CHANGE (fotogramas 0–4), seleccionados con CHANGE.MAP activo. Hay 49 PNG contextuales en total. Siguen pendientes CHANGE[5–7] y CASTLE[24–25], que conservan índices y transparencia.
- SMALL.BRD tiene 118 entradas iniciales válidas. La entrada 118 apunta fuera del archivo: párrafo 16128, desplazamiento 258048, frente a 41520 bytes de archivo. Se registra `valid-prefix-only`; no se declara relleno ni se repara el original. Solo una copia temporal de la tabla termina tras el prefijo válido para reutilizar el decodificador.

El nombre FINAL.BRD aparece en la tabla del EXE, pero falta entre los originales disponibles y ningún descriptor inicial lo selecciona. Su uso dinámico queda pendiente.

## Reproducción

Desde la raíz del repositorio:

```powershell
pnpm --filter @curse/asset-extractor scene-backgrounds
pnpm --filter @curse/asset-extractor brd-extract
pnpm --filter @curse/asset-extractor spr-atlas reports/brd reports/brd/atlases
pnpm --filter @curse/asset-extractor test
python -m pip install --target reports/tool-deps -r tools/reverse-engineering/requirements.txt
$env:PYTHONPATH = (Resolve-Path reports/tool-deps).Path
python tools/reverse-engineering/trace-map-backgrounds.py
python tools/reverse-engineering/trace-brd-scripts.py
```

Fondos, índices, franjas y manifiestos: `reports/scenes/backgrounds/`. BRD, índices RGBA y contextos: `reports/brd/`. En los archivos RGBA indexados, cada canal RGB conserva el índice y alfa conserva la transparencia. Los contrastes originales se registran en `reports/exe/map-background-verification.json` y `reports/exe/brd-script-verification.json`. Todos los recursos, PNG e informes permanecen excluidos de Git.

Los manifiestos registran hashes, desplazamientos, asociaciones y límites. Los lectores del EXE rechazan revisiones desconocidas. Pasan 11 pruebas del extractor, las comprobaciones específicas de TypeScript, ESLint y formato, y el contraste de las 736 franjas con el original. Persisten los fallos globales previamente documentados en [paletas](palette-loading.md).

Queda por investigar el final de la tabla SMALL, los contextos dinámicos de BRD, las capas de escenario de tipo cero y los scripts. La extracción no presupone que el juego completo esté reconstruido.

## Selección BRD mediante scripts

El intérprete de animaciones (`0x85FC–0x8800`) reconoce el comando 248 (`0xF8`), lee su argumento en `0x8715` y cambia el recurso BRD. Los selectores 255 y 254 eligen STD y el SPR activo, respectivamente. Los demás seleccionan un nombre en DS:0918; `0x8771–0x879D` abre y lee el BRD en el búfer reservado. No se interpreta una pareja de bytes F8/selector encontrada al azar como prueba de una carga: también puede pertenecer a datos de movimiento o argumentos.

Para CHANGE, `0x450F` exige el recurso 25. La escritura de `0x453F` instala la secuencia DS:1B8E; la copia original `0xBE2–0xBF1` la transfiere al actor. El comando en DS:1B8F carga CHANGE.BRD (selector 19), selecciona los fotogramas 0, 1, 2, 3 y 4, y vuelve a STD. El recurso 25 está asociado a CHANGE.MAP en la tabla de recursos del ejecutable. La ejecución aislada confirma la carga, los cinco índices, la conservación del recurso y del búfer de paleta, y la ausencia de escrituras DAC en esta ruta. La misma rama rechaza un recurso distinto. Es evidencia de contexto de esta ruta, sin afirmar exclusividad de paleta ni cobertura de todos los scripts.

Para CASTLE, `0x4B25` exige el recurso 72 (FINAL.MAP) y el estado cero de los dos bits altos de DS:35CA. Instala DS:2B61, carga CASTLE.BRD y selecciona el fotograma 22. Esto demuestra una carga en FINAL, pero **no verifica el uso de CASTLE[24–25]**. No se exportan esos dos fotogramas con una asociación deducida de esta carga. Existe otra secuencia en DS:2BA8 con índices 24 y 25; falta verificar su contexto de activación y paleta.

`trace-brd-scripts.py` ejecuta estas instrucciones originales sin sustituir el intérprete. Solo emula las operaciones DOS de apertura, lectura y cierre. Usa un actor fuera de pantalla (x=500) para omitir el sonido mediante el recorte original; inicia los contadores de animación explícitamente. Contrasta las selecciones observadas con el manifiesto TypeScript y comprueba que no se exportan como verificados otros fotogramas de CHANGE. Los 85 y 3 pasos observados son iteraciones del ensayo, no una medida de tiempo de juego ni una prueba de alcance desde una partida inicial.

La anomalía de SMALL sigue abierta: encontrar una secuencia que cargue SMALL o que use sus índices bajos no demuestra que la entrada 118 sea relleno o que nunca se consulte. Se conserva el aviso de extracción parcial.
