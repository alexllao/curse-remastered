import { Application, Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import { containsPoint, facingTowards, moveTowards, type Facing } from '@curse/engine';
import {
  fitPresentation,
  loadVisual,
  PRESENTATION_MODES,
  type VisualAsset,
} from './presentation.js';
import './style.css';

interface Manifest {
  background: VisualAsset;
  player: VisualAsset[];
}
const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const modeLabel = document.querySelector<HTMLParagraphElement>('#mode')!;
const modeButton = document.querySelector<HTMLButtonElement>('#visual-mode')!;
const restartButton = document.querySelector<HTMLButtonElement>('#restart')!;
const fullscreenButton = document.querySelector<HTMLButtonElement>('#fullscreen')!;

async function start() {
  const response = await fetch('/manifest.json');
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
    throw new Error('Local assets are not prepared');
  const manifest: Manifest = await response.json();
  if (
    manifest.player.length !== 27 ||
    manifest.background.width !== 320 ||
    manifest.background.height !== 200
  )
    throw new Error('Invalid playtest manifest');
  const app = new Application();
  await app.init({
    width: 320,
    height: 200,
    background: '#000000',
    antialias: false,
    resolution: 1,
  });
  const world = new Container();
  const original = await Promise.all(
    [manifest.background, ...manifest.player].map((asset) => loadVisual(asset, 'original')),
  );
  let visuals = original;
  const background = new Sprite(original[0].texture);
  background.width = 320;
  background.height = 200;
  const ben = new Sprite(original[10].texture);
  ben.anchor.set(0.5, 1);
  const destination = new Graphics().circle(0, 0, 2).stroke({ color: 0xe9c780, width: 0.7 });
  destination.visible = false;
  world.addChild(background, destination, ben);
  world.eventMode = 'static';
  world.hitArea = new Rectangle(0, 0, 320, 200);
  world.cursor = 'pointer';
  app.stage.addChild(world);
  const fps = document.createElement('span');
  fps.id = 'fps';
  fps.setAttribute('aria-hidden', 'true');
  fps.textContent = '— FPS';
  viewport.replaceChildren(app.canvas, fps);
  let fpsElapsed = 0,
    fpsFrames = 0;
  const resize = () => fitPresentation(app, world, viewport);
  new ResizeObserver(resize).observe(viewport);
  resize();
  const floor = [
    { x: 126, y: 156 },
    { x: 207, y: 151 },
    { x: 260, y: 168 },
    { x: 220, y: 191 },
    { x: 128, y: 181 },
  ];
  let position = { x: 177, y: 174 },
    target = { ...position },
    facing: Facing = 'down',
    walking = false,
    clock = 0,
    modeIndex = 0,
    changing = false;
  function setFrame(index: number) {
    ben.texture = visuals[index + 1].texture;
    ben.width = manifest.player[index].width;
    ben.height = manifest.player[index].height;
    ben.scale.x = Math.abs(ben.scale.x) * (facing === 'left' ? -1 : 1);
  }
  function reset() {
    position = { x: 177, y: 174 };
    target = { ...position };
    facing = 'down';
    walking = false;
    clock = 0;
    destination.visible = false;
    status.textContent = 'Haz clic en la alfombra para mover a Ben.';
  }
  world.on('pointertap', (event) => {
    const point = world.toLocal(event.global);
    if (!containsPoint(floor, point)) {
      status.textContent = 'Por ahora, Ben puede caminar por la alfombra.';
      return;
    }
    target = { x: point.x, y: point.y };
    facing = facingTowards(position, target);
    walking = true;
    clock = 0;
    destination.position.set(target.x, target.y);
    destination.visible = true;
    status.textContent = 'Ben camina hacia el punto elegido.';
  });
  app.ticker.add((ticker) => {
    fpsElapsed += ticker.elapsedMS;
    fpsFrames++;
    if (fpsElapsed >= 500) {
      fps.textContent = `${Math.round((fpsFrames * 1000) / fpsElapsed)} FPS`;
      fpsElapsed = 0;
      fpsFrames = 0;
    }
    const seconds = Math.min(ticker.deltaMS / 1000, 0.1);
    if (walking) {
      position = moveTowards(position, target, 42, seconds);
      clock += seconds;
      if (position.x === target.x && position.y === target.y) {
        walking = false;
        destination.visible = false;
        status.textContent = 'Haz clic en otro punto de la alfombra para seguir explorando.';
      }
    }
    const base = facing === 'up' ? 18 : facing === 'down' ? 9 : 0;
    setFrame(walking ? base + 1 + (Math.floor(clock * 9) % 8) : base);
    ben.position.set(Math.round(position.x), Math.round(position.y));
  });
  async function changeMode() {
    if (changing) return;
    changing = true;
    modeButton.disabled = true;
    const next = (modeIndex + 1) % PRESENTATION_MODES.length,
      mode = PRESENTATION_MODES[next];
    try {
      const loaded = await Promise.all(
        [manifest.background, ...manifest.player].map((asset) => loadVisual(asset, mode.id)),
      );
      const previous = visuals;
      visuals = loaded;
      modeIndex = next;
      background.texture = loaded[0].texture;
      background.width = 320;
      background.height = 200;
      setFrame(facing === 'up' ? 18 : facing === 'down' ? 9 : 0);
      for (const visual of previous) if (visual.disposable) visual.texture.destroy(true);
      modeButton.textContent = `F2 · ${mode.label}`;
      const fallback = loaded.filter((visual) => visual.fallback).length;
      modeLabel.textContent =
        mode.label +
        (mode.id === 'remaster' && fallback ? ' · Original interpolado donde falta' : '');
      status.textContent =
        mode.id === 'remaster'
          ? loaded[0].fallback
            ? 'Fondo remasterizado aún no disponible: se muestra el original interpolado.'
            : 'Fondo remasterizado cargado. Los sprites pendientes usan el original interpolado.'
          : 'Haz clic en la alfombra para mover a Ben.';
    } catch {
      status.textContent =
        'No se ha podido cargar este modo. Se mantiene la presentación anterior.';
    } finally {
      changing = false;
      modeButton.disabled = false;
    }
  }
  modeButton.disabled = false;
  restartButton.disabled = false;
  modeButton.addEventListener('click', () => void changeMode());
  restartButton.addEventListener('click', reset);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'F2') {
      event.preventDefault();
      if (!event.repeat) void changeMode();
    }
  });
  fullscreenButton.addEventListener('click', () => {
    const action = document.fullscreenElement
      ? document.exitFullscreen()
      : viewport.requestFullscreen();
    void action.catch(() => {
      status.textContent = 'La pantalla completa no está disponible en esta ventana.';
    });
  });
}
void start().catch(() => {
  viewport.innerHTML =
    '<p id="loading">Faltan los recursos locales de la prueba. Sigue la preparación descrita en mods/README.md y vuelve a cargar esta página.</p>';
  status.textContent = 'La prueba todavía no ha podido iniciarse.';
});
