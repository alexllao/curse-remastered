# Recursos gráficos opcionales

El juego original y los recursos derivados siguen fuera de Git. Esta carpeta contiene solo instrucciones y configuración versionadas; sus imágenes son locales.

## Primer encargo: STUDY

1. Abre `mods/original/fondos/070-STUDY.png` con Codex.
2. Remasteriza el fondo manteniendo su composición, perspectiva, puertas, mobiliario y suelo. No añadas a Ben, objetos de inventario, texto ni elementos nuevos. Esta imagen es el fondo; las capas y personajes se dibujan aparte.
3. Guarda el resultado en **`mods/remaster/fondos/070-STUDY.png`** como PNG de **1280 × 800** (4× el original de 320 × 200), sin márgenes añadidos.
4. Durante la prueba jugable, pulsa **F2** para alternar Original, Escalado y Remaster. Si ya estabas en Remaster, sal de ese modo y vuelve para recargar el fondo.

Si Codex genera otra resolución, habrá que ajustarla o recortarla con cuidado al tamaño acordado antes de considerarla terminada. No cambies la posición de los elementos para adaptarla: las coordenadas de la escena deben seguir encajando. La mera presencia del archivo no equivale a una revisión visual aprobada.

Solo necesitas dejar la imagen con ese nombre. No hace falta editar código, instalar el resultado ni generar un manifiesto. El siguiente encargo se elegirá después de revisar este fondo. Conserva también una imagen de referencia del estilo que te haya gustado en `mods/referencias/`.

## Carpetas

- `original/`: copias locales preparadas desde los recursos extraídos. No editarlas.
- `escalado/`: variantes Scale2x generadas automáticamente; no son imágenes creadas por IA.
- `remaster/`: tus PNG terminados, con la misma ruta y nombre que sus originales.
- `referencias/`: referencias locales del estilo deseado.
- `manifest.json`: catálogo generado para la prueba, con dimensiones lógicas y procedencia. También es local.

En Remaster se decide por recurso: usa su PNG mejorado si existe y tiene la misma proporción; si falta o no se puede cargar, muestra el original interpolado. Los sprites pueden seguir siendo originales mientras los fondos ya están remasterizados. Las variantes deben conservar transparencia, punto de apoyo y dimensiones lógicas. Por ahora solo se encarga el fondo STUDY; los fotogramas de Ben se preparan para la prueba, no como una petición de remasterizarlos todos.

## Preparación local

Desde la raíz del repositorio:

```powershell
pnpm --filter @curse/asset-extractor scene-backgrounds
pnpm --filter @curse/asset-extractor brd-extract
pnpm mods:prepare
pnpm dev
```

La preparación copia el fondo y los 27 fotogramas iniciales de STD.BRD. Nunca sobrescribe `mods/remaster/` ni `mods/referencias/`. Si una copia original local difiere de la extracción actual, detiene la preparación en lugar de pisarla. Los originales DOS tampoco se modifican.

La prueba usa el estudio y una zona transitable provisional sobre la alfombra, no la navegación original. No implementa aún interacciones, scripts de sala, salidas, inventario ni una partida completa. El cambio F2 afecta a los gráficos, no al estado ni las coordenadas del personaje. Los modos se definen en la capa de presentación; los factores no forman parte de la lógica del juego.

El servidor local y la compilación incluyen los recursos presentes en esta carpeta. No publiques la compilación con los gráficos originales o derivados; `dist/` permanece excluido de Git.

## Tamaño de los sprites de Ben

Los 27 fotogramas de paseo preparados en `mods/original/ben/` miden 32 × 48; para el remaster 4× corresponden PNG de 128 × 192. El original `STD-000.png`, por ejemplo, se sustituye mediante `mods/remaster/ben/STD-000.png`. Cada fotograma conserva el mismo lienzo, transparencia y punto de apoyo. Otras poses del archivo STD tienen tamaños distintos y deberán escalarse desde sus dimensiones originales cuando se preparen: no se fuerzan al tamaño de estos fotogramas de paseo. Conviene fijar primero el estilo y validar una animación corta antes de encargar toda la secuencia.

## Prueba artística instalada

Se ha generado una primera variante con la herramienta integrada imagegen: fondo STUDY y pose frontal parada de Ben (STD-009). Son propuestas visuales para revisión, no una reconstrucción artística ya aprobada. La herramienta entregó el fondo a 1586 × 992 y el personaje a 1024 × 1536; se conserva esa resolución nativa sin editar los originales. El motor admite el pequeño redondeo de proporción del fondo (hasta dos píxeles nativos) y mantiene los tamaños lógicos originales. Para futuras entregas manuales se recomienda el objetivo 4× indicado arriba.

Los otros 26 fotogramas de paseo todavía usan el original interpolado en Remaster: cambiarán de aspecto durante el movimiento hasta completar y revisar la animación. La pose frontal y el fondo están en `remaster/ben/STD-009.png` y `remaster/fondos/070-STUDY.png`. El contador FPS de la esquina superior derecha se actualiza aproximadamente cada medio segundo y no bloquea los clics. Mide la cadencia de la aplicación en esta sesión, sin prometer una tasa concreta en otros equipos.

`remaster2k/` y `remaster4k/` quedan contempladas como variantes futuras y protegidas por la exclusión `mods/remaster*/`. Todavía no son modos disponibles con F2. No se sustituye la prueba actual hasta valorar su estilo y encaje.
