import { Application, Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import { containsPoint, facingTowards, moveTowards, type Facing } from '@curse/engine';
import {
  discoverPacks,
  fitPresentation,
  loadVisual,
  type GraphicsPack,
  type VisualAsset,
} from './presentation.js';
import './style.css';

interface SceneRecord {
  id: number;
  name: string;
  background: VisualAsset;
  animationLayers: unknown[];
}
interface Manifest {
  scenes: SceneRecord[];
  player: VisualAsset[];
}
const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const modeLabel = document.querySelector<HTMLParagraphElement>('#mode')!;
const sceneLabel = document.querySelector<HTMLParagraphElement>('#scene-name')!;
const button = (id: string) => document.querySelector<HTMLButtonElement>(`#${id}`)!;
const modeButton = button('visual-mode'),
  restartButton = button('restart'),
  nextButton = button('next-scene'),
  previousButton = button('previous-scene'),
  leftButton = button('pan-left'),
  rightButton = button('pan-right');

async function start() {
  const response = await fetch('/manifest.json', { cache: 'no-store' });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
    throw new Error('Prepare local assets');
  const manifest: Manifest = await response.json();
  if (
    manifest.player.length !== 27 ||
    !manifest.scenes?.length ||
    manifest.scenes.some((scene) => scene.background.width < 320 || scene.background.height !== 200)
  )
    throw new Error('Invalid local manifest');
  const app = new Application();
  await app.init({
    width: 320,
    height: 200,
    background: '#000000',
    antialias: false,
    resolution: 1,
  });
  const world = new Container(),
    sceneContent = new Container(),
    effectsLayer = new Container();
  effectsLayer.eventMode = 'none'; // Reservada para futuras capas de animación independientes del fondo.
  let sceneIndex = Math.max(
    0,
    manifest.scenes.findIndex((scene) => scene.id === 70),
  );
  let packs = await discoverPacks(),
    pack: GraphicsPack = packs.find((p) => p.id === 'original')!;
  let visual = await loadVisual(manifest.scenes[sceneIndex].background, pack);
  const player = await Promise.all(
    manifest.player.map((asset) => loadVisual({ ...asset, remaster: false }, pack)),
  );
  const background = new Sprite(visual.texture),
    ben = new Sprite(player[9].texture);
  ben.anchor.set(0.5, 1);
  const destination = new Graphics().circle(0, 0, 2).stroke({ color: 0xe9c780, width: 0.7 });
  destination.visible = false;
  sceneContent.addChild(background, effectsLayer, destination, ben);
  const clip = new Graphics().rect(0, 0, 320, 200).fill(0xffffff);
  world.addChild(sceneContent, clip);
  world.mask = clip;
  world.eventMode = 'static';
  world.hitArea = new Rectangle(0, 0, 320, 200);
  app.stage.addChild(world);
  const fps = document.createElement('span');
  fps.id = 'fps';
  fps.setAttribute('aria-hidden', 'true');
  fps.textContent = '— FPS';
  viewport.replaceChildren(app.canvas, fps);
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
    changing = false,
    cameraX = 0,
    fpsElapsed = 0,
    fpsFrames = 0;
  const cameras = new Map<number, number>();
  const scene = () => manifest.scenes[sceneIndex];
  function setFrame(index: number) {
    ben.texture = player[index].texture;
    ben.width = manifest.player[index].width;
    ben.height = manifest.player[index].height;
    ben.scale.x = Math.abs(ben.scale.x) * (facing === 'left' ? -1 : 1);
  }
  function sync() {
    background.width = scene().background.width;
    background.height = 200;
    sceneContent.x = -cameraX;
    ben.visible = scene().id === 70;
    world.cursor = ben.visible ? 'pointer' : 'default';
    sceneLabel.textContent = `${scene().name} · ${sceneIndex + 1} de ${manifest.scenes.length}`;
    modeButton.textContent = `F2 · ${pack.label}`;
    modeLabel.textContent =
      pack.label +
      (visual.fallback
        ? ` · ${visual.usedPack === 'original' ? 'Original' : visual.usedPack} donde falta`
        : '');
    for (const b of [modeButton, nextButton, previousButton, restartButton]) b.disabled = changing;
    leftButton.disabled = changing || cameraX === 0;
    rightButton.disabled = changing || cameraX >= scene().background.width - 320;
  }
  function describe() {
    status.textContent =
      scene().id === 70
        ? 'Haz clic en la alfombra para mover a Ben.'
        : 'Vista de fondo. F3 cambia de escenario; las flechas recorren los panoramas.';
  }
  function pan(direction: number) {
    if (changing) return;
    cameraX = Math.max(0, Math.min(scene().background.width - 320, cameraX + direction * 32));
    cameras.set(scene().id, cameraX);
    sync();
  }
  async function show(nextScene: number, nextPack: GraphicsPack) {
    if (changing) return;
    changing = true;
    sync();
    try {
      const loaded = await loadVisual(manifest.scenes[nextScene].background, nextPack);
      const previous = visual;
      visual = loaded;
      const moved = nextScene !== sceneIndex;
      sceneIndex = nextScene;
      pack = nextPack;
      background.texture = loaded.texture;
      if (moved) {
        walking = false;
        target = { ...position };
        destination.visible = false;
        cameraX = cameras.get(scene().id) ?? 0;
      }
      if (previous.disposable) previous.texture.destroy(true);
      describe();
      if (loaded.fallback)
        status.textContent = `${scene().name}: se muestra ${loaded.usedPack === 'original' ? 'el original' : loaded.usedPack} porque no hay una versión válida en ${pack.label}.`;
    } catch {
      status.textContent = 'No se ha podido cargar el fondo. Se conserva la vista anterior.';
    } finally {
      changing = false;
      sync();
    }
  }
  async function nextPack() {
    if (changing) return;
    packs = await discoverPacks();
    const current = packs.findIndex((p) => p.id === pack.id);
    await show(sceneIndex, packs[(current + 1) % packs.length]);
  }
  function nextScene(direction: number) {
    return show((sceneIndex + direction + manifest.scenes.length) % manifest.scenes.length, pack);
  }
  world.on('pointertap', (event) => {
    if (changing || scene().id !== 70) return;
    const local = world.toLocal(event.global),
      point = { x: local.x + cameraX, y: local.y };
    if (!containsPoint(floor, point)) {
      status.textContent = 'Por ahora, Ben puede caminar por la alfombra.';
      return;
    }
    target = point;
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
    if (walking) {
      const seconds = Math.min(ticker.deltaMS / 1000, 0.1);
      position = moveTowards(position, target, 42, seconds);
      clock += seconds;
      if (position.x === target.x && position.y === target.y) {
        walking = false;
        destination.visible = false;
        describe();
      }
    }
    const base = facing === 'up' ? 18 : facing === 'down' ? 9 : 0;
    setFrame(walking ? base + 1 + (Math.floor(clock * 9) % 8) : base);
    ben.position.set(Math.round(position.x), Math.round(position.y));
  });
  modeButton.addEventListener('click', () => void nextPack());
  nextButton.addEventListener('click', () => void nextScene(1));
  previousButton.addEventListener('click', () => void nextScene(-1));
  leftButton.addEventListener('click', () => pan(-1));
  rightButton.addEventListener('click', () => pan(1));
  restartButton.addEventListener('click', () => {
    if (changing) return;
    position = { x: 177, y: 174 };
    target = { ...position };
    walking = false;
    facing = 'down';
    destination.visible = false;
    cameraX = 0;
    cameras.set(scene().id, 0);
    sync();
    describe();
  });
  window.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'F2') {
      event.preventDefault();
      if (!event.repeat) void nextPack();
    }
    if (event.key === 'F3') {
      event.preventDefault();
      if (!event.repeat) void nextScene(event.shiftKey ? -1 : 1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      pan(-1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      pan(1);
    }
  });
  button('fullscreen').addEventListener('click', () => {
    void (
      document.fullscreenElement ? document.exitFullscreen() : viewport.requestFullscreen()
    ).catch(() => {
      status.textContent = 'La pantalla completa no está disponible en esta ventana.';
    });
  });
  sync();
  describe();
}
void start().catch((error) => {
  console.error('Unable to start local gallery', error);
  viewport.innerHTML =
    '<p id="loading">No se ha podido abrir la escena. Prepara los recursos locales con las instrucciones de mods/README.md y vuelve a cargar la página.</p>';
  status.textContent = 'La prueba todavía no ha podido iniciarse.';
});
