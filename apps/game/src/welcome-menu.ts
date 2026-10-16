/** Presentación del port. El arranque y el lienzo DOS conservan su propio flujo. */
export function createWelcomeMenu() {
  const settings = document.querySelector<HTMLDialogElement>('#menu-settings')!;
  const options = document.querySelector<HTMLButtonElement>('#open-options')!;
  const image = document.querySelector<HTMLImageElement>('#welcome-wallpaper')!;
  const frame = document.querySelector<HTMLElement>('#welcome-border')!;
  const graphics = document.querySelector<HTMLSelectElement>('#graphics-select')!;
  const music = document.querySelector<HTMLSelectElement>('#music-select')!;
  const showFrame = document.querySelector<HTMLInputElement>('#show-frame')!;
  const status = document.querySelector<HTMLElement>('#welcome-status')!;
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
    async prepare() {
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
      if (!open && settings.open) settings.close();
      frame.hidden = !showFrame.checked;
      const graphicsLabel = graphics.selectedOptions[0]?.textContent ?? 'Original';
      const musicLabel = music.selectedOptions[0]?.textContent ?? 'Sin música';
      status.textContent = `${graphicsLabel} · Música: ${musicLabel}`;
    },
  };
}
