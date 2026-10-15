# Ingeniería inversa de CURSE.EXE: carga de recursos

Análisis estático del ejecutable original (no distribuirlo ni incorporarlo al repositorio).

## Base de direccionamiento

- Ejecutable DOS MZ, 111606 bytes; cabecera 512 bytes.
- El código de inicio carga `DS = 0x0F31` (instrucciones alrededor del desplazamiento de archivo 0x433).
- En el tramo inicial, para un desplazamiento `DS:offset`, la posición en el EXE es `512 + 0x0F31 * 16 + offset`.
- **Esta fórmula solo aplica mientras DS conserva ese valor**; no es una regla universal para todo el programa.

## Rutinas identificadas mediante desensamblado x86 de 16 bits

| Posición de archivo | Instrucción / dato | Interpretación |
| --- | --- | --- |
| `0x6A2` | `mov dx, 0x08EA` | Apunta a la cadena `std.brd` |
| `0x6A5` | `mov ah, 0x4E; int 0x21` | DOS FindFirst: localizar archivo |
| `0x6AD`–`0x6B5` | `AH=2Fh`; leer `ES:[BX+1A/1C]` | Obtener tamaño desde DTA |
| `0x6D3` | `AH=48h; int 0x21` | Reservar memoria |
| `0x6DC` | `AX=3D00h; int 0x21` | Abrir archivo para lectura |
| `0x6F0`–`0x707` | `AH=3Fh; int 0x21` | Leer bloques de hasta 32768 bytes |
| `0x718` | `mov dx, 0x08E0` | Apunta a `mouse.spr` |
| `0x71B` | `mov ah, 0x4E; int 0x21` | DOS FindFirst |
| `0x749` | `AH=48h; int 0x21` | Reservar memoria |
| `0x752` | `AX=3D00h; int 0x21` | Abrir `mouse.spr` |
| `0x766`–`0x77D` | `AH=3Fh; int 0x21` | Leer datos de `mouse.spr` |
| `0x781` | `AH=3Eh; int 0x21` | Cerrar archivo |

Las direcciones de la tabla son **posiciones dentro del EXE**; el desensamblado se generó con `objdump -D -b binary -mi8086 --adjust-vma=0x200 CURSE.EXE`. El ejecutable se analizó como binario x86 de 16 bits; no hay todavía un grafo de flujo de control completo.

## Próxima investigación

1. Rastrear la dirección del segmento de memoria donde se cargó `mouse.spr`: la rutina guarda el segmento devuelto por DOS en `DS:[0x2C29]`.
2. Encontrar lecturas posteriores de `DS:[0x2C29]` y llamadas que reciban el segmento como parámetro.
3. Distinguir indexación de sprites, interpretación de comandos y escritura en VGA.
4. Confirmar el decodificador con `BENN.SPR` y `SPRITES.PAL`; **no asumir** que las cabeceras son cuatro fotogramas o que los bytes `00 FF` representan un comando concreto.

### Precauciones

- `CURSE.CFG` se usa para la configuración y no forma parte de la ruta gráfica investigada.
- La presencia de cadenas `benn.spr` y `benn.map` no identifica por sí sola la rutina que las carga.
- La rutina encontrada **carga** `mouse.spr`; todavía no hemos localizado su **decodificador**.
