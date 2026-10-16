import { chooseFrame } from './frame-layout.js';
import { Application, Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import {
  createDungeon,
  performDungeonAction,
  tickDungeon,
  walkDungeon,
  dungeonInventory,
  dungeonNearby,
  dungeonByte,
  dungeonWord,
  OriginalActionMenu,
  type DungeonState,
  type DungeonProfile,
  type ActionCommand,
  originalActorOrder,
  originalActorView,
  tickOriginalActors,
  type ActorPrograms,
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
import './welcome-menu.css';
import { createWelcomeMenu } from './welcome-menu.js';
import { DecorativeFrames, discoverFrames, frameVariant } from './decorative-frames.js';
import { createOriginalHud, type OriginalHudAssets } from './original-hud.js';
import { discoverSounds, SoundPlayer } from './sounds.js';
import { discoverMusic, initialMusicVersion, MusicPlayer, type MusicCatalog } from './music.js';

interface SceneRecord {
  id: number;
  name: string;
  background: VisualAsset;
  animationLayers: unknown[];
  animation?: ActorPrograms & {
    assets: (VisualAsset & { bank: number; frame: number })[];
    includePlayer: boolean;
    cyclePulses: number;
    referenceHz: number;
  };
  layers: {
    actors: (OrderedActor & { frame: number })[];
    foreground: { frame: number; x: number; y: number; width: number; height: number }[];
    assets: (VisualAsset & { frame: number })[];
  };
  navigation: {
    entryStatus: 'normal-walk-ready' | 'hidden-player' | 'special-entry';
    regions: BoxRegion[];
    state: NavigationState;
    spawn: { x: number; y: number; frame: number; cameraX: number; logicalRoomId: number } | null;
  };
}
interface PresentationEvent {
  tick: number;
  index: number;
  asset: VisualAsset;
  brightness: number;
}
interface Manifest {
  schemaVersion: number;
  scenes: SceneRecord[];
  title: VisualAsset;
  core: VisualAsset;
  startupPlayback: {
    holdTicks: number;
    durationTicks: number;
    referenceHz: number;
    events: { tick: number; brightness: number; asset: VisualAsset }[];
  };
  presentation: { name: string; asset: VisualAsset }[];
  player: VisualAsset[];
  presentationPlayback: {
    referenceHz: number;
    physicalTimingVerified: boolean;
    durationTicks: number;
    events: PresentationEvent[];
  };
  navigationProfile: WalkProfile;
  actorPrograms: number[];
  dungeon: DungeonProfile;
  originalHud: OriginalHudAssets;
}
const resourceLoading = document.querySelector<HTMLDivElement>('#resource-loading')!;
function setResourceLoading(message: string | null) {
  if (message) document.querySelector('#loading-message')!.textContent = message;
  resourceLoading.hidden = message === null;
  document.querySelector('main')!.setAttribute('aria-busy', String(message !== null));
}
function revealGame() {
  document.querySelector('main')!.hidden = false;
  setResourceLoading(null);
}
const silentPreview = new URLSearchParams(location.search).get('silent') === '1';
const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const modeLabel = document.querySelector<HTMLParagraphElement>('#mode')!;
const sceneLabel = document.querySelector<HTMLParagraphElement>('#scene-name')!;
const sceneSelect = document.querySelector<HTMLSelectElement>('#scene-select')!;
const button = (id: string) => document.querySelector<HTMLButtonElement>(`#${id}`)!;
const modeButton = button('visual-mode'),
  restartButton = button('restart'),
  nextButton = button('next-scene'),
  previousButton = button('previous-scene'),
  leftButton = button('pan-left'),
  rightButton = button('pan-right'),
  boundaryButton = button('boundaries');

async function start() {
  const response = await fetch('/__assets/game.json', { cache: 'no-store' });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
    throw new Error('Prepare local assets');
  const manifest: Manifest = await response.json();
  if (
    manifest.schemaVersion !== 7 ||
    !manifest.title ||
    !manifest.originalHud?.icons ||
    !manifest.core ||
    !manifest.startupPlayback?.events.length ||
    !manifest.actorPrograms?.length ||
    manifest.presentation?.length !== 16 ||
    !manifest.presentationPlayback?.events.length ||
    manifest.player.length !== 27 ||
    manifest.scenes.length !== 78 ||
    !manifest.navigationProfile?.programs.length ||
    manifest.scenes.some(
      (s) => !s.navigation || !s.layers || s.background.width < 320 || s.background.height !== 200,
    )
  )
    throw new Error('Repeat local navigation preparation');
  const gameClock = manifest.scenes.find((scene) => scene.id === 0)?.animation;
  if (!gameClock || gameClock.cyclePulses !== 5 || gameClock.referenceHz <= 0)
    throw new Error('Missing verified game clock');
  const gameCycleMs = (gameClock.cyclePulses * 1000) / gameClock.referenceHz;
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
  const staticScreens = [
    { name: 'TITLE — Bienvenida', asset: manifest.title },
    ...manifest.presentation.map((entry) => ({ ...entry, name: `Presentación — ${entry.name}` })),
  ];
  const screenCount = staticScreens.length + manifest.scenes.length;
  let sceneIndex = 0,
    staticIndex = 0,
    currentView = 0,
    showingStatic = true;
  sceneSelect.replaceChildren(
    ...staticScreens.map((record, index) => new Option(`${index} · ${record.name}`, String(index))),
    ...manifest.scenes.map(
      (record, index) =>
        new Option(
          `${staticScreens.length + index} · Escenario ${index + 1} — ${record.name}`,
          String(staticScreens.length + index),
        ),
    ),
  );
  let preferences: {
    graphics?: string;
    music?: string;
    musicBeforeMute?: string;
    effects?: string;
    volume?: number;
    intro?: boolean;
    sounds?: boolean;
    frame?: string;
    showFrame?: boolean;
  } = {};
  try {
    preferences = JSON.parse(localStorage.getItem('curse.preferences.v1') ?? '{}') ?? {};
  } catch {
    /* Preferencias locales opcionales. */
  }
  let packs = await discoverPacks(),
    pack: GraphicsPack =
      packs.find((p) => p.id === preferences.graphics) ??
      packs.find((p) => p.id === 'remaster') ??
      packs[0];
  const frameCatalog = await discoverFrames();
  let musicCatalog: MusicCatalog = { schemaVersion: 1, versions: [], contexts: {} };
  let musicCatalogFailed = false;
  try {
    musicCatalog = await discoverMusic();
  } catch {
    musicCatalogFailed = true;
  }
  const soundCatalog = await discoverSounds(),
    sounds = new SoundPlayer(soundCatalog);
  const soundSelect = document.querySelector<HTMLSelectElement>('#sounds-select')!;
  const soundVersions = soundCatalog.versions ?? [];
  soundSelect.replaceChildren(
    new Option('Sin efectos', 'none'),
    ...soundVersions.map((v) => new Option(v.label, v.id)),
  );
  soundSelect.value = soundVersions.some((v) => v.id === preferences.effects)
    ? preferences.effects!
    : preferences.sounds === false
      ? 'none'
      : soundVersions.some((v) => v.id === 'original')
        ? 'original'
        : 'none';
  function selectSounds() {
    sounds.select(soundSelect.value);
    if (silentPreview) sounds.enabled = false;
    const selected = soundVersions.find((v) => v.id === soundSelect.value);
    document.querySelector('#sound-note')!.textContent =
      selected && !Object.keys(selected.events).length
        ? 'Los efectos de este paquete aún no están vinculados al juego.'
        : '';
  }
  selectSounds();
  const frameSelect = document.querySelector<HTMLSelectElement>('#frame-select')!;
  const showFrame = document.querySelector<HTMLInputElement>('#show-frame')!;
  showFrame.checked = preferences.showFrame === true;
  frameSelect.replaceChildren(
    new Option('Automático · según escenario', 'auto'),
    ...frameCatalog.map((frame) => new Option(frame.label, frame.id)),
  );
  frameSelect.value =
    preferences.frame === 'auto' || frameCatalog.some((frame) => frame.id === preferences.frame)
      ? preferences.frame!
      : 'auto';
  showFrame.disabled = !frameCatalog.length;
  const menu = document.querySelector<HTMLElement>('#game-menu')!,
    graphicsSelect = document.querySelector<HTMLSelectElement>('#graphics-select')!,
    musicSelect = document.querySelector<HTMLSelectElement>('#music-select')!,
    volume = document.querySelector<HTMLInputElement>('#music-volume')!,
    introEnabled = document.querySelector<HTMLInputElement>('#intro-enabled')!,
    musicNote = document.querySelector<HTMLParagraphElement>('#music-note')!,
    startButton = button('start-game'),
    resumeButton = button('resume-game'),
    menuButton = button('open-menu'),
    skipButton = button('skip-intro');
  const welcomeMenu = createWelcomeMenu(soundCatalog, silentPreview);
  let menuOpen = false,
    gameStarted = false,
    startingGame = false,
    debugMode = false;
  const musicAudio = document.createElement('audio');
  musicAudio.id = 'music-output';
  musicAudio.hidden = true;
  musicAudio.muted = silentPreview;
  document.body.append(musicAudio);
  const music = new MusicPlayer(
    musicCatalog,
    (message) => {
      musicNote.textContent = message;
      welcomeMenu.setMusicHint(
        message.startsWith('Haz clic') ? 'Haz clic para activar la música' : '',
      );
    },
    musicAudio,
  );
  const gameToast = document.querySelector<HTMLElement>('#game-toast')!;
  let gameToastTimer: number | undefined;
  function notifyGame(message: string) {
    if (!gameStarted || menuOpen || debugMode) return;
    window.clearTimeout(gameToastTimer);
    gameToast.textContent = message;
    gameToast.hidden = false;
    gameToast.classList.remove('show');
    void gameToast.offsetWidth;
    gameToast.classList.add('show');
    gameToastTimer = window.setTimeout(() => {
      gameToast.hidden = true;
    }, 2600);
  }
  const toast = document.querySelector<HTMLElement>('#music-toast')!;
  let toastTimer: number | undefined;
  music.onTrackPlaying((label) => {
    welcomeMenu.setMusicHint('');
    toast.textContent = `♫ ${label}`;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4500);
  });
  graphicsSelect.replaceChildren(...packs.map((p) => new Option(p.label, p.id)));
  graphicsSelect.value = pack.id;
  musicSelect.replaceChildren(
    new Option('Sin música', 'none'),
    ...musicCatalog.versions.map((v) => new Option(v.label, v.id)),
  );
  musicSelect.value = initialMusicVersion(musicCatalog, preferences.music);
  let lastMusicVersion = initialMusicVersion(musicCatalog, preferences.musicBeforeMute);

  volume.value = String(
    typeof preferences.volume === 'number' ? Math.max(0, Math.min(100, preferences.volume)) : 65,
  );
  introEnabled.checked = preferences.intro !== false;
  function savePreferences() {
    try {
      localStorage.setItem(
        'curse.preferences.v1',
        JSON.stringify({
          graphics: pack.id,
          music: musicSelect.value,
          musicBeforeMute: lastMusicVersion,
          volume: Number(volume.value),
          intro: introEnabled.checked,
          effects: soundSelect.value,
          frame: frameSelect.value,
          showFrame: showFrame.checked,
        }),
      );
    } catch {
      /* El juego funciona sin almacenamiento. */
    }
  }
  function selectMusic() {
    const version = musicCatalog.versions.find((v) => v.id === musicSelect.value);
    button('preview-music').disabled = !musicCatalog.versions.length;
    if (version) lastMusicVersion = version.id;
    music.select(musicSelect.value, !gameStarted ? 'CURSE.RS5' : '');
    music.setVolume((Number(volume.value) / 100) * (!gameStarted ? 0.3 : 1));
    button('preview-music').textContent = version ? 'Silenciar música' : 'Activar música';
    if (musicCatalogFailed) musicNote.textContent = 'No se ha podido leer el catálogo de música.';
  }
  async function refreshMusic() {
    button('refresh-music').disabled = true;
    try {
      const selected = musicSelect.value;
      musicCatalog = await discoverMusic();
      musicCatalogFailed = false;
      music.replaceCatalog(musicCatalog);
      musicSelect.replaceChildren(
        new Option('Sin música', 'none'),
        ...musicCatalog.versions.map((v) => new Option(v.label, v.id)),
      );
      musicSelect.value = initialMusicVersion(musicCatalog, selected);
      selectMusic();
    } catch {
      musicNote.textContent = 'No se ha podido actualizar la lista de música.';
    } finally {
      button('refresh-music').disabled = false;
    }
  }
  selectMusic();
  function setMenu(open: boolean) {
    menuOpen = open;
    menu.hidden = !open;
    resumeButton.hidden = !gameStarted;
    startButton.hidden = gameStarted;
    welcomeMenu.sync(!gameStarted && !debugMode, open);
    document.querySelector('#menu-heading')!.textContent = gameStarted
      ? 'La aventura te espera'
      : 'Tu aventura comienza aquí';
    if (open) {
      originalHud.close();
      sounds.stop();
      (gameStarted ? resumeButton : startButton).focus();
    }
  }
  function setDebug(enabled: boolean) {
    debugMode = enabled;
    document.body.classList.toggle('debug', enabled);
    button('toggle-debug').setAttribute('aria-pressed', String(enabled));
    if (enabled) {
      awaitingTitle = false;
      setMenu(false);
    } else if (!gameStarted) setMenu(true);
    resize();
  }

  setResourceLoading('Cargando gráficos y personajes…');
  let visual = await loadVisual(manifest.title, pack);
  let awaitingTitle = false;
  let startup: {
    elapsed: number;
    event: number;
    visual: typeof visual;
    frames: Awaited<ReturnType<typeof loadVisual>>[];
  } | null = null;
  function skipStartup() {
    if (startup)
      startup.elapsed = Math.max(
        startup.elapsed,
        (manifest.startupPlayback.holdTicks * 1000) / manifest.startupPlayback.referenceHz,
      );
  }
  async function finishStartup() {
    startup = null;
    awaitingTitle = true;
    background.alpha = 1;
    await show(0, pack);
    sync();
    app.canvas.focus({ preventScroll: true });
    status.textContent = 'Portada original.';
  }

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
  const originalHud = await createOriginalHud(manifest.originalHud, pack);
  world.addChild(originalHud.layer);
  world.mask = clip;
  world.eventMode = 'static';
  world.hitArea = new Rectangle(0, 0, 320, 200);
  world.cursor = 'pointer';
  const decorativeFrames = new DecorativeFrames();
  const cursorCache = new Map<string, Promise<Awaited<ReturnType<typeof loadVisual>>[]>>();
  function prepareCursors(nextPack: GraphicsPack) {
    let pending = cursorCache.get(nextPack.id);
    if (!pending) {
      pending = Promise.all(
        (manifest.originalHud.cursors ?? []).map((asset) =>
          loadVisual({ ...asset, remaster: true }, nextPack),
        ),
      );
      cursorCache.set(nextPack.id, pending);
    }
    return pending;
  }
  let cursorVisuals = await prepareCursors(pack);
  const gameCursor = new Sprite();
  gameCursor.eventMode = 'none';
  gameCursor.visible = false;
  let pointerOnGame = false;
  world.on('pointermove', (event) => {
    pointerOnGame = true;
    gameCursor.position.copyFrom(event.global);
  });
  world.on('pointerout', () => {
    pointerOnGame = false;
  });
  app.stage.addChild(world, decorativeFrames.layer, gameCursor);
  const fps = document.createElement('span');
  app.canvas.tabIndex = 0;
  app.canvas.setAttribute('aria-label', 'Pantalla del juego');
  fps.id = 'fps';
  fps.setAttribute('aria-hidden', 'true');
  fps.textContent = '— FPS';
  viewport.replaceChildren(app.canvas, fps);
  const resize = () => {
    fitPresentation(app, world, viewport, decorativeFrames.layer.visible);
    decorativeFrames.resize(
      app.screen.width,
      world.x,
      world.y,
      320 * world.scale.x,
      200 * world.scale.y,
    );
  };
  let lastFrameKey = '';
  let frameTask: Promise<void> = Promise.resolve();
  function updateFrame() {
    frameSelect.disabled = !showFrame.checked || !frameCatalog.length;
    const active = showFrame.checked && !!document.fullscreenElement;
    const context = startup
      ? 'core'
      : playback
        ? 'intro'
        : showingStatic
          ? 'title'
          : `scene:${manifest.scenes[sceneIndex].id}`;
    const selected = chooseFrame(frameCatalog, frameSelect.value, context);
    const key = `${active}/${selected?.id}/${pack.id}`;
    if (key === lastFrameKey) return frameTask;
    lastFrameKey = key;
    frameTask = decorativeFrames
      .show(active ? frameVariant(selected, pack.id) : undefined, pack.id === 'original')
      .then(resize)
      .catch(() => {
        status.textContent = 'No se ha podido cargar el marco seleccionado.';
        resize();
      });
    return frameTask;
  }
  for (const control of [frameSelect, showFrame])
    control.addEventListener('change', () => {
      savePreferences();
      void updateFrame();
    });
  document.addEventListener('fullscreenchange', () => {
    void updateFrame();
    resize();
  });
  new ResizeObserver(resize).observe(viewport);
  resize();
  const introButton = button('play-intro');
  const assetInfo = document.querySelector<HTMLParagraphElement>('#asset-info')!;
  const scene = () => manifest.scenes[sceneIndex];
  async function loadLayers(record: SceneRecord, targetPack = pack) {
    // Los bancos del protagonista se mantienen originales. Solo se sustituyen piezas de sala.
    const sourceAssets =
      record.animation?.assets ?? record.layers.assets.map((asset) => ({ ...asset, bank: 24576 }));
    const assets = await Promise.all(
      sourceAssets.map(async (asset) => ({
        asset,
        visual: await loadVisual(
          { ...asset, remaster: record.id === 0 && asset.bank === 24576 },
          targetPack,
        ),
      })),
    );
    const texture = (frame: number, bank = 24576) => {
      const entry = assets.find(
        (entry) => entry.asset.frame === frame && entry.asset.bank === bank,
      );
      if (!entry) throw new Error('Missing original scene layer');
      return entry.visual.texture;
    };
    const initialActors: (OrderedActor & { frame: number; bank?: number })[] = record.animation
      ? record.animation.actors.slice(1).map((raw, index) => originalActorView(raw, index + 2))
      : record.layers.actors;
    const objects = initialActors
      .filter((a) => a.flags !== 0 && (record.animation || !(a.flags & 2)) && a.frame !== 255)
      .map((a) => {
        const sprite = new Sprite(texture(a.frame & 127, a.bank ?? 24576));
        sprite.width = a.width;
        sprite.height = a.height;
        sprite.scale.x = Math.abs(sprite.scale.x) * (a.frame & 128 ? -1 : 1);
        sprite.position.set(a.x + (a.frame & 128 ? a.width : 0), a.y);
        sprite.eventMode = 'none';
        sprite.visible = !(a.flags & 2);
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
    return {
      objects,
      foreground,
      texture,
      dispose() {
        for (const entry of assets) if (entry.visual.disposable) entry.visual.texture.destroy(true);
      },
    };
  }
  let layerView = await loadLayers(scene());
  let depthOrder = Array.from({ length: 69 }, (_, i) => i + 1);
  function installLayers(next: typeof layerView) {
    for (const child of actorsLayer.removeChildren()) if (child !== ben) child.destroy();
    for (const child of foregroundLayer.removeChildren()) child.destroy();
    if (layerView !== next) layerView.dispose();
    layerView = next;
    actorsLayer.addChild(ben);
    for (const item of layerView.objects) actorsLayer.addChild(item.sprite);
    for (const item of layerView.foreground) foregroundLayer.addChild(item.sprite);
  }
  installLayers(layerView);

  const actors = new Map<number, WalkActor | null>(),
    cameras = new Map<number, number>();
  const animationStates = new Map<number, ActorPrograms>();
  let animationState: ActorPrograms | null = null,
    animationElapsed = 0;
  let dungeonState: DungeonState | null = null;
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
  let playback: {
    elapsed: number;
    event: number;
    base: Awaited<ReturnType<typeof loadVisual>>[];
    original: Awaited<ReturnType<typeof loadVisual>>[];
  } | null = null;
  const playbackCache = new Map<
    string,
    Promise<{
      base: Awaited<ReturnType<typeof loadVisual>>[];
      original: Awaited<ReturnType<typeof loadVisual>>[];
    }>
  >();
  function stopPresentation() {
    playback = null;
    background.alpha = 1;
    background.texture = visual.texture;
  }
  async function playPresentation(resume = 0) {
    if (changing) return;
    await show(0, pack);
    changing = true;
    status.textContent = 'Preparando la presentación…';
    setResourceLoading('Cargando la presentación…');
    sync();
    try {
      let pending = playbackCache.get(pack.id);
      if (!pending) {
        pending = Promise.all([
          Promise.all(staticScreens.map((screen) => loadVisual(screen.asset, pack))),
          Promise.all(
            manifest.presentationPlayback.events.map((event) => loadVisual(event.asset, pack)),
          ),
        ]).then(([base, original]) => ({ base, original }));
        playbackCache.set(pack.id, pending);
      }
      const assets = await pending;
      if (visual.disposable) visual.texture.destroy(true);
      visual = { ...assets.base[0], disposable: false };
      background.texture = visual.texture;
      playback = { ...assets, elapsed: resume, event: -1 };
      renderPresentationFrame();
      status.textContent = debugMode
        ? 'Presentación en curso. F2 compara gráficos; F3 permite revisar fotogramas.'
        : 'Presentación en curso. Puedes omitirla.';
    } catch {
      playbackCache.delete(pack.id);
      status.textContent =
        'No se ha podido preparar la presentación. Puedes recorrer sus imágenes con F3.';
    } finally {
      changing = false;
      sync();
      setResourceLoading(null);
    }
  }
  function renderPresentationFrame() {
    if (!playback) return;
    const tick = (playback.elapsed * manifest.presentationPlayback.referenceHz) / 1000;
    const events = manifest.presentationPlayback.events;
    let index = playback.event;
    while (index + 1 < events.length && events[index + 1].tick <= tick) index++;
    if (index >= 0 && index !== playback.event) {
      playback.event = index;
      const event = events[index],
        base = playback.base[event.index];
      visual = { ...base, disposable: false };
      background.texture =
        base.usedPack === 'original' ? playback.original[index].texture : base.texture;
      background.alpha = base.usedPack === 'original' ? 1 : event.brightness;
      staticIndex = currentView = event.index;
      sync();
    }
  }
  let transition: { sprite: Sprite; elapsed: number } | null = null;
  const transitionDuration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320;
  function finishTransition() {
    if (!transition) return;
    transition.sprite.removeFromParent();
    transition.sprite.texture.destroy(true);
    transition.sprite.destroy();
    transition = null;
  }
  function captureTransition() {
    if (!transitionDuration) return;
    // Captura a la resolución de presentación; no modifica recursos ni coordenadas.
    const texture = app.renderer.generateTexture({
      target: world,
      frame: new Rectangle(0, 0, 320, 200),
      resolution: Math.max(1, world.scale.x),
      clearColor: '#000000',
      textureSourceOptions: { scaleMode: 'linear' },
    });
    finishTransition();
    const sprite = new Sprite(texture);
    sprite.eventMode = 'none';
    sprite.width = 320;
    sprite.height = 200;
    world.addChild(sprite);
    transition = { sprite, elapsed: 0 };
  }
  function resetActor() {
    sounds.stop();
    animationState =
      !showingStatic && scene().animation ? structuredClone(scene().animation!) : null;
    if (animationState && !animationState.programs.length)
      animationState.programs = manifest.actorPrograms;
    if (animationState && scene().id === 0)
      dungeonState = createDungeon(animationState, manifest.dungeon);
    animationElapsed = 0;
    const spawn =
      showingStatic || scene().animation?.includePlayer ? null : scene().navigation.spawn;
    actor = spawn ? createWalkActor(spawn.x + spawn.cameraX, spawn.y, spawn.frame) : null;
    cameraX = spawn ? Math.max(0, Math.min(scene().background.width - 320, spawn.cameraX)) : 0;
    renderCameraX = cameraX;
    scrollElapsed = 0;
    elapsed = 0;
    destination.visible = false;
  }
  function describe() {
    if (playback) return;
    status.textContent = showingStatic
      ? staticIndex === 0
        ? 'Pulsa Entrar o haz clic para reproducir la presentación. F3 permite revisarla imagen a imagen.'
        : `${staticScreens[staticIndex].name}. Imagen de revisión. Puedes reproducir la presentación o avanzar con F3.`
      : actor
        ? 'Haz clic para caminar. Las acciones y salidas se señalarán sin ejecutarlas.'
        : scene().animation?.includePlayer
          ? 'Clic derecho para abrir las acciones originales. Los objetos disponibles dependen de la posición y del estado de la sala.'
          : scene().navigation.entryStatus === 'hidden-player'
            ? 'El original oculta a Ben en esta pantalla. Vista del escenario sin paseo.'
            : 'Secuencia especial pendiente de reproducir. Vista del escenario sin paseo libre.';
  }
  function drawLimits() {
    limits.clear();
    limits.visible = showLimits && !showingStatic;
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
    background.width = showingStatic
      ? staticScreens[staticIndex].asset.width
      : scene().background.width;
    actorsLayer.visible = foregroundLayer.visible = !showingStatic;
    limits.visible = showLimits && !showingStatic;
    background.height = 200;
    sceneContent.x = -renderCameraX;
    const animated = animationState?.actors.map((raw, index) => originalActorView(raw, index + 1));
    const animatedBen = scene().animation?.includePlayer ? animated?.[0] : undefined;
    ben.visible = actor !== null;
    if (animatedBen) {
      ben.visible = !!animatedBen.flags && !(animatedBen.flags & 2) && animatedBen.frame !== 255;
      const bank =
        animatedBen.bank === 16384
          ? (animationState?.spriteBanks?.[animationState.bank] ?? 16384)
          : animatedBen.bank;
      ben.texture = layerView.texture(animatedBen.frame & 127, bank);
      ben.width = animatedBen.width;
      ben.height = animatedBen.height;
      ben.scale.x = Math.abs(ben.scale.x) * (animatedBen.frame & 128 ? -1 : 1);
      ben.position.set(
        animatedBen.x + (animatedBen.frame & 128 ? animatedBen.width : 0),
        animatedBen.y,
      );
    } else if (actor) {
      const frame = actor.frame & 127;
      if (frame >= player.length) throw new Error('Frame outside normal STD walk');
      ben.texture = player[frame].texture;
      ben.width = 32;
      ben.height = 48;
      ben.scale.x = Math.abs(ben.scale.x) * (actor.frame & 128 ? -1 : 1);
      ben.position.set(actor.x + (actor.frame & 128 ? 32 : 0), actor.y);
    }
    if (animated)
      for (const view of animated.slice(1)) {
        const sprite = layerView.objects.find((item) => item.slot === view.slot)?.sprite;
        if (!sprite) continue;
        sprite.visible = !!view.flags && !(view.flags & 2) && view.frame !== 255;
        if (!sprite.visible) continue;
        sprite.texture = layerView.texture(view.frame & 127, view.bank);
        sprite.width = view.width;
        sprite.height = view.height;
        sprite.scale.x = Math.abs(sprite.scale.x) * (view.frame & 128 ? -1 : 1);
        sprite.position.set(view.x + (view.frame & 128 ? view.width : 0), view.y);
      }
    const slots: OrderedActor[] = animated ?? [
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
    if (animated && !scene().animation?.includePlayer)
      slots[0] = {
        slot: 1,
        flags: actor ? 1 : 0,
        x: actor?.x ?? 0,
        y: actor?.y ?? 0,
        width: 32,
        height: 48,
        depthOffset: 0,
      };
    depthOrder = originalActorOrder(slots, depthOrder);
    let drawIndex = 0;
    for (const slot of depthOrder) {
      const sprite =
        slot === 1 ? ben : layerView.objects.find((item) => item.slot === slot)?.sprite;
      if (sprite) actorsLayer.setChildIndex(sprite, drawIndex++);
    }
    for (const piece of layerView.foreground)
      piece.sprite.visible = originalForegroundOverlaps(piece, slots);
    sceneLabel.textContent = showingStatic
      ? `${currentView} · ${staticScreens[staticIndex].name}`
      : `${currentView} · ${scene().name} · Escenario ${sceneIndex + 1} de ${manifest.scenes.length}`;
    skipButton.hidden = !debugMode || !playback || menuOpen;
    document.body.classList.toggle('playing', gameStarted && !menuOpen && !debugMode);
    welcomeMenu.sync(!gameStarted && !debugMode, menuOpen);
    button('toggle-debug').disabled = !!startup;
    startButton.disabled =
      resumeButton.disabled =
      graphicsSelect.disabled =
      menuButton.disabled =
        changing || startingGame || selectingPack || !!startup;
    musicSelect.disabled = false;
    graphicsSelect.value = pack.id;
    music.setContext(
      startup ? 'core' : playback ? 'intro' : showingStatic ? 'title' : `scene:${scene().id}`,
    );
    sceneSelect.value = String(currentView);
    sceneSelect.disabled = changing || selectingPack;
    introButton.disabled = changing || selectingPack;
    introButton.textContent = playback ? 'Omitir presentación' : 'Reproducir presentación';
    const asset = showingStatic ? staticScreens[staticIndex].asset : scene().background;
    assetInfo.textContent = `${asset.file} · Original: ${asset.width} × ${asset.height} · Remaster ×6: ${asset.width * 6} × ${asset.height * 6}`;
    restartButton.textContent = showingStatic ? 'Continuar' : 'Reiniciar';
    void updateFrame();
    modeButton.textContent = `F2 · ${pack.label}`;
    button('music-mode').textContent =
      `F3 · ${musicCatalog.versions.find((v) => v.id === musicSelect.value)?.label ?? 'Sin música'}`;
    button('music-mode').disabled =
      changing || startingGame || selectingPack || !!startup || debugMode;
    document.querySelector('#title-prompt')!.toggleAttribute('hidden', !awaitingTitle || menuOpen);
    document
      .querySelector('#original-hud-note')!
      .toggleAttribute(
        'hidden',
        showingStatic || menuOpen || originalHud.visible || scene().id !== 0,
      );
    if (showingStatic || menuOpen || scene().id !== 0) originalHud.close();
    modeLabel.textContent =
      pack.label +
      (visual.fallback
        ? ` · ${visual.usedPack === 'original' ? 'Original' : visual.usedPack} donde falta`
        : '');
    for (const b of [modeButton, nextButton, previousButton, restartButton])
      b.disabled = changing || startingGame || selectingPack || !!startup;
    leftButton.disabled = showingStatic || changing || cameraX === 0;
    rightButton.disabled = showingStatic || changing || cameraX >= scene().background.width - 320;
    boundaryButton.disabled = showingStatic || changing;
    boundaryButton.textContent = showLimits ? 'Ocultar límites' : 'Mostrar límites';
    boundaryButton.setAttribute('aria-pressed', String(showLimits));
  }
  function navigationState(): NavigationState {
    const state = { ...scene().navigation.state };
    if (!animationState) return state;
    const bytes = animationState.actors.flat();
    for (const key of Object.keys(state)) {
      const offset = Number(key) - 0x2c2b;
      if (offset >= 33 && offset + 1 < bytes.length)
        state[key] = bytes[offset] | (bytes[offset + 1] << 8);
    }
    return state;
  }
  function pan(direction: number) {
    if (changing || selectingPack || transition || showingStatic) return;
    if (actor) stopOriginalWalk(actor);
    destination.visible = false;
    cameraX = Math.max(0, Math.min(scene().background.width - 320, cameraX + direction * 32));
    cameras.set(scene().id, cameraX);
    sync();
  }
  async function show(nextView: number, nextPack: GraphicsPack) {
    if (changing) return;
    if (!selectingPack) finishTransition();
    stopPresentation();
    const nextStatic = nextView < staticScreens.length,
      nextScene = Math.max(0, nextView - staticScreens.length);
    changing = true;
    sync();
    try {
      const nextLayers =
        !nextStatic && (nextScene !== sceneIndex || nextPack.id !== pack.id)
          ? await loadLayers(manifest.scenes[nextScene], nextPack)
          : null;
      const loaded = await loadVisual(
        nextStatic ? staticScreens[nextView].asset : manifest.scenes[nextScene].background,
        nextPack,
      );
      await originalHud.setPack(nextPack);
      cursorVisuals = await prepareCursors(nextPack);
      const previous = visual,
        moved =
          nextScene !== sceneIndex ||
          nextStatic !== showingStatic ||
          (nextStatic && nextView !== staticIndex);
      if (moved) {
        if (actor) stopOriginalWalk(actor);
        if (!showingStatic) {
          actors.set(scene().id, actor);
          if (animationState) animationStates.set(scene().id, animationState);
          cameras.set(scene().id, cameraX);
        }
      }
      visual = loaded;
      sceneIndex = nextScene;
      showingStatic = nextStatic;
      sounds.setScene(nextStatic ? null : manifest.scenes[nextScene].id);
      currentView = nextView;
      if (nextStatic) staticIndex = nextView;
      pack = nextPack;
      savePreferences();
      background.texture = loaded.texture;
      if (nextLayers) installLayers(nextLayers);
      if (moved) {
        if (!showingStatic && actors.has(scene().id)) {
          actor = actors.get(scene().id)!;
          animationState = animationStates.get(scene().id) ?? null;
          animationElapsed = 0;
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
    if (startup || changing || selectingPack) return;
    const resume = playback?.elapsed;
    selectingPack = true;
    sync();
    try {
      captureTransition();
      packs = await discoverPacks();
      graphicsSelect.replaceChildren(...packs.map((p) => new Option(p.label, p.id)));
      const current = packs.findIndex((p) => p.id === pack.id);
      await show(currentView, packs[(current + 1) % packs.length]);
      if (resume !== undefined) await playPresentation(resume);
    } finally {
      selectingPack = false;
      sync();
      notifyGame(`Gráficos · ${modeLabel.textContent}`);
    }
  }
  const nextScene = (direction: number) =>
    selectingPack
      ? Promise.resolve()
      : show((currentView + direction + screenCount) % screenCount, pack);
  function openOriginalHud(x: number, y: number) {
    if (menuOpen || changing || selectingPack || transition || showingStatic || scene().id !== 0)
      return;
    if (!animationState?.controls[1]) return;
    actionMenu.reset();
    originalHud.open(x, y, actionMenu.cells());
    sync();
    elapsed = animationElapsed = 0;
    app.canvas.focus({ preventScroll: true });
  }
  const actionMenu = new OriginalActionMenu({
    inventory: () => (dungeonState ? dungeonInventory(dungeonState) : []),
    nearby: (mask) => (dungeonState ? dungeonNearby(dungeonState, mask) : []),
    vocabulary: () =>
      dungeonState
        ? Array.from({ length: 10 }, (_, i) => dungeonWord(dungeonState!, 0x5239 + i * 2)).filter(
            (n) => n !== 65535,
          )
        : [],
    icon: (item) => (dungeonState ? dungeonByte(dungeonState, 0x524e + item * 2) : 0),
    blocked: () =>
      !!animationState &&
      (animationState.actors[0][16] !== 0 || animationState.actors[0][17] !== 0),
    execute: executeOriginalAction,
  });
  function executeOriginalAction(command: ActionCommand) {
    if (!dungeonState) return;
    const { item, other, verb } = command;
    let action: Parameters<typeof performDungeonAction>[1] | undefined;
    if (command.kind === 'talk') action = item === 0 ? 'help' : 'hello';
    if (command.kind === 'take')
      action =
        item === 1 ? 'take-key' : item === 3 ? 'take-clip' : item === 5 ? 'take-coin' : undefined;
    if (command.kind === 'use') {
      if (verb === 0 && ((item === 0 && other === 1) || (item === 1 && other === 0)))
        action = 'unlock-chains';
      if (verb === 0 && ((item === 4 && other === 3) || (item === 3 && other === 4)))
        action = 'unlock-door';
      if (verb === 2 && item === 2) action = 'push-wall';
    }
    if (action) {
      performDungeonAction(dungeonState, action, manifest.navigationProfile);
      for (const id of dungeonState.animation.sounds) sounds.play(id);
      dungeonState.animation.sounds = [];
    } else if (command.kind === 'disk')
      notifyGame('Guardar y cargar todavía no están implementados.');
    else if (command.kind === 'info')
      notifyGame(`Puntuación · ${dungeonWord(dungeonState, 0x35c7)}`);
    else dungeonState.cursor = 'failure';
    sync();
  }
  function selectOriginalHud() {
    const index = originalHud.select();
    if (index === null) return;
    if (actionMenu.select(index)) originalHud.close();
    else originalHud.setEntries(actionMenu.cells());
    sync();
  }
  app.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  world.on('rightclick', (event) => {
    if (originalHud.visible) {
      originalHud.close();
      sync();
    } else {
      const local = world.toLocal(event.global);
      openOriginalHud(local.x, local.y);
    }
  });
  world.on('pointermove', (event) => {
    if (originalHud.visible) originalHud.move(world.toLocal(event.global).x);
  });
  world.on('pointertap', (event) => {
    if (event.button !== 0) return;
    if (originalHud.visible) {
      originalHud.move(world.toLocal(event.global).x);
      selectOriginalHud();
      return;
    }
    if (startup) {
      skipStartup();
      return;
    }
    if (menuOpen || changing || selectingPack || transition || renderCameraX !== cameraX) return;
    if (awaitingTitle) {
      void continueFromTitle();
      return;
    }
    if (playback && !debugMode) {
      void show(staticScreens.length, pack);
      return;
    }
    if (showingStatic) {
      if (!debugMode && !gameStarted) {
        setMenu(true);
        return;
      }
      if (staticIndex === 0) void playPresentation();
      else if (debugMode) void nextScene(1);
      return;
    }
    const local = world.toLocal(event.global),
      point = { x: Math.trunc(local.x + renderCameraX), y: Math.trunc(local.y) };
    if (point.x < 0 || point.x >= scene().background.width || point.y < 0 || point.y >= 200) return;
    if (scene().id === 0 && dungeonState) {
      walkDungeon(dungeonState, point, manifest.navigationProfile);
      animationElapsed = 0;
      return;
    }
    if (!actor) {
      describe();
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
    decorativeFrames.tick(ticker.elapsedMS);
    originalHud.tick(ticker.elapsedMS);
    const customCursor = !menuOpen && !showingStatic && scene().id === 0 && !!dungeonState;
    const cursorIndex =
      dungeonState?.cursor === 'success' ? 1 : dungeonState?.cursor === 'failure' ? 2 : 0;
    const cursorVisual = cursorVisuals[cursorIndex];
    gameCursor.visible = customCursor && pointerOnGame && !!cursorVisual;
    world.cursor = customCursor && cursorVisual ? 'none' : 'pointer';
    if (gameCursor.visible) {
      gameCursor.texture = cursorVisual.texture;
      const asset = manifest.originalHud.cursors![cursorIndex];
      gameCursor.width = asset.width * world.scale.x;
      gameCursor.height = asset.height * world.scale.y;
    }
    fpsElapsed += ticker.elapsedMS;
    fpsFrames++;
    if (fpsElapsed >= 500) {
      fps.textContent = `${Math.round((fpsFrames * 1000) / fpsElapsed)} FPS`;
      fpsElapsed = fpsFrames = 0;
    }
    if (changing || selectingPack) return;
    if (transition) {
      transition.elapsed += ticker.elapsedMS;
      const progress = Math.min(1, transition.elapsed / transitionDuration);
      transition.sprite.alpha = 1 - progress * progress * (3 - 2 * progress);
      if (progress === 1) finishTransition();
      return;
    }
    if (startup) {
      startup.elapsed += ticker.elapsedMS;
      // El menú ya expresa la intención de jugar: abreviamos la espera del logotipo.
      if (startup.elapsed >= 2500) skipStartup();
      const timing = manifest.startupPlayback,
        tick = (startup.elapsed * timing.referenceHz) / 1000;
      let index = startup.event;
      while (index + 1 < timing.events.length && timing.events[index + 1].tick <= tick) index++;
      if (index >= 0 && index !== startup.event) {
        startup.event = index;
        const original = startup.visual.usedPack === 'original';
        background.texture = original ? startup.frames[index].texture : startup.visual.texture;
        background.alpha = original ? 1 : timing.events[index].brightness;
      }
      if (tick >= timing.durationTicks) void finishStartup();
      return;
    }
    if (menuOpen || originalHud.visible) return;
    if (playback) {
      playback.elapsed += ticker.elapsedMS;
      renderPresentationFrame();
      if (
        (playback.elapsed * manifest.presentationPlayback.referenceHz) / 1000 >=
        manifest.presentationPlayback.durationTicks
      )
        void show(staticScreens.length, pack);
      return;
    }
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
    if (animationState) {
      animationElapsed += Math.min(ticker.deltaMS, 100);
      while (animationElapsed >= gameCycleMs) {
        animationElapsed -= gameCycleMs;
        if (scene().id === 0 && dungeonState)
          tickDungeon(dungeonState, manifest.navigationProfile, scene().navigation.regions);
        else tickOriginalActors(animationState);
        for (const id of animationState.sounds) sounds.play(id);
      }
      if (scene().id === 0 && dungeonState) {
        if (dungeonState.exited) {
          const corridor = manifest.scenes.findIndex((s) => s.id === 1);
          if (corridor >= 0) void show(staticScreens.length + corridor, pack);
        }
      }
      sync();
    }
    if (!actor) return;
    elapsed += Math.min(ticker.deltaMS, 100);
    while (elapsed >= gameCycleMs) {
      elapsed -= gameCycleMs;
      if (!actor.remaining && !actor.channels.length) break;
      const previous = { x: actor.x, y: actor.y },
        wasWalking = !!actor.remaining;
      tickOriginalWalk(actor, manifest.navigationProfile);
      const contact = resolveOriginalContact(
        actor,
        previous,
        scene().navigation.regions,
        navigationState(),
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
  introButton.addEventListener('click', () => {
    if (playback) void show(staticScreens.length, pack);
    else void playPresentation();
  });
  sceneSelect.addEventListener('change', () => void show(Number(sceneSelect.value), pack));
  button('welcome').addEventListener('click', () => void show(0, pack));
  function nextMusic() {
    if (startingGame || changing || selectingPack || startup) return;
    const versions = [{ id: 'none', label: 'Sin música' }, ...musicCatalog.versions];
    const current = versions.findIndex((v) => v.id === musicSelect.value);
    const selected = versions[(current + 1) % versions.length];
    musicSelect.value = selected.id;
    selectMusic();
    music.start();
    savePreferences();
    sync();
    notifyGame(`Música · ${selected.label}`);
    app.canvas.focus({ preventScroll: true });
  }
  button('music-mode').addEventListener('click', nextMusic);
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
    if (showingStatic) {
      if (staticIndex === 0) void playPresentation();
      else void nextScene(1);
      return;
    }
    if (!changing) {
      resetActor();
      sync();
      describe();
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !resourceLoading.hidden) return;
    if (startup) {
      event.preventDefault();
      skipStartup();
      return;
    }
    const target = event.target;
    if (originalHud.visible && ['Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'Escape') {
        originalHud.close();
        sync();
      } else if (event.key === 'Enter') selectOriginalHud();
      else originalHud.step(event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (target instanceof HTMLElement && target.matches('input,select,textarea')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenu(!menuOpen || !gameStarted);
      sync();
      return;
    }
    if (menuOpen) return;
    if (
      awaitingTitle &&
      event.key !== 'Escape' &&
      event.key !== 'F2' &&
      event.key !== 'F3' &&
      !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key) &&
      (target === document.body || target === app.canvas)
    ) {
      event.preventDefault();
      if (!event.repeat) void continueFromTitle();
      return;
    }
    if (
      playback &&
      !debugMode &&
      !event.repeat &&
      event.key !== 'Escape' &&
      event.key !== 'F2' &&
      event.key !== 'F3' &&
      !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key) &&
      (target === document.body || target === app.canvas)
    ) {
      event.preventDefault();
      void show(staticScreens.length, pack);
      return;
    }
    if (event.key === 'Enter' && debugMode && showingStatic && event.target === document.body) {
      event.preventDefault();
      if (staticIndex === 0) void playPresentation();
      else void nextScene(1);
    }
    if (event.key === 'F2') {
      event.preventDefault();
      if (!event.repeat) void nextPack();
    }
    if (event.key === 'F3') {
      event.preventDefault();
      if (!event.repeat) {
        if (debugMode) void nextScene(event.shiftKey ? -1 : 1);
        else if (gameStarted) {
          nextMusic();
        }
      }
    }
    if (event.key === 'ArrowLeft' && debugMode) {
      event.preventDefault();
      pan(-1);
    }
    if (event.key === 'ArrowRight' && debugMode) {
      event.preventDefault();
      pan(1);
    }
  });
  async function continueFromTitle() {
    if (!awaitingTitle || changing || selectingPack || menuOpen) return;
    awaitingTitle = false;
    if (introEnabled.checked) await playPresentation();
    else await show(staticScreens.length, pack);
    sync();
  }
  async function beginGame() {
    if (startup || startingGame || changing || selectingPack) return;
    startingGame = true;
    sync();
    await music.fadeOut(450);
    gameStarted = true;
    awaitingTitle = false;
    setDebug(false);
    setMenu(false);
    selectMusic();
    await show(0, pack);
    actors.clear();
    cameras.clear();
    animationStates.clear();
    resetActor();
    changing = true;
    setResourceLoading('Cargando el arranque original…');
    sync();
    try {
      const [core, frames] = await Promise.all([
        loadVisual(manifest.core, pack),
        Promise.all(manifest.startupPlayback.events.map((event) => loadVisual(event.asset, pack))),
      ]);
      const previous = visual;
      visual = core;
      background.texture = core.texture;
      background.alpha = 1;
      if (previous.disposable) previous.texture.destroy(true);
      startup = { elapsed: 0, event: -1, visual: core, frames };
      app.canvas.focus({ preventScroll: true });
      status.textContent = 'Arranque original.';
      sync();
      if (!document.hidden) music.start(true);
    } catch {
      setMenu(true);
      status.textContent = 'No se ha podido cargar el arranque. Puedes volver a intentarlo.';
    } finally {
      changing = false;
      startingGame = false;
      sync();
      setResourceLoading(null);
    }
  }
  startButton.addEventListener('click', () => void beginGame());
  resumeButton.addEventListener('click', () => {
    setMenu(false);
    sync();
  });
  menuButton.addEventListener('click', () => {
    setMenu(!menuOpen);
    sync();
  });
  skipButton.addEventListener('click', () => void show(staticScreens.length, pack));
  button('toggle-debug').addEventListener('click', () => {
    setDebug(!debugMode);
    sync();
  });
  graphicsSelect.addEventListener('change', () => {
    const selected = packs.find((p) => p.id === graphicsSelect.value);
    if (!selected || changing || selectingPack) return;
    const resume = playback?.elapsed;
    void (async () => {
      selectingPack = true;
      captureTransition();
      sync();
      try {
        await show(currentView, selected);
        if (resume !== undefined) await playPresentation(resume);
      } finally {
        selectingPack = false;
        sync();
      }
    })();
  });
  musicSelect.addEventListener('change', () => {
    selectMusic();
    if (!gameStarted && !document.hidden) music.start();
    savePreferences();
    sync();
  });
  volume.addEventListener('input', () => {
    music.setVolume((Number(volume.value) / 100) * (!gameStarted ? 0.3 : 1));
    savePreferences();
    sync();
  });
  introEnabled.addEventListener('change', savePreferences);
  soundSelect.addEventListener('change', () => {
    selectSounds();
    savePreferences();
  });
  button('refresh-music').addEventListener('click', () => void refreshMusic());
  function pauseAudio() {
    music.pause();
    sounds.stop();
    toast.hidden = true;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseAudio();
    else if (!gameStarted && !startingGame) music.start();
  });
  window.addEventListener('pagehide', pauseAudio);
  function unlockMenuAudio() {
    if (!gameStarted && !startingGame && music.needsGesture && !document.hidden) music.start();
  }
  window.addEventListener('pointerdown', unlockMenuAudio, { capture: true });
  window.addEventListener('keydown', unlockMenuAudio, { capture: true });

  function toggleMusicMute() {
    if (musicSelect.value === 'none' || Number(volume.value) === 0) {
      if (musicSelect.value === 'none') musicSelect.value = lastMusicVersion;
      if (Number(volume.value) === 0) volume.value = '65';
    } else musicSelect.value = 'none';
    selectMusic();
    if (!document.hidden) music.start();
    savePreferences();
    sync();
  }
  button('preview-music').addEventListener('click', toggleMusicMute);
  button('welcome-audio').addEventListener('click', toggleMusicMute);
  button('fullscreen').addEventListener('click', () => {
    void (
      document.fullscreenElement
        ? document.exitFullscreen()
        : document.querySelector<HTMLElement>('main')!.requestFullscreen()
    ).catch(() => {
      status.textContent = 'La pantalla completa no está disponible en esta ventana.';
    });
  });
  resetActor();
  drawLimits();
  sync();
  describe();
  setMenu(true);
  selectMusic();
  sync();
  status.textContent = 'Elige gráficos y música y comienza la partida.';
  await updateFrame();
  setResourceLoading('Preparando la bienvenida…');
  await welcomeMenu.prepare();
  revealGame();
  resize();
  app.render();
  if (!document.hidden) music.start();
}
void start().catch((error) => {
  console.error('Unable to start local walking viewer', error);
  revealGame();
  viewport.innerHTML =
    '<p id="loading">Prepara los datos de navegación y los recursos locales con las instrucciones de assets/README.md y vuelve a cargar.</p>';
  status.textContent = 'La prueba todavía no ha podido iniciarse.';
});
