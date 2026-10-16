# Estado de CURSE Remastered

Actualizado: 16 de octubre de 2026. Rama de trabajo: `development`.

## Prioridad y criterio de cierre

Completar la primera mazmorra con el comportamiento original antes de ampliar otras salas. Las demás salas y los marcos quedan aparcados. Àlex ha solicitado ahora el remaster coherente del fondo, las piezas, el HUD y los cursores de esta primera sala; El aspecto y las animaciones remasterizadas de Ben ya han sido aceptados por Àlex. Probar siempre en silencio. Una comparación de rutinas no equivale a una captura visual ni verifica la velocidad física del juego DOS.

## Primera mazmorra

| Parte                                   | Implementado                    | Contraste con CURSE.EXE                                                                   | Comparación visual/temporal con DOSBox                                          |
| --------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Barra contextual y submenús originales  | Sí, integración en revisión     | Posición, bloqueo por canal y selección; 135 consultas de objetos según estado y posición | Pendiente                                                                       |
| Pedir ayuda y secuencia del guardia     | Sí                              | Incluida en la traza completa                                                             | Pendiente                                                                       |
| Recoger llave y liberar al protagonista | Sí                              | Canales, bancos y estado contrastados                                                     | Pendiente                                                                       |
| Moneda opcional e inventario            | Sí                              | La moneda suma puntos sin ocupar inventario; llave y clip se conservan según esta traza   | Pendiente                                                                       |
| Empujar pared y recoger clip            | Sí                              | Aproximación automática y animaciones contrastadas                                        | Pendiente                                                                       |
| Abrir puerta y salir al corredor        | Sí                              | Condición de puerta, región de salida y destino lógico 0 → recurso 1                      | Pendiente                                                                       |
| Movimiento y colisiones                 | Corregida la deriva tras chocar | 500 ciclos hacia cinco bordes y traza de acciones contrastados                            | El usuario ha completado el recorrido hasta la segunda sala; continuar probando |
| Gotas, fuego y rata                     | Sí                              | Canales originales; animación ambiental y acciones verificadas por ciclos                 | Cadencia física pendiente                                                       |
| Primer plano al pasar la rata           | Sí, conserva la lógica original | Selección, geometría e índices contrastados                                               | El usuario confirma que el fallo visual también existe en el original           |
| Guardar/cargar desde la barra           | No                              | Fuera de los cinco puntos de esta sala                                                    | Pendiente                                                                       |

La sala **todavía no se considera terminada al 100 %**. La integración visual de las acciones está en revisión; faltan la comparación DOSBox y resolver cualquier diferencia que aparezca, especialmente la velocidad percibida de las animaciones. La discontinuidad de la pared queda conservada tras la confirmación del usuario.

## Evidencia reproducible

- `tools/reverse-engineering/trace-dungeon-actions.py`: ejecuta rutinas originales en Unicorn con entradas explícitas, sin render ni hardware de audio. Recorre siete acciones, incluida la moneda opcional, abre la puerta y alcanza la salida.
- `tools/reverse-engineering/verify-dungeon-actions.mts`: compara 577 ciclos de 69 registros de actor, bancos, semilla aleatoria, controles, inventario, puntuación y plantillas. Contrasta también 135 consultas de objetos y la salida al corredor.
- `trace-dungeon.py` y `verify-dungeon.mts`: comprobación ambiental previa de 1000 ciclos.
- Los informes, memoria extraída y gráficos se generan en `reports/` y `assets/`; permanecen fuera de Git.
- El ensayo DOSBox anterior de reloj figura como inconcluso en `reports/navigation/dosbox-dungeon-probe/status.json`. No se usa como prueba de que la velocidad ya sea correcta.

## Qué es genérico y qué queda por generalizar

El motor comparte paseo, colisiones BOXDET, canales de animación, cambio de bancos, orden de profundidad y submenús de acciones/inventario. `original-action-menu.ts` recibe los objetos y las operaciones de una sala y no contiene sus acertijos.

`dungeon.ts` contiene todavía las condiciones específicas reconstruidas para esta primera sala. No existe aún un extractor general de todas las reglas del ejecutable. La siguiente fase de arquitectura deberá convertir esas reglas en datos o programas verificados, sin dar por jugables las demás salas por el hecho de que ya se dibujen o tengan animaciones ambientales.

## Próximos pasos

