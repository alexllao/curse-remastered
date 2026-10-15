import { executableSha256, readSceneAssociations, sha256 } from './scene-palette.js';
import { unpackRnc2 } from './rnc2.js';

export const STRIP_WIDTH = 32;
export const SCENE_HEIGHT = 200;
export function readBackgroundLayouts(exe: Buffer) {
  if (sha256(exe) !== executableSha256)
    throw new Error('Unknown executable revision: unverified background layouts');
  const base = exe.readUInt16LE(8) * 16 + 0x0f31 * 16;
  return readSceneAssociations(exe).map((scene) => {
    const pointerFileOffset = base + 0x757e + scene.resourceId * 2;
    const orderFileOffset = base + exe.readUInt16LE(pointerFileOffset);
    const count = exe[orderFileOffset];
    if (!count || orderFileOffset + count + 1 > exe.length) throw new Error('Invalid strip order');
    const stripOrder = Array.from(exe.subarray(orderFileOffset + 1, orderFileOffset + count + 1));
    if (stripOrder.some((index) => index !== 255 && index >= 128))
      throw new Error('Unsupported signed strip index');
    return {
      ...scene,
      pointerFileOffset,
      orderFileOffset,
      stripOrder,
      width: count * STRIP_WIDTH,
      height: SCENE_HEIGHT,
    };
  });
}
export function readMapStrip(map: Buffer, index: number) {
  if (map.length < 580 || !Number.isInteger(index) || index < 0 || index >= 128)
    throw new Error('Invalid MAP strip request');
  const payload = map.subarray(578);
  const first = payload.readUInt16LE(0) * 16;
  if (first < 2 || first > payload.length || index * 2 + 2 > first)
    throw new Error('Strip index outside MAP offset table');
  const offset = payload.readUInt16LE(index * 2) * 16;
  if (
    offset < first ||
    offset + 18 > payload.length ||
    payload.toString('ascii', offset, offset + 3) !== 'RNC' ||
    payload[offset + 3] !== 2
  )
    throw new Error('Invalid RNC2 strip pointer');
  const packed = payload.readUInt32BE(offset + 8);
  if (
    payload.readUInt32BE(offset + 4) !== STRIP_WIDTH * SCENE_HEIGHT ||
    offset + 18 + packed > payload.length
  )
    throw new Error('Invalid MAP strip size');
  const pixels = Buffer.from(unpackRnc2(payload.subarray(offset, offset + 18 + packed)));
  return { index, fileOffset: 578 + offset, packedBytes: packed + 18, pixels };
}
export function assembleStrips(strips: (Buffer | undefined)[]) {
  if (!strips.length || strips.length > 255) throw new Error('Invalid strip count');
  const width = strips.length * STRIP_WIDTH;
  const indices = Buffer.alloc(width * SCENE_HEIGHT); // 0xFF order entries are cleared to VGA index 0.
  strips.forEach((strip, column) => {
    if (!strip) return;
    if (strip.length !== STRIP_WIDTH * SCENE_HEIGHT)
      throw new Error('Invalid decoded strip length');
    for (let y = 0; y < SCENE_HEIGHT; y++)
      strip.copy(indices, y * width + column * STRIP_WIDTH, y * STRIP_WIDTH, (y + 1) * STRIP_WIDTH);
  });
  return { width, height: SCENE_HEIGHT, indices };
}
export function indexedRgba(indices: Buffer): Buffer {
  const rgba = Buffer.alloc(indices.length * 4);
  indices.forEach((index, pixel) => {
    rgba[pixel * 4] = rgba[pixel * 4 + 1] = rgba[pixel * 4 + 2] = index;
    rgba[pixel * 4 + 3] = 255;
  });
  return rgba;
}
export function overlaySprite(
  canvas: Buffer,
  width: number,
  height: number,
  sprite: { width: number; height: number; pixels: Buffer },
  x: number,
  y: number,
  mirror = false,
): void {
  if (
    canvas.length !== width * height * 4 ||
    sprite.pixels.length !== sprite.width * sprite.height * 4
  )
    throw new Error('Invalid RGBA canvas');
  for (let sy = 0; sy < sprite.height; sy++)
    for (let sx = 0; sx < sprite.width; sx++) {
      const dx = x + sx,
        dy = y + sy;
      if (dx < 0 || dx >= width || dy < 0 || dy >= height) continue;
      const source = (sy * sprite.width + (mirror ? sprite.width - 1 - sx : sx)) * 4;
      if (sprite.pixels[source + 3])
        sprite.pixels.copy(canvas, (dy * width + dx) * 4, source, source + 4);
    }
}
