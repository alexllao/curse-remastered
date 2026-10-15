# Recursos gráficos opcionales

El juego original y los recursos derivados siguen fuera de Git. Esta carpeta contiene solo instrucciones y configuración versionadas; sus imágenes son locales.

## Primer encargo: STUDY

1. Abre `mods/original/fondos/070-STUDY.png` con Codex.
2. Remasteriza el fondo manteniendo su composición, perspectiva, puertas, mobiliario y suelo. No añadas a Ben, objetos de inventario, texto ni elementos nuevos. Esta imagen es el fondo; las capas y personajes se dibujan aparte.
3. Guarda el resultado en **`mods/remaster/fondos/070-STUDY.png`** como PNG de **1280 × 800** (4× el original de 320 × 200), sin márgenes añadidos.
4. Durante la prueba jugable, pulsa **F2** para alternar Original y Remaster. Si ya estabas en Remaster, sal de ese modo y vuelve para recargar el fondo.

Si Codex genera otra resolución, habrá que ajustarla o recortarla con cuidado al tamaño acordado antes de considerarla terminada. No cambies la posición de los elementos para adaptarla: las coordenadas de la escena deben seguir encajando. La mera presencia del archivo no equivale a una revisión visual aprobada.

Solo necesitas dejar la imagen con ese nombre. No hace falta editar código, instalar el resultado ni generar un manifiesto. El siguiente encargo se elegirá después de revisar este fondo. Conserva también una imagen de referencia del estilo que te haya gustado en `mods/referencias/`.

## Carpetas

- `original/`: copias locales preparadas desde los recursos extraídos. No editarlas.
- `remaster/`: tus PNG terminados, con la misma ruta y nombre que sus originales.
- `referencias/`: referencias locales del estilo deseado.
- `manifest.json`: catálogo generado para la prueba, con dimensiones lógicas y procedencia. También es local.

En Remaster se decide por recurso: usa su PNG mejorado si existe y tiene la misma proporción; si falta o no se puede cargar, muestra el original sin interpolar. Los sprites pueden seguir siendo originales mientras los fondos ya están remasterizados. Las variantes deben conservar transparencia, punto de apoyo y dimensiones lógicas. Por ahora solo se encarga el fondo STUDY; los fotogramas de Ben se preparan para la prueba, no como una petición de remasterizarlos todos.

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

El fondo STUDY generado con imagegen está instalado en `remaster/fondos/070-STUDY.png`. Es una propuesta visual para revisión. La herramienta entregó 1586 × 992 y se conserva esa resolución nativa sin editar el original. El motor admite un pequeño redondeo de proporción de hasta dos píxeles nativos y mantiene los tamaños lógicos originales. Para futuras entregas manuales se recomienda el objetivo 4× indicado arriba.

El usuario ha descartado la propuesta del sprite de Ben: se ha retirado de `remaster/ben/` y se conserva únicamente en `referencias/ben-frente-descartado.png`. **Todos los sprites permanecen originales, sin interpolar; por ahora no se generan nuevas versiones de personajes.** F2 alterna exclusivamente Original y Remaster. No hay modo de escalado intermedio.

El contador FPS de la esquina superior derecha se actualiza aproximadamente cada medio segundo y no bloquea los clics. Mide la cadencia de la aplicación en esta sesión, sin prometer una tasa concreta en otros equipos.

`remaster2k/` y `remaster4k/` quedan contempladas como variantes futuras y protegidas por la exclusión `mods/remaster*/`. Todavía no son modos disponibles con F2. No se sustituye la prueba actual hasta valorar su estilo y encaje.

## Prueba de luces en STUDY

F4 activa o desactiva luces suaves en las velas y la chimenea del fondo remasterizado. Son capas aditivas con variación continua de intensidad y pequeñas variaciones de llama; el PNG, las coordenadas de juego y los sprites originales se mantienen intactos. Solo se activan cuando el fondo Remaster de STUDY se ha cargado. En Original o si falta el remaster, quedan deshabilitadas. La preferencia del navegador de reducir movimiento las deja apagadas inicialmente; F4 permite elegir explícitamente.

Esta propuesta de luces se revisará antes de continuar con otros fondos. La galería de 78 fondos y la navegación F3/Mayús+F3 quedan como siguiente trabajo, todavía no implementado. Para los panoramas habrá que conservar el ancho completo y poder recorrerlos; no se deben recortar ni forzar a 320 píxeles de ancho.
