import { MusicPlayer } from '../src/music.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { NativeMusicAudio } from '../src/music-audio.ts';
class Html extends globalThis.EventTarget {
  paused = true;
  volume = 1;
  currentTime = 0;
  duration = 30;
  src = '';
  play() {
    this.paused = false;
    this.dispatchEvent(new globalThis.Event('playing'));
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {}
  removeAttribute() {
    this.src = '';
  }
}
function setup(
  fetchAudio = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
) {
  const sources = [],
    html = new Html();
  const context = {
    currentTime: 0,
    destination: {},
    createGain: () => ({ gain: { value: 1 }, connect() {} }),
    resume: async () => {},
    decodeAudioData: async () => ({ duration: 40 }),
    createBufferSource() {
      const source = {
        connect() {},
        disconnect() {},
        stop() {
          this.stopped = true;
        },
        start(when, offset) {
          this.offset = offset;
        },
      };
      sources.push(source);
      return source;
    },
  };
  return { audio: new NativeMusicAudio(html, () => context, fetchAudio), html, context, sources };
}
test('el bucle nativo usa el reloj de audio y conserva posiciÃ³n al pausar', async () => {
  const { audio, context, sources } = setup();
  audio.setLoopRegion({ start: 10, end: 30 });
  audio.onloadedmetadata = () => {
    audio.currentTime = 2;
  };
  audio.src = '/original.ogg';
  await audio.play();
  assert.equal(sources.length, 1);
  assert.equal(sources[0].loop, true);
  assert.equal(sources[0].loopStart, 10);
  assert.equal(sources[0].loopEnd, 30);
  assert.equal(sources[0].offset, 2);
  context.currentTime = 35;
  assert.equal(audio.currentTime, 17);
  audio.pause();
  context.currentTime = 100;
  assert.equal(audio.currentTime, 17);
  await audio.play();
  assert.equal(sources[1].offset, 17);
});
test('silenciar o cambiar de pista mientras carga impide reproducir audio obsoleto', async () => {
  let resolve;
  const { audio, sources, html } = setup(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  audio.setLoopRegion({ start: 10, end: 30 });
  audio.src = '/original.ogg';
  const playing = audio.play();
  audio.pause();
  resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  await playing;
  assert.equal(sources.length, 0);
  audio.setLoopRegion();
  audio.src = '/remaster.mp3';
  await audio.play();
  assert.equal(html.paused, false);
  assert.equal(sources.length, 0);
});
test('buscar durante reproducciÃ³n detiene la fuente anterior y el volumen alcanza ambos transportes', async () => {
  const { audio, sources, html } = setup();
  audio.setLoopRegion({ start: 10, end: 30 });
  audio.src = '/original.ogg';
  await audio.play();
  audio.currentTime = 12;
  await new Promise((resolve) => globalThis.setImmediate(resolve));
  assert.equal(sources[0].stopped, true);
  assert.equal(sources[1].offset, 12);
  audio.volume = 0.3;
  assert.equal(audio.volume, 0.3);
  assert.equal(html.volume, 0.3);
  audio.removeAttribute('src');
  assert.equal(sources[1].stopped, true);
  assert.equal(audio.paused, true);
});

test('un contexto suspendido avisa del gesto necesario y el siguiente intento reproduce', async () => {
  const { audio, context, sources } = setup();
  context.state = 'suspended';
  context.resume = () => new Promise(() => {});
  audio.setLoopRegion({ start: 10, end: 30 });
  audio.src = '/original.ogg';
  await assert.rejects(audio.play(), { name: 'NotAllowedError' });
  assert.equal(sources.length, 0);
  context.resume = async () => {
    context.state = 'running';
  };
  await audio.play();
  assert.equal(sources.length, 1);
});

test('el transporte real pasa del título a RS1 tras detener el menú y empezar partida', async () => {
  const { audio, sources } = setup();
  const track = (id) => ({
    id,
    label: id,
    file: `/${id}.ogg`,
    midi: false,
    loopRegion: { start: 10, end: 30 },
  });
  const player = new MusicPlayer(
    {
      schemaVersion: 1,
      contexts: { 'scene:0': 'CURSE.RS1' },
      versions: [
        { id: 'original', label: 'Original', tracks: [track('CURSE.RS1'), track('CURSE.RS5')] },
      ],
    },
    () => {},
    audio,
  );
  player.select('original', 'CURSE.RS5');
  player.start();
  await new Promise((resolve) => globalThis.setImmediate(resolve));
  assert.equal(sources.length, 1);
  assert.equal(player.playing, true);
  player.pause();
  player.setContext('scene:0');
  player.select('original');
  player.start(true);
  await new Promise((resolve) => globalThis.setImmediate(resolve));
  assert.equal(audio.src, '/CURSE.RS1.ogg');
  assert.equal(player.playing, true);
  assert.equal(sources.length, 2);
  assert.equal(sources[0].stopped, true);
});
