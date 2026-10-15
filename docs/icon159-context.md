# ICONS[159]: origen y paleta contextual

## Resultado

El icono 159 corresponde al objeto interno **175**. Su registro estático de
origen se encuentra en el recurso de escena **70**, que la tabla original
asocia a **STUDY.MAP / STUDY.SPR**.

No tiene una paleta RGB permanente: la rutina de recogida incorpora el objeto
al inventario y la barra dibuja sus índices con la paleta de la escena activa.
Los siete píxeles con índices inferiores a 192 cambian con ese MAP; el resto
utiliza los colores compartidos. Por eso asignar siempre STUDY.PAL al objeto
transportado tampoco reproduciría la conducta del juego.

## Cadena de evidencia en CURSE.EXE

Perfil SHA-256 igual al de [paletas de escena](palette-loading.md). Todas las
direcciones siguientes son posiciones reales de archivo, no direcciones DOS.

| Posición / campo                 | Evidencia                                                                                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x148BB–0x148BC`                | Entrada del objeto 175: marca inicial 3 en DS:53AB y sprite 159 en DS:53AC. El formato es **marca seguida de icono**, con paso de 2 bytes desde DS:524D.                            |
| `0x8B73–0x8BC2`                  | El selector lee la marca desde DS:524D + 2×objeto y guarda objeto +26 como entrada de interfaz. Para 175, el valor es 201.                                                          |
| `0xE173–0xE195`                  | Resta 26, indexa DS:524E + 2×objeto, obtiene 159 e indexa ICONS.SPR. Llama al mismo decodificador de sprites.                                                                       |
| `0x14951`                        | Puntero DS:53B5 + 2×70 a DS:5033.                                                                                                                                                   |
| `0x14543`                        | Primer registro del recurso 70, de nueve bytes: sprite de escena 5, posición (202,152), atributos DS:7320. El sprite de escena 5 y el icono 159 son índices de archivos diferentes. |
| `0x16834`                        | El tercer uint16 de los atributos DS:7320 contiene el objeto 175. El cargador lo copia al campo +14 del objeto en memoria.                                                          |
| `0x8CA6–0x8D6E`, `0x8DA0–0x8DDF` | Cargador de registros de escena y atributos; confirma cómo se interpretan los datos anteriores.                                                                                     |
| `0x16F8E`                        | Registro 70 de la tabla MAP/SPR: STUDY.MAP y STUDY.SPR.                                                                                                                             |
| `0x583A–0x5879`                  | La acción convierte la selección en objeto 175 y llama a la inserción en inventario `0x8AD9`. Esto ocurre antes de su tratamiento especial.                                         |
| `0x6341–0x6352`                  | Caso especial del objeto 175: llama a `0x653F` y prepara la animación de recogida.                                                                                                  |
| `0x653F–0x6544`                  | Activa el bit 0 en DS:53AD. Esta marca pertenece al **objeto 176**, no al 175; no confundir el orden de los campos de la tabla.                                                     |
| `0x8AD9–0x8AF2`                  | El inventario guarda el identificador como uint16 en una de diez posiciones desde DS:5225. No guarda una paleta ni un MAP de origen.                                                |
| `0xE1D3–0xE1F9`                  | El selector de inventario añade 26 a esos identificadores y reutiliza el dibujado normal de iconos. No restaura una paleta de origen.                                               |

La búsqueda de registros mediante los 78 recursos MAP/SPR de este perfil
encuentra una única aparición estática del objeto 175: el recurso 70.
Esto identifica su origen; no demuestra todos los estados que pueden generarse
por scripts ni todas las salas a las que puede transportarse en una partida.

## Contraste con las instrucciones originales

`trace-icon-context.py` reutiliza el arnés Unicorn anterior. No utiliza DOSBox,
no altera CURSE.EXE y no ejecuta la partida completa. Carga STUDY.SPR y ejecuta
los bloques originales que:

1. Crean los objetos del recurso 70.
2. Construyen el selector con máscara 2.
3. Insertan la selección en un inventario inicialmente vacío.
4. Ejecutan la activación especial.
5. Traducen la entrada seleccionada a un índice de ICONS.SPR.

El modo de selección global se declara como entrada sintética, para evitar
que la distancia del jugador oculte el objeto. Los puntos de parada se sitúan
antes del retorno o del siguiente bloque no incluido en la prueba.

Observado: objeto de escena 175 → selección 201 → inventario 175 → icono 159.
La marca del objeto 175 sigue valiendo 3; la del 176 pasa de 0 a 1.
No se ha medido una ruta jugable completa ni una transición real entre salas.

## Exportación

```powershell
pnpm --filter @curse/asset-extractor spr-decode-ui-context
```

Por defecto produce la variante de origen STUDY en
`reports/sprites/interface-context/STUDY/ICONS/sprite-159.png`, con manifiesto
de hashes y evidencia. Su estado es `verified-source-scene-static`.

Para representar explícitamente otra paleta activa:

```powershell
pnpm --filter @curse/asset-extractor spr-decode-ui-context XROADS.MAP
```

El MAP debe estar en la tabla verificada del ejecutable. Las variantes ajenas
al origen reciben el estado `conditional-active-map`: significan «estos serían
los colores si el icono se dibuja con este MAP activo». No prueban que una
partida permita transportar el objeto a esa sala ni convierten esa asociación
en una paleta permanente.

Para generar el atlas del contexto de origen:

```powershell
pnpm --filter @curse/asset-extractor spr-atlas reports/sprites/interface-context/STUDY reports/sprites/interface-context/STUDY/atlases
```

El exportador general `spr-decode-ui` sigue generando 211 PNG independientes
del contexto. La entrada 159 permanece separada y ahora indica la regla de
paleta activa, su origen STUDY y el comando de exportación contextual. Así
pueden reconstruirse los 212 sprites sin asignar una paleta global falsa al
único icono que necesita contexto.

El manifiesto general pasa a `schemaVersion: 2`: conserva 211 en
`exportedSprites`, registra 1 en `contextDependentSprites` y 0 en
`unresolvedSprites`. El icono 159 aparece en `results[].contextDependent`,
con STUDY como origen y la regla de paleta activa. Los casos sin contexto
identificado siguen reservados para `results[].unresolved`. No interpretar
la diferencia entre 212 originales y 211 PNG compartidos como un recurso
perdido.

## Reproducir y validar

Con las dependencias Python del arnés ya disponibles (véase
[configuración](palette-effects.md#reproducir-la-captura)):

```powershell
python tools/reverse-engineering/trace-icon-context.py
pnpm --filter @curse/asset-extractor test
```

La comprobación aislada genera `reports/exe/icon159-execution.json`.
Ocho pruebas del paquete verifican, entre otros casos, la lectura del objeto
por su puntero de atributos, registros truncados, terminadores ausentes y
coloración contextual con conservación de alfa y de los colores compartidos.
Se han generado las variantes STUDY y XROADS y revisado el atlas de STUDY. Entre ambas variantes cambian exactamente los siete píxeles dependientes de escena; dimensiones y alfa permanecen idénticos.
Los 211 PNG compartidos conservan sus bytes anteriores. Las comprobaciones
específicas de ESLint, Prettier y TypeScript pasan; permanecen los fallos
globales previos documentados. No se modifica el decodificador geométrico.

Los originales, sus colores, los PNG y los informes siguen fuera de Git.
