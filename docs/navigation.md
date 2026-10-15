# Movimiento original: primera evidencia de BOXDET

## Alcance actual

La prioridad es reconstruir el juego y usar su navegación para revisar los remasters. Las propuestas de IA pueden mover puertas, muebles y otros detalles aunque mantengan la resolución y proporción. Por ahora el visor solo permite pasear por una zona de STUDY trazada a mano: **no es la navegación original**. No se habilita un paseo libre en las demás pantallas como sustituto de esa comprobación.

Se ha verificado mediante ejecución aislada el cargador de `BOXDET.DAT` para los 78 identificadores de recursos y se han extraído sus 2.344 registros. Esto prueba la estructura y carga de esos datos, no el movimiento completo ni su comportamiento en todos los estados de una partida.

## Fuente y formato

Perfil exclusivo del ejecutable con SHA-256 `f2c0046e07b25f408516edae5d6a66c06107971fb95c55ed770fa52a6b4ecd8d`. Direcciones de código expresadas como posiciones de archivo; base de DS en el archivo: `0xF510`.

La cadena DS:8077 contiene `boxdet.dat`. El código `0x524F–0x52CA` abre el archivo, busca `resourceId × 2`, lee un puntero uint16LE, busca ese desplazamiento y lee un contador uint16LE. Reserva memoria para `contador × 10` bytes y lee los registros en CS:[18h]. DS:0DF0 conserva el contador. Un puntero cero toma una rama sin lista. El contraste usa los 78 recursos conocidos del perfil; no atribuye significado a otros índices de la tabla.

Cada registro conserva exactamente:

| Desplazamiento | Formato | Dato      |
| -------------- | ------- | --------- |
| +0             | uint8   | Tipo      |
| +1             | uint8   | Argumento |
| +2             | int16LE | Izquierda |
| +4             | int16LE | Arriba    |
| +6             | int16LE | Derecha   |
| +8             | int16LE | Abajo     |

No son polígonos transitables. Son regiones consultadas por el ejecutable para detectar bloqueos, acciones y transiciones. Se preserva su orden y sus coordenadas firmadas. Los 78 recursos gráficos tampoco equivalen a las 126 entradas de salas lógicas ni a todos los estados posibles del juego.

## Consulta rectangular contrastada

La rutina `0x274A–0x2AB1` recibe una caja en AX/BX/CX/DX y comprueba solapamiento con comparaciones firmadas. Sus bordes son inclusivos: tocar un borde cuenta como contacto.

- Tipo 0: guarda el argumento como candidato; continúa examinando la lista. Entre dos registros de tipo 0 superpuestos, prevalece el último. Al final devuelve AX=1 y BL=argumento si existe un candidato distinto de 255, o AX=0 si no lo hay.
- Tipo 1: devuelve inmediatamente AX=4 y BL=argumento al detectar contacto.
- Tipo 3: para los argumentos admitidos por su rama, devuelve inmediatamente AX=8 y BL=argumento. Se ha contrastado el argumento sintético 9; no se generaliza esta prueba a todos sus valores.
- Tipo 2: contiene condiciones sobre actores y estado de partida, puede elegir otra sala o instalar secuencias. Su comportamiento completo sigue pendiente. No se sustituye por una transición incondicional.

Antes de la lista existe una consulta de una región dinámica en DS:18F4–18FB. Los ensayos de solapamiento la sitúan explícitamente fuera del área consultada: **no verifican su actualización ni sus efectos**.

La llamada en `0x0C84–0x0CBA` construye la caja usando posición, ancho, alto, cámara y márgenes de Ben. Las ramas siguientes examinan los bits del resultado y pueden corregir coordenadas, ejecutar acciones o cambiar de sala. La preparación de un tramo hacia un destino aparece en `0x115F–0x12EB`; usa acumuladores fraccionarios y condiciones de dirección. Son evidencias estáticas para continuar la investigación, todavía sin contraste completo de trayectorias o tiempos.

## Reproducción

```powershell
pnpm --filter @curse/asset-extractor boxdet-extract
pnpm --filter @curse/asset-extractor test
$env:PYTHONPATH = (Resolve-Path reports/tool-deps).Path
python tools/reverse-engineering/trace-boxdet.py
```

Las dependencias del ensayo son las mismas que las de los otros contrastes del ejecutable, documentadas en `tools/reverse-engineering/requirements.txt`. La exportación genera `reports/navigation/boxdet.json`; el contraste escribe `reports/exe/boxdet-verification.json`. Ambos permanecen fuera de Git, junto con los datos derivados. El informe registra hashes de fuentes, lecturas y cantidades por recurso.

El ensayo conserva las instrucciones originales: solo emula los servicios DOS de archivo y reserva. Compara byte por byte lo cargado en los 78 recursos con la exportación. Además ejecuta ocho casos sintéticos de consulta para comprobar bordes, ausencia de contacto, coordenadas negativas, prioridad de solapamientos y retornos de tipo 1/3. No ejecuta una partida ni mide la cadencia original.

## Trabajo pendiente

1. Recuperar la selección de recorridos, la conversión de coordenadas con cámara y el punto de apoyo del personaje.
2. Contrastar trayectorias completas y su cadencia, incluidas correcciones por obstáculos y cambios de dirección.
3. Interpretar regiones condicionadas y actualizar estado, objetos y transiciones sin confundir recurso con sala lógica.
4. Incorporar al motor solo el comportamiento contrastado y usarlo para validar el encaje de cada remaster.

El extractor no modifica la geometría de los sprites, no cambia los originales y no incorpora estos rectángulos al prototipo como si ya fueran un sistema de navegación terminado.
