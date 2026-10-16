# Estado de CURSE Remastered

Actualizado: 16 de octubre de 2026. Rama de trabajo: `development`.

## Prioridad y criterio de cierre

Completar la primera mazmorra con el comportamiento original antes de ampliar otras salas. Los marcos y los remasters quedan aparcados. Probar siempre en silencio. Una comparación de rutinas no equivale a una captura visual ni verifica la velocidad física del juego DOS.

## Primera mazmorra

| Parte                                   | Implementado                    | Contraste con CURSE.EXE                                                                   | Comparación visual/temporal con DOSBox                |
| --------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Barra contextual y submenús originales  | Sí, integración en revisión     | Posición, bloqueo por canal y selección; 135 consultas de objetos según estado y posición | Pendiente                                             |
| Pedir ayuda y secuencia del guardia     | Sí                              | Incluida en la traza completa                                                             | Pendiente                                             |
| Recoger llave y liberar al protagonista | Sí                              | Canales, bancos y estado contrastados                                                     | Pendiente                                             |
| Moneda opcional e inventario            | Sí                              | La moneda suma puntos sin ocupar inventario; llave y clip se conservan según esta traza   | Pendiente                                             |
| Empujar pared y recoger clip            | Sí                              | Aproximación automática y animaciones contrastadas                                        | Pendiente                                             |
| Abrir puerta y salir al corredor        | Sí                              | Condición de puerta, región de salida y destino lógico 0 → recurso 1                      | Pendiente                                             |
| Movimiento y colisiones                 | Sí                              | Motor STD y traza de acciones; ampliar ensayos manuales en la sala                        | Pendiente                                             |
| Gotas, fuego y rata                     | Sí                              | Canales originales; animación ambiental y acciones verificadas por ciclos                 | Cadencia física pendiente                             |
| Primer plano al pasar la rata           | Sí, conserva la lógica anterior | Selección, geometría e índices de dos piezas contrastados                                 | Sigue pendiente comprobar la discontinuidad reportada |
| Guardar/cargar desde la barra           | No                              | Fuera de los cinco puntos de esta sala                                                    | Pendiente                                             |

La sala **todavía no se considera terminada al 100 %**. La integración visual de las acciones está en revisión; faltan la comparación DOSBox y resolver cualquier diferencia que aparezca, especialmente la velocidad percibida de las animaciones. La discontinuidad de la pared queda conservada tras la confirmación del usuario.

## Evidencia reproducible

- `tools/reverse-engineering/trace-dungeon-actions.py`: ejecuta rutinas originales en Unicorn con entradas explícitas, sin render ni hardware de audio. Recorre siete acciones, incluida la moneda opcional, abre la puerta y alcanza la salida.
- `tools/reverse-engineering/verify-dungeon-actions.mts`: compara 577 ciclos de 69 registros de actor, bancos, semilla aleatoria, controles, inventario, puntuación y plantillas. Contrasta también 135 consultas de objetos y la salida al corredor.
- `trace-dungeon.py` y `verify-dungeon.mts`: comprobación ambiental previa de 1000 ciclos.
- Los informes, memoria extraída y gráficos se generan en `reports/` y `mods/`; permanecen fuera de Git.
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
- **Validación ya ejecutada:** siete acciones y salida, 577 ciclos; 135 consultas de objetos; cinco paseos de borde, 500 ciclos. Tras los últimos ajustes pasan las 40 pruebas automatizadas, los tipos, ESLint, el formato de los archivos modificados, la compilación y la comprobación de exclusión de recursos. La preparación local de recursos también terminó correctamente. La traza ambiental anterior sigue coincidiendo durante 1000 ciclos.
- **Comparación visual DOSBox:** arrancó una copia de prueba con sonido deshabilitado. La captura falló con `FrameArrived timed out: timed out waiting on channel` después de recuperar la ventana minimizada. No se presenta ese intento como comparación visual realizada.

Este documento se versiona; los informes de ejecución, las capturas y los recursos derivados siguen en las carpetas locales excluidas de Git.
