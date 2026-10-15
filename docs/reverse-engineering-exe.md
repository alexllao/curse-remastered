# Ingeniería inversa de CURSE.EXE: carga de recursos

Análisis estático del ejecutable original (no distribuirlo ni incorporarlo al repositorio).

## Base de direccionamiento

- Ejecutable DOS MZ, 111606 bytes; cabecera 512 bytes.
- El código de inicio carga `DS = 0x0F31` (instrucciones alrededor del desplazamiento de archivo 0x233).
- En el tramo inicial, para un desplazamiento `DS:offset`, la posición en el EXE es `512 + 0x0F31 * 16 + offset`.
- **Esta fórmula solo aplica mientras DS conserva ese valor**; no es una regla universal para todo el programa.

## Rutinas identificadas mediante desensamblado x86 de 16 bits

| Posición de archivo | Instrucción / dato             | Interpretación                    |
| ------------------- | ------------------------------ | --------------------------------- |
| `0x4A2`             | `mov dx, 0x08EA`               | Apunta a la cadena `std.brd`      |
| `0x4A5`             | `mov ah, 0x4E; int 0x21`       | DOS FindFirst: localizar archivo  |
| `0x4AD`–`0x4B5`     | `AH=2Fh`; leer `ES:[BX+1A/1C]` | Obtener tamaño desde DTA          |
| `0x4D3`             | `AH=48h; int 0x21`             | Reservar memoria                  |
| `0x4DC`             | `AX=3D00h; int 0x21`           | Abrir archivo para lectura        |
| `0x4F0`–`0x507`     | `AH=3Fh; int 0x21`             | Leer bloques de hasta 32768 bytes |
| `0x518`             | `mov dx, 0x08E0`               | Apunta a `mouse.spr`              |
| `0x51B`             | `mov ah, 0x4E; int 0x21`       | DOS FindFirst                     |
| `0x549`             | `AH=48h; int 0x21`             | Reservar memoria                  |
| `0x552`             | `AX=3D00h; int 0x21`           | Abrir `mouse.spr`                 |
| `0x566`–`0x57D`     | `AH=3Fh; int 0x21`             | Leer datos de `mouse.spr`         |
| `0x581`             | `AH=3Eh; int 0x21`             | Cerrar archivo                    |

Las direcciones de la tabla son **posiciones dentro del EXE**. Corregidas el 15/10/2026: el desensamblado anterior aplicaba `--adjust-vma=0x200` al archivo completo, por lo que sus etiquetas excedían la posición real en 0x200. El ejecutable se analizó como binario x86 de 16 bits; no hay todavía un grafo de flujo de control completo.

## Próxima investigación

1. Rastrear la dirección del segmento de memoria donde se cargó `mouse.spr`: la rutina guarda el segmento devuelto por DOS en `DS:[0x2C29]`.
2. Encontrar lecturas posteriores de `DS:[0x2C29]` y llamadas que reciban el segmento como parámetro.
3. Distinguir indexación de sprites, interpretación de comandos y escritura en VGA.
4. Confirmar el decodificador con `BENN.SPR` y `SPRITES.PAL`; **no asumir** que las cabeceras son cuatro fotogramas o que los bytes `00 FF` representan un comando concreto.

### Precauciones

- `CURSE.CFG` se usa para la configuración y no forma parte de la ruta gráfica investigada.
- La presencia de cadenas `benn.spr` y `benn.map` no identifica por sí sola la rutina que las carga.
- La rutina encontrada **carga** `mouse.spr`; todavía no hemos localizado su **decodificador**.

## Descubrimiento: decodificador SPR original (verificado)

La ruta que usa `mouse.spr` llega al código en posición de archivo `0xEC51`: toma el segmento guardado en `DS:[0x2C29]`, indexa el sprite y llama a `0x6F8C` para dibujarlo. El desensamblado de `0x6F8C` demuestra que el encabezado del sprite contiene dos dimensiones (`uint16LE`) y tres desplazamientos (`uint16LE`) relativos al byte `start + 10`. Los cuatro flujos VGA comienzan en `start+10+[0, offset3, offset2, offset1]`.

Cada flujo representa uno de los cuatro planos de píxeles intercalados de VGA (`x % 4`). Por cada fila: byte firmado negativo = avanzar tantos píxeles de ese plano sin pintar; después, byte positivo = número de índices de paleta literales; byte cero = fin de fila. Un byte positivo directamente también significa copiar ese número de índices literales. La implementación está en `packages/asset-extractor/src/spr-decode.ts`.

```powershell
pnpm --filter @curse/asset-extractor spr-decode
```

Genera los PNG individuales en `reports/sprites/BENN-decoded/`, junto con `manifest.json`. **Nota histórica:** esta primera prueba usaba escala de grises. La paleta base por escena ya está resuelta mediante el cargador original; véase [Paletas VGA de escenas](palette-loading.md). El algoritmo se contrastó con los 22 sprites de `BENN.SPR` y reconstruye figuras reconocibles sin errores de flujo.

Los antiguos comandos `spr-preview` y `spr-compare` son experimentos anteriores, no decodificadores válidos.

## Paletas de escena

La investigación posterior verifica la composición MAP + SPRITES.PAL y documenta los cambios dinámicos en [Paletas VGA de escenas](palette-loading.md).
