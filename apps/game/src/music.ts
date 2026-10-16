export interface MusicTrack {
  id: string;
  label: string;
  file: string;
  midi: boolean;
}
export interface MusicVersion {
  id: string;
  label: string;
  tracks: MusicTrack[];
}
export interface MusicCatalog {
  schemaVersion: number;
  versions: MusicVersion[];
  contexts: Record<string, string>;
}
export async function discoverMusic(): Promise<MusicCatalog> {
  const response = await fetch('/__mods/music.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Music catalog unavailable');
  const data: MusicCatalog = await response.json();
  if (data.schemaVersion !== 1 || !Array.isArray(data.versions) || !data.contexts)
    throw new Error('Invalid music catalog');
  return data;
}
/** Un único transporte de audio, independiente del paquete gráfico. */
export class MusicPlayer {
  private enabled = false;
  private paused = true;
  private version = 'none';
  private manual = '';
  private context = 'title';
  private current: MusicTrack | null = null;
  private request = 0;
  private fade = 0;
  needsGesture = false;
  private volume = 0.65;
  get playing() {
    return !!this.current && !this.audio.paused;
  }
  private playingLabel = '';
  private onPlaying: (label: string) => void = () => {};
  onTrackPlaying(listener: (label: string) => void) {
    this.onPlaying = listener;
  }
  private catalog: MusicCatalog;
  private notify: (message: string) => void;
  private audio: HTMLAudioElement;
  constructor(
    catalog: MusicCatalog,
    notify: (message: string) => void,
    audio: HTMLAudioElement = new Audio(),
  ) {
    this.catalog = catalog;
    this.notify = notify;
    this.audio = audio;
    audio.preload = 'metadata';
    audio.loop = true;
    audio.addEventListener('playing', () => {
      this.needsGesture = false;
      if (this.current && !this.paused) this.onPlaying(this.playingLabel);
    });
    audio.addEventListener('error', () => {
      if (this.current) this.notify('No se ha podido reproducir el tema seleccionado.');
    });
  }
  replaceCatalog(catalog: MusicCatalog) {
    this.catalog = catalog;
    this.update();
  }
  setVolume(volume: number) {
    this.fade++;
    this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0));
    this.audio.volume = this.volume;
  }
  select(version: string, track = '') {
    this.version = version;
    this.manual = track;
    this.update();
  }
  setContext(context: string) {
    if (this.context === context) return;
    this.context = context;
    this.update();
  }
  start(reset = false) {
    this.fade++;
    if (reset) this.current = null;
    this.enabled = true;
    this.paused = false;
    this.update();
  }
  pause() {
    this.needsGesture = false;
    this.fade++;
    this.paused = true;
    this.audio.pause();
  }
  async fadeOut(duration = 450) {
    const token = ++this.fade;
    const initial = this.audio.volume;
    const start = performance.now();
    while (token === this.fade && !this.audio.paused && performance.now() - start < duration) {
      this.audio.volume = initial * Math.max(0, 1 - (performance.now() - start) / duration);
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    if (token !== this.fade) return;
    this.pause();
    this.audio.volume = this.volume;
  }
  resume() {
    this.paused = false;
    this.update();
  }
  private play(request: number) {
    if (!this.enabled || this.paused || !this.current) return;
    void this.audio.play().catch((error: unknown) => {
      if (request !== this.request || this.paused || !this.enabled) return;
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'NotAllowedError'
      ) {
        this.needsGesture = true;
        this.notify('Haz clic o pulsa una tecla para activar la música de la presentación.');
      } else this.notify('No se ha podido iniciar la música seleccionada.');
    });
  }
  private update() {
    const version = this.catalog.versions.find((item) => item.id === this.version);
    const id =
      this.manual ||
      this.catalog.contexts[this.context] ||
      this.catalog.contexts.game ||
      (version?.tracks.length === 1 ? version.tracks[0].id : '');
    const chosen = version?.tracks.find((track) => track.id === id);
    const original = this.catalog.versions
      .find((item) => item.id === 'original')
      ?.tracks.find((track) => track.id === id);
    const track = chosen ?? (version ? original : undefined);
    if (!track || track.midi) {
      this.request++;
      this.audio.pause();
      this.current = null;
      this.audio.removeAttribute('src');
      this.audio.load();
      this.notify(
        !version
          ? this.catalog.versions.length
            ? 'Música desactivada.'
            : 'Copia tus versiones en mods/musica/ para elegirlas aquí.'
          : track?.midi
            ? 'Este tema está en MIDI. Añade su versión de audio (por ejemplo, RS1.ogg) para reproducirlo en la web.'
            : id
              ? 'Este tema no está disponible en la versión seleccionada ni en Original.'
              : 'Esta escena todavía no tiene música asignada.',
      );
      return;
    }
    this.playingLabel = chosen ? `${version!.label} · ${track.label}` : `Original · ${track.label}`;
    const unchanged = this.current?.file === track.file;
    this.notify(
      chosen
        ? `${version!.label} · ${track.label}`
        : `Original · ${track.label} (no disponible en ${version!.label})`,
    );
    if (unchanged) {
      if (this.audio.paused) this.play(this.request);
      return;
    }
    const seconds = this.current?.id === track.id ? this.audio.currentTime : 0;
    this.audio.pause();
    this.current = track;
    const request = ++this.request;
    this.audio.onloadedmetadata = () => {
      if (request !== this.request) return;
      if (Number.isFinite(this.audio.duration) && this.audio.duration > 0)
        this.audio.currentTime = seconds % this.audio.duration;
    };
    this.audio.src = track.file;
    this.play(request);
  }
}
