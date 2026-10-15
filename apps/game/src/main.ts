import { Application, Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import {
  actorContact,
  originalActorOrder,
  originalForegroundOverlaps,
  type OrderedActor,
  advanceOriginalScroll,
  createWalkActor,
  followOriginalCamera,
  resolveOriginalContact,
  startOriginalWalk,
  stopOriginalWalk,
  tickOriginalWalk,
  type BoxRegion,
  type NavigationState,
  type WalkActor,
  type WalkProfile,
} from '@curse/engine';
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
  layers: {
    actors: (OrderedActor & { frame: number })[];
    foreground: { frame: number; x: number; y: number; width: number; height: number }[];
    assets: (VisualAsset & { frame: number })[];
  };
  navigation: {
    regions: BoxRegion[];
    state: NavigationState;
    spawn: { x: number; y: number; frame: number; cameraX: number; logicalRoomId: number } | null;
  };
}
interface Manifest {
  schemaVersion: number;
  scenes: SceneRecord[];
  player: VisualAsset[];
  navigationProfile: WalkProfile;
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
  rightButton = button('pan-right'),
  boundaryButton = button('boundaries');

async function start() {
  const response = await fetch('/manifest.json', { cache: 'no-store' });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
    throw new Error('Prepare local assets');
  const manifest: Manifest = await response.json();
  if (
    manifest.schemaVersion !== 4 ||
    manifest.player.length !== 27 ||
    manifest.scenes.length !== 78 ||
    !manifest.navigationProfile?.programs.length ||
    manifest.scenes.some(
      (s) => !s.navigation || !s.layers || s.background.width < 320 || s.background.height !== 200,
    )
  )
    throw new Error('Repeat local navigation preparation');
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
    effectsLayer = new Container(),
    actorsLayer = new Container(),
    foregroundLayer = new Container(),
    limits = new Graphics();
  effectsLayer.eventMode = 'none'; // Capa independiente reservada para futuras animaciones.
  limits.eventMode = 'none';
  let sceneIndex = Math.max(
    0,
    manifest.scenes.findIndex((s) => s.id === 70),
  );
  let packs = await discoverPacks(),
    pack: GraphicsPack = packs.find((p) => p.id === 'original')!;
  let visual = await loadVisual(manifest.scenes[sceneIndex].background, pack);
  const player = await Promise.all(
    manifest.player.map((asset) => loadVisual({ ...asset, remaster: false }, pack)),
  );
  const background = new Sprite(visual.texture),
    ben = new Sprite(player[9].texture);
  ben.anchor.set(0, 0);
  const destination = new Graphics().circle(0, 0, 2).stroke({ color: 0xe9c780, width: 0.7 });
  destination.visible = false;
  actorsLayer.addChild(ben);
  sceneContent.addChild(
    background,
    effectsLayer,
    actorsLayer,
    foregroundLayer,
    limits,
    destination,
  );
  const clip = new Graphics().rect(0, 0, 320, 200).fill(0xffffff);
  world.addChild(sceneContent, clip);
  world.mask = clip;
  world.eventMode = 'static';
  world.hitArea = new Rectangle(0, 0, 320, 200);
  world.cursor = 'pointer';
  app.stage.addChild(world);
  const fps = document.createElement('span');
  fps.id = 'fps';
  fps.setAttribute('aria-hidden', 'true');
  fps.textContent = '— FPS';
  viewport.replaceChildren(app.canvas, fps);
  const resize = () => fitPresentation(app, world, viewport);
  new ResizeObserver(resize).observe(viewport);
  resize();
  const scene = () => manifest.scenes[sceneIndex];
  async function loadLayers(record: SceneRecord) {
    const assets = await Promise.all(
      record.layers.assets.map(async (asset) => ({
        asset,
        visual: await loadVisual({ ...asset, remaster: false }, pack),
      })),
    );
    const texture = (frame: number) => {
      const entry = assets.find((entry) => entry.asset.frame === frame);
      if (!entry) throw new Error('Missing original scene layer');
      return entry.visual.texture;
    };
    const objects = record.layers.actors
      .filter((a) => a.flags !== 0 && !(a.flags & 2) && a.frame !== 255)
      .map((a) => {
        const sprite = new Sprite(texture(a.frame & 127));
        sprite.width = a.width;
        sprite.height = a.height;
        sprite.scale.x = Math.abs(sprite.scale.x) * (a.frame & 128 ? -1 : 1);
        sprite.position.set(a.x + (a.frame & 128 ? a.width : 0), a.y);
        sprite.eventMode = 'none';
        return { slot: a.slot, sprite };
      });
    const foreground = record.layers.foreground.map((piece) => {
      const sprite = new Sprite(texture(piece.frame));
      sprite.position.set(piece.x, piece.y);
      sprite.width = piece.width;
      sprite.height = piece.height;
      sprite.eventMode = 'none';
      return { ...piece, sprite };
    });
    return { objects, foreground };
  }
  let layerView = await loadLayers(scene());
  let depthOrder = Array.from({ length: 69 }, (_, i) => i + 1);
  function installLayers(next: typeof layerView) {
    for (const child of actorsLayer.removeChildren()) if (child !== ben) child.destroy();
    for (const child of foregroundLayer.removeChildren()) child.destroy();
    layerView = next;
    actorsLayer.addChild(ben);
    for (const item of layerView.objects) actorsLayer.addChild(item.sprite);
    for (const item of layerView.foreground) foregroundLayer.addChild(item.sprite);
  }
  installLayers(layerView);

  const actors = new Map<number, WalkActor | null>(),
    cameras = new Map<number, number>();
  let actor: WalkActor | null = null,
    cameraX = 0,
    renderCameraX = 0,
    scrollElapsed = 0,
    changing = false,
    selectingPack = false,
    showLimits = false,
    elapsed = 0,
    fpsElapsed = 0,
    fpsFrames = 0;
  function resetActor() {
    const spawn = scene().navigation.spawn;
    actor = spawn ? createWalkActor(spawn.x + spawn.cameraX, spawn.y, spawn.frame) : null;
    cameraX = spawn ? Math.max(0, Math.min(scene().background.width - 320, spawn.cameraX)) : 0;
    renderCameraX = cameraX;
    scrollElapsed = 0;
    elapsed = 0;
    destination.visible = false;
  }
  function describe() {
    status.textContent = actor
      ? 'Haz clic para caminar. Las acciones y salidas se señalarán sin ejecutarlas.'
      : 'La entrada usa una animación especial. Pulsa suelo libre para colocar a Ben y probar el paseo normal.';
  }
  function drawLimits() {
    limits.clear();
    limits.visible = showLimits;
    if (!showLimits) return;
    for (const region of scene().navigation.regions) {
      const color = region.type === 0 ? 0xea675a : region.type === 2 ? 0x6ec8ee : 0xf1c762;
      limits
        .rect(
          region.left,
          region.top,
          Math.max(1, region.right - region.left + 1),
          Math.max(1, region.bottom - region.top + 1),
        )
        .fill({ color, alpha: 0.1 })
        .stroke({ color, alpha: 0.65, width: 0.35 });
    }
  }
  function sync() {
    background.width = scene().background.width;
    background.height = 200;
    sceneContent.x = -renderCameraX;
    ben.visible = actor !== null;
    if (actor) {
      const frame = actor.frame & 127;
      if (frame >= player.length) throw new Error('Frame outside normal STD walk');
      ben.texture = player[frame].texture;
      ben.width = 32;
      ben.height = 48;
      ben.scale.x = Math.abs(ben.scale.x) * (actor.frame & 128 ? -1 : 1);
      ben.position.set(actor.x + (actor.frame & 128 ? 32 : 0), actor.y);
    }
    const slots: OrderedActor[] = [
      {
        slot: 1,
        flags: actor ? 1 : 0,
        x: actor?.x ?? 0,
        y: actor?.y ?? 0,
        width: 32,
        height: 48,
        depthOffset: 0,
      },
      ...scene().layers.actors,
    ];
    depthOrder = originalActorOrder(slots, depthOrder);
    let drawIndex = 0;
    for (const slot of depthOrder) {
      const sprite =
        slot === 1 ? ben : layerView.objects.find((item) => item.slot === slot)?.sprite;
      if (sprite) actorsLayer.setChildIndex(sprite, drawIndex++);
    }
    for (const piece of layerView.foreground)
      piece.sprite.visible = originalForegroundOverlaps(piece, slots);
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
    boundaryButton.textContent = showLimits ? 'Ocultar límites' : 'Mostrar límites';
    boundaryButton.setAttribute('aria-pressed', String(showLimits));
  }
  function pan(direction: number) {
    if (changing) return;
    if (actor) stopOriginalWalk(actor);
    destination.visible = false;
    cameraX = Math.max(0, Math.min(scene().background.width - 320, cameraX + direction * 32));
    cameras.set(scene().id, cameraX);
    sync();
  }
  async function show(nextScene: number, nextPack: GraphicsPack) {
    if (changing) return;
    changing = true;
    sync();
    try {
      const nextLayers =
        nextScene === sceneIndex ? null : await loadLayers(manifest.scenes[nextScene]);
      const loaded = await loadVisual(manifest.scenes[nextScene].background, nextPack);
      const previous = visual,
        moved = nextScene !== sceneIndex;
      if (moved) {
        if (actor) stopOriginalWalk(actor);
        actors.set(scene().id, actor);
        cameras.set(scene().id, cameraX);
      }
      visual = loaded;
      sceneIndex = nextScene;
      pack = nextPack;
      background.texture = loaded.texture;
      if (nextLayers) installLayers(nextLayers);
      if (moved) {
        if (actors.has(scene().id)) {
          actor = actors.get(scene().id)!;
          cameraX = cameras.get(scene().id) ?? 0;
          renderCameraX = cameraX;
          scrollElapsed = 0;
        } else resetActor();
        destination.visible = false;
        elapsed = 0;
        drawLimits();
      }
      if (previous.disposable) previous.texture.destroy(true);
      describe();
    } catch {
      status.textContent = 'No se ha podido cargar el fondo. Se conserva la vista anterior.';
    } finally {
      changing = false;
      sync();
    }
  }
  async function nextPack() {
    if (changing || selectingPack) return;
    selectingPack = true;
    try {
      packs = await discoverPacks();
      const current = packs.findIndex((p) => p.id === pack.id);
      await show(sceneIndex, packs[(current + 1) % packs.length]);
    } finally {
      selectingPack = false;
    }
  }
  const nextScene = (direction: number) =>
    show((sceneIndex + direction + manifest.scenes.length) % manifest.scenes.length, pack);
  world.on('pointertap', (event) => {
    if (changing || renderCameraX !== cameraX) return;
    const local = world.toLocal(event.global),
      point = { x: Math.trunc(local.x + renderCameraX), y: Math.trunc(local.y) };
    if (point.x < 0 || point.x >= scene().background.width || point.y < 0 || point.y >= 200) return;
    if (!actor) {
      const candidate = createWalkActor(point.x - 15, point.y - 47);
      if (actorContact(candidate, scene().navigation.regions, scene().navigation.state).code) {
        status.textContent = 'Ese punto toca un límite o una acción. Prueba en suelo libre.';
        return;
      }
      actor = candidate;
      status.textContent =
        'Ben colocado para probar el paseo normal; la entrada especial sigue pendiente.';
      sync();
      return;
    }
    startOriginalWalk(actor, point, manifest.navigationProfile);
    if (!actor.remaining || (actor.remaining === 1 && !actor.minorX && !actor.minorY)) {
      if (actor.remaining === 1) stopOriginalWalk(actor);
      destination.visible = false;
      status.textContent = 'Ben ya está ahí.';
      return;
    }
    elapsed = 0;
    destination.position.set(point.x, point.y);
    destination.visible = !!actor.remaining;
    status.textContent = 'Probando el recorrido de Ben…';
  });
  app.ticker.add((ticker) => {
    fpsElapsed += ticker.elapsedMS;
    fpsFrames++;
    if (fpsElapsed >= 500) {
      fps.textContent = `${Math.round((fpsFrames * 1000) / fpsElapsed)} FPS`;
      fpsElapsed = fpsFrames = 0;
    }
    if (changing) return;
    if (renderCameraX !== cameraX) {
      scrollElapsed += Math.min(ticker.deltaMS, 100);
      while (scrollElapsed >= 1000 / 60 && renderCameraX !== cameraX) {
        scrollElapsed -= 1000 / 60;
        renderCameraX = advanceOriginalScroll(renderCameraX, cameraX);
      }
      elapsed = 0;
      sync();
      return;
    }
    scrollElapsed = 0;
    if (!actor) return;
    elapsed += Math.min(ticker.deltaMS, 100);
    while (elapsed >= 100) {
      elapsed -= 100;
      if (!actor.remaining && !actor.channels.length) break;
      const previous = { x: actor.x, y: actor.y },
        wasWalking = !!actor.remaining;
      tickOriginalWalk(actor, manifest.navigationProfile);
      const contact = resolveOriginalContact(
        actor,
        previous,
        scene().navigation.regions,
        scene().navigation.state,
      );
      cameraX = followOriginalCamera(actor.x, cameraX, scene().background.width);
      cameras.set(scene().id, cameraX);
      if (contact.code && contact.code !== 1)
        status.textContent =
          contact.code === 2
            ? 'Aquí se activa una salida o secuencia. Se ha detenido el paseo para conservar la escena de prueba.'
            : contact.code === 16
              ? 'Esta zona necesita un estado todavía pendiente de verificar. Se ha detenido el paseo.'
              : 'Aquí se activa una acción especial. Se señala sin ejecutarla.';
      else if (wasWalking && !actor.remaining)
        status.textContent =
          contact.code === 1
            ? 'Ben se ha detenido ante un límite del escenario.'
            : 'Recorrido terminado.';
      if (!actor.remaining) destination.visible = false;
      if (renderCameraX !== cameraX) break;
    }
    sync();
  });
  modeButton.addEventListener('click', () => void nextPack());
  nextButton.addEventListener('click', () => void nextScene(1));
  previousButton.addEventListener('click', () => void nextScene(-1));
  leftButton.addEventListener('click', () => pan(-1));
  rightButton.addEventListener('click', () => pan(1));
  boundaryButton.addEventListener('click', () => {
    showLimits = !showLimits;
    drawLimits();
    sync();
  });
  restartButton.addEventListener('click', () => {
    if (!changing) {
      resetActor();
      sync();
      describe();
    }
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
  resetActor();
  drawLimits();
  sync();
  describe();
}
void start().catch((error) => {
  console.error('Unable to start local walking viewer', error);
  viewport.innerHTML =
    '<p id="loading">Prepara los datos de navegación y los recursos locales con las instrucciones de mods/README.md y vuelve a cargar.</p>';
  status.textContent = 'La prueba todavía no ha podido iniciarse.';
});
