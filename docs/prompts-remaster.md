# Prompt para remasterizar escenarios sin cambiar su geometría

La prioridad actual es terminar la revisión del original. Este prompt queda preparado para rehacer las propuestas artísticas después. Una imagen generada sigue siendo provisional hasta comprobar su encaje; las instrucciones de texto no garantizan alineación exacta.

## Referencias que se deben adjuntar

1. **Fondo original:** el PNG de `mods/original/fondos/`, como imagen que se va a transformar. No usar una captura con Ben y los objetos superpuestos.
2. **Guía de geometría, si está disponible:** referencia con contornos y posiciones de piezas, puertas y límites. Solo sirve de guía; sus marcas no deben aparecer en la entrega.
3. **Estilo aprobado, opcional:** una referencia del acabado artístico deseado. No permite trasladar sus objetos, arquitectura o iluminación a otra sala.

Completar las dimensiones antes de copiar el prompt. Ejemplo para STUDY: original 320 × 200, entrega 1920 × 1200 (×6). Un panorama conserva su ancho completo: no se trata como una pantalla de 320 × 200.

## Tamaño habitual: ×6

Multiplicar el ancho y el alto originales por seis. Una pantalla de 320 × 200 se entrega a 1920 × 1200; un panorama de 480 × 200, a 2880 × 1200. Mantener el panorama completo. El motor ajusta la presentación al contenedor sin cambiar sus coordenadas lógicas y admite otros factores en futuros paquetes; no hace falta usar ×6 internamente en el juego.

Las imágenes de la introducción ya incluyen personajes y elementos animados pintados en cada fotograma. Al remasterizarlas, conservar todos esos elementos y su posición entre imágenes. La instrucción de excluir personajes del prompt siguiente se refiere a fondos MAP con sprites independientes, no a los fotogramas completos de presentación.

## Prompt para copiar

Remasteriza el fondo original adjunto de Curse of Enchantia como una ilustración 2D pintada a mano para una aventura gráfica clásica.

**La geometría del original es obligatoria.** El juego seguirá usando sus coordenadas, obstáculos y piezas superpuestas. Mejora únicamente el acabado de las superficies y el detalle dentro de las formas existentes.

Original: [ANCHO] × [ALTO] píxeles. Entrega: [ANCHO DE ENTREGA] × [ALTO DE ENTREGA], con exactamente la misma proporción y el encuadre completo.

Conserva, en las mismas coordenadas proporcionales, todos los contornos, siluetas, tamaños, distancias, apoyos y puntos de contacto: suelo transitable, paredes, puertas, escaleras, muebles, mesas, columnas, ventanas, soportes de velas y antorchas. No desplaces ningún elemento para mejorar la composición. No cambies la cámara, la perspectiva ni la profundidad aparente.

Respeta exactamente los márgenes y las zonas negras del original. Si es un panorama, conserva ambos extremos, toda su anchura y las separaciones entre elementos repetidos. No recortes, amplíes el encuadre, estires, recentres ni añadas bandas.

Mantén la identidad y los colores del escenario. Añade detalle pictórico dentro de sus materiales sin agrandar las formas ni crear salientes. Conserva las sombras de contacto y una iluminación compatible con las piezas originales; no añadas nuevas fuentes de luz.

Entrega exclusivamente el fondo. No añadas a Ben, personajes, objetos procedentes de sprites separados, llamas, partículas ni efectos que no estén ya pintados en este PNG original. Las animaciones se reproducirán después mediante piezas independientes. Conserva los elementos estáticos que sí forman parte del fondo original.

Algunos elementos del primer plano, como una mesa, también tienen una pieza transparente que volverá a dibujarse encima del personaje. Su silueta, posición y límites deben permanecer idénticos al original: el nuevo dibujo tiene que seguir encajando dentro de esa misma máscara. No inventes bordes o volúmenes que sobresalgan de ella.

Si adjunto una guía de geometría, úsala solo para alinear. Si adjunto una referencia de estilo, úsala solo para el acabado. No copies su composición ni sus objetos. No incluyas las marcas de ninguna guía, interfaz, texto nuevo o marca de agua.

Si no puedes conservar el encuadre y la geometría exigidos, indica la limitación en lugar de rediseñar el escenario para ajustarlo.

## Revisión antes de activar la imagen

- Comparar con el original en el mismo encuadre y proporción. Revisar contornos mediante superposición o alternancia; no basta con que resulte atractiva.
- Recorrer el panorama completo. Comprobar puertas, suelo y elementos repetidos en ambos extremos.
- Probar los recorridos y límites originales, y revisar por dónde pasan los pies de Ben.
- Comprobar las piezas que lo ocultan. Las piezas de primer plano que duplican una región del fondo deberán remasterizarse como parte del mismo conjunto, conservando la máscara original y el mismo dibujo en esa zona. No generarlas como ilustraciones independientes sin referencia al fondo.
- Revisar los apoyos y zonas de contacto de los sprites animados: una llama o un personaje no pueden quedar desplazados respecto a su soporte o al suelo.

Si un objeto cambia de sitio, el fondo se registra como pendiente y se rehace. No mover las coordenadas del juego ni su máscara para acomodar el resultado de la IA.

Guardar los PNG con la misma ruta y nombre que sus originales dentro del paquete correspondiente. Los gráficos y las referencias permanecen fuera de Git; solo se versiona esta guía.
