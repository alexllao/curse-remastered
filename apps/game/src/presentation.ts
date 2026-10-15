import { Application, Assets, Container, Texture } from 'pixi.js';

export const PRESENTATION_MODES = [
  { id: 'original', label: 'Original' },
  { id: 'escalado', label: 'Escalado' },
  { id: 'remaster', label: 'Remaster' },
] as const;
export type PresentationMode = (typeof PRESENTATION_MODES)[number]['id'];
export interface VisualAsset {
  file: string;
  width: number;
  height: number;
  remaster?: boolean;
}

/** El tamaño lógico no depende de la resolución del PNG ni de la ventana. */
export function fitPresentation(app: Application, world: Container, host: HTMLElement) {
  const width = Math.max(1, host.clientWidth),
    height = Math.max(1, host.clientHeight);
  app.renderer.resize(width, height);
  const fit = Math.min(width / 320, height / 200);
  const scale = fit >= 1 ? Math.floor(fit) : fit;
  world.scale.set(scale);
  world.position.set(Math.floor((width - 320 * scale) / 2), Math.floor((height - 200 * scale) / 2));
}

export async function loadVisual(asset: VisualAsset, mode: PresentationMode) {
  let fallback = false;
  let texture: Texture;
  if (mode === 'remaster' && asset.remaster) {
    try {
      // Evita reutilizar un fondo antiguo al volver a Remaster tras copiar otro PNG.
      const response = await fetch(`/remaster/${asset.file}?v=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('image/png'))
        throw new Error('Missing remaster');
      const bitmap = await createImageBitmap(await response.blob());
      if (
        Math.abs(bitmap.width * asset.height - bitmap.height * asset.width) >
        2 * Math.max(asset.width, asset.height)
      ) {
        bitmap.close();
        throw new Error('Incompatible proportions');
      }
      texture = Texture.from(bitmap);
      texture.source.scaleMode = 'linear';
      return { texture, fallback, disposable: true };
    } catch {
      fallback = true;
    }
  } else if (mode === 'remaster') fallback = true;
  texture = await Assets.load<Texture>(
    `/${mode === 'escalado' ? 'escalado' : 'original'}/${asset.file}`,
  );
  texture.source.scaleMode = mode === 'remaster' ? 'linear' : 'nearest';
  return { texture, fallback, disposable: false };
}
