import type { SoundCatalog } from './sounds.js';

/** Presentación del port. El arranque y el lienzo DOS conservan su propio flujo. */
export function createWelcomeMenu(soundCatalog: SoundCatalog, muted = false) {
  const settings = document.querySelector<HTMLDialogElement>('#menu-settings')!;
  const options = document.querySelector<HTMLButtonElement>('#open-options')!;
  const image = document.querySelector<HTMLImageElement>('#welcome-wallpaper')!;
  const frame = document.querySelector<HTMLElement>('#welcome-border')!;
  const music = document.querySelector<HTMLSelectElement>('#music-select')!;
  const showFrame = document.querySelector<HTMLInputElement>('#show-frame')!;
  const status = document.querySelector<HTMLElement>('#welcome-status')!;
  const audioButton = document.querySelector<HTMLButtonElement>('#welcome-audio')!;
  let musicHint = '';
  function updateStatus() {
    const musicLabel = music.selectedOptions[0]?.textContent ?? 'Sin música';
    const mutedMusic =
      music.value === 'none' ||
      Number(document.querySelector<HTMLInputElement>('#music-volume')!.value) === 0;
    audioButton.classList.toggle('is-muted', mutedMusic);
    audioButton.setAttribute('aria-pressed', String(mutedMusic));
    audioButton.title = mutedMusic ? 'Activar música' : 'Silenciar música';
    audioButton.setAttribute('aria-label', audioButton.title);
    status.textContent = `${musicLabel}${musicHint ? ` · ${musicHint}` : ''}`;
  }

  const effects = document.querySelector<HTMLSelectElement>('#sounds-select')!;
  const volume = document.querySelector<HTMLInputElement>('#music-volume')!;
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
    feedback.volume = (Number(volume.value) / 100) * (click ? 0.3 : 0.18);
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
  return {
    setMusicHint(message: string) {
      musicHint = message;
      updateStatus();
    },
    async prepare() {
      await document.fonts.load('18px "IM Fell English"').catch(() => {});
      // La imagen se decodifica bajo el loading; una ausencia conserva TITLE.
      for (const path of [
        '/remaster/graficos/menu/WALLPAPER.png',
        '/remaster/graficos/interfaz/TITLE.png',
        '/original/graficos/interfaz/TITLE.png',
      ]) {
        try {
          image.src = path;
          await image.decode();
          image.hidden = false;
          document.body.classList.add('has-wallpaper');
          return;
        } catch {
          /* Paquete incompleto: probar el respaldo. */
        }
      }
      image.hidden = true;
    },
    sync(welcome: boolean, open: boolean) {
      document.body.classList.toggle('welcome', welcome);
      if (!welcome) stopFeedback();
      if (!open && settings.open) settings.close();
      frame.hidden = !showFrame.checked;
      updateStatus();
    },
  };
}
