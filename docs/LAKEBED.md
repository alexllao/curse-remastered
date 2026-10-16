# Fondo submarino: LAKEBED

Cuarta zona preparada, recurso 3 y sala lógica 3. Panorama original de1600×200,
Remaster9600×1200. La primera mazmorra queda aprobada por Àlex; este lote continúa
tras CORRIDOR y DROP y se detiene antes de la siguiente zona.

## Comportamiento original

`trace-lakebed.py` prepara el perfil local ejecutando las rutinas de CURSE.EXE.
La entrada PLUNGE parte de(140,−48), cámara1280; el port normaliza a mundo(1420,−48).
Al asentarse, Ben aún no puede caminar: ponerse la pecera, verbo4 sobre objeto6,
habilita los tres controles. Se conserva el inventario y la puntuación de DROP.
El selector compartido ejecuta comer, ponerse y lanzar con un objeto, sin pedir
un segundo destino; las combinaciones mantienen su selección de dos objetos.

`verify-lakebed.mjs` contrasta actores, controles, banco, inventario, puntos,
sonidos, paseo, canales, colisiones, plantillas y semilla:1540 ciclos de entrada,
pecera y paseo, más40 acciones independientes y3200 ciclos posteriores.
Los obstáculos de las plantas detienen a Ben y activan SHOCK como en el original;
no se saltan los acertijos ni se desbloquean obstáculos artificialmente.
Estas comprobaciones no equivalen a resolver el puzle completo en Firefox.

Se preparan STD/MANA, DIG/PLOK/SPLAT y los modos5–10:PLUNGE,SHOCK,TURTLE,PROD,JUMP,PLUG.
EMERGE pertenece a la salida a la superficie y no forma parte del arte de este lote.

## Sonido

La música de esta zona es CURSE.RS3 de la versión Original activa.
`trace-lakebed-sounds.py` contrasta25 asociaciones y150 casos de prioridad:
15 efectos globales y10 locales, grupo1 de LAKEBED.SFX.
`extract-lakebed-sounds.py` guarda los10 WAV locales y las asociaciones de escena3
sin alterar las muestras PCM. La frecuencia del WAV se redondea al hercio.
No se presenta este contraste de datos como una escucha comparativa con DOSBox.

## Arte

Fondo, plantas, peces, tortuga, tiburón, objetos,59 poses especiales de Ben y11
iconos del HUD mantienen coordenadas, lienzos y cajas ocupadas nativas×6.
Se reutilizan las poses comunes de Ben ya aprobadas. El único oclusor repetido
se obtiene del fondo nuevo en(1491,168), con la máscara original del fotograma56.
Las partículas diminutas, destellos, letrero y pictograma de pensamiento conservan
sus píxeles nativos ampliados; las fuentes se remasterizarán posteriormente.

Másteres y prompts en `reports/remaster/lakebed/`, fuera de Git.
`tools/remaster-lakebed.py` reproduce la normalización técnica con Pillow.
Recursos activos en `assets/remaster/graficos/`, mismos nombres del Original.
Marcos propios lakebed.png en Original y Remaster, asociados a scene:3;
la variante Original es arte del port reducido a64×200 y64 colores, no arte DOS.

F2 conserva el estado al alternar gráficos; F4 alterna los marcos;
F10/F11 permiten acceder para pruebas. En ese recorrido de depuración, una entrada nueva
a LAKEBED usa el inventario del perfil (pecera, pez y bolsa), para no quedar bloqueada
por haberse saltado CORRIDOR. Una partida normal conserva los objetos reales.
El HUD admite ratón y teclado.
Las vistas y animaciones compuestas para revisión son composiciones técnicas,
no capturas de Firefox. Quedan para validación interactiva el recorrido completo,
los apoyos visuales en movimiento y la escucha del conjunto.

## Revisión del gesto de ahogo

Por petición de Àlex se corrigen las expresiones de PLUNGE: se revisan sus21
fotogramas y se actualizan20 caras visibles con miedo y boca abierta buscando
aire, conservando el cambio a azul. La pose sin cara visible se mantiene.
No cambian los otros bancos de animación ni los gráficos Original.
Másteres anteriores y comparativa en reports/remaster/lakebed/revision-ahogo/.
