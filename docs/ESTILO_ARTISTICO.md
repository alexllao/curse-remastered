# Dirección artística de CURSE Remastered

Este criterio se aplica a los nuevos recursos que pida Àlex, salvo que indique expresamente otro acabado. Fondo, objetos, animaciones, HUD y cursores pertenecen al mismo conjunto visual; no se diseñan como ilustraciones independientes.

## Acabado aprobado

Ilustración 2D pintada a mano para una aventura gráfica clásica: pincelada contenida, superficies con detalle legible y contornos oscuros discretos. Estilizado y artístico. Evitar fotografía, materiales hiperrealistas, volumen de render 3D, plástico brillante y rediseños de fantasía ajenos al original.

En la primera mazmorra: piedra gris azulada, hierro oscuro con reflejos fríos, madera marrón envejecida, luz cálida ocre de la antorcha, sombras azules y paneles del HUD burdeos. La piel de las manos y personajes recibe la misma luz cálida. No inventar luces adicionales.

## Identidad de Ben

Ben es un joven de pelo medio rojizo/cobrizo con flequillo visible. No lleva gorra, boina, sombrero, casco ni capucha. La indicación también se aplica a los iconos que lo representen. Conservar su ropa y su identidad original.

Àlex ha autorizado el remaster de sus sprites de juego y aprobado el diseño de referencia; el lote y sus límites se documentan en `prompts-ben-remaster.md`. El guardia de la mazmorra es otro personaje: conservar el casco metálico que sí tiene en el original. No confundirlo con Ben ni trasladar su casco al protagonista.

### Expresiones y actuación

Conservar también la emoción del original en cada animación. En el ahogo, Ben
debe mostrar miedo y falta de aire: ojos abiertos, cejas preocupadas y boca
abierta buscando aire. No sustituir ese gesto por una cara tranquila o sonriente.

## Geometría y capas

- Fondo de pantalla normal: 320 × 200 lógico, entrega **1920 × 1200**. Cada sprite conserva su lienzo original multiplicado por seis; no todos los sprites tienen el mismo tamaño.
- El fondo original es la referencia geométrica. Una propuesta remasterizada solo aporta estilo, nunca nuevas posiciones ni perspectiva.
- Conservar calavera/esqueleto de la pared derecha, soportes, huecos, suelo y detalles fijos originales. No añadir elementos móviles al fondo: cadenas, puerta, bloque, fuego, agua y rata son piezas separadas.
- Las coordenadas, anclajes, fotogramas, orden, reflejos y duración siguen siendo los del motor original. No corregir el juego para acomodar un dibujo desplazado.
- Los primeros planos que repiten el fondo se obtienen del propio fondo remasterizado y usan las máscaras originales. Así no aparece otro dibujo al cruzar un personaje.
- Àlex ha autorizado normalización técnica de tamaños, recortes y máscaras para alcanzar ×6 y respetar la alineación. El arte se genera con IA; esos ajustes técnicos no autorizan redibujar poses ni inventar objetos.
- Las zonas de clic del HUD, su disposición y el punto activo del cursor conservan las coordenadas originales. No agrandar la interacción para acomodar un PNG grande.

## Referencias y revisión

Guardar referencias, atlas de entrada, salidas del generador, versiones previas e informes en `reports/remaster/`. Las entregas activas van en `assets/remaster/graficos/` con la ruta del original. Los gráficos, aunque estén generados o modificados mediante IA, permanecen fuera de Git.

Primero comprobar resolución, alpha y correspondencia de fotogramas; después probar F2 y todas las acciones de la sala. Una máscara correcta no certifica por sí sola la calidad de la pintura ni todos los apoyos del fondo. Registrar cualquier diferencia pendiente sin darla por validada.

Los prompts de cada lote se conservan junto a su guía. El prompt general de escenarios está en `prompts-remaster.md`; el lote de la primera mazmorra se registra en `prompts-mazmorra-remaster.md`.

## Transparencia de piezas remasterizadas

No imponer la silueta pixelada original a dibujos nuevos independientes: vacía los bocadillos y recorta manos, personajes y cadenas. Mantener el alpha del arte y ajustar su caja ocupada al lienzo/anclaje nativo ×6. Usar la máscara original exclusivamente donde se repite el fondo como oclusor. Los bocadillos tienen interior blanco opaco. Agua sin pared lateral ni borde rectangular elevado. Calaveras múltiples en el borde inferior izquierdo, parcialmente cortadas por pantalla, como en el original.
