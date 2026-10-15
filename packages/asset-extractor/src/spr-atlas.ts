import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const fromRoot = (p: string): string => isAbsolute(p) ? p : resolve(root, p);
const input = fromRoot(process.argv[2] ?? 'reports/sprites/all');
const output = fromRoot(process.argv[3] ?? 'reports/sprites/atlases');
const columns = 6, cellWidth = 152, cellHeight = 152, imageSize = 120;
type Sprite = { index: number; width: number; height: number; paintedPixels: number; file: string };
type Entry = { source: string; status: string; count: number; sprites?: Sprite[] };
type Manifest = { results: Entry[] };
const glyphs: Record<string, string[]> = {
  '0':['111','101','101','101','111'], '1':['010','110','010','010','111'],
  '2':['111','001','111','100','111'], '3':['111','001','111','001','111'],
  '4':['101','101','111','001','001'], '5':['111','100','111','001','111'],
  '6':['111','100','111','101','111'], '7':['111','001','010','010','010'],
  '8':['111','101','111','101','111'], '9':['111','101','111','001','111'],
  'x':['000','101','010','101','000'], '/':['001','001','010','100','100'],
  ' ':['000','000','000','000','000'], '-':['000','000','111','000','000'],
  'p':['000','110','101','110','100'],
};
function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(tag: string, data: Buffer): Buffer {
  const name = Buffer.from(tag, 'ascii'), len = Buffer.alloc(4), sum = Buffer.alloc(4);
  len.writeUInt32BE(data.length); sum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([len, name, data, sum]);
}
function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) rgba.copy(rows, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR',header), chunk('IDAT',deflateSync(rows)), chunk('IEND',Buffer.alloc(0))]);
}
// This decoder intentionally accepts only the RGBA/filter-0 PNGs produced by spr-decode-all.
function decodePng(bytes: Buffer): { width: number; height: number; pixels: Buffer } {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('PNG signature invalid');
  let pos = 8, width = 0, height = 0;
  const compressed: Buffer[] = [];
  while (pos + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(pos), type = bytes.toString('ascii',pos+4,pos+8);
    if (pos + size + 12 > bytes.length) throw new Error('Truncated PNG chunk');
    const payload = bytes.subarray(pos+8,pos+8+size);
    if (type === 'IHDR') {
      width = payload.readUInt32BE(0); height = payload.readUInt32BE(4);
      if (payload[8] !== 8 || payload[9] !== 6 || payload[12] !== 0) throw new Error('Expected RGBA8 non-interlaced PNG');
    }
    if (type === 'IDAT') compressed.push(payload);
    pos += size + 12;
    if (type === 'IEND') break;
  }
  if (!width || !height || width * height > 2_000_000) throw new Error('Invalid PNG dimensions');
  const raw = inflateSync(Buffer.concat(compressed));
  const stride = width * 4;
  if (raw.length !== height * (stride + 1)) throw new Error('Unexpected PNG pixel data');
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    if (raw[row] !== 0) throw new Error('Unsupported PNG filter (expected 0)');
    raw.copy(pixels, y * stride, row + 1, row + 1 + stride);
  }
  return { width, height, pixels };
}
function rect(dst: Buffer, width: number, x: number, y: number, w: number, h: number, color: [number,number,number]): void {
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
    const at = (py * width + px) * 4;
    dst[at] = color[0]; dst[at+1] = color[1]; dst[at+2] = color[2]; dst[at+3] = 255;
  }
}
function label(dst: Buffer, width: number, x: number, y: number, message: string): void {
  for (const char of message) {
    const glyph = glyphs[char] ?? glyphs[' '];
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) {
      if (glyph[gy][gx] === '1') rect(dst, width, x+gx*2, y+gy*2, 2, 2, [238,238,238]);
    }
    x += 8;
  }
}
const manifest = JSON.parse(await readFile(join(input,'manifest.json'),'utf8')) as Manifest;
await mkdir(output,{recursive:true});
const results: { source:string; atlas?:string; sprites:number; error?:string }[] = [];
for (const entry of manifest.results) {
  if (entry.status !== 'decoded' || !entry.sprites?.length) continue;
  const count = entry.sprites.length, rows = Math.ceil(count / columns);
  const width = columns * cellWidth, height = rows * cellHeight;
  const canvas = Buffer.alloc(width * height * 4);
  try {
    for (let i = 0; i < count; i++) {
      const item = entry.sprites[i], col = i % columns, row = Math.floor(i / columns);
      const x0 = col * cellWidth, y0 = row * cellHeight;
      for (let y = 0; y < imageSize; y += 12) for (let x = 0; x < imageSize; x += 12) {
        rect(canvas,width,x0+16+x,y0+5+y,12,12,((x+y)/12)%2===0?[65,65,65]:[93,93,93]);
      }
      const decoded = decodePng(await readFile(join(input,item.file)));
      const scale = Math.min(imageSize/decoded.width,imageSize/decoded.height);
      const drawW = Math.max(1,Math.round(decoded.width*scale));
      const drawH = Math.max(1,Math.round(decoded.height*scale));
      const ox = x0+16+Math.floor((imageSize-drawW)/2), oy = y0+5+Math.floor((imageSize-drawH)/2);
      for (let dy = 0; dy < drawH; dy++) for (let dx = 0; dx < drawW; dx++) {
        const sx = Math.min(decoded.width-1,Math.floor(dx/scale)), sy = Math.min(decoded.height-1,Math.floor(dy/scale));
        const src = (sy*decoded.width+sx)*4, dst = ((oy+dy)*width+ox+dx)*4;
        if (!decoded.pixels[src+3]) continue;
        decoded.pixels.copy(canvas,dst,src,src+4);
      }
      label(canvas,width,x0+10,y0+130,String(item.index).padStart(3,'0')+' '+item.width+'x'+item.height);
      label(canvas,width,x0+10,y0+143,String(item.paintedPixels)+'p');
    }
    const name = entry.source.replace(/\\/g,'/').replace(/\.spr$/i,'').replace(/[^a-zA-Z0-9/_-]/g,'_').replace(/\//g,'__')+'.png';
    await writeFile(join(output,name),encodePng(width,height,canvas));
    results.push({source:entry.source,atlas:name,sprites:count});
    console.log('OK '+entry.source+': '+count+' sprites -> '+name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({source:entry.source,sprites:count,error:message});
    console.error('ERROR '+entry.source+': '+message);
  }
}
await writeFile(join(output,'manifest.json'),JSON.stringify({note:'Atlas de revisión visual. Los sprites están escalados con vecino más cercano y pueden usar paletas provisionales.',results},null,2)+'\n');
console.log(JSON.stringify({atlases:results.filter(r=>r.atlas).length,errors:results.filter(r=>r.error).length,output},null,2));
if (results.some(r=>r.error)) process.exitCode = 1;
