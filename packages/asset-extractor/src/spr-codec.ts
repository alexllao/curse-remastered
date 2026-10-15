import { deflateSync } from 'node:zlib';

const crc32 = (bytes: Buffer): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
function chunk(type: string, payload: Buffer): Buffer {
  const tag = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([tag, payload])));
  return Buffer.concat([len, tag, payload, checksum]);
}
export function png(width: number, height: number, rgba: Buffer): Buffer {
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++)
    rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
export function decode(
  data: Buffer,
  palette: Buffer,
  source: string,
): { width: number; height: number; pixels: Buffer; paintedPixels: number }[] {
  if (data.length < 16) throw new Error('Archivo SPR demasiado corto');
  const first = data.readUInt16LE(0) * 16;
  if (first < 16 || first > data.length || first % 2)
    throw new Error('Tabla de índices SPR inválida');
  const starts: number[] = [];
  for (let i = 0; i < first; i += 2) {
    const unit = data.readUInt16LE(i);
    if (unit === 0) break; // Relleno a 16 bytes.
    const start = unit * 16;
    if (
      start < first ||
      start >= data.length ||
      (starts.length > 0 && start <= starts[starts.length - 1])
    ) {
      throw new Error('Índice SPR fuera de rango o desordenado: ' + i / 2);
    }
    starts.push(start);
  }
  if (!starts.length) throw new Error('Sin sprites');
  return starts.map((start, index) => {
    const end = starts[index + 1] ?? data.length;
    if (start + 10 > end) throw new Error('Cabecera truncada, sprite ' + index);
    const width = data.readUInt16LE(start),
      height = data.readUInt16LE(start + 2);
    if (!width || !height || width > 2048 || height > 2048 || width * height > 1_000_000) {
      throw new Error('Dimensiones inválidas, sprite ' + index);
    }
    const offsets = [
      0,
      data.readUInt16LE(start + 8),
      data.readUInt16LE(start + 6),
      data.readUInt16LE(start + 4),
    ];
    const positions = offsets.map((offset) => start + 10 + offset);
    if (positions.some((p, i) => p >= end || (i > 0 && p <= positions[i - 1]))) {
      throw new Error('Desplazamientos VGA inválidos, sprite ' + index);
    }
    const pixels = Buffer.alloc(width * height * 4);
    let paintedPixels = 0;
    for (let plane = 0; plane < 4; plane++) {
      let position = positions[plane];
      const limit = positions[plane + 1] ?? end;
      for (let y = 0; y < height; y++) {
        let x = plane;
        let terminated = false;
        while (position < limit) {
          let count = data.readInt8(position++);
          if (count === 0) {
            terminated = true;
            break;
          }
          if (count < 0) {
            x += -count * 4;
            if (position >= limit)
              throw new Error('Salto truncado en ' + source + ' sprite ' + index);
            count = data[position++];
          }
          if (position + count > limit)
            throw new Error('Píxeles truncados en ' + source + ' sprite ' + index);
          for (let n = 0; n < count; n++) {
            if (x >= 0 && x < width) {
              const pixel = (y * width + x) * 4;
              const color = data[position + n] * 3;
              pixels[pixel] = palette[color];
              pixels[pixel + 1] = palette[color + 1];
              pixels[pixel + 2] = palette[color + 2];
              pixels[pixel + 3] = 255;
              paintedPixels++;
            }
            x += 4;
          }
          position += count;
        }
        if (!terminated)
          throw new Error(
            'Fila sin terminador en ' +
              source +
              ' sprite ' +
              index +
              ', plano ' +
              plane +
              ', fila ' +
              y,
          );
      }
    }
    return { width, height, pixels, paintedPixels };
  });
}
