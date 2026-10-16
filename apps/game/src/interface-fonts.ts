const fonts = [
  { id: 'im-fell', label: 'IM Fell English · libro antiguo', family: 'IM Fell English' },
  { id: 'cinzel', label: 'Cinzel · fantasía e inscripciones', family: 'Cinzel' },
  { id: 'alegreya', label: 'Alegreya · aventura clásica', family: 'Alegreya' },
  { id: 'cormorant', label: 'Cormorant Garamond · elegante', family: 'Cormorant Garamond' },
  { id: 'georgia', label: 'Georgia · clásica', family: 'Georgia' },
] as const;
const key = 'curse.interface-font.v1';

async function configureInterfaceFonts() {
  const select = document.querySelector<HTMLSelectElement>('#interface-font')!;
  const note = document.querySelector<HTMLElement>('#font-note')!;
  select.replaceChildren(...fonts.map((font) => new Option(font.label, font.id)));
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(key);
  } catch {
    /* Preferencia opcional. */
  }
  let current: (typeof fonts)[number] = fonts.find((font) => font.id === saved) ?? fonts[0];
  async function apply(id: string, persist: boolean) {
    const chosen = fonts.find((font) => font.id === id) ?? fonts[0];
    select.disabled = true;
    try {
      await document.fonts.load(`400 22px "${chosen.family}"`);
      document.documentElement.style.setProperty(
        '--interface-font',
        `"${chosen.family}", Georgia, serif`,
      );
      current = chosen;
      select.value = chosen.id;
      note.textContent = 'La fuente se aplica al menú, las opciones y los mensajes de la web.';
      if (persist) {
        try {
          localStorage.setItem(key, chosen.id);
        } catch {
          /* Sin almacenamiento. */
        }
      }
    } catch {
      select.value = current.id;
      note.textContent = 'No se ha podido cargar esa fuente. Se conserva la anterior.';
    } finally {
      select.disabled = false;
    }
  }
  select.value = current.id;
  select.addEventListener('change', () => void apply(select.value, true));
  await apply(current.id, false);
}

/** Preparación temprana: el loading y la bienvenida comparten la preferencia. */
export const interfaceFontsReady = configureInterfaceFonts();
