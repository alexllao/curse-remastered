import { Application, Assets, Container, ImageSource, Rectangle, Texture } from 'pixi.js';

export interface GraphicsPack {
  id: string;
  label: string;
}
export const DEFAULT_PACKS: GraphicsPack[] = [
  { id: 'original', label: 'Original' },
  { id: 'remaster', label: 'Remaster' },
];
export interface VisualAsset {
  file: string;
  width: number;
  height: number;
  remaster?: boolean;
}
export async function discoverPacks(): Promise<GraphicsPack[]> {
  try {
    const response = await fetch('/__mods/packs.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('No pack catalog');
    const data = await response.json();
    if (!Array.isArray(data.packs)) throw new Error('Invalid pack catalog');
    const safe = data.packs.filter(
      (pack: GraphicsPack) =>
        typeof pack.id === 'string' &&
        typeof pack.label === 'string' &&
        pack.id.length > 0 &&
        !pack.id.startsWith('.') &&
        !/[\\/]/.test(pack.id),
    );
    if (!safe.some((pack: GraphicsPack) => pack.id === 'original'))
      throw new Error('Missing original pack');
    return safe;
  } catch {
    return DEFAULT_PACKS;
  }
}
/** El tamaño lógico no depende de la resolución del PNG ni de la ventana. */
export function fitPresentation(app: Application, world: Container, host: HTMLElement) {
  const width = Math.max(1, host.clientWidth),
    height = Math.max(1, host.clientHeight);
  app.renderer.resize(width, height);
  const fit = Math.min(width / 320, height / 200),
    scale = fit;
  world.scale.set(scale);
  world.position.set(Math.floor((width - 320 * scale) / 2), Math.floor((height - 200 * scale) / 2));
}
export async function loadVisual(asset: VisualAsset, pack: GraphicsPack) {
  const candidates =
    pack.id === 'original' || !asset.remaster
      ? []
      : pack.id === 'remaster'
        ? ['remaster']
        : [pack.id, 'remaster'];
  for (const candidate of candidates) {
    let bitmap: ImageBitmap | undefined;
    try {
      const path = `/graficos/${encodeURIComponent(candidate)}/${asset.file.split('/').map(encodeURIComponent).join('/')}`;
      const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok || !response.headers.get('content-type')?.includes('image/png')) continue;
      bitmap = await createImageBitmap(await response.blob());
      let rect: Rectangle | undefined;
      // Un atlas o panorama con bandas puede declarar su región, sin editar el PNG.
      const meta = await fetch(`${path}.json?v=${Date.now()}`, { cache: 'no-store' });
      if (meta.ok && meta.headers.get('content-type')?.includes('application/json')) {
        const data = await meta.json(),
          r = data.contentRect;
        if (r) {
          if (
            ![r.x, r.y, r.width, r.height].every(Number.isInteger) ||
            r.x < 0 ||
            r.y < 0 ||
            r.width < 1 ||
            r.height < 1 ||
            r.x + r.width > bitmap.width ||
            r.y + r.height > bitmap.height
          )
            throw new Error('Invalid image region');
          rect = new Rectangle(r.x, r.y, r.width, r.height);
        }
      }
      const width = rect?.width ?? bitmap.width,
        height = rect?.height ?? bitmap.height;
      if (
        Math.abs(width * asset.height - height * asset.width) >
        2 * Math.max(asset.width, asset.height)
      )
        throw new Error('Incompatible proportions');
      const texture = new Texture({
        source: new ImageSource({ resource: bitmap, scaleMode: 'linear' }),
        frame: rect,
      });
      return { texture, usedPack: candidate, fallback: candidate !== pack.id, disposable: true };
    } catch {
      bitmap?.close();
    }
  }
  const texture = await Assets.load<Texture>(`/graficos/original/${asset.file}`);
  texture.source.scaleMode = 'nearest';
  return { texture, usedPack: 'original', fallback: pack.id !== 'original', disposable: false };
}
