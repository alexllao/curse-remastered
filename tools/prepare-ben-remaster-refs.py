from pathlib import Path
from PIL import Image, ImageDraw
import json
r=Path(__file__).resolve().parents[1]
dest=r/'reports/remaster/ben'; dest.mkdir(parents=True,exist_ok=True)
d=json.loads((r/'reports/playtest/manifest.json').read_text())
original=r/'assets/original/graficos'
assets=d['scenes'][0]['animation']['assets']
batches=[]
for bank,label in [(20480,'STD'),(16384,'MANA'),(65537,'DIG'),(65538,'PLOK')]:
    frames=sorted((a for a in assets if a['bank']==bank),key=lambda a:a['frame'])
    for start in range(0,len(frames),9):
        group=frames[start:start+9]; sheet=Image.new('RGBA',(1152,1536)); entries=[]
        for i,a in enumerate(group):
            im=Image.open(original/a['file']).convert('RGBA'); bb=im.getbbox()
            x=(i%3)*384; y=(i//3)*512
            # Mismo factor en todos los fotogramas: no se alteran proporciones.
            shown=im.resize((im.width*7,im.height*7),Image.Resampling.NEAREST)
            sheet.alpha_composite(shown,(x+(384-shown.width)//2,y+(512-shown.height)//2))
            entries.append({**a,'bbox':bb,'cell':[x,y,384,512]})
        name=f'{label}-{start:02d}-{start+len(group)-1:02d}'
        sheet.save(dest/f'{name}-original.png')
        batches.append({'name':name,'width':1152,'height':1536,'columns':3,'rows':3,'entries':entries})
# Referencia separada de la llave en la escena y los iconos de inventario.
files=['escenario/000/animation-24576-11.png','interfaz/hud/icon-27.png','interfaz/hud/icon-29.png']
sheet=Image.new('RGBA',(1152,512));entries=[]
for i,file in enumerate(files):
    im=Image.open(original/file).convert('RGBA'); box=im.getbbox(); cropped=im.crop(box)
    size=(cropped.width*10,cropped.height*10)
    sheet.alpha_composite(cropped.resize(size,Image.Resampling.NEAREST),(i*384+(384-size[0])//2,(512-size[1])//2))
    entries.append({'file':file,'width':im.width,'height':im.height,'bbox':box,'cell':[i*384,0,384,512]})
sheet.save(dest/'objetos-original.png')
(dest/'referencias.json').write_text(json.dumps({'batches':batches,'objects':entries},indent=2),encoding='utf-8')
print('Atlas de Ben:',len(batches),'fotogramas:',sum(len(b['entries']) for b in batches))
print('Oclusores:',d['scenes'][0]['layers']['foreground'])
