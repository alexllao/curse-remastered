# Dirección artística de los marcos

Los marcos son decoración opcional del port, no gráficos recuperados del juego DOS. Deben acompañar a Curse of Enchantia sin competir con la escena ni alterar su identidad visual.

## Estilo común

- Fantasía de aventura ilustrada, formas diseñadas a mano, un punto de encanto y humor; evitar terror y fantasía oscura realista.
- Original: pixel art de inspiración VGA, grupos de píxeles legibles, paleta limitada y tramado contenido. No presentar estos marcos como recursos originales de 1992.
- Remaster: ilustración pintada con contornos y volúmenes claros, detalle deliberado y sombras simplificadas. Evitar fotografía, render 3D, materiales PBR, microtextura excesiva y luz cinematográfica.
- Mantener iguales los motivos, la posición del reborde y el equilibrio de las dos versiones. Más resolución no implica mayor realismo.
- Default: piedra azul índigo, bronce envejecido, pequeñas estrellas de encantamiento y vidrio turquesa discreto. Sin rostros, personajes, texto ni logotipos.
- Usar los colores y materiales de una sala como referencia al preparar un marco específico. Las asociaciones son decisiones artísticas del port, no datos del ejecutable.

## Entrega técnica

Un panel cuadrado aislado, con un reborde estrecho en el lado derecho y decoración más tranquila hacia el exterior izquierdo. El motor puede reflejarlo para el otro lateral mediante `mirrorRight: true`. Sin vigas que crucen arriba o abajo. Mantener una pequeña transparencia real en el borde interior, sin sombra negra añadida.

Solicitar la máxima calidad, normalmente 2048 × 2048, y comprobar la resolución entregada. El objetivo aceptado para Remaster es al menos 1200 píxeles reales de altura. Registrar tamaño solicitado, tamaño real, SHA-256 y prompt. No ampliar artificialmente un PNG pequeño y describirlo como detalle de mayor resolución.

Guardar como `mods/graficos/original/marcos/default.png` y `mods/graficos/remaster/marcos/default.png`, con sus respectivos `.png.json`. Los paneles se adaptan a distintas proporciones de monitor mediante recorte y escala uniforme, sin alterar las coordenadas lógicas 320 × 200. Mostrar solo en pantalla completa y cuando el jugador lo active.

## Prompt base de generación

```text
Production game decorative side-panel, a single square PNG, requested 2048x2048,
at least 1200 pixels tall. Front-facing flat fantasy ornamental wall, one narrow
full-height jamb at the extreme RIGHT edge; the LEFT area is broad, quiet outer
decoration intended to be cropped. Genuine thin transparent alpha at the inner
right edge, no black backing or cast shadow. The game engine mirrors this one
panel for the opposite side. No whole frame, pair of panels, central window,
perspective, top/bottom crossbars, text, logos or characters.
Art direction: charming hand-painted fantasy adventure illustration, consciously
stylized forms and restrained lighting, not photographic, not PBR, not a 3D render,
not cinematic realism. Original variant uses readable VGA-inspired pixel clusters;
Remaster uses polished painted illustration while preserving the same composition.
Theme and palette: [materials and colors matching the intended scene].
```

## Prompt base de remaster a partir de referencia

```text
The input is the approved pixel-art frame panel. Create its painted HD counterpart.
Preserve the exact square composition, narrow RIGHT inner jamb, motifs, palette,
empty transparency and full-height shape. Change only the rendering language:
stylized storybook fantasy adventure illustration with designed shapes, clear
painted contours and simplified shadows. No pixelation, photorealism, PBR,
3D render, cinematic lighting, gritty microtexture, new objects or text.
Requested 2048x2048, minimum1200 pixels tall, genuine alpha transparency.
```

Los prompts exactos de cada generación, incluidos los de las propuestas anteriores, se conservan en `reports/referencias/marcos/prompts/`, fuera de Git. Esta guía se versiona para poder reproducir la intención artística desde una copia nueva del repositorio.
