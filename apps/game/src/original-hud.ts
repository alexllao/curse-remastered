import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { loadVisual, type VisualAsset, type GraphicsPack } from './presentation.js';
import type { ActionCell } from '@curse/engine';
export interface OriginalHudAssets {
  background: VisualAsset;
  icons: VisualAsset[];
  cursors?: VisualAsset[];
  blocked: VisualAsset;
  selection: { xInset: number; yInset: number; width: number; height: number };
  selectionColor: number[];
  selectionAnimation?: { colors: number[][]; modalCyclesPerColor: number; referenceHz: number };
  initialBlocked: number[];
}
export async function createOriginalHud(
  assets: OriginalHudAssets,
  pack: GraphicsPack = { id: 'original', label: 'Original' },
) {
  const cache = new Map<string, Promise<Awaited<ReturnType<typeof loadVisual>>[]>>();
  function preparePack(next: GraphicsPack) {
    let pending = cache.get(next.id);
    if (!pending) {
      pending = Promise.all(
        [assets.background, ...assets.icons, assets.blocked].map((asset) =>
          loadVisual({ ...asset, remaster: true }, next),
        ),
      );
      cache.set(next.id, pending);
    }
    return pending;
  }
  let visuals = await preparePack(pack);
  const layer = new Container();
  layer.eventMode = 'none';
  layer.visible = false;
  const background = new Sprite(visuals[0].texture);
  background.width = assets.background.width;
  background.height = assets.background.height;
  layer.addChild(background);
  const icons = Array.from({ length: 10 }, (_, i) => {
    const s = new Sprite();
    s.position.set(i * 32 + 4, 4);
    layer.addChild(s);
    return s;
  });
  const crosses = Array.from({ length: 10 }, (_, i) => {
    const s = new Sprite(visuals.at(-1)!.texture);
    s.position.set(i * 32 + 4, 4);
    s.width = assets.blocked.width;
    s.height = assets.blocked.height;
    s.visible = false;
    layer.addChild(s);
    return s;
  });
  const border = new Graphics(),
    area = assets.selection;
  function drawBorder(color: number[]) {
    const [r, g, b] = color;
    border
      .clear()
      .rect(area.xInset + 0.5, area.yInset + 0.5, area.width - 1, area.height - 1)
      .stroke({ color: (r << 16) | (g << 8) | b, width: 1 });
  }
  drawBorder(assets.selectionColor);
  let colorElapsed = 0,
    colorIndex = 0,
    colorCounter = 1;
  layer.addChild(border);
  let selected = 0,
    cells: ActionCell[] = [];
  function move(x: number) {
    selected = Math.max(0, Math.min(9, Math.floor(x / 32)));
    border.x = selected * 32;
  }
  function setEntries(entries: ActionCell[]) {
    cells = entries.slice(0, 10);
    icons.forEach((s, i) => {
      s.texture = visuals[(cells[i]?.icon ?? -1) + 1]?.texture ?? Texture.EMPTY;
      const asset = assets.icons[cells[i]?.icon ?? -1];
      if (asset) {
        s.width = asset.width;
        s.height = asset.height;
      }
      s.visible = !!cells[i];
      crosses[i].visible = cells[i]?.blocked === true;
    });
  }
  return {
    layer,
    async setPack(next: GraphicsPack) {
      visuals = await preparePack(next);
      background.texture = visuals[0].texture;
      background.width = assets.background.width;
      background.height = assets.background.height;
      for (const cross of crosses) {
        cross.texture = visuals.at(-1)!.texture;
        cross.width = assets.blocked.width;
        cross.height = assets.blocked.height;
      }
      setEntries(cells);
    },
    tick(deltaMs: number) {
      const animation = assets.selectionAnimation;
      if (!layer.visible || !animation) return;
      colorElapsed += Math.min(deltaMs, 100);
      const cycleMs = 1000 / animation.referenceHz;
      while (colorElapsed >= cycleMs) {
        colorElapsed -= cycleMs;
        if (--colorCounter > 0) continue;
        colorCounter = animation.modalCyclesPerColor;
        drawBorder(animation.colors[colorIndex]);
        colorIndex = (colorIndex + 1) % animation.colors.length;
      }
    },
    get visible() {
      return layer.visible;
    },
    open(x: number, y: number, entries: ActionCell[]) {
      colorElapsed = 0;
      colorIndex = 0;
      colorCounter = 1;
      drawBorder(assets.selectionColor);
      setEntries(entries);
      layer.y = y < 100 ? 0 : 168;
      move(x);
      layer.visible = true;
    },
    close() {
      layer.visible = false;
    },
    move,
    setEntries,
    step(direction: number) {
      move((selected + direction) * 32);
    },
    select(): number | null {
      return cells[selected] && !cells[selected].blocked ? selected : null;
    },
  };
}
