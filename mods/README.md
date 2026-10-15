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

No hace falta que el factor sea 2×, 3× ni 4×: se admite otra resolución con la proporción del original, con hasta dos píxeles nativos de tolerancia por redondeo. STUDY mide 320 × 200; 1280 × 800 es un ejemplo adecuado. Los panoramas conservan **todo su ancho lógico**: CORRIDOR mide 1216 × 200, LAKEBED 1600 × 200 y EDGE 2144 × 200. No los fuerces a 320 × 200.

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

Solo STUDY permite mover a Ben sobre una zona provisional de la alfombra, trazada a mano. Las demás pantallas son una galería. Falta recuperar el movimiento, las colisiones, la cámara, las transiciones, los objetos y los scripts originales. El primer análisis reproducible está en `docs/navigation.md`.

F4 y la prueba de luces se han retirado. El fondo estático, la capa reservada para futuros efectos y el personaje se mantienen separados. El manifiesto reserva `animationLayers`, pero no existe aún un reproductor de esas capas. Añadir animaciones será trabajo posterior y no exige sustituir los PNG estáticos ni cambiar las coordenadas lógicas.
