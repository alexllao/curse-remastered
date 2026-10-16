"""Normalización técnica autorizada: recortes, tamaño ×6 y alpha por tipo de pieza.

El arte procede de image_gen. No redibuja poses ni modifica coordenadas del juego.
Los atlas, referencias, copias previas e informes se mantienen fuera de Git.
"""
from collections import deque
from pathlib import Path
from PIL import Image, ImageChops
import hashlib
import json
import shutil

ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'reports/remaster/dungeon'
ORIGINAL=ROOT/'mods/graficos/original'
OUTPUT=ROOT/'mods/graficos/remaster'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fill_transparent_rgb(image):
    """Extiende solo el color para poder aplicar después la máscara original.

    Evita agujeros nuevos si el generador desplaza un detalle dentro de la celda.
    La silueta final sigue siendo exclusivamente la del original.
    """
    image=image.convert('RGBA')
    width,height=image.size
    colors=list(image.get_flattened_data() if hasattr(image,'get_flattened_data') else image.getdata())
    seen=bytearray(width*height)
    queue=deque()
    for index,color in enumerate(colors):
        if color[3]>=64:
            seen[index]=1
            queue.append(index)
    if not queue:
        raise ValueError('El generador ha dejado vacía una celda ocupada')
    while queue:
        index=queue.popleft()
        x=index%width
        for neighbor in (index-1 if x else -1,index+1 if x+1<width else -1,index-width,index+width):
            if 0<=neighbor<len(colors) and not seen[neighbor]:
                seen[neighbor]=1
                colors[neighbor]=colors[index]
                queue.append(neighbor)
    result=Image.new('RGBA',image.size)
    result.putdata(colors)
    return result


