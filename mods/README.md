# Paquetes gráficos locales

Las imágenes originales y derivadas son locales y permanecen fuera de Git. Solo se versiona este documento. No publiques una compilación que incluya estos gráficos.

## Carpetas y nombres

```text
mods/
  original/fondos/070-STUDY.png
  remaster/fondos/070-STUDY.png
  remaster2/fondos/070-STUDY.png
  remaster4k/fondos/070-STUDY.png
  referencias/
  manifest.json
```

`original/` contiene las copias preparadas a partir de la extracción: no editarlas. `remaster/` es el paquete mejorado de respaldo. Puedes crear otra carpeta con el nombre que quieras, por ejemplo `remaster2`, y poner dentro imágenes con **la misma ruta y nombre** que sus originales. Puede estar incompleta o vacía.

En desarrollo, F2 vuelve a consultar las carpetas en cada pulsación. Detecta las carpetas directas de `mods/`, salvo `original`, `referencias`, la antigua `escalado` y los nombres que empiezan por punto. Original y Remaster siempre aparecen. Los demás paquetes se ordenan por nombre. Una compilación guarda la lista disponible al compilar: para añadir carpetas nuevas después, hay que volver a compilar.

## Carga y comparación

- **F2:** siguiente paquete gráfico; conserva la escena y el encuadre.
- **F3 / Mayús+F3:** escenario siguiente / anterior entre los 78 fondos.
- **Flechas izquierda / derecha:** desplazar la cámara en un panorama.
- **FPS:** contador en la esquina superior derecha.

Cada recurso usa el primer PNG válido de **paquete seleccionado → remaster → original**. El modo Original carga directamente el original. Si falta una imagen, falla su carga o tiene una proporción incompatible, se intenta el respaldo. Los originales usan vecino más cercano, sin interpolación; los fondos HD usan muestreo lineal para adaptarse a la ventana. No hay un modo intermedio de escalado.

Por decisión del usuario, **todos los sprites de Ben permanecen originales**. La propuesta descartada está en `referencias/ben-frente-descartado.png`, fuera de las rutas de carga. No se encargan sprites nuevos por ahora.

## Cómo preparar un fondo

1. Usa como referencia el PNG correspondiente de `original/fondos/`.
2. Conserva el encuadre completo, perspectiva, suelo, puertas, objetos y posiciones. No añadas personajes ni objetos. Mantén también las zonas negras que rodean algunos interiores.
3. Guarda el resultado con la misma ruta y nombre en el paquete deseado.
4. Pulsa F2 para salir del paquete y volver a él; compara después de mover la cámara a ambos extremos si es un panorama.

No hace falta que el factor sea 2×, 3× ni 4×: se admite otra resolución con la proporción del original, con hasta dos píxeles nativos de tolerancia por redondeo. La referencia habitual es ×6: STUDY mide 320 × 200 y su remaster se prepara a 1920 × 1200. Los panoramas conservan **todo su ancho lógico**: CORRIDOR mide 1216 × 200, LAKEBED 1600 × 200 y EDGE 2144 × 200. No los fuerces a 320 × 200.

Algunas propuestas generadas contienen bandas negras adicionales para alojar panoramas muy anchos. El archivo opcional `imagen.png.json`, mediante `contentRect`, indica qué región del PNG debe usar la textura. El PNG se conserva intacto y el motor comprueba tanto los límites como la proporción de esa región. Este metadato está preparado en los fondos instalados que lo necesitan; una entrega sin bandas no requiere ningún archivo adicional.

## Estado artístico y revisión

Se han instalado propuestas para **33 de los 78 escenarios**, correspondientes a **26 de los 57 fondos distintos**. Las imágenes idénticas del original comparten propuesta. Quedan 31 fondos distintos sin generar. El registro local `referencias/background-generation.json` guarda procedencia, asociaciones, dimensiones, estado y prompts; no se versiona.

La presencia de un PNG y su carga correcta no equivalen a una revisión aprobada. La IA ha desplazado detalles en varias propuestas: deberán revisarse con los recorridos originales y probablemente rehacerse. La prioridad pasa a la fidelidad del juego antes de ampliar la producción artística. Todas las propuestas, salvo la prueba visual de STUDY ya valorada por el usuario, siguen pendientes de revisión; esa valoración artística tampoco verifica su navegación.

## Preparación local y límites del prototipo

```powershell
pnpm --filter @curse/asset-extractor scene-backgrounds
pnpm --filter @curse/asset-extractor brd-extract
pnpm mods:prepare
pnpm dev
```

Abre `http://127.0.0.1:8787/`. La preparación copia los 78 fondos y los 27 fotogramas iniciales de STD.BRD. No sobrescribe los paquetes remaster ni `referencias`. Si una copia original local difiere de la extracción actual, se detiene para conservarla.

El paseo STD y las regiones BOXDET ya sustituyen la alfombra provisional. En 62 fondos se toma el destino de una entrada STD contrastada, después de ejecutar sus canales de entrada; 15 quedan como especiales y BASEBAT oculta a Ben, según el original. No se coloca un Ben arbitrario en esas escenas. El botón «Mostrar límites» ayuda a revisar obstáculos. La cámara sigue a Ben y desliza el panorama en ocho pasos de cuatro píxeles. Las acciones y salidas se señalan sin ejecutarse; no se permite usar objetos. Las cadencias temporales son de prueba y los scripts de sala siguen pendientes. Véase `docs/navigation.md`.

