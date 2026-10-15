# Movimiento original: primera evidencia de BOXDET

## Alcance actual

La prioridad es reconstruir el juego y usar su navegación para revisar los remasters. Las propuestas de IA pueden mover puertas, muebles y otros detalles aunque mantengan la resolución y proporción. La primera prueba usaba una alfombra de STUDY trazada a mano. El visor actual incorpora el paseo STD y las regiones originales con los límites descritos al final de este documento. No se habilita un paseo libre en las demás pantallas como sustituto de esa comprobación.

Se ha verificado mediante ejecución aislada el cargador de `BOXDET.DAT` para los 78 identificadores de recursos y se han extraído sus 2.344 registros. Esto prueba la estructura y carga de esos datos, no el movimiento completo ni su comportamiento en todos los estados de una partida.

## Fuente y formato

Perfil exclusivo del ejecutable con SHA-256 `f2c0046e07b25f408516edae5d6a66c06107971fb95c55ed770fa52a6b4ecd8d`. Direcciones de código expresadas como posiciones de archivo; base de DS en el archivo: `0xF510`.

La cadena DS:8077 contiene `boxdet.dat`. El código `0x524F–0x52CA` abre el archivo, busca `resourceId × 2`, lee un puntero uint16LE, busca ese desplazamiento y lee un contador uint16LE. Reserva memoria para `contador × 10` bytes y lee los registros en CS:[18h]. DS:0DF0 conserva el contador. Un puntero cero toma una rama sin lista. El contraste usa los 78 recursos conocidos del perfil; no atribuye significado a otros índices de la tabla.

Cada registro conserva exactamente:

| Desplazamiento | Formato | Dato      |
| -------------- | ------- | --------- |
| +0             | uint8   | Tipo      |
| +1             | uint8   | Argumento |
| +2             | int16LE | Izquierda |
| +4             | int16LE | Arriba    |
| +6             | int16LE | Derecha   |
| +8             | int16LE | Abajo     |

No son polígonos transitables. Son regiones consultadas por el ejecutable para detectar bloqueos, acciones y transiciones. Se preserva su orden y sus coordenadas firmadas. Los 78 recursos gráficos tampoco equivalen a las 126 entradas de salas lógicas ni a todos los estados posibles del juego.

## Consulta rectangular contrastada

La rutina `0x274A–0x2AB1` recibe una caja en AX/BX/CX/DX y comprueba solapamiento con comparaciones firmadas. Sus bordes son inclusivos: tocar un borde cuenta como contacto.

- Tipo 0: guarda el argumento como candidato; continúa examinando la lista. Entre dos registros de tipo 0 superpuestos, prevalece el último. Al final devuelve AX=1 y BL=argumento si existe un candidato distinto de 255, o AX=0 si no lo hay.
- Tipo 1: devuelve inmediatamente AX=4 y BL=argumento al detectar contacto.
- Tipo 3: para los argumentos admitidos por su rama, devuelve inmediatamente AX=8 y BL=argumento. Se ha contrastado el argumento sintético 9; no se generaliza esta prueba a todos sus valores.
- Tipo 2: contiene condiciones sobre actores y estado de partida, puede elegir otra sala o instalar secuencias. Su comportamiento completo sigue pendiente. No se sustituye por una transición incondicional.

Antes de la lista existe una consulta de una región dinámica en DS:18F4–18FB. Los ensayos de solapamiento la sitúan explícitamente fuera del área consultada: **no verifican su actualización ni sus efectos**.

La llamada en `0x0C84–0x0CBA` construye la caja usando posición, ancho, alto, cámara y márgenes de Ben. Las ramas siguientes examinan los bits del resultado y pueden corregir coordenadas, ejecutar acciones o cambiar de sala. La preparación de un tramo hacia un destino aparece en `0x115F–0x12EB`; usa acumuladores fraccionarios y condiciones de dirección. Son evidencias estáticas para continuar la investigación, todavía sin contraste completo de trayectorias o tiempos.

