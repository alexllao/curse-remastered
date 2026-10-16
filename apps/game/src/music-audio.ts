export interface LoopRegion {
  start: number;
  end: number;
}
export type MusicAudio = Pick<
  HTMLAudioElement,
  | 'preload'
  | 'loop'
  | 'volume'
  | 'paused'
  | 'duration'
  | 'currentTime'
  | 'src'
  | 'onloadedmetadata'
  | 'play'
  | 'pause'
  | 'load'
  | 'removeAttribute'
  | 'addEventListener'
> & { setLoopRegion?: (region?: LoopRegion) => void; unlock?: () => Promise<void> };

/** Web Audio repite la región nativa sin depender de eventos ended del navegador. */
export class NativeMusicAudio extends EventTarget {
  preload: HTMLAudioElement['preload'] = 'metadata';
  loop = true;
  onloadedmetadata: HTMLAudioElement['onloadedmetadata'] = null;
  private html: HTMLAudioElement;
  private context?: AudioContext;
  private gain?: GainNode;
  private region?: LoopRegion;
  private buffer?: AudioBuffer;
  private source?: AudioBufferSourceNode;
  private loading?: Promise<void>;
  private generation = 0;
  private operation = 0;
  private offset = 0;
  private startedAt = 0;
  private file = '';
  private level = 1;
  private stopped = true;
  private createContext: () => AudioContext;
  private fetchAudio: typeof fetch;
  constructor(
    html: HTMLAudioElement = new Audio(),
    createContext = () => new AudioContext(),
    fetchAudio: typeof fetch = (...args) => fetch(...args),
  ) {
    super();
    this.html = html;
    this.createContext = createContext;
    this.fetchAudio = fetchAudio;
    html.addEventListener('playing', () => {
      if (!this.region) this.dispatchEvent(new Event('playing'));
    });
    html.addEventListener('error', () => {
      if (!this.region) this.dispatchEvent(new Event('error'));
    });
    html.addEventListener('loadedmetadata', () => {
      if (!this.region) this.metadataReady();
    });
  }
  private metadataReady() {
    const event = new Event('loadedmetadata');
    this.onloadedmetadata?.call(this.html, event);
    this.dispatchEvent(event);
  }
  private audioContext() {
    if (!this.context) {
      this.context = this.createContext();
      this.gain = this.context.createGain();
      this.gain.gain.value = this.html.muted ? 0 : this.level;
      this.gain.connect(this.context.destination);
    }
    return this.context;
  }
  setLoopRegion(region?: LoopRegion) {
    this.pause();
    this.region = region;
  }
  get src() {
    return this.file;
  }
  set src(file: string) {
    this.pause();
    const generation = ++this.generation;
    this.file = file;
    this.offset = 0;
    this.buffer = undefined;
    if (!this.region) {
      this.html.loop = this.loop;
      this.html.preload = this.preload;
      this.html.src = file;
      return;
    }
    this.html.removeAttribute('src');
    this.html.load();
    // El contexto se crea dentro de play(), durante el gesto que activa el audio.
    this.loading = this.fetchAudio(file).then(async (response) => {
      if (!response.ok) throw new Error('Native music unavailable');
      const data = await response.arrayBuffer();
      if (generation !== this.generation) return;
      const buffer = await this.audioContext().decodeAudioData(data);
      if (generation !== this.generation) return;
      if (!this.region || this.region.end > buffer.duration + 0.01)
        throw new Error('Invalid native music loop');
      this.buffer = buffer;
      this.metadataReady();
    });
    void this.loading.catch(() => {
      if (generation === this.generation) this.dispatchEvent(new Event('error'));
    });
  }
  get paused() {
    return this.region ? this.stopped : this.html.paused;
  }
  get duration() {
    return this.region ? (this.buffer?.duration ?? NaN) : this.html.duration;
  }
  get volume() {
    return this.level;
  }
  set volume(value: number) {
    this.level = value;
    this.html.volume = value;
    if (this.gain) this.gain.gain.value = this.html.muted ? 0 : value;
  }
  get currentTime() {
    if (!this.region) return this.html.currentTime;
    const seconds =
      this.offset + (this.stopped ? 0 : this.audioContext().currentTime - this.startedAt);
    return seconds >= this.region.end
      ? this.region.start + ((seconds - this.region.start) % (this.region.end - this.region.start))
      : seconds;
  }
  set currentTime(seconds: number) {
    if (!this.region) {
      this.html.currentTime = seconds;
      return;
    }
    const playing = !this.stopped;
    if (playing) this.pause();
    this.offset = Math.max(0, seconds);
    if (playing) void this.play();
  }
  unlock() {
    return this.region ? this.audioContext().resume() : Promise.resolve();
  }
  async play() {
    if (!this.region) return this.html.play();
    if (!this.stopped) return;
    const operation = ++this.operation;
    const generation = this.generation;
    const context = this.audioContext();
    const resumed = context.resume();
    // Algunos navegadores dejan resume() pendiente hasta el próximo gesto.
    // Comunicar el bloqueo permite que el clic global vuelva a intentarlo.
    if (context.state === 'suspended') {
      await Promise.race([resumed, new Promise<void>((resolve) => setTimeout(resolve, 100))]);
      if (operation !== this.operation || generation !== this.generation) return;
      if (context.state === 'suspended')
        throw new DOMException('Audio requires a user gesture', 'NotAllowedError');
    }
    await Promise.all([resumed, this.loading]);
    if (
      operation !== this.operation ||
      generation !== this.generation ||
      !this.buffer ||
      !this.region
    )
      return;
    const source = context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = true;
    source.loopStart = this.region.start;
    source.loopEnd = this.region.end;
    source.connect(this.gain!);
    const offset = this.currentTime;
    source.start(0, offset);
    this.offset = offset;
    this.startedAt = context.currentTime;
    this.source = source;
    this.stopped = false;
    this.dispatchEvent(new Event('playing'));
  }
  pause() {
    this.operation++;
    if (this.region && !this.stopped) this.offset = this.currentTime;
    this.stopped = true;
    this.source?.stop();
    this.source?.disconnect();
    this.source = undefined;
    this.html.pause();
  }
  removeAttribute(name: string) {
    if (name === 'src') {
      this.pause();
      this.generation++;
      this.file = '';
      this.buffer = undefined;
      this.loading = undefined;
      this.offset = 0;
    }
    this.html.removeAttribute(name);
  }
  load() {
    this.html.load();
  }
}