1. Terminar la prueba completa en la web con recursos Original y capturas de los submenús, liberación y salida.
2. Comparar silenciosamente las mismas secuencias en DOSBox y verificar tiempos. El fallo visual de la pared ya fue confirmado en el original por el usuario.
3. Corregir diferencias y añadir los casos a las comprobaciones reproducibles.
4. Solo entonces marcar la sala completa y estudiar la generalización de sus reglas para las demás.

## Últimos ajustes y comprobaciones

- **Ben se perdía por la derecha:** al agotarse un recorrido contra un obstáculo se descartaba el estado de paseo antes de retirar sus canales de movimiento. Ahora se conserva hasta la fase de parada del siguiente ciclo, como hace el ejecutable. `trace-dungeon-boundaries.py` y el verificador comparan los 33 bytes de Ben durante 500 ciclos hacia cinco destinos en los bordes.
- **Cursor pequeño:** se dibuja como sprite a la escala de la presentación, igual que las opciones del HUD, en vez de usar el PNG sin ampliar como cursor CSS. Pendiente validar visualmente en ventana y pantalla completa.
- **Cambio brusco de marco:** fundido de 320 ms entre marcos, conservando el anterior durante la carga. Respeta la preferencia de reducir movimiento. Pendiente prueba visual.
- **Selección del HUD:** ciclo original de 24 colores RGB, cambio cada cuatro vueltas modales. La traza contrasta 96 vueltas y las 24 escrituras del DAC. La cadencia de pantalla usa 70 Hz como referencia; no equivale a una medición física completa en DOSBox.
- **Validación ya ejecutada:** siete acciones y salida, 577 ciclos; 135 consultas de objetos; cinco paseos de borde, 500 ciclos. Tras incorporar los efectos pasan las 45 pruebas automatizadas, los tipos, ESLint, el formato de los archivos modificados, la compilación y la comprobación de exclusión de recursos. La preparación local de recursos también terminó correctamente. La traza ambiental anterior sigue coincidiendo durante 1000 ciclos.
- **Comparación visual DOSBox:** arrancó una copia de prueba con sonido deshabilitado. La captura falló con `FrameArrived timed out: timed out waiting on channel` después de recuperar la ventana minimizada. No se presenta ese intento como comparación visual realizada.

Este documento se versiona; los informes de ejecución, las capturas y los recursos derivados siguen en las carpetas locales excluidas de Git.

## Efectos de sonido y prueba del usuario

El usuario confirma que ha conseguido salir de la primera mazmorra y alcanzar la segunda. Las acciones de la segunda siguen pendientes; la prioridad continúa en la primera.

Se han generado 21 WAV originales por evento en `assets/original/sonidos/verificados/`, a partir de STD.SFX y DUNGEON.SFX. La selección de muestras, cabeceras, recortes, frecuencias y prioridades se contrasta con las rutinas Sound Blaster del EXE: 21 asociaciones y 126 casos de prioridad. Los efectos de esta sala no se asignan a la siguiente. Las extracciones experimentales anteriores se conservan. La reproducción está conectada a las solicitudes de los canales originales, incluido el saludo inmediato del HUD. Falta comparar la escucha con DOSBox; no se da por completada la validación auditiva.

### Lista de comprobación manual de la primera sala

- [ ] Pedir ayuda y esperar la secuencia completa del guardia.
- [ ] Recoger la llave y desbloquear las cadenas.
- [ ] Caminar por la sala, insistir contra sus bordes y comprobar clics cercanos a los pies.
- [ ] Recoger la moneda opcional y comprobar puntuación e inventario.
- [ ] Empujar la pared, recoger el clip y desbloquear la puerta.
- [x] Alcanzar la salida y llegar a la siguiente sala: confirmado por el usuario.
- [ ] Escuchar ayuda/saludo, cadenas, objetos, puerta y ambiente con Efectos → Original.
- [ ] Repetir tras reiniciar y comprobar que «Sin efectos» silencia los eventos.

La lista no da por implementadas todas las respuestas posibles de mirar, luchar, saltar o combinaciones incorrectas; siguen pendientes de auditoría, al igual que guardar/cargar.

Validación del bloque de sonidos: 45 pruebas automatizadas, ESLint, tipos y compilación correctos. El servidor local entrega los 21 WAV; sus muestras y longitudes coinciden por SHA-256 con las porciones solicitadas por el EXE. Las pruebas no emiten sonido.

## Remaster de la primera mazmorra

Àlex confirma que los sonidos originales le parecen correctos tras probarlos. Se mantiene pendiente la comparación auditiva técnica con DOSBox, sin invalidar esa aceptación del usuario.

