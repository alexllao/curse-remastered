# Recursos locales del juego

Los gráficos, la música, los sonidos y sus derivados son locales y permanecen fuera de Git. Solo se versiona este documento. No publiques una compilación que incluya estos gráficos.

## Carpetas y nombres

```text
mods/
  graficos/
    original/fondos/070-STUDY.png
    remaster/fondos/070-STUDY.png
    remaster2/fondos/070-STUDY.png
  musica/
    original/CURSE.RS1.mid
    original/CURSE.RS1.ogg
    medieval/CURSE.RS1.mp3
    cinematic/CURSE.RS1.mp3
    symphonic/CURSE.RS1.mp3
  sonidos/original/
```

Las referencias, los prompts y los descartes están en `reports/referencias/`. El manifiesto del juego se genera en `reports/playtest/manifest.json`. La copia DOS de los disquetes se conserva en `original/`, en la raíz del repositorio. Esa carpeta no contiene aportaciones, prototipos ni ROM externas; véase [la guía de originales](../docs/original-files.md).

La web carga los recursos necesarios y abre TITLE con el menú. Permite elegir gráficos, música y efectos. RS5 suena en bucle a volumen reducido en el menú; si el navegador bloquea el audio basta un primer clic o tecla. «Comenzar partida» desvanece la música y arranca CORE → TITLE → presentación → DUNGEON, con las esperas e intervalos contrastados; TITLE espera la entrada del jugador sin botones web de continuar. La liberación de Ben y las interacciones siguen pendientes. «Depuración» muestra el catálogo de pantallas, límites y panoramas; F3 y las flechas solo actúan en ese modo.

La música se detecta al cargar y con «Actualizar música». Las carpetas vacías no aparecen como versiones disponibles. El audio generado con los MIDI actuales se identifica como **Original · MT-32 provisional**. Véanse `docs/AUDIO_SYSTEM.md`, `docs/MUSIC_SYNC.md` y `docs/ORIGINAL_MUSIC_MAPPING.md`.

`graficos/original/` contiene las copias preparadas a partir de la extracción: no editarlas. `graficos/remaster/` es el paquete mejorado de respaldo. Puedes crear otra carpeta con el nombre que quieras, por ejemplo `remaster2`, y poner dentro imágenes con **la misma ruta y nombre** que sus originales. Puede estar incompleta o vacía.

En desarrollo, F2 vuelve a consultar las carpetas en cada pulsación. Detecta las carpetas directas de `mods/graficos/`, salvo `original`, la antigua `escalado` y los nombres que empiezan por punto. Original y Remaster siempre aparecen. Los demás paquetes se ordenan por nombre. Una compilación guarda la lista disponible al compilar: para añadir carpetas nuevas después, hay que volver a compilar.

## Carga y comparación

- **F2:** siguiente paquete gráfico; conserva la escena y el encuadre.
- **F3 / Mayús+F3 (depuración):** escenario siguiente / anterior entre los 78 fondos.
- **Flechas izquierda / derecha (depuración):** desplazar la cámara en un panorama.
- **FPS:** contador en la esquina superior derecha.

Cada recurso usa el primer PNG válido de **paquete seleccionado → remaster → original**. El modo Original carga directamente el original. Si falta una imagen, falla su carga o tiene una proporción incompatible, se intenta el respaldo. Los originales usan vecino más cercano, sin interpolación; los fondos HD usan muestreo lineal para adaptarse a la ventana. No hay un modo intermedio de escalado.

Por decisión del usuario, **todos los sprites de Ben permanecen originales**. La propuesta descartada está en `reports/referencias/ben-frente-descartado.png`, fuera de las rutas de carga. No se encargan sprites nuevos por ahora.

## Cómo preparar un fondo

1. Usa como referencia el PNG correspondiente de `graficos/original/fondos/`.
2. Conserva el encuadre completo, perspectiva, suelo, puertas, objetos y posiciones. No añadas personajes ni objetos. Mantén también las zonas negras que rodean algunos interiores.
3. Guarda el resultado con la misma ruta y nombre en el paquete deseado.
4. Pulsa F2 para salir del paquete y volver a él; compara después de mover la cámara a ambos extremos si es un panorama.

No hace falta que el factor sea 2×, 3× ni 4×: se admite otra resolución con la proporción del original, con hasta dos píxeles nativos de tolerancia por redondeo. La referencia habitual es ×6: STUDY mide 320 × 200 y su remaster se prepara a 1920 × 1200. Los panoramas conservan **todo su ancho lógico**: CORRIDOR mide 1216 × 200, LAKEBED 1600 × 200 y EDGE 2144 × 200. No los fuerces a 320 × 200.