## Reproducción

```powershell
pnpm --filter @curse/asset-extractor boxdet-extract
pnpm --filter @curse/asset-extractor test
$env:PYTHONPATH = (Resolve-Path reports/tool-deps).Path
python tools/reverse-engineering/trace-boxdet.py
```

Las dependencias del ensayo son las mismas que las de los otros contrastes del ejecutable, documentadas en `tools/reverse-engineering/requirements.txt`. La exportación genera `reports/navigation/boxdet.json`; el contraste escribe `reports/exe/boxdet-verification.json`. Ambos permanecen fuera de Git, junto con los datos derivados. El informe registra hashes de fuentes, lecturas y cantidades por recurso.

El ensayo conserva las instrucciones originales: solo emula los servicios DOS de archivo y reserva. Compara byte por byte lo cargado en los 78 recursos con la exportación. Además ejecuta ocho casos sintéticos de consulta para comprobar bordes, ausencia de contacto, coordenadas negativas, prioridad de solapamientos y retornos de tipo 1/3. No ejecuta una partida ni mide la cadencia original.

## Trabajo pendiente

1. Recuperar la selección de recorridos, la conversión de coordenadas con cámara y el punto de apoyo del personaje.
2. Contrastar trayectorias completas y su cadencia, incluidas correcciones por obstáculos y cambios de dirección.
3. Interpretar regiones condicionadas y actualizar estado, objetos y transiciones sin confundir recurso con sala lógica.
4. Incorporar al motor solo el comportamiento contrastado y usarlo para validar el encaje de cada remaster.

El extractor no modifica la geometría de los sprites ni los originales. El probador incorpora los aspectos contrastados sin declararlos un sistema de navegación de partida completo.

## Paseo STD incorporado al visor

La zona de alfombra trazada a mano se ha sustituido por el paseo STD y las regiones BOXDET. El motor conserva acumuladores fraccionarios, pasos horizontales y verticales, fotogramas, giros y correcciones de contacto. El contraste TypeScript coincide ciclo a ciclo con 644 recorridos aislados del ejecutable: 160 trayectorias con cuatro orientaciones y obstáculos sintéticos, y 484 casos de clics cortos alrededor de los pies. No se aproxima un clic corto mediante un salto al destino: se respeta la cuantización original. La interfaz indica «Ben ya está ahí» cuando el tramo no desplaza al personaje.

Se contrastan además 65 casos de condiciones de tipo 2 y seis umbrales de cámara. Las condiciones usan una instantánea del cargador inicial de objetos, con rama normal y contexto STD explícitos; no avanzan los scripts de sala. Las condiciones sin estado conocido detienen la prueba. Las secuencias especiales, decisiones aleatorias y comprobaciones de inventario no se ejecutan; al tocar una acción o salida el visor conserva la escena y lo indica. No hay uso de objetos.

El perfil exporta las 126 entradas de sala. Para 66 fondos existe al menos una entrada con Ben normal STD: el visor toma la primera de ellas y conserva su posición y cámara. Esta elección es para revisar el recurso, no reproduce el progreso de una partida. En los otros 12 fondos se permite colocar manualmente a Ben en suelo libre para probar el paseo STD; su entrada especial sigue pendiente. No se presenta esa colocación como una posición original.

La cámara sigue el centro de Ben con umbrales 64/223, limitada al panorama. El scroll original escribe nueve posiciones CRTC, separadas por cuatro píxeles, con esperas de retrazado: posición inicial y ocho pasos para recorrer 32 píxeles. Se han ejecutado ambos tramos de instrucciones (`0xEF9D–0xF14A` y `0xF2B8–0xF465`) capturando esos valores. El visor presenta esa progresión en lugar de saltar 32 píxeles, y detiene el avance lógico de Ben durante el deslizamiento. Las flechas manuales usan la misma progresión.

