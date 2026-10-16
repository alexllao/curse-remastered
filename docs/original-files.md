# Copia original del juego

`original/` se reserva exclusivamente para los ficheros de la copia DOS de los disquetes, conservando sus nombres y carpetas. No se guardan aquí imágenes remasterizadas, animaciones nuevas, MIDI convertidos, WAV extraídos, ROM MT-32 ni documentación del proyecto.

```text
original/
  CURSE.EXE
  SETUP.EXE
  CURSE.CFG
  DATA/
    TITLE.DAT
    TITLE.PAL
    DUNGEON.MAP
    DUNGEON.SPR
    ...resto de recursos originales...
```

El extractor lee esta copia sin modificarla. Desde la raíz del repositorio:

```powershell
pnpm assets:prepare
pnpm dev
```

Los resultados locales se generan en `reports/` y `assets/original/graficos/`. Los paquetes listos para usar se colocan en `assets/<versión>/graficos/`, `assets/<versión>/musica/` y `assets/<versión>/sonidos/`. Las aportaciones y prototipos que requieren revisión se conservan en `reports/referencias/aportaciones/`. Las ROM MT-32 opcionales se guardan en `reports/audio/roms/MT32_CONTROL.ROM` y `reports/audio/roms/MT32_PCM.ROM`; no se sirven a la web y no son parte del juego de los disquetes. No borres esas aportaciones ni ROM al limpiar informes generados.

Los archivos originales, las ROM, los recursos extraídos, las aportaciones gráficas y los remasters permanecen fuera de Git. La documentación se conserva en `docs/` para que `original/` no contenga ficheros del proyecto.
