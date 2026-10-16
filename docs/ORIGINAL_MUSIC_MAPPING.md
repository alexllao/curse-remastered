# Asociaciones de música original

## Estado verificado y pendiente

Se han recibido cinco archivos MIDI reconstruidos de `CURSE.RS1`–`CURSE.RS5`, junto con su auditoría local. El README de esa entrega señala como provisionales el tempo de 120 BPM, PPQN 120 y la interpretación de un marcador especial. Los finales contienen referencias propias de repetición. Esta documentación no sustituye una captura del motor DOS.

| Identificador | Archivo aportado | Asociación con pantallas | Estado temporal |
| ------------- | ---------------- | ------------------------ | --------------- |
| CURSE.RS1     | CURSE.RS1.mid    | Pendiente                | Provisional     |
| CURSE.RS2     | CURSE.RS2.mid    | Pendiente                | Provisional     |
| CURSE.RS3     | CURSE.RS3.mid    | Pendiente                | Provisional     |
| CURSE.RS4     | CURSE.RS4.mid    | Pendiente                | Provisional     |
| CURSE.RS5     | CURSE.RS5.mid    | Pendiente                | Provisional     |

Las escuchas MT-32 generadas preservan los tiempos de esos MIDI. No confirman los tiempos del RS original ni la inicialización específica de instrumentos/canales del juego. El código del sintetizador, los archivos generados y sus hashes se mantienen localmente en `reports/` y `assets/`.

## Mapa de configuración local

`assets/<versión>/musica/music.json` puede declarar `contexts`, que asocia un contexto con un identificador de tema. Los contextos reconocidos son `core`, `title`, `intro`, `game` y `scene:N`, con N igual al identificador de recurso 0–77. `game` actúa como respaldo general cuando no hay una asociación concreta. Las extensiones de archivo no forman parte del identificador.

El mapa inicial está vacío hasta verificar las asociaciones. El selector manual permite escuchar los temas sin afirmar que corresponden a una escena. Una configuración del usuario es una elección explícita; para documentarla como original deberá incluirse evidencia del ejecutable o de una captura reproducible.

## Próximo contraste de fidelidad

1. Capturar las órdenes MPU-401 y los mensajes MIDI emitidos por el ejecutable.
2. Relacionar selección de tema, entrada/salida de escenarios y eventos de presentación.
3. Comparar cada mensaje y su instante con las conversiones aportadas.
4. Verificar los marcadores RS y sus puntos de repetición.
5. Aplicar y contrastar la inicialización MT-32 y los cambios de timbre, manteniendo las ROM en `original/ROMS/`.

Los resultados deberán registrar la revisión del EXE y la procedencia. Los MIDI, SysEx, ROM y tablas derivadas no se incorporarán a Git.