La cadencia del probador está fijada en diez ciclos de paseo y sesenta pasos de presentación por segundo, independientes de los FPS de renderizado. **No se ha verificado todavía la frecuencia temporal de la partida DOS ni la duración física de sus retrazados**. Coinciden los valores y secuencias comprobados, sin afirmar una reproducción completa de los tiempos originales.

Preparación y contraste adicionales:

```powershell
$env:PYTHONPATH = (Resolve-Path reports/tool-deps).Path
python tools/reverse-engineering/trace-navigation.py
pnpm --filter @curse/asset-extractor navigation-verify
pnpm mods:prepare
```

`walking-profile.json` y `walking-verification.json` se generan en `reports/navigation/`. Los programas derivados del ejecutable y las posiciones originales se copian al manifiesto local de `mods/`; no se incorporan a Git. F2 conserva posición y encuadre. F3 cambia de recurso y el botón «Mostrar límites» ayuda a comprobar contactos sin activar acciones. La ocultación por piezas de escenario ya está contrastada por separado; la actualización de sus actores sigue pendiente; el paseo normal no implica que todos los scripts de animación estén implementados.

## Objetos y primeros planos originales

El visor ya carga los objetos visibles del estado inicial y las piezas de primer plano. Se extraen 378 PNG locales usados por los 78 recursos y 82 registros de primer plano. El cargador original `0x8CA6–0x8D6E` contrasta sus posiciones y dimensiones; el decodificador geométrico existente permanece intacto. Se aplica la paleta MAP + SPRITES y la conversión RGB6 a RGB8 mediante el conversor existente. En STUDY se compararon los 2.305 píxeles opacos de la pieza de la mesa con el fondo: coinciden todos, por lo que restaurar esa pieza no cambia sus colores.

Hay dos mecanismos distintos:

- Los actores se ordenan según Y + altura + ajuste de profundidad, con suma de 16 bits firmada. Se reproduce la ordenación por saltos de `0xF49A–0xF50E`, incluyendo su permutación previa y los 69 huecos del original. Así se conserva también el comportamiento comprobado con profundidades iguales, en vez de sustituirlo por una ordenación estable arbitraria.
- Los registros de escenario de tipo cero se cargan en `0x8D22–0x8D61`. Después de los actores, `0xEE12–0xEE89` restaura su sprite si solapa a un actor con indicador exactamente 1. Estas piezas pueden ocultar piernas y cuerpo, por ejemplo detrás de la mesa del estudio. Se respeta la transparencia.

`trace-scene-order.py` ejecuta la ordenación original en doce casos sintéticos con 69 actores, empates y sumas que desbordan, y comprueba ocho casos de contacto de primer plano. Se detiene antes del copiador VGA: no sustituye ni ejecuta su dibujo. `navigation-verify` contrasta los resultados TypeScript con esos informes.

```powershell
python tools/reverse-engineering/trace-scene-order.py
pnpm --filter @curse/asset-extractor scene-layers
pnpm --filter @curse/asset-extractor navigation-verify
pnpm mods:prepare
```

Las imágenes se generan en `reports/scenes/layers/` y se copian a `mods/original/escenario/`. Son recursos derivados locales, excluidos de Git. Los objetos se dibujan, pero todavía no pueden usarse y sus animaciones ambientales permanecen en el fotograma inicial exportado. Los scripts pueden cambiar visibilidad, fotogramas, posición y condiciones durante una partida; esos cambios dinámicos siguen pendientes. Tampoco se declaran terminados los obstáculos dinámicos que esos scripts puedan modificar.

## Siguientes bloques del original

La base de revisión es Original. Quedan las entradas especiales, las animaciones ambientales y sus desplazamientos, los obstáculos dinámicos, la cadencia de la partida y las transiciones completas. El uso de objetos queda fuera de la prueba actual. También falta reconstruir la reproducción de la introducción y sus tiempos; disponer de sus imágenes extraídas no significa que su secuencia animada esté implementada.
