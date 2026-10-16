# Wallpapers adaptables del menú

Generados con la herramienta integrada `image_gen`, tomando como referencia el wallpaper aprobado. Los PNG completos del generador se conservan sin cambios en `reports/remaster/menu-wallpapers/fuentes/`; el antiguo `assets/menu/graficos/WALLPAPER.png` sigue intacto.

## Entregas activas

| Archivo en assets/menu/graficos | Tamaño     | Procedencia                                 |
| ------------------------------- | ---------- | ------------------------------------------- |
| WALLPAPER-32x9.png              | 2144 × 603 | Segundo panorama, recorte x=14, y=0         |
| WALLPAPER-24x9.png              | 1992 × 747 | Primer panorama aprobado, recorte x=55, y=0 |
| WALLPAPER-16x9.png              | 1664 × 936 | Variante ancha, recorte x=4, y=0            |
| WALLPAPER-16x10.png             | 1584 × 990 | Wallpaper anterior, recorte x=1, y=0        |

Son proporciones exactas. La normalización técnica solo recorta: no remuestrea ni estira. Los PNG se guardan sin pérdidas, a su resolución nativa; no son fuentes 4K. El generador no entregó 32:9 exacto: su segundo panorama de 2172 × 724 se encuadró por arriba a 2144 × 603, conservando texto, cara, manos y Ben, recortando terreno inferior. Se conserva la fuente completa para futuras revisiones. El primer panorama generado mide 2103 × 748; la variante 16:9 generada mide 1672 × 941.

El menú elige el archivo que requiere menos recorte proporcional para la relación de ventana actual, también al entrar/salir de pantalla completa y al volver al inicio. Una imagen nueva se decodifica aparte antes de sustituir la visible. Si falta un archivo, se prueba otro encuadre y después el wallpaper antiguo y TITLE. Estos recursos nunca aparecen en el selector gráfico F2. Para monitores 5120 × 1440 y 3840 × 1080 se selecciona 32:9; para 3440 × 1440 se selecciona 24:9.

## Prompts usados (herramienta integrada)

### Primer panorama (fuente de la entrega 24:9)

Use case: stylized-concept. Edit target: the provided Curse of Enchantia Remastered menu wallpaper. Create ONE production ultrawide wallpaper in exact 32:9 aspect ratio, ideally 3840x1080 pixels. OUTPAINT horizontally: preserve the entire original central composition at its original proportions, all of the sorceress face and crown, both hands, Ben (copper-red hair, no hat), castle, bridge, sunset and the exact existing gold text 'curse of ENCHANTIA REMASTERED'. Do not redesign, stretch, crop, truncate or duplicate the central illustration or lettering. Extend only the scenery on both sides: naturally continuous painterly blue storm clouds with amber sunset, distant mountains, conifer woods, river valleys and waterfalls, matching the same hand-painted 2D adventure-game style, brushwork, perspective and lighting. Central original occupies about 45% of the total width. Composition must include top of crown and bottom of bridge with safe margin. Left lower quadrant needs readable scenic texture behind a menu, no added characters or distracting focal objects. No new text, labels, UI controls, border, black bars, watermarks, photorealism or 3D. Deliver the single 32:9 panoramic artwork; never a contact sheet.

### Segundo panorama (fuente de la entrega 32:9)

Use case stylized-concept. Edit target reference: the supplied approved hand-painted Curse of Enchantia menu wallpaper. Need a 32:9 SUPER ULTRAWIDE adaptation with all central artwork fully preserved and new continuous painted scenery extending to both sides. Preserve original typography exactly: 'curse of ENCHANTIA' and 'REMASTERED', the same sorceress face and crown, both hands, red-haired Ben without hat, castle, bridge and sunset; no redesigns, no duplicates, no additional text/UI. Production framing instruction: if your output canvas cannot be 32:9, use a very wide 3:1 landscape canvas containing the complete 32:9 illustration as a central letterboxed panoramic strip with SOLID BLACK PADDING above and below ONLY. All meaningful artwork including entire crown and bridge must lie inside the panoramic strip, comfortably away from its upper and lower edges. Black padding may be trimmed during technical export. Illustration strip occupies approximately the central 80% of canvas height, full canvas width. Do not let any hair, crown, clouds or scenery extend into the black padding. Central characters and logo occupy about 45% of panorama width. Horizontally extend scenery with matching amber sunset, storm-blue painterly skies, pine forests, mountains, rivers and waterfalls. Not photorealistic or 3D. Single coherent artwork, no panels/contact sheet.

### Variante 16:9

Edit target: provided approved Curse of Enchantia Remastered wallpaper. Create one widescreen 16:9 wallpaper adaptation at 2560x1440 if possible. Preserve the existing central composition without stretching: the same sorceress with crown and dark hair, both hands and gold jewellery, the gold title with EXACT spelling 'curse of ENCHANTIA' and 'REMASTERED', red-haired Ben without hat in green shirt and red trousers, the castle, bridge and magical light. Keep their identities, costumes, painted shapes, lighting and positions relative to each other. Expand scenery horizontally on both sides slightly to achieve 16:9 rather than cropping top and bottom of the original. Include safe margins around the logo and character. Continuous storm-blue clouds, amber sunset, mountains, conifer forests, rivers, village, waterfalls in the identical richly detailed hand-painted 2D fantasy adventure-game illustration style. No new characters, labels, buttons, frames, watermarks, 3D or photorealism. Single 16:9 artwork, no contact sheet, no black bands.

## Entrega para el monitor 3840 × 1080 de Àlex

`assets/menu/graficos/WALLPAPER-32x9-3840.png` es la entrega activa 32:9. Se obtiene de `WALLPAPER-32x9.png` mediante Lanczos a 3840 × 1080 y un enfoque suave (unsharp 5:5:0.25). Es un PNG sin pérdidas, reescalado de la fuente 2144 × 603; no contiene detalle nativo 4K ni una nueva generación artística. Ambas fuentes y los maestros del generador permanecen intactos. Su nombre diferente evita reutilizar en caché la versión anterior. Las otras proporciones conservan las entregas nativas descritas arriba.