Se ha instalado un lote local de **126 recursos**: fondo a **1920 × 1200**, 88 fotogramas de escenario a ×6, 32 iconos del HUD, su panel, 3 cursores y el aspa original escalada. Ben no se ha remasterizado. Los dibujos comparten la dirección artística de `ESTILO_ARTISTICO.md`; los prompts están en `prompts-mazmorra-remaster.md`. Se corrigieron la calavera ausente y las gorras de los iconos de Ben: pelo rojizo con flequillo, sin gorra.

El cambio F2 prepara también los sprites de esta sala, el HUD y los cursores, manteniendo el estado de los actores. Los primeros planos repiten el dibujo del fondo con su máscara original. Las dimensiones y las máscaras se comprueban automáticamente; las posiciones, contactos y tiempos del juego no se han modificado para acomodar el arte.

Se han revisado composiciones de estados originales con las piezas nuevas. Son vistas reproducibles de los recursos, **no capturas del navegador**. Queda pendiente la aceptación dentro del juego al alternar F2 y completar las acciones, especialmente la gota, el paso de la rata y las fases de rotura de la piedra. No dar por terminada esa revisión solo por cumplir tamaño y alpha.

Referencias, atlas, PNG activos, copias anteriores y comprobaciones permanecen fuera de Git. La carpeta `assets/` solo contiene las entregas activas; las versiones intermedias se conservan en `reports/remaster/dungeon/`.

### Revisión de recortes del remaster de DUNGEON — 16/10/2026

Se cambia la política de alpha para HUD, manos, cadenas, guardia, piedra, fuego y salpicaduras. Los cuatro bocadillos tienen interior blanco; se recuperan varias calaveras cortadas por el borde inferior izquierdo. Fondo1920×1200 y126 recursos con tamaño nativo ×6 comprobados. Las seis imágenes de la rata conservan sus hashes; Ben sigue original. Se han inspeccionado composiciones de estados originales y recortes del guardia sobre fondo gris; todavía falta aceptación de todas las animaciones en el navegador. No se modifican tiempos, colisiones, sonidos ni lógica.

Revisión posterior solicitada por Àlex: las seis poses de la rata también pasan al alpha del dibujo, conservando lienzos y anclajes. Sustituye la conservación temporal de hashes descrita antes: el usuario detectó bordes defectuosos al mirarlos de cerca.

La piedra cerrada ya no usa una ilustración de bloque independiente: se extrae del muro reconstruido sin la reja, continuando las juntas a las coordenadas originales. El primer fotograma agrietado conserva esa base con grietas pintadas; no se trasladan los agujeros del tramado VGA a la ilustración nueva. Los fragmentos posteriores mantienen los anclajes y ciclos originales; queda revisar visualmente la transición completa.

### Recursos agrupados por versión

Se trasladan4519 archivos locales desde mods a assets, conservando sus hashes. Cada versión contiene graficos/, musica/ y/o sonidos/. Se unifica remastered como remaster para los efectos. Los selectores, las rutas web, los marcos, los extractores y los scripts de arte usan la estructura nueva. Original/ sigue reservado a la copia DOS; reports conserva referencias e informes. La puerta de DUNGEON usa ahora el alpha del dibujo en sus cinco fotogramas, evitando recortar su arco con la silueta VGA.

El marco remaster de mazmorra se revisa a un acabado ilustrado de1254×1254, sin ampliar el PNG. Se conservan los otros tres marcos y el marco de estilo original. La música disponible se agrupa ahora en original y remaster; cada selector detecta sus propios tipos de recursos.

### Bienvenida de la web

Se aplica la maqueta aprobada con wallpaper a ventana completa, menú compacto abajo a la izquierda, opciones en diálogo nativo, créditos existentes y acceso a pantalla completa. Se precarga y decodifica WALLPAPER.png antes de mostrar la bienvenida, con respaldo en TITLE. Se conserva la imagen aportada sin redibujarla. El marco fino de la bienvenida respeta Mostrar marco. Al comenzar se conserva el flujo CORE/TITLE/presentación del juego y sus controles. La depuración sigue accesible desde Opciones.

La bienvenida incorpora IM Fell English local, con licencia OFL, también en Opciones, Créditos y la pantalla de carga. Los tres botones son iguales, con degradado dorado animado al señalar. El velo azul se aplica a toda la zona inferior y se desvanece hacia arriba. El altavoz muestra únicamente la versión musical y permite silenciar/reactivar con respuesta sonora, sin duplicar la etiqueta gráfica. Se recupera la música al volver a la pestaña y se evita iniciar en silencio sin una preferencia previa. Las pruebas se realizan sin altavoces; sigue pendiente la revisión visual del usuario.

