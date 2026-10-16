export interface SoundEvents {
  events: Record<string, string>;
  priorities?: Record<string, number>;
}
export interface SoundPack extends SoundEvents {
  scenes?: Record<string, SoundEvents>;
}
export interface SoundCatalog extends SoundPack {
  schemaVersion: number;
  versions?: (SoundPack & { id: string; label: string })[];
}
/** Una voz PCM, con la prioridad estricta que aplica el controlador Sound Blaster. */
export class SoundPlayer {
  private active: { audio: HTMLAudioElement; priority: number | undefined } | null = null;
  enabled = true;
  private version = 'original';
  private resource: number | null = null;
  private catalog: SoundCatalog;
  constructor(catalog: SoundCatalog) {
    this.catalog = catalog;
  }
  select(version: string) {
    this.stop();
    this.version = version;
    this.enabled = version !== 'none';
  }
  setScene(resource: number | null) {
    if (this.resource === resource) return;
    this.stop();
    this.resource = resource;
  }
  play(id: number) {
    if (!this.enabled) return;
    const key = String(id);
    const selected = this.catalog.versions?.find((v) => v.id === this.version);
    const resource = String(this.resource);
    const candidates = [
      selected?.scenes?.[resource],
      selected,
      this.catalog.scenes?.[resource],
      this.catalog,
    ];
    const entry = candidates.find((source) => source?.events[key]);
    const file = entry?.events[key];
    if (!file) return;
    const priority =
      entry.priorities?.[key] ??
      candidates.find((source) => source?.priorities?.[key] !== undefined)?.priorities?.[key];
    if (
      this.active &&
      priority !== undefined &&
      this.active.priority !== undefined &&
      priority <= this.active.priority
    )
      return;
    this.stop();
    const audio = new Audio(file);
    const current = { audio, priority };
    this.active = current;
    const release = () => {
      if (this.active === current) this.active = null;
    };
    audio.addEventListener('ended', release, { once: true });
    audio.addEventListener('error', release, { once: true });
    void audio.play().catch(release);
  }
  stop() {
    this.active?.audio.pause();
    this.active = null;
  }
}
export async function discoverSounds(): Promise<SoundCatalog> {
  try {
    const response = await fetch('/__mods/sounds.json', { cache: 'no-store' });
    if (!response.ok) return { schemaVersion: 1, events: {} };
    const data = await response.json();
    return data.schemaVersion === 1 && data.events ? data : { schemaVersion: 1, events: {} };
  } catch {
    return { schemaVersion: 1, events: {} };
  }
}
