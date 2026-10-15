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
- Los 10 restantes, CHANGE (8) y CASTLE (2), conservan índices y transparencia; su asociación de color sigue pendiente.
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
```

Fondos, índices, franjas y manifiestos: `reports/scenes/backgrounds/`. BRD, índices RGBA y contextos: `reports/brd/`. En los archivos RGBA indexados, cada canal RGB conserva el índice y alfa conserva la transparencia. El contraste original se registra en `reports/exe/map-background-verification.json`. Todos los recursos, PNG e informes permanecen excluidos de Git.

Los manifiestos registran hashes, desplazamientos, asociaciones y límites. Los lectores del EXE rechazan revisiones desconocidas. Pasan 11 pruebas del extractor, las comprobaciones específicas de TypeScript, ESLint y formato, y el contraste de las 736 franjas con el original. Persisten los fallos globales previamente documentados en [paletas](palette-loading.md).

Queda por investigar el final de la tabla SMALL, los contextos dinámicos de BRD, las capas de escenario de tipo cero y los scripts. La extracción no presupone que el juego completo esté reconstruido.
