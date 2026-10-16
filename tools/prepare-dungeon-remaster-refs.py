"""Crea atlas de referencia ×6 desde PNG originales ya extraídos. Requiere Pillow.

No genera arte nuevo: prepara la geometría que se adjunta a image_gen.
Los atlas y su distribución se escriben solo en reports/remaster/dungeon/.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT/'reports/remaster/dungeon/referencias'
DEST.mkdir(parents=True,exist_ok=True)
original=ROOT/'assets/original/graficos'
background=Image.open(original/'fondos/000-DUNGEON.png').convert('RGBA')
background.resize((1920,1200),Image.Resampling.NEAREST).save(DEST/'fondo-original-x6.png')
background.crop((265,70,315,171)).resize((300,606),Image.Resampling.NEAREST).save(DEST/'pared-derecha-original-x6.png')

groups = {
 'cadenas': {'frames':[0], 'columns':1, 'cell':(64,160)},
 'piedra-puerta': {'frames':list(range(3,17)), 'columns':7, 'cell':(48,80)},
 'efectos': {'frames':list(range(17,48)), 'columns':8, 'cell':(32,80)},
 'rata-cara': {'frames':list(range(48,66)), 'columns':6, 'cell':(40,24)},
 'guardia': {'frames':list(range(66,88)), 'columns':6, 'cell':(64,64)},
 'hud': {'frames':list(range(32)), 'columns':8, 'cell':(32,32)},
 'cursores': {'frames':[0,1,2], 'columns':3, 'cell':(24,24)},
}
metadata={}
for name,group in groups.items():
    cw,ch=group['cell'];columns=group['columns'];rows=(len(group['frames'])+columns-1)//columns
    # Referencias ×6 sobre fondo transparente. Su distribución es parte del contrato del atlas.
    sheet=Image.new('RGBA',(cw*columns*6,ch*rows*6))
    entries=[]
    for i,frame in enumerate(group['frames']):
        file=(f'interfaz/hud/icon-{frame}.png' if name=='hud' else f'interfaz/hud/mouse-{frame}.png' if name=='cursores' else f'escenario/000/animation-24576-{frame}.png')
        image=Image.open(original/file).convert('RGBA')
        x=(i%columns)*cw*6; y=(i//columns)*ch*6
        # El borde superior izquierdo del sprite es el anclaje original, con margen fijo.
        px=x+(cw-image.width)*3;py=y+(ch-image.height)*3
        sheet.alpha_composite(image.resize((image.width*6,image.height*6),Image.Resampling.NEAREST),(px,py))
        entries.append({'frame':frame,'file':file,'rect':[px,py,image.width*6,image.height*6],'cell':[x,y,cw*6,ch*6], 'width':image.width,'height':image.height})
    path=DEST/f'{name}.png';sheet.save(path)
    metadata[name]={'file':str(path),'width':sheet.width,'height':sheet.height,'columns':columns,'rows':rows,'entries':entries}
    print(name,sheet.size)
(DEST/'atlases.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')

root=ROOT
ref=root/'reports/remaster/dungeon/referencias'
original=root/'assets/original/graficos'
metadata=json.loads((ref/'atlases.json').read_text())
menu=Image.open(original/'interfaz/hud/MENU.png').convert('RGBA')
sheet=Image.new('RGBA',(960,384))
for i in range(10):sheet.alpha_composite(menu.crop((i*32,0,(i+1)*32,32)).resize((192,192),Image.Resampling.NEAREST),((i%5)*192,(i//5)*192))
sheet.save(ref/'hud-paneles.png')
sheet=Image.new('RGBA',(384,384));entries=[]
for i,file in enumerate(['mouse-0.png','mouse-1.png','mouse-2.png','blocked.png']):
    im=Image.open(original/'interfaz/hud'/file).convert('RGBA');x=(i%2)*192+(32-im.width)*3;y=(i//2)*192+(32-im.height)*3
    sheet.alpha_composite(im.resize((im.width*6,im.height*6),Image.Resampling.NEAREST),(x,y))
    entries.append({'file':'interfaz/hud/'+file,'rect':[x,y,im.width*6,im.height*6],'cell':[(i%2)*192,(i//2)*192,192,192],'width':im.width,'height':im.height})
sheet.save(ref/'cursores-aspa.png')
metadata['cursores-aspa']={'file':str(ref/'cursores-aspa.png'),'width':384,'height':384,'columns':2,'rows':2,'entries':entries}
(ref/'atlases.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