Opciones separa Música del menú (Música del juego durante la partida), Efectos y Ambiente, con restauración de preferencias. El primer clic del altavoz activa un audio bloqueado por el navegador antes de permitir silenciarlo. La pantalla completa incorpora detección de la API WebKit, sus eventos y estilos; el aviso de incompatibilidad es visible en la bienvenida. La lógica de compatibilidad se verifica con pruebas simuladas, pendiente de prueba real en Safari. En iPhone no se garantiza pantalla completa del documento desde la pestaña: se informa de Añadir a pantalla de inicio según la limitación de WebKit.

El selector de tipografía permite comparar IM Fell English, Cinzel, Alegreya, Cormorant Garamond y Georgia en la propia interfaz, con una muestra y preferencia persistente. Las fuentes abiertas se distribuyen localmente con sus licencias; la elección también alcanza el loading. Los textos dibujados en sprites originales permanecen intactos.

Pendiente para la futura PWA: conservar los PNG remaster como maestros y generar salidas optimizadas aparte mediante el empaquetado local. Precargar lo necesario para el arranque y cachear los escenarios por uso, con versiones y actualización de caché. Esta previsión no implica que ya exista un service worker ni compresión de los maestros; no se incorporarán recursos del juego al repositorio.

### Ben, objetos y separación de paquetes — 16/10/2026

Se instala el diseño de Ben aprobado por Àlex: 88 fotogramas de los cuatro bancos de la primera sala, 27 alias de marcha y siete recursos de llave/clip, 122 PNG en total. Las dimensiones son nativas ×6, con alpha del dibujo y cajas originales. Los maestros, prompts, hashes y copias anteriores se guardan en `reports/remaster/ben/`; guía en `prompts-ben-remaster.md`. Sustituye las notas anteriores que mantenían a Ben original.

Se corrige una mezcla de paquetes del port: cambiar los gráficos en la portada podía conservar las capas preparadas antes de ese cambio al entrar en la sala inicial. Ahora se compara la identidad del paquete y la sala realmente cargados. Ben también prepara sus texturas por paquete; Original carga sus propios recursos. Hay pruebas de regresión para ambos sentidos del cambio y para cambiar de sala.

El fondo incorpora musgo y raíces discretas solo en las filas 0–330 de su lienzo 1920×1200; las filas 331–1199 conservan los píxeles anteriores. La piedra, el suelo y sus apoyos quedan preservados. Un tinte común a la escena Remaster atenúa la iluminación del fondo y sus piezas juntas, sin afectar al HUD ni a Original. Fuentes e informe en `reports/remaster/dungeon/techo-integracion.json` y `prompts-techo-musgo.txt`.

El recorte derecho identificado por el usuario es `animation-24576-2`. En Remaster se limita su diagonal mediante geometría de presentación, sin editar el PNG ni cambiar las colisiones. Original conserva su máscara nativa. Àlex ha comprobado que en DOSBox el borde está mejor conseguido: se retira la hipótesis inicial de fallo confirmado del juego original. La mezcla de paquetes es un fallo del port; el contorno sigue pendiente de comparación visual con DOSBox.

Pendiente de aceptación en partida: animaciones completas de Ben, llave y clip a su escala real, rotura de la piedra y cruce del primer plano derecho en ambos modos. No se considera terminada al 100% la primera sala. La moneda inicial tiene un fotograma exportado vacío; su visibilidad y disponibilidad siguen pendientes de comprobación, aunque exista lógica de recogida.

### Aceptación de Ben y ajuste del borde derecho — 16/10/2026

Àlex confirma que el aspecto y las animaciones de Ben están bien. Se continúa con el borde derecho `animation-24576-2`.

La primera máscara geométrica seguía intersectando el alpha escalonado del SPR; por eso no podía recuperar la superficie pintada que faltaba fuera de ese recorte. Ahora el oclusor Remaster repite la textura del propio fondo y la limita al contorno de su piedra, incluidos el lateral irregular y la base diagonal. Se amplía su rectángulo de activación a la zona que realmente ocupa para evitar que aparezca tarde. No se modifica ningún PNG, coordenada de Ben, navegación ni colisión.

El contorno se aplica solo cuando el fondo cargado procede realmente de Remaster. Original y los fondos de otros paquetes mantienen el SPR nativo; un respaldo a Original no recibe la forma del dibujo remasterizado. Las 1001 selecciones de primeros planos y las escrituras VGA de las dos piezas coinciden con la traza aislada del ejecutable. Esto no sustituye una captura comparativa en DOSBox ni demuestra que el borde observado por el usuario esté resuelto en Original.

