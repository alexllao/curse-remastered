interface NoticeClock {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(timer: number | undefined): void;
}
interface SettingSelection {
  kind: 'music' | 'graphics';
  label: string;
  detail: string;
  muted?: boolean;
}
/** Aviso único para cambios explícitos del jugador, con temporizador renovable. */
export function createSettingNotice(element: HTMLElement, clock: NoticeClock = window) {
  const label = element.querySelector<HTMLElement>('[data-setting-label]')!;
  const detail = element.querySelector<HTMLElement>('[data-setting-detail]')!;
  const caption = element.querySelector<HTMLElement>('[data-setting-caption]')!;
  const shortcut = element.querySelector<HTMLElement>('[data-setting-shortcut]')!;
  let timer: number | undefined;
  function hide() {
    clock.clearTimeout(timer);
    timer = undefined;
    element.hidden = true;
    element.classList.remove('show');
  }
  return {
    hide,
    playingMusic(playing: string) {
      // La confirmación de audio no abre avisos ni interrumpe el de gráficos.
      if (!element.hidden && element.dataset.kind === 'music')
        detail.textContent = `Sonando: ${playing}`;
    },
    show(selection: SettingSelection) {
      hide();
      label.textContent = selection.label;
      detail.textContent = selection.detail;
      caption.textContent = selection.kind === 'music' ? 'Música de fondo' : 'Gráficos';
      shortcut.textContent = selection.kind === 'music' ? 'F5' : 'F2';
      element.dataset.kind = selection.kind;
      element.dataset.muted = String(selection.muted === true);
      element.hidden = false;
      void element.offsetWidth;
      element.classList.add('show');
      timer = clock.setTimeout(hide, 3400);
    },
  };
}