def main():
    metadata=json.loads((REPORT/'referencias/atlases.json').read_text(encoding='utf-8'))
    sources=json.loads((REPORT/'generados.json').read_text(encoding='utf-8'))
    archive=REPORT/'generados'
    archive.mkdir(parents=True,exist_ok=True)
    for name,source in list(sources.items()):
        target=archive/f'{name}.png'
        if Path(source).resolve()!=target.resolve():
            shutil.copy2(source,target)
        sources[name]=str(target)
    (REPORT/'generados.json').write_text(json.dumps(sources,indent=2),encoding='utf-8')
    corrections=json.loads((REPORT/'correcciones.json').read_text(encoding='utf-8')) if (REPORT/'correcciones.json').exists() else {}
    if 'guardia' in corrections:sources['guardia']=corrections['guardia']
    if 'fondo' in corrections:sources['fondo-corregido']=corrections['fondo']
    records=[]
    def save(relative,image,source,mask=None):
        original=Image.open(ORIGINAL/relative).convert('RGBA')
        expected=(original.width*6,original.height*6)
        if image.size!=expected:
            raise ValueError(f'Tamaño incorrecto: {relative} {image.size} != {expected}')
        path=OUTPUT/relative
        if path.exists():
            data=path.read_bytes()
            backup=REPORT/'anteriores'/digest(data)/(relative.replace('/','__'))
            backup.parent.mkdir(parents=True,exist_ok=True)
            if not backup.exists():backup.write_bytes(data)
        path.parent.mkdir(parents=True,exist_ok=True)
        # RGB bajo alpha cero no debe aparecer como bandas en visores sin alpha.
        transparent=image.getchannel('A').point(lambda a:255 if a==0 else 0)
        image.paste((0,0,0,0),(0,0,image.width,image.height),transparent)
        image.save(path)
        records.append({'file':relative,'width':image.width,'height':image.height,
                        'sha256':digest(path.read_bytes()),'source':source,'mask':mask})

    background=Image.open(sources['fondo-corregido']).convert('RGBA').resize((1920,1200),Image.Resampling.LANCZOS)
    save('fondos/000-DUNGEON.png',background,sources['fondo-corregido'])
    for group in ('cadenas','piedra-puerta','efectos','rata-cara','guardia','hud','cursores-aspa'):
        meta=metadata[group]
        sheet=Image.open(sources[group]).convert('RGBA').resize((meta['width'],meta['height']),Image.Resampling.LANCZOS)
        if group=='hud':
            corrected=Image.open(sources['hud-pelo-corregido']).convert('RGBA').resize(sheet.size,Image.Resampling.LANCZOS)
            for i in (5,6,19):
                x=(i%8)*192;y=(i//8)*192
                box=(x,y,x+192,y+192)
                sheet.paste(corrected.crop(box),(x,y))
        for entry in meta['entries']:
            if entry['file'].endswith('/blocked.png') or entry['file'].endswith('/animation-24576-47.png'):
                continue
            original=Image.open(ORIGINAL/entry['file']).convert('RGBA')
            mask=original.getchannel('A').resize((original.width*6,original.height*6),Image.Resampling.LANCZOS)
            ob=original.getchannel('A').getbbox()
            frame=Image.new('RGBA',mask.size)
            if ob:
                x,y,cw,ch=entry['cell']
                cell=sheet.crop((x,y,x+cw,y+ch))
                replacement=None
                for key,ids,cols in (('bocadillos',[4,23,24,25],4),('fuego',[33,34,35],3),('piedra',list(range(3,11)),4),('agua',list(range(28,33)),5)):
                    index=entry.get('frame') if group!='hud' else meta['entries'].index(entry)
                    if key in corrections and index in ids and group=={'bocadillos':'hud','fuego':'efectos','piedra':'piedra-puerta','agua':'efectos'}[key]:
                        override=Image.open(corrections[key]).convert('RGBA')
                        i=ids.index(index);tw=override.width//cols;th=override.height//((len(ids)+cols-1)//cols)
                        cell=override.crop(((i%cols)*tw,(i//cols)*th,(i%cols+1)*tw,(i//cols+1)*th))
                        replacement=corrections[key]
                natural=group in ('hud','cursores-aspa','cadenas') or (group=='guardia' and 'guardia' in corrections) or replacement is not None or (group=='efectos' and entry['frame']==41)
                if natural:
                    if cell.getchannel('A').getextrema()[0]>=250:
                        raise ValueError(f'El arte independiente requiere alpha real: {entry["file"]}')
                    # Solo los oclusores del fondo conservan el recorte VGA.
                    # UI/personajes mantienen el alpha real del dibujo nuevo.
                    bb=cell.getchannel('A').point(lambda a:255 if a>=64 else 0).getbbox()
                    if not bb:raise ValueError(f'Celda vacía: {entry["file"]}')
                    artwork=cell.crop(bb).resize(((ob[2]-ob[0])*6,(ob[3]-ob[1])*6),Image.Resampling.LANCZOS)
                    position=(ob[0]*6,ob[1]*6)
                    if group=='efectos' and 28<=entry['frame']<=32:
                        # Impacto más contenido solicitado: mismo suelo y lienzo,
                        # sin cambiar ciclos, coordenadas ni dimensiones lógicas.
                        reduced=max(1,round(artwork.height*0.65))
                        position=(position[0],ob[3]*6-reduced)
                        artwork=artwork.resize((artwork.width,reduced),Image.Resampling.LANCZOS)
                    frame.alpha_composite(artwork,position)
                    save(entry['file'],frame,replacement or sources[group],'generated-alpha-native-bounds-x6')
                    continue
                # Ignora píxeles de alpha residual del borde de la generación.
                bb=cell.getchannel('A').point(lambda a:255 if a>=64 else 0).getbbox()
                if not bb:raise ValueError(f'Celda vacía: {group}/{entry["file"]}')
                if sheet.getchannel('A').getextrema()[0]>=250:
                    # Algún atlas incluye un fondo pintado: se elimina con la
                    # máscara original, sin ajustar la pose al fondo opaco.
                    rx,ry,rw,rh=entry['rect']
                    artwork=sheet.crop((rx+ob[0]*6,ry+ob[1]*6,rx+ob[2]*6,ry+ob[3]*6))
                else:
                    artwork=fill_transparent_rgb(cell.crop(bb)).resize(((ob[2]-ob[0])*6,(ob[3]-ob[1])*6),Image.Resampling.LANCZOS)
                frame.paste(artwork,(ob[0]*6,ob[1]*6))
                frame.putalpha(mask)
                if group=='efectos' and 17<=entry['frame']<=25:
                    # El SPR original mezcla un fragmento fijo de techo y una
                    # gota clara. El fragmento toma el color del fondo nuevo.
                    patch=background.crop((188*6,10*6,(188+original.width)*6,(10+original.height)*6))
                    patch.putalpha(mask)
                    bright=Image.new('L',original.size)
                    bright.putdata([255 if r>=140 and g>=100 and a else 0
                                    for r,g,b,a in original.getdata()])
                    frame=Image.composite(frame,patch,bright.resize(frame.size,Image.Resampling.LANCZOS))
            save(entry['file'],frame,sources[group],'original-alpha-x6')
    # Los dos primeros planos usan el propio fondo, evitando dibujos independientes.
    for frame,x,y in ((1,0,169),(2,265,99),(47,30,83)):
        relative=f'escenario/000/animation-24576-{frame}.png'
        original=Image.open(ORIGINAL/relative).convert('RGBA')
        patch=background.crop((x*6,y*6,(x+original.width)*6,(y+original.height)*6))
        patch.putalpha(original.getchannel('A').resize(patch.size,Image.Resampling.NEAREST))
        save(relative,patch,'fondos/000-DUNGEON.png','original-alpha-x6-nearest')
    # Conserva el borde y la máscara del aspa; el color se adapta al metal del HUD.
    relative='interfaz/hud/blocked.png'
    original=Image.open(ORIGINAL/relative).convert('RGBA')
    cross=original.resize((original.width*6,original.height*6),Image.Resampling.LANCZOS)
    save(relative,cross,'original blocked-action overlay','original-alpha-x6')
    panels=Image.open(sources['hud-paneles']).convert('RGBA').resize((960,384),Image.Resampling.LANCZOS)
    bar=Image.new('RGBA',(1920,192))
    for i in range(10):
        x=(i%5)*192;y=(i//5)*192
        bar.paste(panels.crop((x,y,x+192,y+192)),(i*192,0))
    save('interfaz/hud/MENU.png',bar,sources['hud-paneles'])
    # Verificaciones de forma, alpha y exclusión del protagonista.
    for record in records:
        file=record['file']
        if file.startswith('escenario/') and 'animation-24576-' not in file:
            raise ValueError('Un recurso de Ben no debe entrar en este lote')
        im=Image.open(OUTPUT/file).convert('RGBA')
        if record['mask']=='original-alpha-x6':
            orig=Image.open(ORIGINAL/file).convert('RGBA')
            expected=orig.getchannel('A').resize(im.size,Image.Resampling.LANCZOS)
            if ImageChops.difference(im.getchannel('A'),expected).getbbox():
                raise ValueError(f'Máscara alterada: {file}')
    (REPORT/'instalacion.json').write_text(json.dumps({'schemaVersion':1,'scale':6,'files':records,
        'backgroundSize':[1920,1200],'playerModified':False,
        'limitations':['Technical dimensions verified; in-game visual acceptance still required']},indent=2)+'\n',encoding='utf-8')
    print(f'Instalados {len(records)} recursos ×6. Fondo1920×1200; Ben intacto; tamaños verificados; revisión visual pendiente.')


if __name__=='__main__':main()