Se inspecciona una composición antes/después y se prepara una secuencia de paso por el borde, sin audio. Son previsualizaciones técnicas, no capturas del navegador. Queda pendiente la aceptación en partida del contorno ajustado.

### Corrección del zócalo que ocultaba la pierna

La captura de Àlex demuestra que el primer ajuste del contorno sigue mal: incorpora la cuña clara del zócalo detrás de Ben y corta su pierna antes de llegar a la cara oscura del primer plano. Se retira esa cuña de la máscara y se desplaza la diagonal hasta el borde del elemento oscuro. Se añaden puntos de regresión sobre la zona clara y la oscura. No se considera aceptado el resultado anterior; la revisión en partida del nuevo contorno sigue pendiente. Los PNG permanecen intactos.

### Segundo ajuste pendiente del borde: medición de la captura

Las dos capturas siguientes del usuario muestran que todavía no queda bien: la recta aproximada corta dentro de la cara oscura, en lugar de coincidir con su borde. La captura se localiza sobre el fondo a escala 3 píxeles por unidad lógica, con origen lógico 258⅓,159⅔. Se mide la transición del suelo a la piedra sobre el maestro 1920×1200, con muestras por fila y contraste perpendicular al borde; la polilínea resultante sustituye la diagonal aproximada. Incluye la irregularidad visible en las juntas y actualiza los límites de activación.

Se añaden puntos de regresión a ambos lados del borde cerca de los pies: 286,180 debe quedar oculto; 284,180 debe permanecer delante. Se inspecciona el contorno superpuesto al fondo. No se alteran imágenes ni navegación. La aceptación visual en partida sigue pendiente; los tests geométricos no la sustituyen.

### Borde aprobado; objetos visibles y profundidad de la gota

Àlex confirma que el borde derecho ya parece correcto. Detecta que puede recoger moneda y clip pero no localizarlos visualmente, incluso en Original. La moneda usa un actor invisible con fotograma42 vacío; el clip alterna ese vacío con tres píxeles grises de los fotogramas43–46 y puede quedar oculto por Ben cuando se acerca. La composición de un estado nativo después de romper el muro confirma que el clip se dibuja y que Ben tapa dos de sus tres píxeles; esto no sustituye una captura del navegador.

A petición del usuario se mejora la presentación en ambos modos: se reutilizan los iconos de moneda y clip de cada paquete como dibujos pequeños en el escenario. El clip sigue oculto hasta romper el muro y desaparece al recogerlo; conserva un leve cambio de brillo sin desaparecer entre fotogramas. La moneda se dibuja en la capa de actores y desaparece al recogerla; respeta los primeros planos, incluida la pared que la esconde. No cambian coordenadas de interacción, acciones, inventario ni puntuación. Es una mejora de visibilidad respecto a la presentación nativa, no una extracción nueva ni un cambio de PNG.

También se corrige en ambos modos la profundidad de la gota: se ordena con la profundidad del punto de aterrizaje del charco y no con su altura instantánea. Una ejecución aislada de la rutina original confirma que la ordenación nativa cambia al bajar la gota, con pies de Ben en140 y alturas de gota80/120. No se presenta como comprobación visual DOSBox. La corrección solo afecta al dibujo; los registros de actores y sus tiempos no se modifican. Hay regresión para todo el recorrido vertical, con Ben delante y detrás del charco, y para las condiciones de aparición y recogida de ambos objetos. Pendiente de aceptación visual del usuario.

Àlex confirma después la misma superposición de la gota jugando al original en DOSBox y autoriza mejorar ese comportamiento. Se registra por tanto como mejora respecto al original confirmada por el usuario, además de la comprobación aislada de la ordenación.

La mano del cursor queda limitada a la barra de acciones mientras está abierta, tanto arriba como abajo; se mantiene completa dentro de sus320×32 unidades y recupera el movimiento libre al cerrar. El límite se calcula en coordenadas del juego para respetar escala, ventana y pantalla completa. Esto limita el cursor dibujado del juego; no captura ni bloquea el puntero del sistema fuera del navegador.

El usuario recuerda el resplandor periódico del clip en DOSBox. Se conserva su señal original: el fotograma42 muestra la base plateada tenue y los43–46 recuperan todo su brillo. No se añade un temporizador paralelo ni se cambia el programa del actor. La base permanece opaca para poder localizar el clip entre destellos.

