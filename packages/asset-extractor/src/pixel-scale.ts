/** Scale2x: compara vecinos de cada píxel, conservando colores y alfa. */
export function scale2x(width: number, height: number, pixels: Buffer) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    pixels.length !== width * height * 4
  )
    throw new Error('Invalid RGBA raster');
  const out = Buffer.alloc(width * height * 16);
  const same = (a: number, b: number) => pixels.readUInt32LE(a) === pixels.readUInt32LE(b);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const e = (y * width + x) * 4,
        b = (Math.max(0, y - 1) * width + x) * 4,
        d = (y * width + Math.max(0, x - 1)) * 4,
        f = (y * width + Math.min(width - 1, x + 1)) * 4,
        h = (Math.min(height - 1, y + 1) * width + x) * 4;
      const values =
        !same(b, h) && !same(d, f)
          ? [same(d, b) ? d : e, same(b, f) ? f : e, same(d, h) ? d : e, same(h, f) ? f : e]
          : [e, e, e, e];
      for (let i = 0; i < 4; i++)
        pixels.copy(
          out,
          ((y * 2 + Math.floor(i / 2)) * width * 2 + x * 2 + (i % 2)) * 4,
          values[i],
          values[i] + 4,
        );
    }
  return out;
}
