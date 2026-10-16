import { panelBounds } from './frame-layout.js';
import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
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
  fit?: 'height' | 'cover';
  mirrorRight?: boolean;
  innerPadding?: { left: number; right: number };
}
export interface FrameChoice {
  id: string;
  label: string;
  contexts?: string[];
  variants: Record<string, FrameVariant>;
}
export async function discoverFrames(): Promise<FrameChoice[]> {
  try {
    const response = await fetch('/__assets/frames.json', { cache: 'no-store' });
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
  private cover = false;
  private mirrorRight = false;
  private clip = new Graphics();
  private innerFraction = { left: 0, right: 0 };
  private crops: Texture[] = [];
  private previous: { layer: Container; crops: Texture[] } | null = null;
  private elapsed = 0;
  private readonly fadeMs = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320;
  private finishFade() {
    if (this.previous) {
      this.previous.layer.destroy({ children: true });
      for (const texture of this.previous.crops) texture.destroy(false);
      this.previous = null;
    }
    this.left.alpha = this.right.alpha = 1;
  }
  tick(deltaMs: number) {
    if (!this.previous) return;
    this.elapsed += deltaMs;
    const t = Math.min(1, this.elapsed / this.fadeMs);
    const alpha = t * t * (3 - 2 * t);
    this.left.alpha = this.right.alpha = alpha;
    // La capa anterior queda opaca debajo para evitar un destello oscuro.
    this.previous.layer.alpha = 1;
    if (t === 1) this.finishFade();
  }
  constructor() {
    this.layer.eventMode = 'none';
    this.layer.visible = false;
    this.layer.addChild(this.left, this.right, this.clip);
    this.layer.mask = this.clip;
  }
  async show(variant: FrameVariant | undefined, pixelArt: boolean) {
    const generation = ++this.generation;
    if (!variant) {
      this.finishFade();
      this.layer.visible = false;
      return;
    }
    const base = await Assets.load<Texture>(variant.url);
    if (generation !== this.generation) return;
    this.finishFade();
    const previousCrops = this.crops;
    if (this.layer.visible && previousCrops.length && this.fadeMs) {
      const previous = new Container();
      for (const current of [this.left, this.right]) {
        const copy = new Sprite(current.texture);
        copy.position.copyFrom(current.position);
        copy.scale.copyFrom(current.scale);
        copy.visible = current.visible;
        previous.addChild(copy);
      }
      this.layer.addChildAt(previous, 0);
      this.previous = { layer: previous, crops: previousCrops };
      this.elapsed = 0;
      this.left.alpha = this.right.alpha = 0;
    }
    base.source.scaleMode = pixelArt ? 'nearest' : 'linear';
    const crops = [variant.left, variant.right].map(
      (panel) =>
        new Texture({
          source: base.source,
          frame: new Rectangle(panel.x, panel.y, panel.width, panel.height),
        }),
    );
    this.cover = variant.fit === 'cover';
    this.mirrorRight = variant.mirrorRight === true;
    this.innerFraction = {
      left: (variant.innerPadding?.left ?? 0) / variant.left.width,
      right: (variant.innerPadding?.right ?? 0) / variant.right.width,
    };
    this.left.texture = crops[0];
    this.right.texture = crops[1];
    if (!this.previous) for (const texture of previousCrops) texture.destroy(false);
    this.crops = crops;
    this.layer.visible = true;
  }
  resize(width: number, gameX: number, gameY: number, gameWidth: number, gameHeight: number) {
    const scale = gameWidth / 320;
    const rightMargin = Math.max(0, width - gameX - gameWidth);
    const leftOverlap = gameX > 0 ? Math.min(2 * scale, gameX * 0.15) : 0;
    const rightOverlap = rightMargin > 0 ? Math.min(2 * scale, rightMargin * 0.15) : 0;
    this.clip.clear().rect(0, gameY, width, gameHeight).fill(0xffffff);
    for (const [sprite, right, margin, overlap, padding] of [
      [this.left, false, gameX, leftOverlap, this.innerFraction.left],
      [this.right, true, rightMargin, rightOverlap, this.innerFraction.right],
    ] as const) {
      const bounds = panelBounds(
        sprite.texture.width,
        sprite.texture.height,
        padding * sprite.texture.width,
        margin,
        overlap,
        gameY,
        gameHeight,
        right ? gameX + gameWidth : gameX,
        right,
        this.cover,
      );
      const mirrored = right && this.mirrorRight;
      sprite.scale.set(mirrored ? -bounds.scale : bounds.scale, bounds.scale);
      sprite.position.set(
        bounds.x + (mirrored ? sprite.texture.width * bounds.scale : 0),
        bounds.y,
      );
    }
    this.left.visible = gameX > 0;
    this.right.visible = rightMargin > 0;
  }
}