La captura del usuario detecta una excepción incorrecta de la implementación provisional: la moneda se había colocado por encima del primer plano. Se elimina esa capa especial. La moneda vuelve a quedar debajo de la pared; además su representación visible activa la oclusión aunque su registro lógico mantenga los flags de objeto oculto. Una prueba cubre ese caso sin Ben próximo y la desaparición tras recogerla. No se garantiza visibilidad de un objeto físicamente escondido detrás de la pared.

### Destello nativo del clip, recorrido de moneda y teclado completo del HUD

Àlex precisa que en DOSBox el clip no tiene una representación permanente visible, pero sí un destello periódico. Se retira por completo el icono de clip añadido al escenario y se vuelven a usar los fotogramas42–46 originales, con sus pausas y condiciones, también en Remaster. El icono del inventario sigue siendo el de su paquete. Esta revisión sustituye la base opaca y el pulso de tinte descritos antes.

Se reproduce la recogida de la moneda desde la posición libre inicial mediante paseo hasta el punto lógico295,196, espera hasta detenerse, apertura de Coger y selección del objeto5 por el controlador real del HUD. La moneda desaparece y la puntuación aumenta en uno. También se comprueba el clip con paseo hasta210,155 tras romper el muro, selección del objeto3 y entrada en inventario. Estos ensayos no son clics del navegador: verifican el recorrido y el controlador en la simulación. La moneda no aparece con los pies a192; sí desde193 en ese recorrido. La franja de proximidad original es estrecha. El clip se recoge al lado del hueco, una vez acabada la rotura.

El HUD ya se puede abrir, recorrer, confirmar y cerrar con teclado según `original-hud.md`. Se corrige un problema concreto del foco: entrar en Coger podía dejar seleccionada una columna vacía si el submenú solo contenía un objeto. Las pruebas cubren esa secuencia completa, el salto de opciones bloqueadas y el regreso por submenús de uso de objetos. La mano sigue la casilla elegida y vuelve al ratón cuando este se mueve. Pendiente aceptación visual y de entrada real en el navegador.

Al completarse la recogida de la moneda aparece «Moneda recogida · +1 punto»: no ocupa inventario en el original, por lo que esa ausencia no significa que haya fallado. El aviso se dispara al retirarse el actor, sin alterar la acción ni su puntuación. Mirar objetos sigue sin una reconstrucción completa; la comprobación de este lote cubre Coger, no todas las respuestas de Mirar.

### Punta del cursor centrada al navegar con teclado

Se sustituye el desplazamiento aproximado de la esquina del PNG por el centro geométrico del cuadrado de selección menos la posición de la punta del índice. Se comprueban primera, intermedia y última casilla, ambas posiciones del HUD y los cursores Original/Remaster. En la barra se utiliza siempre la mano de señalar; las manos de acierto/error quedan para la escena. No se editan imágenes ni zonas de selección. Pendiente de aceptación visual.

## Interfaz y música — 16 de octubre de 2026

- El último icono del HUD abre las cuatro páginas de información nativas en Original, con FONT.SPR, rectángulos y campos de puntuación del ejecutable (0xE360 y 0xD823). El porcentaje usa 478 puntos y tres columnas con espacios. Clic avanza; clic derecho cierra. Se adapta el teclado: Intro/Espacio/derecha avanzan y Escape/Retroceso cierran.
- En Remaster abre una ventana provisional con información del proyecto, avances y puntuación; su diseño sigue pendiente de revisión.
- La bienvenida muestra arriba a la izquierda la versión raíz (1.0.0) y la fecha de compilación inyectada por Vite, fija durante esa compilación o sesión del servidor de desarrollo.
- La partida ocupa la ventana disponible, con dos controles discretos para menú y pantalla completa. El marco puede verse también fuera de pantalla completa. F4 lo muestra u oculta durante la partida y guarda la preferencia. Las fuentes del juego se mantienen para una revisión posterior.
- La música de las salas usa el selector RS verificado; la primera mazmorra reproduce CURSE.RS1. Véase MUSIC_SYNC.md para alcance y pruebas. La vista en un navegador real queda pendiente de comprobación visual.

La información del modo Original añade una quinta página propia del port: «Web y remaster · Àlex Llaó», con los acentos adaptados al estilo de FONT.SPR. Las cuatro páginas nativas se conservan. La dirección musical y las alternativas parciales Amiga/AdLib están documentadas en DIRECCION_MUSICAL.md.
