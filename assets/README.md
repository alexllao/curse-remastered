# Recursos locales del juego

Cada carpeta agrupa una versión, y dentro se separan sus gráficos, música y sonidos. **Los archivos originales y derivados no se suben a Git.** Aquí solo se versiona este README.

```text
assets/
  menu/
    graficos/WALLPAPER.png
    musica/menu.mp3
  dosbox-mt32/
    musica/                  # capturas RS1–RS5, loops.json y procedencia
  dosbox-adlib/
    musica/                  # reservado; todavía sin pistas
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
```

`remaster` es el nombre del paquete mejorado de respaldo, también para los sonidos. No se usa `remastered` como nombre alternativo. Puedes añadir `assets/remaster2/graficos/`, `assets/storybook/musica/` u otra versión sin tener que aportar los tres tipos de recurso.

## Qué guardar en cada sitio

- `original/` en la raíz del repositorio: únicamente los archivos DOS de los disquetes, con `CURSE.EXE` y `DATA/`. No editar ni guardar aquí PNG, música convertida, ROM externas o prototipos.
- `assets/original/`: recursos preparados a partir de tu copia, listos para el motor. Los extractores escriben aquí; no editar manualmente sus gráficos.
- `assets/remaster/` y otras versiones: entregas listas para usar, con los mismos nombres y rutas relativas que el original.
- `reports/`: extracciones intermedias, referencias, descartes, aportaciones e informes. Las ROM opcionales se conservan en `reports/audio/roms/` y no se sirven a la web.
- `docs/`: investigación, criterios artísticos y prompts versionados.

Por ejemplo, `assets/original/graficos/fondos/000-DUNGEON.png` corresponde a `assets/remaster/graficos/fondos/000-DUNGEON.png`. El original lógico de 320 × 200 se remasteriza habitualmente a 1920 × 1200 (×6). Un panorama conserva su ancho completo. Los sprites conservan su propio lienzo multiplicado por seis y sus anclajes; no todos miden 1920 × 1200.

Ben mantiene sus sprites originales hasta que se apruebe sustituirlos. Aplicar la [dirección artística](../docs/ESTILO_ARTISTICO.md) a fondos, objetos, HUD, cursores y marcos.

## Detección de versiones

La carpeta `menu` agrupa exclusivamente la bienvenida y nunca aparece como versión gráfica ni musical. Su MP3 tiene un silencio independiente guardado; reemplazarlo no cambia el audio del juego. Los arreglos Remaster están preservados en `archive/remaster/musica`, fuera de `assets` y de Git. Durante la revisión solo se habilita DOSBox MT-32; AdLib todavía no contiene audio.

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

## Wallpaper del menú de la web

Guardar la imagen de bienvenida como `assets/remaster/graficos/menu/WALLPAPER.png`. Esta carpeta pertenece a la presentación del port, no al arranque DOS. El título del juego se conserva en `interfaz/TITLE.png`. Para el menú se recomienda una composición 16:9, por ejemplo 1920 × 1080 o 3840 × 2160; no aplicar el lienzo lógico de 320 × 200 a esta imagen.

La bienvenida ya carga este wallpaper antes de retirar el loading y lo adapta a la ventana sin estirarlo; según la proporción puede recortar los márgenes. Si falta, utiliza TITLE remaster y después TITLE original. El menú compacto ofrece Comenzar partida, Opciones y Créditos. Los selectores de gráficos, música, efectos, marcos y volumen se conservan dentro de Opciones. Las futuras capas ambientales podrán acompañar al wallpaper en esta carpeta, conservando una imagen estática de respaldo.