Antes de `mods:prepare`, genera también los datos de navegación:

```powershell
pnpm --filter @curse/asset-extractor boxdet-extract
python -m pip install --target reports/tool-deps -r tools/reverse-engineering/requirements.txt
$env:PYTHONPATH = (Resolve-Path reports/tool-deps).Path
python tools/reverse-engineering/trace-boxdet.py
python tools/reverse-engineering/trace-navigation.py
python tools/reverse-engineering/trace-scene-order.py
pnpm --filter @curse/asset-extractor scene-layers
pnpm --filter @curse/asset-extractor navigation-verify
```

La preparación comprueba que los hashes del ejecutable, BOXDET y STD coincidan con la exportación.

F4 y la prueba de luces se han retirado. El fondo estático, la capa reservada para futuros efectos y el personaje se mantienen separados. El manifiesto reserva `animationLayers`, pero no existe aún un reproductor de esas capas. Añadir animaciones será trabajo posterior y no exige sustituir los PNG estáticos ni cambiar las coordenadas lógicas.

## Piezas de escenario y pantalla de título

La preparación incluye las piezas originales de escenario en `original/escenario/`. Se dibujan con su orden de profundidad y se restauran los primeros planos que deben ocultar a Ben. Estas piezas conservan sus gráficos originales. El visor reproduce los canales ambientales iniciales con cambios visuales contrastados en 32 recursos; todavía faltan los controladores de interacción. El uso de objetos sigue desactivado.

La pantalla de título se prepara como `original/interfaz/TITLE.png`, con el remaster en `remaster/interfaz/TITLE.png` (respetar mayúsculas). Es una pantalla completa de 320 × 200: ×6 corresponde a 1920 × 1200. El visor arranca en TITLE y permite reproducir la presentación con Enter o con su botón, además de revisarla mediante F3. Los originales y los remasters proporcionados por el usuario se conservan intactos.

El trabajo artístico queda aplazado mientras se comprueba el original. Las nuevas propuestas de Ben pueden guardarse en `remaster/ben/` para revisión, conservando los nombres STD; el visor mantiene los sprites originales hasta que se apruebe activarlas.

## Portada e imágenes de presentación

El visor empieza en `interfaz/TITLE.png` (pantalla 0). F3 recorre las 16 imágenes de presentación en el orden contrastado del ejecutable y después los 78 escenarios; el selector permite saltar directamente. El botón «Reproducir presentación» alterna los fotogramas y sus repeticiones según la traza del ejecutable. F3 permite revisarlos manualmente. Los intervalos se cuentan en retrazados VGA y se presentan usando una referencia de 70 Hz; la duración física original sigue pendiente de medir. Sin audio todavía.

Originales: `mods/original/presentacion/`. Deja tus versiones en `mods/remaster/presentacion/` con el mismo nombre, respetando mayúsculas:

- `CAULDRN1.png` a `CAULDRN4.png`
- `BALCONY1.png` a `BALCONY5.png`
- `BASEBAL1.png` a `BASEBAL6.png`
- `BASEBAT.png`

Portada: `mods/original/interfaz/TITLE.png` → `mods/remaster/interfaz/TITLE.png`. Logotipo inicial disponible en `mods/original/interfaz/CORE.png`. F2 mantiene el original cuando falta un remaster. Puedes usar un paquete alternativo como `mods/remaster2/presentacion/` con los mismos nombres.

Las originales son de 320 × 200. Conserva esa proporción y el encuadre completo (ejemplos: 1920 × 1200 (×6) o 2560 × 1600 (×8)), sin mover elementos entre fotogramas. Los sprites, máscaras y objetos animados necesitan mantener su posición respecto al fondo. La navegación de las secuencias especiales sigue pendiente; no se inserta un Ben normal artificialmente.

Preparación nueva: ejecutar también `trace-room-entries.py` y `trace-presentation.py` antes de `pnpm mods:prepare`, según `docs/navigation.md`. Las imágenes y el manifiesto generado permanecen excluidos de Git.

La lista completa con tamaños exactos se regenera en `mods/referencias/Guia-remaster-x6.txt`. No hace falta remasterizar los PNG de `presentacion/fundidos/`: se generan automáticamente con las paletas originales. En remaster el reproductor aplica un fundido global adaptado a la nueva imagen; en Original utiliza los colores DAC capturados, sin aproximarlos mediante opacidad.

Más resolución no sustituye el detalle real ni la alineación: ×6 es la referencia habitual, sin obligar al juego a una resolución fija. Los futuros paquetes de mayor resolución se compararán manteniendo la misma geometría y continuidad entre fotogramas.

F2 utiliza un fundido cruzado de 320 ms entre los paquetes, conservando posición y cámara. La presentación se pausa durante ese cambio y continúa desde el mismo instante. Se respeta la preferencia de reducir movimiento del sistema.
