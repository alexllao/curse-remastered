"""Normaliza los másteres locales de DROP conservando anclajes y alpha (Pillow).

No genera ni redibuja arte. Conserva copia de recursos existentes antes de sustituir.
Los másteres y referencias se guardan en reports/remaster/drop fuera de Git.
"""
from pathlib import Path
from PIL import Image
from collections import deque
import json,shutil,hashlib
r=Path(__file__).resolve().parents[1];b=r/'reports/remaster/drop';master=b/'generados';master.mkdir(exist_ok=True);active=r/'assets/remaster/graficos';out=b/'previews';out.mkdir(parents=True,exist_ok=True)
records=json.loads((b/'fuentes.json').read_text(encoding='utf-8'));sources={}
for row in records:
 dest=master/(row['name']+'.png')
 if not dest.is_file():raise RuntimeError(f'Missing master: {dest}')
 sources[row['name']]=dest
prompts=[{k:v for k,v in x.items() if k!='path'} for x in records];(b/'fuentes.json').write_text(json.dumps(prompts,ensure_ascii=False,indent=2),encoding='utf-8');(b/'prompts.json').write_text(json.dumps(prompts,ensure_ascii=False,indent=2),encoding='utf-8');(out/'prompts.json').write_text(json.dumps(prompts,ensure_ascii=False,indent=2),encoding='utf-8');receipt=[]
def save(im,file,source):
 target=active/file;target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists():
  backup=b/'anteriores'/file;backup.parent.mkdir(parents=True,exist_ok=True)
  if not backup.exists():shutil.copy2(target,backup)
 im.save(target);receipt.append({'file':file,'source':source,'size':im.size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
bg=Image.open(sources['fondo']).convert('RGBA').resize((1920,1200),Image.Resampling.LANCZOS);save(bg,'fondos/002-DROP.png','fondo');bg.resize((960,600),Image.Resampling.LANCZOS).save(out/'fondo.png')
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
aliases={'suelo':'losa','caida-grande':'trampilla','ben-fall-0':'ben0','ben-fall-1':'ben1','fragmentos':'ben_lejos','agua':'agua'}
for group in json.loads((b/'referencias.json').read_text()):
 key=aliases.get(group['name'])
 if key not in sources:continue
 im=Image.open(sources[key]).convert('RGBA');cols=group['columns'];rows=group['rows'];slots=[[] for _ in group['entries']]
 for pixels,bb in components(im):
  cx=(bb[0]+bb[2])/2/im.width*cols;cy=(bb[1]+bb[3])/2/im.height*rows;i=min(range(len(slots)),key=lambda i:(cx-(i%cols+.5))**2+(cy-(i//cols+.5))**2);slots[i].append((pixels,bb))
 for i,entry in enumerate(group['entries']):
  if not slots[i]:raise RuntimeError(f'Missing sprite {key}:{i}')
  boxes=[x[1] for x in slots[i]];bounds=(min(a[0] for a in boxes),min(a[1] for a in boxes),max(a[2] for a in boxes),max(a[3] for a in boxes));mask=Image.new('L',im.size);mp=mask.load();alpha=im.getchannel('A').load()
  for pixels,_ in slots[i]:
   for pos in pixels:mp[pos%im.width,pos//im.width]=alpha[pos%im.width,pos//im.width]
  spr=im.copy();spr.putalpha(mask);spr=spr.crop(bounds);bb=entry['bbox'];spr=spr.resize(((bb[2]-bb[0])*6,(bb[3]-bb[1])*6),Image.Resampling.LANCZOS);final=Image.new('RGBA',(entry['width']*6,entry['height']*6));final.alpha_composite(spr,(bb[0]*6,bb[1]*6));save(final,entry['file'],key+f' slot{i}')
for bank in [16384,20480]:
 for src in (active/'escenario/000').glob(f'animation-{bank}-*.png'):save(Image.open(src).convert('RGBA'),'escenario/002/'+src.name,'approved Ben '+str(src.relative_to(active)))
for n in range(23,27):
 src=Image.open(r/f'assets/original/graficos/escenario/002/animation-24576-{n}.png').convert('RGBA');save(src.resize((src.width*6,src.height*6),Image.Resampling.NEAREST),f'escenario/002/animation-24576-{n}.png','native sparse droplets x6')
frame=Image.open(sources['marco']).convert('RGBA');frame=frame.crop(frame.getchannel('A').point(lambda v:255 if v>8 else 0).getbbox())
for pack,im in [('remaster',frame),('original',frame.resize((64,200),Image.Resampling.LANCZOS).quantize(colors=64).convert('RGBA'))]:
 folder=r/'assets'/pack/'graficos/marcos';folder.mkdir(parents=True,exist_ok=True);im.save(folder/'drop.png');w,h=im.size;info={'label':'Caída · piedra y agua','contexts':['scene:2'],'left':{'x':0,'y':0,'width':w,'height':h},'right':{'x':0,'y':0,'width':w,'height':h},'mirrorRight':True,'fit':'cover','innerPadding':{'left':0,'right':0},'note':'Arte propio del port; variante Original reducida a64x200/64colores, no recurso DOS.'};(folder/'drop.png.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf-8')
frame.thumbnail((256,800));frame.save(out/'marco.png');(b/'instalacion.json').write_text(json.dumps({'scale':6,'files':receipt,'limitations':['Tiny sparse droplets retain native pixels','Technical composites are not browser captures']},indent=2),encoding='utf-8');print('Installed',len(receipt),'graphics')
