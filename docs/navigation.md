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

El perfil exporta las 126 entradas de sala. `trace-room-entries.py` ejecuta su constructor (`0x4D55–0x4E89`) y sus tres canales mediante el intérprete original (`0x85DE–0x8A21`), con actores secundarios y controles inicialmente a cero. Se aceptan destinos STD de 32 × 48, visibles, con canales terminados y control de paseo habilitado. Son 104 entradas lógicas de prueba; no equivalen a 104 escenarios ni a estados completos de partida. Si aparece azar, sonido o un cambio de banco de sprites se detiene el ensayo y se conserva el caso como especial.

El manifiesto usa el primer destino normal disponible de cada recurso que también tenga registros BOXDET. Antes tomaba la posición de inicio del script: por ejemplo, STUDY aparecía en X=288 en vez del destino comprobado X=264. Ya no se permite colocar un Ben STD arbitrario en las entradas especiales. BASEBAT tiene indicador original de Ben a cero: se muestra sin personaje. FINAL termina sus canales sin habilitar paseo y carece de BOXDET: se mantiene como secuencia pendiente, sin paseo libre. Esto corrige la presentación y las entradas; los obstáculos y estados dinámicos continúan pendientes. No se afirma que toda la navegación sea ya fiel.

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

La base de revisión es Original. Quedan las entradas especiales, las animaciones ambientales y sus desplazamientos, los obstáculos dinámicos, la cadencia de la partida y las transiciones completas. El uso de objetos queda fuera de la prueba actual. La presentación ya alterna los fotogramas y repeticiones de la traza original; faltan el audio, medir su duración física en DOS y enlazar con la secuencia especial inicial de DUNGEON.

## Portada y presentación ordenadas

El visor arranca en TITLE (pantalla 0). Enter o el botón reproducen la presentación. Las pantallas 1–16 permiten revisar manualmente CAULDRN1–4, BALCONY1–5, BASEBAL1–6 y BASEBAT. Después aparecen los 78 escenarios en orden de recurso (pantallas 17–94), conservando también su número de escenario. Es un catálogo de revisión, no un orden lineal de todos los recorridos posibles de una partida. F3 avanza, Mayús+F3 retrocede y el selector permite ir directamente a cualquier pantalla. F2 cambia de paquete también en la presentación.

`trace-presentation.py` ejecuta el control original `0x2AB2–0x314F`, captura las cargas y 80 selecciones de página CRTC. Solo sustituye la carga/descompresión de imágenes; las consultas de entrada, bucles, escrituras DAC y fundidos originales se ejecutan. Cada espera explícita de flanco ascendente avanza un retrazado sintético; las consultas previas ven fase baja. No se alterna el valor por cada lectura, porque eso añadiría flancos artificiales entre bucles contiguos. No hay pulsaciones inyectadas. Contrasta las referencias estáticas de CORE (`0x698/0x6B0`), TITLE (`0x784/0x79C`) y la llamada a la presentación (`0x871`). El orden de arranque original es CORE → TITLE → presentación → entrada lógica -1 (recurso 0, BRD 0), que es distinta de la entrada normal usada para probar DUNGEON. El catálogo empieza por TITLE por decisión del usuario. CORE se conserva en `mods/original/interfaz/CORE.png`.

La traza contiene 80 selecciones de página, 206 eventos efectivos de imagen/paleta y 1005 esperas de flanco, incluidos los fundidos de salida de TITLE y de la presentación. El visor reproduce ese orden y esos intervalos a una referencia configurable en el manifiesto de 70 Hz (unos 14,36 segundos sin cargas). La frecuencia física, las latencias de disco y el audio originales no están contrastados; los tiempos en segundos son una conversión de referencia. Los 144 PNG distintos de imagen/paleta se generan automáticamente a partir de los índices descomprimidos y los valores DAC, sin tocar la geometría. Original usa esos PNG exactos; Remaster conserva las imágenes del usuario y aproxima sus fundidos mediante brillo global. F2 conserva el instante de reproducción al cambiar de paquete. Omitir o terminar lleva al escenario DUNGEON de revisión; todavía no ejecuta su entrada especial inicial BRD 0. Los remasters conservan su nombre: `mods/original/presentacion/CAULDRN1.png` corresponde a `mods/remaster/presentacion/CAULDRN1.png`. Todos son de proporción 320:200; por ejemplo, 1920 × 1200 (×6) o 2560 × 1600 (×8) conservan el encuadre. Mantener exactamente las posiciones entre fotogramas para evitar saltos al animarlos.

```powershell
python tools/reverse-engineering/trace-room-entries.py
python tools/reverse-engineering/trace-presentation.py
pnpm --filter @curse/asset-extractor navigation-verify
pnpm mods:prepare
```

Los informes derivados se guardan en `reports/navigation/`; el manifiesto local pasa a versión 5. Si el visor avisa de datos antiguos, repetir la preparación. Nunca se publican imágenes originales ni derivadas en Git.
