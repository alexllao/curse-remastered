import { Container, Graphics, Sprite } from 'pixi.js';
import { loadVisual } from './presentation.js';
import {
  originalInfoPage,
  originalInfoGlyph,
  withPortCredits,
  type OriginalInfoProfile,
} from './original-info-layout.js';

/** Texto y glifos originales; no usa fuentes web ni contenido nuevo del proyecto. */
export async function createOriginalInfo(profile: OriginalInfoProfile, onClose: () => void) {
  profile = withPortCredits(profile);
  const glyphs = await Promise.all(
    profile.glyphs.map((asset) => loadVisual(asset, { id: 'original', label: 'Original' })),
  );
  const layer = new Container();
  layer.eventMode = 'none';
  layer.visible = false;
  let page = 0,
    score = 0;
  function draw() {
    for (const child of layer.removeChildren()) child.destroy();
    const current = originalInfoPage(profile, page, score);
    layer.addChild(
      new Graphics().rect(current.x, current.y, current.width, current.height).fill(0),
    );
    current.rows.forEach((row, y) =>
      row.forEach((code, x) => {
        const glyph = originalInfoGlyph(code);
        const index = profile.mapping[glyph.code];
        if (index === undefined || index < 0 || !glyphs[index]) return;
        const sprite = new Sprite(glyphs[index].texture);
        sprite.position.set(
          current.x + profile.insetX + x * profile.advanceX,
          current.y + profile.insetY + y * profile.advanceY,
        );
        sprite.width = profile.glyphs[index].width;
        sprite.height = profile.glyphs[index].height;
        layer.addChild(sprite);
        if (glyph.accent) {
          const mark = new Graphics();
          const x = sprite.x + (glyph.accent === 'grave' ? 2 : 4);
          mark
            .rect(x, sprite.y - 2, 1, 1)
            .rect(x + (glyph.accent === 'grave' ? 1 : -1), sprite.y - 1, 1, 1)
            .fill(0xa6ceae);
          layer.addChild(mark);
        }
      }),
    );
  }
  function close() {
    if (!layer.visible) return;
    layer.visible = false;
    onClose();
  }
  return {
    layer,
    get visible() {
      return layer.visible;
    },
    show(value: number) {
      score = value;
      page = 0;
      draw();
      layer.visible = true;
    },
    advance() {
      if (!layer.visible) return;
      if (++page >= profile.pages.length) close();
      else draw();
    },
    close,
  };
}
