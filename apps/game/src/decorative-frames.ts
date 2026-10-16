import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
interface Panel {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface FrameVariant {
  url: string;
  width: number;
  height: number;
  left: Panel;
  right: Panel;
  innerPadding?: { left: number; right: number };
}
export interface FrameChoice {
  id: string;
  label: string;
  variants: Record<string, FrameVariant>;
}
export async function discoverFrames(): Promise<FrameChoice[]> {
  try {
    const response = await fetch('/__mods/frames.json', { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return data.schemaVersion === 1 && Array.isArray(data.frames) ? data.frames : [];
  } catch {
    return [];
  }
}
export function frameVariant(frame: FrameChoice | undefined, pack: string) {
  if (!frame) return undefined;
  return pack === 'original'
    ? frame.variants.original
    : (frame.variants[pack] ?? frame.variants.remaster ?? frame.variants.original);
}
/** Capa de presentación: reborde mínimo sobre la imagen, sin alterar coordenadas DOS. */
export class DecorativeFrames {
  readonly layer = new Container();
  private left = new Sprite();
  private right = new Sprite();
  private generation = 0;
  private innerFraction = { left: 0, right: 0 };
  private crops: Texture[] = [];
  constructor() {
    this.layer.eventMode = 'none';
    this.layer.visible = false;
    this.layer.addChild(this.left, this.right);
  }
  async show(variant: FrameVariant | undefined, pixelArt: boolean) {
    const generation = ++this.generation;
    this.layer.visible = false;
    if (!variant) return;
    const base = await Assets.load<Texture>(variant.url);
    if (generation !== this.generation) return;
    base.source.scaleMode = pixelArt ? 'nearest' : 'linear';
    const crops = [variant.left, variant.right].map(
      (panel) =>
        new Texture({
          source: base.source,
          frame: new Rectangle(panel.x, panel.y, panel.width, panel.height),
        }),
    );
    this.innerFraction = {
      left: (variant.innerPadding?.left ?? 0) / variant.left.width,
      right: (variant.innerPadding?.right ?? 0) / variant.right.width,
    };
    this.left.texture = crops[0];
    this.right.texture = crops[1];
    for (const texture of this.crops) texture.destroy(false);
    this.crops = crops;
    this.layer.visible = true;
  }
  resize(width: number, gameX: number, gameY: number, gameWidth: number, gameHeight: number) {
    const scale = gameWidth / 320;
    const rightMargin = Math.max(0, width - gameX - gameWidth);
    const leftOverlap = gameX > 0 ? Math.min(2 * scale, gameX * 0.15) : 0;
    const rightOverlap = rightMargin > 0 ? Math.min(2 * scale, rightMargin * 0.15) : 0;
    // Escala isotrópica: conservar la forma de cada columna, sin estirarla al margen.
    const leftScale = gameHeight / this.left.texture.height;
    const rightScale = gameHeight / this.right.texture.height;
    this.left.scale.set(leftScale);
    this.right.scale.set(rightScale);
    const leftBody = this.left.texture.width * (1 - this.innerFraction.left) * leftScale;
    const rightInset = this.right.texture.width * this.innerFraction.right * rightScale;
    this.left.position.set(gameX + leftOverlap - leftBody, gameY);
    this.right.position.set(gameX + gameWidth - rightOverlap - rightInset, gameY);
    this.left.visible = gameX > 0;
    this.right.visible = rightMargin > 0;
  }
}
