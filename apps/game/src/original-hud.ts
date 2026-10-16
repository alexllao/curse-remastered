import { Container, Graphics, Sprite } from 'pixi.js';
import { loadVisual, type VisualAsset } from './presentation.js';

export interface OriginalHudAssets {
  background: VisualAsset;
  icons: VisualAsset[];
  blocked: VisualAsset;
  selection: { xInset: number; yInset: number; width: number; height: number };
  selectionColor: number[];
  initialBlocked: number[];
}
/** Vista independiente de los futuros controladores de acciones y del menú web. */
export async function createOriginalHud(assets: OriginalHudAssets) {
  const originals = { id: 'original', label: 'Original' };
  const visuals = await Promise.all(
    [assets.background, ...assets.icons, assets.blocked].map((a) => loadVisual(a, originals)),
  );
  const layer = new Container();
  layer.eventMode = 'none';
  layer.visible = false;
  const background = new Sprite(visuals[0].texture);
  layer.addChild(background);
  const icons = assets.icons.map((asset, index) => {
    const sprite = new Sprite(visuals[index + 1].texture);
    sprite.position.set(index * 32 + 4, 4);
    layer.addChild(sprite);
    return sprite;
  });
  const blocked = assets.initialBlocked.map((index) => {
    const sprite = new Sprite(visuals.at(-1)!.texture);
    sprite.position.set(index * 32 + 4, 4);
    layer.addChild(sprite);
    return sprite;
  });
  const border = new Graphics();
  const [r, g, b] = assets.selectionColor;
  const area = assets.selection;
  border
    .rect(area.xInset + 0.5, area.yInset + 0.5, area.width - 1, area.height - 1)
    .stroke({ color: (r << 16) | (g << 8) | b, width: 1 });
  layer.addChild(border);
  let selected = 0;
  let inventory = false;
  function move(x: number) {
    selected = Math.max(0, Math.min(9, Math.floor(x / 32)));
    border.x = selected * 32;
  }
  return {
    layer,
    get visible() {
      return layer.visible;
    },
    open(x: number, y: number) {
      inventory = false;
      layer.y = y < 100 ? 0 : 168;
      icons.forEach((sprite) => {
        sprite.visible = true;
      });
      blocked.forEach((sprite) => {
        sprite.visible = true;
      });
      move(x);
      layer.visible = true;
    },
    close() {
      layer.visible = false;
    },
    move,
    step(direction: number) {
      move((selected + direction) * 32);
    },
    select(): number | null {
      if (inventory || assets.initialBlocked.includes(selected)) return null;
      if (selected === 0) {
        inventory = true;
        icons.forEach((sprite) => {
          sprite.visible = false;
        });
        blocked.forEach((sprite) => {
          sprite.visible = false;
        });
        return null;
      }
      layer.visible = false;
      return selected;
    },
  };
}
