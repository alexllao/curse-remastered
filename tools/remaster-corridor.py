"""Normalización técnica de másteres CORRIDOR ya generados (requiere Pillow).

No genera ni redibuja arte. Conserva alpha, anclajes y fuentes aprobadas, y guarda
una copia previa antes de sustituir un recurso existente. Másteres fuera de Git.
"""
from pathlib import Path
from PIL import Image,ImageChops,ImageFilter
import json,hashlib,shutil
from collections import deque
r=Path(__file__).resolve().parents[1];base=r/'reports/remaster/corridor';masters=base/'generados';masters.mkdir(exist_ok=True);active=r/'assets/remaster/graficos';out=base/'previews';out.mkdir(parents=True,exist_ok=True)
records=json.loads((base/'fuentes.json').read_text());sources={}
for row in records:
 dest=masters/(row['name']+'.png');
 if not dest.is_file():raise RuntimeError(f'Missing generated master: {dest}')
 sources[row['name']]=dest
(base/'prompts.json').write_text(json.dumps([{k:v for k,v in row.items() if k!='path'} for row in records],ensure_ascii=False,indent=2),encoding='utf-8')
receipt=[]
def save(im,file,source):
 path=active/file;path.parent.mkdir(parents=True,exist_ok=True)
 if path.exists() and path.read_bytes()!=b'':
  backup=base/'anteriores'/file;backup.parent.mkdir(parents=True,exist_ok=True)
  if not backup.exists():shutil.copy2(path,backup)
 im.save(path);receipt.append({'file':file,'size':im.size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source':source})
# Panorama: cortes dentro de juntas verticales en el solape, sin mezclar dos arquitecturas.
tiles=[Image.open(sources[k]).convert('RGBA').resize((2304,1200),Image.Resampling.LANCZOS) for k in ['bg0','bg1v2','bg1v2','bg3']]
bg=Image.new('RGBA',(7296,1200));starts=[0,288*6,576*6,832*6];cuts=[0,336*6,624*6,896*6,1216*6]
for i,tile in enumerate(tiles):bg.paste(tile.crop((cuts[i]-starts[i],0,cuts[i+1]-starts[i],1200)),(cuts[i],0))
save(bg,'fondos/001-CORRIDOR.png','bg0,bg1v2 repeated,bg3; cuts 336,624,896 logical')
bg.convert('RGB').resize((2432,400),Image.Resampling.LANCZOS).save(out/'panorama.png')
metadata=json.loads((base/'referencias-sprites.json').read_text())
metadata.extend(json.loads((base/(name+'-referencias.json')).read_text()) for name in ['inventario','ben-accion'])
aliases={'trampa-criatura':'trampa','cabeza-a':'cabeza_a','cabeza-b':'cabeza_b','fuego-efectos':'fuego','ben-accion':'ben_accion'}
def components(im):
 a=im.getchannel('A');w,h=im.size;data=bytearray(a.point(lambda v:255 if v>8 else 0).tobytes());groups=[]
 for start,v in enumerate(data):
  if not v:continue
  data[start]=0;q=deque([start]);pixels=[];x0=w;y0=h;x1=y1=0
  while q:
   pos=q.popleft();pixels.append(pos);x=pos%w;y=pos//w;x0=min(x0,x);y0=min(y0,y);x1=max(x1,x);y1=max(y1,y)
   for nxt in ([pos-1] if x else [])+([pos+1] if x+1<w else [])+([pos-w] if y else [])+([pos+w] if y+1<h else []):
    if data[nxt]:data[nxt]=0;q.append(nxt)
  if len(pixels)>6:groups.append((pixels,(x0,y0,x1+1,y1+1)))
 return groups
for group in metadata:
 key=aliases.get(group['name'],group['name'])
 if key not in sources:continue
 im=Image.open(sources[key]).convert('RGBA');cols=group['columns'];rows=group['rows'];slots=[[] for _ in group['entries']]
 for pixels,bb in components(im):
  cx=(bb[0]+bb[2])/2/im.width*cols;cy=(bb[1]+bb[3])/2/im.height*rows
  target=min(range(len(slots)),key=lambda i:(cx-(i%cols+.5))**2+(cy-(i//cols+.5))**2)
  slots[target].append((pixels,bb))
 for i,entry in enumerate(group['entries']):
  if not slots[i]:raise RuntimeError(f'Missing sprite {key} {i}')
  boxes=[x[1] for x in slots[i]];bb=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes));mask=Image.new('L',im.size);mp=mask.load();alpha=im.getchannel('A').load()
  for pixels,_ in slots[i]:
   for pos in pixels:mp[pos%im.width,pos//im.width]=alpha[pos%im.width,pos//im.width]
  sprite=im.copy();sprite.putalpha(mask);sprite=sprite.crop(bb);b=entry['bbox'];sprite=sprite.resize(((b[2]-b[0])*6,(b[3]-b[1])*6),Image.Resampling.LANCZOS)
  final=Image.new('RGBA',(entry['width']*6,entry['height']*6));final.alpha_composite(sprite,(b[0]*6,b[1]*6));save(final,entry['file'],key+f' slot{i}')
# Pecera corregida: vidrio y agua translúcidos, misma caja y anclaje nativos.
if 'pecera_v2' in sources:
 bowl=Image.open(sources['pecera_v2']).convert('RGBA')
 bounds=bowl.getchannel('A').point(lambda v:255 if v>32 else 0).getbbox()
 if bounds is None:raise RuntimeError('Pecera sin dibujo visible')
 bowl=bowl.crop(bounds)
 for file in ['escenario/001/animation-24576-12.png','interfaz/hud/icon-32.png']:
  native=Image.open(r/'assets/original/graficos'/file).convert('RGBA');bounds=native.getbbox()
  if bounds is None:raise RuntimeError('Referencia de pecera vacía')
  sprite=bowl.resize(((bounds[2]-bounds[0])*6,(bounds[3]-bounds[1])*6),Image.Resampling.LANCZOS)
  final=Image.new('RGBA',(native.width*6,native.height*6));final.alpha_composite(sprite,(bounds[0]*6,bounds[1]*6))
  save(final,file,'pecera_v2; generated translucent glass alpha; native bbox x6')

# Ben aprobado: compartir arte, conservar los PNG originales de cada paleta.
for bank in [16384,20480,65537]:
 for src in (active/'escenario/000').glob(f'animation-{bank}-*.png'):
  save(Image.open(src).convert('RGBA'),'escenario/001/'+src.name,'approved Ben '+str(src.relative_to(active)))
# Piezas de oclusión que repiten el fondo: mismo dibujo, máscara original.
for n,x,y in [(6,41,184),(8,600,0)]:
 original=Image.open(r/f'assets/original/graficos/escenario/001/animation-24576-{n}.png').convert('RGBA');w,h=original.size;im=bg.crop((x*6,y*6,(x+w)*6,(y+h)*6));im.putalpha(original.getchannel('A').resize(im.size,Image.Resampling.NEAREST));save(im,f'escenario/001/animation-24576-{n}.png','same background crop with original mask')
# Pequeños fragmentos y párpados conservan su geometría nativa; ampliación técnica.
for n in [3,4,5,13,14,15,16,17]:
 original=Image.open(r/f'assets/original/graficos/escenario/001/animation-24576-{n}.png').convert('RGBA');save(original.resize((original.width*6,original.height*6),Image.Resampling.NEAREST),f'escenario/001/animation-24576-{n}.png','native small detail x6')
if 'marco' in sources:
 frame=Image.open(sources['marco']).convert('RGBA');bb=frame.getbbox();frame=frame.crop(bb)
 for pack,im in [('remaster',frame),('original',frame.resize((64,200),Image.Resampling.LANCZOS).quantize(colors=64).convert('RGBA'))]:
  folder=r/'assets'/pack/'graficos/marcos';folder.mkdir(parents=True,exist_ok=True);im.save(folder/'corridor.png');w,h=im.size
  info={'label':'Pasillo · gárgolas y hierro','contexts':['scene:1'],'left':{'x':0,'y':0,'width':w,'height':h},'right':{'x':0,'y':0,'width':w,'height':h},'mirrorRight':True,'fit':'cover','innerPadding':{'left':0,'right':0},'note':'Arte nuevo del port; variante Original reducida a64x200/64colores, no recurso DOS nativo.'};(folder/'corridor.png.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf-8')
 frame.thumbnail((256,800));frame.save(out/'marco.png')
(base/'instalacion.json').write_text(json.dumps({'scale':6,'files':receipt,'limitations':['Small eye lines and tiny fragments retain original pixel art; no redraw','Panorama assembled from overlapping generated tiles; manual alignment review pending']},indent=2),encoding='utf-8')
shutil.copy2(base/'prompts.json',out/'prompts.json');print('Installed',len(receipt),'graphics')