Algunas propuestas generadas contienen bandas negras adicionales para alojar panoramas muy anchos. El archivo opcional `imagen.png.json`, mediante `contentRect`, indica qué región del PNG debe usar la textura. El PNG se conserva intacto y el motor comprueba tanto los límites como la proporción de esa región. Este metadato está preparado en los fondos instalados que lo necesitan; una entrega sin bandas no requiere ningún archivo adicional.

## Estado artístico y revisión

Se han instalado propuestas para **33 de los 78 escenarios**, correspondientes a **26 de los 57 fondos distintos**. Las imágenes idénticas del original comparten propuesta. Quedan 31 fondos distintos sin generar. El registro local `reports/referencias/background-generation.json` guarda procedencia, asociaciones, dimensiones, estado y prompts; no se versiona.

La presencia de un PNG y su carga correcta no equivalen a una revisión aprobada. La IA ha desplazado detalles en varias propuestas: deberán revisarse con los recorridos originales y probablemente rehacerse. La prioridad pasa a la fidelidad del juego antes de ampliar la producción artística. Todas las propuestas, salvo la prueba visual de STUDY ya valorada por el usuario, siguen pendientes de revisión; esa valoración artística tampoco verifica su navegación.

## Preparación local y límites del prototipo

```powershell
pnpm --filter @curse/asset-extractor scene-backgrounds
pnpm --filter @curse/asset-extractor brd-extract
pnpm mods:prepare
pnpm dev
```

Abre `http://127.0.0.1:8787/`. La preparación copia los 78 fondos y los 27 fotogramas iniciales de STD.BRD. No sobrescribe los paquetes remaster ni las referencias. Si una copia original local difiere de la extracción actual, se detiene para conservarla.

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

La preparación incluye las piezas originales de escenario en `graficos/original/escenario/`. Se dibujan con su orden de profundidad y se restauran los primeros planos que deben ocultar a Ben. Estas piezas conservan sus gráficos originales. El visor reproduce los canales ambientales iniciales con cambios visuales contrastados en 32 recursos; todavía faltan los controladores de interacción. El uso de objetos sigue desactivado.

La pantalla de título se prepara como `graficos/original/interfaz/TITLE.png`, con el remaster en `graficos/remaster/interfaz/TITLE.png` (respetar mayúsculas). Es una pantalla completa de 320 × 200: ×6 corresponde a 1920 × 1200. El catálogo de depuración conserva TITLE como pantalla 0 y permite reproducir la presentación con Enter o con su botón, además de revisarla mediante F3. Los originales y los remasters proporcionados por el usuario se conservan intactos.

El trabajo artístico queda aplazado mientras se comprueba el original. Las nuevas propuestas de Ben pueden guardarse en `graficos/remaster/ben/` para revisión, conservando los nombres STD; el visor mantiene los sprites originales hasta que se apruebe activarlas.

## Portada e imágenes de presentación

El visor empieza en `interfaz/TITLE.png` (pantalla 0). F3 recorre las 16 imágenes de presentación en el orden contrastado del ejecutable y después los 78 escenarios; el selector permite saltar directamente. El botón «Reproducir presentación» alterna los fotogramas y sus repeticiones según la traza del ejecutable. F3 permite revisarlos manualmente. Los intervalos se cuentan en retrazados VGA y se presentan usando una referencia de 70 Hz; la duración física original sigue pendiente de medir. Sin audio todavía.

Originales: `mods/graficos/original/presentacion/`. Deja tus versiones en `mods/graficos/remaster/presentacion/` con el mismo nombre, respetando mayúsculas:

- `CAULDRN1.png` a `CAULDRN4.png`
- `BALCONY1.png` a `BALCONY5.png`
- `BASEBAL1.png` a `BASEBAL6.png`
- `BASEBAT.png`

Portada: `mods/graficos/original/interfaz/TITLE.png` → `mods/graficos/remaster/interfaz/TITLE.png`. Logotipo inicial disponible en `mods/graficos/original/interfaz/CORE.png`. F2 mantiene el original cuando falta un remaster. Puedes usar un paquete alternativo como `mods/graficos/remaster2/presentacion/` con los mismos nombres.

Las originales son de 320 × 200. Conserva esa proporción y el encuadre completo (ejemplos: 1920 × 1200 (×6) o 2560 × 1600 (×8)), sin mover elementos entre fotogramas. Los sprites, máscaras y objetos animados necesitan mantener su posición respecto al fondo. La navegación de las secuencias especiales sigue pendiente; no se inserta un Ben normal artificialmente.

