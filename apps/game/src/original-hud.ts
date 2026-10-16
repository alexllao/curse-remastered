import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { loadVisual, type VisualAsset } from './presentation.js';
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
export async function createOriginalHud(assets: OriginalHudAssets) {
  const original = { id: 'original', label: 'Original' };
  const visuals = await Promise.all(
    [assets.background, ...assets.icons, assets.blocked].map((a) => loadVisual(a, original)),
  );
  const layer = new Container();
  layer.eventMode = 'none';
  layer.visible = false;
  layer.addChild(new Sprite(visuals[0].texture));
  const icons = Array.from({ length: 10 }, (_, i) => {
    const s = new Sprite();
    s.position.set(i * 32 + 4, 4);
    layer.addChild(s);
    return s;
  });
  const crosses = Array.from({ length: 10 }, (_, i) => {
    const s = new Sprite(visuals.at(-1)!.texture);
    s.position.set(i * 32 + 4, 4);
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
      s.visible = !!cells[i];
      crosses[i].visible = cells[i]?.blocked === true;
    });
  }
  return {
    layer,
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
