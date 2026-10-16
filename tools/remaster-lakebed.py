"""Normaliza los másteres submarinos a sus anclajes nativos ×6, sin redibujar arte."""
from pathlib import Path
from PIL import Image,ImageOps
from collections import deque
import json,shutil,hashlib
r=Path(__file__).resolve().parents[1];b=r/'reports/remaster/lakebed';master=b/'generados';active=r/'assets/remaster/graficos';out=b/'previews';out.mkdir(parents=True,exist_ok=True)
records=json.loads((b/'fuentes.json').read_text(encoding='utf-8'));sources={row['name']:master/(row['name']+'.png') for row in records};receipt=[]
def save(im,file,source):
 target=active/file;target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists():
  backup=b/'anteriores'/file;backup.parent.mkdir(parents=True,exist_ok=True)
  if not backup.exists():shutil.copy2(target,backup)
 im.save(target);receipt.append({'file':file,'source':source,'size':im.size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
tiles={i:Image.open(sources['fondo'+str(i)]).convert('RGBA').resize((1920,1200),Image.Resampling.LANCZOS) for i in [0,3,4]}
bg=Image.new('RGBA',(9600,1200))
for i in range(5):bg.alpha_composite((ImageOps.mirror(tiles[0]) if i==1 else tiles[0]) if i<3 else tiles[i],(i*1920,0))
# Reparaciones pintadas de las dos juntas, aplicadas solo en sus bandas de unión.
seams=Image.open(sources['uniones']).convert('RGBA').resize((1920,1200),Image.Resampling.LANCZOS)
for source_x,target_x in [(480,5760),(1440,7680)]:
 patch=seams.crop((source_x-72,0,source_x+72,1200));mask=Image.new('L',patch.size);mp=mask.load()
 for x in range(144):
  v=round(255*min(1,x/24,(143-x)/24))
  for y in range(1200):mp[x,y]=v
 patch.putalpha(mask);bg.alpha_composite(patch,(target_x-72,0))
save(bg,'fondos/003-LAKEBED.png','fondo0+fondo3+fondo4')
bg.resize((2400,300),Image.Resampling.LANCZOS).save(out/'panorama.png')
def components(im):
 a=im.getchannel('A');w,h=im.size;data=bytearray(a.point(lambda v:255 if v>8 else 0).tobytes());result=[]
 for start,v in enumerate(data):
  if not v:continue
  data[start]=0;q=deque([start]);pixels=[];x0=w;y0=h;x1=y1=0
  while q:
   pos=q.popleft();pixels.append(pos);x=pos%w;y=pos//w;x0=min(x0,x);y0=min(y0,y);x1=max(x1,x);y1=max(y1,y)
   for nxt in ([pos-1] if x else [])+([pos+1] if x+1<w else [])+([pos-w] if y else [])+([pos+w] if y+1<h else []):
    if data[nxt]:data[nxt]=0;q.append(nxt)
  if len(pixels)>6:result.append((pixels,(x0,y0,x1+1,y1+1)))
 return result

for group in json.loads((b/'referencias.json').read_text()):
 key=group['name']
 if key not in sources:raise RuntimeError('Missing master '+key)
 im=Image.open(sources[key]).convert('RGBA');cols=group['columns'];rows=group['rows'];slots=[[] for _ in group['entries']]
 for pixels,bb in components(im):
  cx=(bb[0]+bb[2])/2/im.width*cols;cy=(bb[1]+bb[3])/2/im.height*rows;i=min(range(len(slots)),key=lambda i:(cx-(i%cols+.5))**2+(cy-(i//cols+.5))**2);slots[i].append((pixels,bb))
 for i,entry in enumerate(group['entries']):
  if key.startswith('ben-'):
   # Celdas fijas para efectos eléctricos que pueden tocarse en el atlas.
   spr=im.crop((round(i%cols*im.width/cols),round(i//cols*im.height/rows),round((i%cols+1)*im.width/cols),round((i//cols+1)*im.height/rows)))
   bounds=spr.getchannel('A').point(lambda v:255 if v>8 else 0).getbbox()
   if not bounds:raise RuntimeError(f'Missing sprite {key}:{i}')
   spr=spr.crop(bounds)
  else:
   if not slots[i]:raise RuntimeError(f'Missing sprite {key}:{i}')
   boxes=[x[1] for x in slots[i]];bounds=(min(a[0] for a in boxes),min(a[1] for a in boxes),max(a[2] for a in boxes),max(a[3] for a in boxes));mask=Image.new('L',im.size);mp=mask.load();alpha=im.getchannel('A').load()
   for pixels,_ in slots[i]:
    for pos in pixels:mp[pos%im.width,pos//im.width]=alpha[pos%im.width,pos//im.width]
   spr=im.copy();spr.putalpha(mask);spr=spr.crop(bounds)
  bb=entry['bbox'];spr=spr.resize(((bb[2]-bb[0])*6,(bb[3]-bb[1])*6),Image.Resampling.LANCZOS);final=Image.new('RGBA',(entry['width']*6,entry['height']*6));final.alpha_composite(spr,(bb[0]*6,bb[1]*6));save(final,entry['file'],key+f' slot{i}')
# Reutilizar exclusivamente las poses aprobadas comunes de Ben.
for bank,scene in [(16384,0),(20480,0),(65537,1),(65538,0),(65539,1)]:
 for src in (active/f'escenario/{scene:03}').glob(f'animation-{bank}-*.png'):save(Image.open(src).convert('RGBA'),'escenario/003/'+src.name,'approved Ben '+str(src.relative_to(active)))
# Partículas diminutas, letrero y pictograma mantienen su dibujo nativo.
for n in [34,35,36,37,52,53,54,55]:
 src=Image.open(r/f'assets/original/graficos/escenario/003/animation-24576-{n}.png').convert('RGBA');save(src.resize((src.width*6,src.height*6),Image.Resampling.NEAREST),f'escenario/003/animation-24576-{n}.png','native particles/text x6')
# Único oclusor que repite el fondo: recorte exacto, nunca una segunda pintura.
mask=Image.open(r/'assets/original/graficos/escenario/003/animation-24576-56.png').getchannel('A').resize((192,192),Image.Resampling.NEAREST);fg=bg.crop((1491*6,168*6,1523*6,200*6));fg.putalpha(mask);save(fg,'escenario/003/animation-24576-56.png','background crop + native mask')
frame=Image.open(sources['marco']).convert('RGBA');frame=frame.crop(frame.getchannel('A').point(lambda v:255 if v>8 else 0).getbbox())
for pack,im in [('remaster',frame),('original',frame.resize((64,200),Image.Resampling.LANCZOS).quantize(colors=64).convert('RGBA'))]:
 folder=r/'assets'/pack/'graficos/marcos';folder.mkdir(parents=True,exist_ok=True);im.save(folder/'lakebed.png');w,h=im.size;info={'label':'Fondo submarino Â· ruinas y conchas','contexts':['scene:3'],'left':{'x':0,'y':0,'width':w,'height':h},'right':{'x':0,'y':0,'width':w,'height':h},'mirrorRight':True,'fit':'cover','innerPadding':{'left':0,'right':0},'note':'Marco propio del port; variante Original reducida a64x200/64colores, no arte DOS.'};(folder/'lakebed.png.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf-8')
frame.thumbnail((256,800));frame.save(out/'marco.png')
(b/'prompts.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
(b/'instalacion.json').write_text(json.dumps({'scale':6,'files':receipt,'limitations':['Tiny bubbles, glints, original sign and thought pictogram retain native pixels','Technical composites are not browser captures','Full puzzle route requires interactive validation']},indent=2),encoding='utf-8');print('Installed',len(receipt),'graphics')
