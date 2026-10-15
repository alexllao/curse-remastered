export const indexPalette = Buffer.from(
  Array.from({ length: 768 }, (_, index) => Math.floor(index / 3)),
);

/** Inspect painted pixels of an SPR decoded using indexPalette. */
export function inspectIndices(pixels: Buffer) {
  if (pixels.length % 4) throw new Error('Expected indexed RGBA pixels');
  const histogram = Array<number>(256).fill(0);
  for (let pixel = 0; pixel < pixels.length; pixel += 4) {
    if (pixels[pixel + 3] === 0) continue;
    if (
      pixels[pixel + 3] !== 255 ||
      pixels[pixel] !== pixels[pixel + 1] ||
      pixels[pixel] !== pixels[pixel + 2]
    ) {
      throw new Error('Expected opaque palette indices in grayscale channels');
    }
    histogram[pixels[pixel]]++;
  }
  const indices = histogram.flatMap((count, index) => (count ? [index] : []));
  return {
    histogram,
    indices,
    sceneIndices: indices.filter((index) => index < 192),
    sceneDependentPixels: histogram.slice(0, 192).reduce((sum, count) => sum + count, 0),
    animatedPixels: histogram[255],
  };
}

export function colorSharedPixels(indexed: Buffer, palette: Buffer): Buffer {
  const usage = inspectIndices(indexed);
  if (palette.length !== 768 || palette.subarray(576).some((value) => value > 63))
    throw new Error('Expected a valid shared VGA palette tail');
  if (usage.sceneDependentPixels || usage.animatedPixels)
    throw new Error('Sprite requires palette context');
  return paintIndices(indexed, palette);
}

/** The caller explicitly supplies the complete active scene palette. */
export function colorContextPixels(indexed: Buffer, palette: Buffer): Buffer {
  inspectIndices(indexed);
  if (palette.length !== 768 || palette.some((value) => value > 63))
    throw new Error('Expected a complete VGA scene palette');
  return paintIndices(indexed, palette);
}

function paintIndices(indexed: Buffer, palette: Buffer): Buffer {
  const result = Buffer.from(indexed);
  for (let pixel = 0; pixel < result.length; pixel += 4) {
    if (!result[pixel + 3]) continue;
    const index = indexed[pixel];
    for (let channel = 0; channel < 3; channel++)
      result[pixel + channel] = Math.round((palette[index * 3 + channel] * 255) / 63);
  }
  return result;
}
