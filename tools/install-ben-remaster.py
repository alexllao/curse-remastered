"""Instala arte generado: cajas nativas ×6 y alpha natural, sin cambiar poses."""
from pathlib import Path
from collections import deque
from PIL import Image
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'reports/remaster/ben'
ORIGINAL = ROOT / 'assets/original/graficos'
TARGET = ROOT / 'assets/remaster/graficos'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    metadata = json.loads((REPORT/'referencias.json').read_text(encoding='utf-8'))
    sources = json.loads((REPORT/'fuentes.json').read_text(encoding='utf-8'))
    archive = REPORT/'generados'; archive.mkdir(exist_ok=True)
    prompts = REPORT/'prompts'; prompts.mkdir(exist_ok=True)
    for name, entry in sources.items():
        destination = archive/f'{name}.png'
        if Path(entry['path']).resolve() != destination.resolve():
            shutil.copy2(entry['path'], destination)
        entry['path'] = str(destination)
        (prompts/f'{name}.txt').write_text(entry['prompt'], encoding='utf-8')
    (REPORT/'fuentes.json').write_text(json.dumps(sources,indent=2),encoding='utf-8')
    records=[]
    def extract(name, index, columns=3, rows=3):
        sheet=Image.open(sources[name]['path']).convert('RGBA')
        x,y=index%columns,index//columns
        im=sheet.crop((round(x*sheet.width/columns),round(y*sheet.height/rows),round((x+1)*sheet.width/columns),round((y+1)*sheet.height/rows)))
        if im.getchannel('A').getextrema()[0]>=250:
            raise ValueError(f'Falta transparencia real: {name}/{index}')
        # Eliminar solo motas minúsculas desconectadas, sin recortar el borde pintado.
        w,h=im.size; alpha=list(im.getchannel('A').getdata()); seen=bytearray(w*h)
        for start,value in enumerate(alpha):
            if value<24 or seen[start]: continue
            queue=deque([start]); seen[start]=1; component=[]
            while queue:
                at=queue.popleft(); component.append(at); px=at%w
                for n in (at-1 if px else -1,at+1 if px+1<w else -1,at-w,at+w):
                    if 0<=n<w*h and not seen[n] and alpha[n]>=24:
                        seen[n]=1;queue.append(n)
            if len(component)<8:
                for at in component: alpha[at]=0
        im.putalpha(Image.frombytes('L',im.size,bytes(alpha)))
        box=im.getchannel('A').point(lambda a:255 if a>=24 else 0).getbbox()
        if not box: raise ValueError(f'Celda vacía: {name}/{index}')
        return im.crop(box)
    def save(file, painted, source):
        original=Image.open(ORIGINAL/file).convert('RGBA'); box=original.getbbox()
        if not box: raise ValueError(f'No pintar fotogramas originales vacíos: {file}')
        x0,y0,x1,y1=box
        canvas=Image.new('RGBA',(original.width*6,original.height*6))
        painted=painted.resize(((x1-x0)*6,(y1-y0)*6),Image.Resampling.LANCZOS)
        canvas.alpha_composite(painted,(x0*6,y0*6))
        path=TARGET/file;path.parent.mkdir(parents=True,exist_ok=True)
        if path.exists():
            backup=REPORT/'anteriores'/sha(path)/file.replace('/','__');backup.parent.mkdir(parents=True,exist_ok=True)
            if not backup.exists(): shutil.copy2(path,backup)
        canvas.save(path)
        records.append({'file':file,'width':canvas.width,'height':canvas.height,'originalSha256':sha(ORIGINAL/file),'sha256':sha(path),'source':source,'alignment':'original-alpha-bbox-x6; generated-natural-alpha'})
    for batch in metadata['batches']:
        for index,entry in enumerate(batch['entries']):
            painted=extract(batch['name'],index)
            save(entry['file'],painted,batch['name'])
            if entry['bank']==20480 and entry['frame']<27:
                save(f"ben/STD-{entry['frame']:03d}.png",painted,batch['name'])
    for index,entry in enumerate(metadata['objects']):
        save(entry['file'],extract('objects',index,3,1),'objects')
    for index,frame in enumerate(range(43,47)):
        save(f'escenario/000/animation-24576-{frame}.png',extract('clip-floor',index,4,1),'clip-floor')
    for record in records:
        im=Image.open(TARGET/record['file']).convert('RGBA')
        assert im.size==(record['width'],record['height'])
        assert im.getchannel('A').getbbox()
        assert sha(ORIGINAL/record['file'])==record['originalSha256']
    (REPORT/'instalacion.json').write_text(json.dumps({'schemaVersion':1,'scale':6,'records':records},indent=2),encoding='utf-8')
    print(f'Instalados {len(records)} PNG ×6; originales intactos; arte con alpha natural.')

if __name__=='__main__':main()
