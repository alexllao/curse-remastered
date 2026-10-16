# Recursos locales del juego

Cada carpeta agrupa una versión, y dentro se separan sus gráficos, música y sonidos. **Los archivos originales y derivados no se suben a Git.** Aquí solo se versiona este README.

```text
assets/
  original/
    graficos/
      fondos/
      escenario/
      ben/
      interfaz/
      presentacion/
      arranque/
      marcos/
    musica/
      CURSE.RS1.mid
      CURSE.RS1.ogg
      ...
    sonidos/
      sounds.json
      verificados/
      ...
  remaster/
    graficos/
      fondos/
      escenario/
      interfaz/
      presentacion/
      marcos/
    sonidos/
    musica/
      CURSE.RS1.mp3
      ...
```

`remaster` es el nombre del paquete mejorado de respaldo, también para los sonidos. No se usa `remastered` como nombre alternativo. Puedes añadir `assets/remaster2/graficos/`, `assets/storybook/musica/` u otra versión sin tener que aportar los tres tipos de recurso.

## Qué guardar en cada sitio

- `original/` en la raíz del repositorio: únicamente los archivos DOS de los disquetes, con `CURSE.EXE` y `DATA/`. No editar ni guardar aquí PNG, música convertida, ROM externas o prototipos.
- `assets/original/`: recursos preparados a partir de tu copia, listos para el motor. Los extractores escriben aquí; no editar manualmente sus gráficos.
- `assets/remaster/` y otras versiones: entregas listas para usar, con los mismos nombres y rutas relativas que el original.
- `reports/`: extracciones intermedias, referencias, descartes, aportaciones e informes. Las ROM opcionales se conservan en `reports/audio/roms/` y no se sirven a la web.
- `docs/`: investigación, criterios artísticos y prompts versionados.

Por ejemplo, `assets/original/graficos/fondos/000-DUNGEON.png` corresponde a `assets/remaster/graficos/fondos/000-DUNGEON.png`. El original lógico320×200 se remasteriza habitualmente a1920×1200 (×6). Un panorama conserva su ancho completo. Los sprites conservan su propio lienzo multiplicado por seis y sus anclajes; no todos miden1920×1200.

Ben mantiene sus sprites originales hasta que se apruebe sustituirlos. Aplicar la [dirección artística](../docs/ESTILO_ARTISTICO.md) a fondos, objetos, HUD, cursores y marcos.

## Detección de versiones

Los selectores son independientes: gráficos descubre las subcarpetas `graficos/`, música las `musica/` con pistas y efectos las `sonidos/` con audio. Una versión solo musical no aparece en F2. Los marcos se guardan en `assets/<versión>/graficos/marcos/`, con su PNG y el `.png.json` correspondiente.

F2 cambia los gráficos durante la partida y vuelve a consultar las versiones. La búsqueda por imagen sigue **versión elegida → remaster → original**. Original carga directamente el original. Las versiones parciales conservan ese respaldo. Al compilar se fija el catálogo disponible: vuelve a compilar para añadir versiones a una compilación existente.

Las pistas conservan sus identificadores, por ejemplo `CURSE.RS1.mp3`. Cada versión puede incluir `musica/version.json` con su etiqueta. El mapa global opcional es `assets/music.json`; no se adivinan asociaciones por orden de archivos. Los efectos usan `sonidos/sounds.json` con eventos explícitos; un WAV experimental no queda validado por estar en Original. Véanse [audio](../docs/AUDIO_SYSTEM.md) y [asociaciones musicales](../docs/ORIGINAL_MUSIC_MAPPING.md).

## Preparación y migración

Con la copia DOS en `original/`:

```powershell
pnpm assets:prepare
pnpm dev
```

Para reconstruir solo el manifiesto y las copias gráficas, una vez disponibles los informes de extracción y contraste:

```powershell
pnpm assets:playtest
```

La preparación conserva los remasters y se detiene si una copia original preparada difiere de su extracción. El manifiesto se genera en `reports/playtest/manifest.json`.

Para una instalación antigua con `mods/graficos/<versión>/`, `mods/musica/<versión>/` y `mods/sonidos/<versión>/`:

```powershell
node tools/migrate-assets.mjs
node tools/migrate-assets.mjs --apply
```

Cerrar antes el servidor local. La primera ejecución solo presenta el inventario. La segunda valida las rutas, rechaza destinos ocupados, conserva los archivos y comprueba sus SHA-256. El informe queda en `reports/asset-migration/`. Los metadatos antiguos de los WAV originales quedan en `assets/original/sonidos/`.

No publiques una compilación que incluya recursos protegidos. La comprobación `pnpm assets:check` impide versionar originales, gráficos, audio y derivados, también dentro de `assets/`.
