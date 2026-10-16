# Ben y objetos de la primera mazmorra

## Dirección y referencia aprobada

Aplicar `ESTILO_ARTISTICO.md`: ilustración 2D pintada para aventura clásica, sin fotografía ni render 3D. Ben tiene pelo cobrizo rojizo con flequillo, sin gorra; túnica verde, pantalones rojos y botas verdes. El usuario ha aprobado la primera hoja de referencia del personaje. Esa aprobación no equivale a validar todas las animaciones integradas.

Cada generación usa el atlas original como referencia obligatoria de poses y orden. La hoja aprobada aporta identidad y acabado. No sustituir una pose de espaldas, colgada, agachada o de acción por una pose frontal. Conservar reflejos y secuencias del motor.

## Lote instalado

- Banco 20480, STD: 56 fotogramas.
- Banco 16384, MANA: 17 fotogramas.
- Banco 65537, DIG: 8 fotogramas.
- Banco 65538, PLOK: 7 fotogramas.
- 27 alias de marcha en `ben/STD-000.png` a `STD-026.png`.
- Llave de escenario, iconos de llave y clip y cuatro destellos del clip: 7 recursos.

Son 122 PNG activos, con lienzo nativo multiplicado por seis. Los fotogramas de escenario están en `assets/remaster/graficos/escenario/000/`; los alias en `ben/` y los iconos en `interfaz/hud/`, dentro del mismo paquete gráfico.

## Prompts y reproducción local

El arte se generó con el generador integrado de imágenes. Los prompts exactos de cada petición, sus fuentes y las hojas originales se conservan fuera de Git en `reports/remaster/ben/`:

- `referencias.json` y `*-original.png`: geometría y atlas originales.
- `fuentes.json` y `prompts/*.txt`: instrucciones exactas y procedencia de cada lote.
- `generados/*.png`: maestros generados con transparencia.
- `instalacion.json`: dimensiones y hashes de originales y entregas.
- `anteriores/`: versiones sustituidas.

`tools/prepare-ben-remaster-refs.py` prepara las referencias desde el manifiesto local. `tools/install-ben-remaster.py` instala los maestros ya generados; requiere Pillow y los informes anteriores. No genera arte ni descarga recursos.

La instalación divide las hojas en celdas y ajusta la caja ocupada del dibujo a la caja original ×6. Conserva el alpha generado, sin imponer la silueta pixelada. Elimina únicamente motas desconectadas menores de ocho píxeles. Los anclajes, temporización, reflejos y coordenadas del juego no cambian. Las originales se verifican por hash y no se sobrescriben. Los cuatro destellos del clip son diminutos en el original; no agrandarlos para darles protagonismo.

## Límites de validación

Se han comprobado lienzos, alpha y hashes e inspeccionado hojas y composiciones. Quedan por revisar dentro del juego las transiciones de marcha, caída de las cadenas, acciones y encuentros con primeros planos. La moneda inicial usa un fotograma vacío en la exportación disponible: no inventar su dibujo ni afirmar que su disponibilidad esté comprobada.
