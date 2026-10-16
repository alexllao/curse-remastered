export interface SoundCatalog {
  schemaVersion: number;
  events: Record<string, string>;
  versions?: { id: string; label: string; events: Record<string, string> }[];
}
export class SoundPlayer {
  private active = new Set<HTMLAudioElement>();
  enabled = true;
  private version = 'original';
  constructor(private catalog: SoundCatalog) {}
  select(version: string) {
    this.stop();
    this.version = version;
    this.enabled = version !== 'none';
  }
  play(id: number) {
    const selected = this.catalog.versions?.find((v) => v.id === this.version);
    const file = selected?.events[String(id)] ?? this.catalog.events[String(id)];
    if (!this.enabled || !file) return;
    if (this.active.size >= 8) {
      const oldest = this.active.values().next().value!;
      oldest.pause();
      this.active.delete(oldest);
    }
    const audio = new Audio(file);
    this.active.add(audio);
    audio.addEventListener('ended', () => this.active.delete(audio), { once: true });
    audio.addEventListener('error', () => this.active.delete(audio), { once: true });
    void audio.play().catch(() => {
      this.active.delete(audio);
    });
  }
  stop() {
    for (const audio of this.active) audio.pause();
    this.active.clear();
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
