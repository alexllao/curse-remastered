# Asociaciones de música original

Las asociaciones de las salas ya se extraen de las tablas RS/MPU del EXE verificado: DS:80CD contiene los 78 recursos y DS:80B9 los cinco registros de tempo/archivo. La primera mazmorra (recurso 0) carga **CURSE.RS1**. trace-music.py contrasta 156 casos de selección y continuidad. El detalle del reproductor y los MIDI corregidos está en [ORIGINAL_MUSIC_VERIFICATION.md](ORIGINAL_MUSIC_VERIFICATION.md).

El extractor genera assets/original/musica/native-contexts.json. El catálogo aplica estas asociaciones a todos los paquetes y permite sobrescribirlas mediante **assets/music.json**, clave contexts. Los contextos admitidos son core, title, intro, game y scene:N; game sirve de respaldo. No existe un music.json independiente por paquete.

El menú propio fija RS5 por elección del usuario; no se interpreta como prueba universal de todas las asociaciones CORE/intro del DOS. Si dos escenarios usan el mismo tema, la reproducción continúa. Al cambiar de tema, la ruta RS/MPU del EXE detiene y carga el nuevo sin rampa de volumen. El fundido de 450 ms al empezar desde el menú es una decisión del port.