Preparación nueva: ejecutar también `trace-room-entries.py` y `trace-presentation.py` antes de `pnpm mods:prepare`, según `docs/navigation.md`. Las imágenes y el manifiesto generado permanecen excluidos de Git.

La lista completa con tamaños exactos se regenera en `reports/referencias/Guia-remaster-x6.txt`. No hace falta remasterizar los PNG de `presentacion/fundidos/`: se generan automáticamente con las paletas originales. En remaster el reproductor aplica un fundido global adaptado a la nueva imagen; en Original utiliza los colores DAC capturados, sin aproximarlos mediante opacidad.

Más resolución no sustituye el detalle real ni la alineación: ×6 es la referencia habitual, sin obligar al juego a una resolución fija. Los futuros paquetes de mayor resolución se compararán manteniendo la misma geometría y continuidad entre fotogramas.

F2 utiliza un fundido cruzado de 320 ms entre los paquetes, conservando posición y cámara. La presentación se pausa durante ese cambio y continúa desde el mismo instante. Se respeta la preferencia de reducir movimiento del sistema.

## Aportaciones y prototipos pendientes de integrar

Deja los paquetes completos de animación, sus fuentes y sus instrucciones en `reports/referencias/aportaciones/`. Los paquetes recibidos de la portada se conservan como `original-animated-title/` y `remastered-animated-title/`, incluidas sus imágenes y el GIF de referencia. Sus píxeles coinciden con los TITLE ya instalados; no se sustituyen esas imágenes ni se duplican en los paquetes activos. La integración de esas nuevas animaciones queda separada de la reproducción del TITLE DOS posterior a «Comenzar partida».

`mods/` contiene recursos que el juego puede utilizar. Las referencias, los prototipos sin integrar y las ROM MT-32 no se colocan aquí. Las ROM opcionales se leen desde `reports/audio/roms/`, fuera de la carpeta pública de la web.

## Marcos decorativos y colección personal

Las carpetas reservadas para prototipos de marcos son `mods/graficos/original/marcos/` y `mods/graficos/remaster/marcos/`. Usar el mismo nombre en ambas variantes, por ejemplo `castillo.png`. El menú incluye el selector «Marco» y la opción «Mostrar marco». Los PNG se descubren al cargar la web. Los marcos solo se muestran en pantalla completa; en ventana quedan ocultos aunque la preferencia esté activada. La variante acompaña al paquete gráfico: Original utiliza `original`; los otros paquetes buscan su propia variante y, si falta, `remaster` y después `original`. El marco ocupa los márgenes laterales y un reborde de referencia de dos píxeles lógicos sobre la imagen, compensando el margen transparente interior de cada PNG. No cambia las coordenadas, el escalado del juego ni sus zonas de clic. Se retiró la sombra artificial por petición del usuario: se conserva el relieve del PNG.

Los fondos de pantalla y el arte de caja que no utiliza el juego se guardan en `reports/coleccion/fondos-de-pantalla/`, `reports/coleccion/caratulas/original/` y `reports/coleccion/caratulas/remaster/`. Las referencias de trabajo, incluida la portada aportada, permanecen en `reports/referencias/`. Conservar estas carpetas al limpiar informes: son aportaciones personales, no salidas desechables del extractor. Todo ese material queda fuera de Git.

Los primeros ejemplos se llaman `castillo.png` y conservan los PNG generados a 1672 × 941. Su resolución puede ser distinta de la del juego: los paneles se ajustan al espacio disponible. Un archivo opcional `castillo.png.json` declara `label` y los rectángulos de origen `left` y `right`, cada uno con `x`, `y`, `width` y `height`. Sin metadatos se usa el 10 % exterior de cada lado del PNG. El visor solo dibuja esos paneles, por lo que el centro no tapa la partida. Si no hay espacio lateral, no se fuerza un marco encima del juego.

Los metadatos pueden añadir `innerPadding: { "left": 0, "right": 0 }`, en píxeles de la imagen fuente, para compensar espacio transparente entre el borde del panel y su cuerpo opaco. El ajuste conserva el PNG y evita dejar franjas negras entre marco y juego. No se añade una sombra artificial.

Las columnas conservan su proporción: la misma escala se aplica en horizontal y vertical, tomando la altura del juego como referencia. Se anclan al borde de la imagen sin ensancharse para rellenar todo el margen. La opción permanece guardada al salir de pantalla completa, pero la capa desaparece totalmente en ventana.
