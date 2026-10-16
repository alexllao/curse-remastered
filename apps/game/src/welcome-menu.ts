import { menuWallpaperCandidates } from './menu-wallpapers.js';
import { interfaceFontsReady } from './interface-fonts.js';
import type { SoundCatalog } from './sounds.js';

/** Presentación del port. El arranque y el lienzo DOS conservan su propio flujo. */
export function createWelcomeMenu(soundCatalog: SoundCatalog, muted = false) {
  const settings = document.querySelector<HTMLDialogElement>('#menu-settings')!;
  const options = document.querySelector<HTMLButtonElement>('#open-options')!;
  const image = document.querySelector<HTMLImageElement>('#welcome-wallpaper')!;
  const frame = document.querySelector<HTMLElement>('#welcome-border')!;
  const showFrame = document.querySelector<HTMLInputElement>('#show-frame')!;
  const status = document.querySelector<HTMLElement>('#welcome-status')!;
  const audioButton = document.querySelector<HTMLButtonElement>('#welcome-audio')!;
  let musicHint = '';
  let presentationMuted = false;
  function updateStatus() {
    const mutedMusic =
      presentationMuted ||
      Number(document.querySelector<HTMLInputElement>('#music-volume')!.value) === 0;
    audioButton.classList.toggle('is-muted', mutedMusic);
    audioButton.setAttribute('aria-pressed', String(mutedMusic));
    audioButton.title =
      mutedMusic || musicHint
        ? 'Activar audio de presentación'
        : 'Desactivar audio de presentación';
    audioButton.setAttribute('aria-label', audioButton.title);
    status.textContent = mutedMusic
      ? 'Audio de presentación desactivado'
      : musicHint || 'Audio de presentación activado';
  }

  const effects = document.querySelector<HTMLSelectElement>('#sounds-select')!;
  const volume = document.querySelector<HTMLInputElement>('#effects-volume')!;
  let feedbackLevel = 0.18;
  // Voz propia de la interfaz: no altera las prioridades PCM del juego DOS.
  const feedback = new Audio();
  feedback.preload = 'auto';
  feedback.muted = muted;
  let lastHover = -Infinity;
  const stopFeedback = () => feedback.pause();
  function playFeedback(click: boolean) {
    if (muted || effects.value === 'none' || document.hidden) return;
    const now = performance.now();
    if (!click && now - lastHover < 100) return;
    if (!click) lastHover = now;
    // Elección provisional del port: dos muestras breves de STD.SFX.
    // No se atribuye esta asociación al menú del juego original.
    const id = click ? '4' : '7';
    const selected = soundCatalog.versions?.find((pack) => pack.id === effects.value);
    const file = selected?.events[id] ?? soundCatalog.events[id];
    if (!file) return;
    stopFeedback();
    feedback.src = file;
    feedbackLevel = click ? 0.3 : 0.18;
    feedback.volume = (Number(volume.value) / 100) * feedbackLevel;
    void feedback.play().catch(() => {
      /* El navegador puede exigir un primer clic. */
    });
  }
  function menuButton(target: EventTarget | null) {
    if (!document.body.classList.contains('welcome') || !(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>(
      '#game-menu button, #project-credits button, #welcome-fullscreen, #welcome-audio',
    );
    return button && !button.disabled ? button : undefined;
  }
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse') return;
    const button = menuButton(event.target);
    if (button && (!(event.relatedTarget instanceof Node) || !button.contains(event.relatedTarget)))
      playFeedback(false);
  });
  document.addEventListener('focusin', (event) => {
    if (menuButton(event.target)?.matches(':focus-visible')) playFeedback(false);
  });
  document.addEventListener(
    'click',
    (event) => {
      if (menuButton(event.target)) playFeedback(true);
    },
    { capture: true },
  );
  effects.addEventListener('change', stopFeedback);
  volume.addEventListener('input', () => {
    feedback.volume = (Number(volume.value) / 100) * feedbackLevel;
    if (!Number(volume.value)) stopFeedback();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopFeedback();
  });
  window.addEventListener('pagehide', stopFeedback);

  options.addEventListener('click', () => settings.showModal());
  document.querySelector('#close-options')!.addEventListener('click', () => settings.close());
  settings.addEventListener('close', () => options.focus({ preventScroll: true }));
  window.addEventListener(
    'keydown',
    (event) => {
      if (settings.open) event.stopImmediatePropagation();
    },
    { capture: true },
  );
  document.querySelector('#welcome-fullscreen')!.addEventListener('click', () => {
    document.querySelector<HTMLButtonElement>('#fullscreen')!.click();
  });
  document.querySelector('#menu-debug')!.addEventListener('click', () => {
    settings.close();
    document.querySelector<HTMLButtonElement>('#toggle-debug')!.click();
  });
  let wallpaperGeneration = 0;
  async function prepareWallpaper() {
    const generation = ++wallpaperGeneration;
    const paths = [
      ...menuWallpaperCandidates(window.innerWidth, window.innerHeight),
      '/menu/graficos/WALLPAPER.png',
      '/remaster/graficos/interfaz/TITLE.png',
      '/original/graficos/interfaz/TITLE.png',
    ];
    if (image.getAttribute('src') === paths[0]) return;
    for (const path of paths) {
      try {
        // Decodificar aparte conserva el fondo visible mientras cambia el formato.
        const candidate = new Image();
        candidate.src = path;
        await candidate.decode();
        if (generation !== wallpaperGeneration) return;
        image.src = path;
        image.hidden = false;
        document.body.classList.add('has-wallpaper');
        return;
      } catch {
        // Una variante ausente vuelve al siguiente encuadre disponible.
      }
    }
    if (generation === wallpaperGeneration && !image.getAttribute('src')) image.hidden = true;
  }
  let wallpaperTimer: number | undefined;
  const resizeWallpaper = () => {
    if (
      !document.body.classList.contains('welcome') ||
      !document.body.classList.contains('has-wallpaper')
    )
      return;
    window.clearTimeout(wallpaperTimer);
    wallpaperTimer = window.setTimeout(() => void prepareWallpaper(), 120);
  };
  window.addEventListener('resize', resizeWallpaper);
  document.addEventListener('fullscreenchange', resizeWallpaper);
  document.addEventListener('webkitfullscreenchange', resizeWallpaper);
  let noticeTimer: number | undefined;
  return {
    showNotice(message: string) {
      const notice = document.querySelector<HTMLElement>('#welcome-notice')!;
      window.clearTimeout(noticeTimer);
      notice.textContent = message;
      notice.hidden = false;
      noticeTimer = window.setTimeout(() => {
        notice.hidden = true;
      }, 8000);
    },
    setPresentationMuted(value: boolean) {
      presentationMuted = value;
      updateStatus();
    },
    setMusicHint(message: string) {
      musicHint = message;
      updateStatus();
    },
    async prepare() {
      await interfaceFontsReady;
      await prepareWallpaper();
    },
    sync(welcome: boolean, open: boolean) {
      document.body.classList.toggle('welcome', welcome);
      if (!welcome) stopFeedback();
      else if (document.body.classList.contains('has-wallpaper')) resizeWallpaper();
      if (!open && settings.open) settings.close();
      frame.hidden = !showFrame.checked;
      updateStatus();
    },
  };
}
