import test from 'node:test';
import assert from 'node:assert/strict';
import { initialMusicVersion, MusicPlayer } from '../src/music.ts';

class AudioFixture extends globalThis.EventTarget {
  paused = true;
  currentTime = 0;
  duration = 120;
  volume = 1;
  src = '';
  plays = 0;
  loads = 0;
  play() {
    this.paused = false;
    this.plays++;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {
    this.loads++;
  }
  removeAttribute() {
    this.src = '';
  }
}
const track = (file, midi = false) => ({ id: 'CURSE.RS1', label: 'CURSE.RS1', file, midi });
const catalog = {
  schemaVersion: 1,
  contexts: { title: 'CURSE.RS1' },
  versions: [
    { id: 'original', label: 'Original', tracks: [track('/musica/original/CURSE.RS1.ogg')] },
    { id: 'medieval', label: 'Medieval', tracks: [track('/musica/medieval/CURSE.RS1.mp3')] },
  ],
};
test('la música espera al gesto de inicio y conserva su posición al pausar el menú', () => {
  const audio = new AudioFixture(),
    player = new MusicPlayer(catalog, () => {}, audio);
  player.select('original');
  assert.equal(audio.plays, 0);
  player.start();
  assert.equal(audio.plays, 1);
  audio.currentTime = 42;
  player.pause();
  player.resume();
  assert.equal(audio.currentTime, 42);
  assert.equal(audio.plays, 2);
});
test('cambiar de versión del mismo tema conserva segundos sin superponer reproductores', () => {
  const audio = new AudioFixture(),
    player = new MusicPlayer(catalog, () => {}, audio);
  player.select('original');
  player.start();
  audio.currentTime = 42;
  player.select('medieval');
  audio.onloadedmetadata();
  assert.equal(audio.src, '/musica/medieval/CURSE.RS1.mp3');
  assert.equal(audio.currentTime, 42);
  const plays = audio.plays;
  player.setContext('title');
  assert.equal(audio.plays, plays);
});
test('un tema ausente vuelve a Original y una escena sin asociación no inventa un tema', () => {
  const audio = new AudioFixture(),
    messages = [];
  const local = globalThis.structuredClone(catalog);
  local.versions[1].tracks = [];
  const player = new MusicPlayer(local, (m) => messages.push(m), audio);
  player.select('medieval');
  player.start();
  assert.match(audio.src, /original/);
  player.setContext('scene:70');
  assert.equal(audio.src, '');
  assert.match(messages.at(-1), /no tiene música asignada/);
});
test('un MIDI sin sintetizador queda en silencio con un aviso explícito', () => {
  const audio = new AudioFixture(),
    messages = [],
    local = globalThis.structuredClone(catalog);
  local.versions[0].tracks = [track('/musica/original/CURSE.RS1.mid', true)];
  const player = new MusicPlayer(local, (m) => messages.push(m), audio);
  player.select('original');
  player.start();
  assert.equal(audio.plays, 0);
  assert.match(messages.at(-1), /MIDI/);
});

test('cambiar opciones o actualizar el catálogo mientras está pausado no reanuda la música', () => {
  const audio = new AudioFixture(),
    player = new MusicPlayer(catalog, () => {}, audio);
  player.select('original');
  player.start();
  player.pause();
  const plays = audio.plays;
  player.select('medieval');
  player.replaceCatalog(globalThis.structuredClone(catalog));
  player.setContext('core');
  player.select('original', 'CURSE.RS1');
  assert.equal(audio.plays, plays);
  assert.equal(audio.paused, true);
});

test('el fundido detiene la pista del menú y restaura el volumen para la siguiente reproducción', async () => {
  const audio = new AudioFixture(),
    player = new MusicPlayer(catalog, () => {}, audio);
  player.select('original');
  player.setVolume(0.2);
  player.start();
  await player.fadeOut(32);
  assert.equal(audio.paused, true);
  assert.equal(audio.volume, 0.2);
  player.select('medieval');
  assert.equal(audio.paused, true);
});

test('el bloqueo inicial permite reintentar con el primer gesto y mantiene el bucle', async () => {
  const audio = new AudioFixture();
  let blocked = true;
  audio.play = () =>
    blocked
      ? Promise.reject(new globalThis.DOMException('Gesto requerido', 'NotAllowedError'))
      : AudioFixture.prototype.play.call(audio);
  const player = new MusicPlayer(catalog, () => {}, audio);
  player.select('original');
  player.start();
  await Promise.resolve();
  assert.equal(player.needsGesture, true);
  assert.equal(audio.loop, true);
  blocked = false;
  player.start();
  audio.dispatchEvent(new globalThis.Event('playing'));
  assert.equal(player.playing, true);
  assert.equal(player.needsGesture, false);
});

test('cancelar una reproducción pendiente no la vuelve a solicitar con el siguiente clic', async () => {
  const audio = new AudioFixture();
  let rejectPlay;
  audio.play = () =>
    new Promise((resolve, reject) => {
      rejectPlay = reject;
    });
  const player = new MusicPlayer(catalog, () => {}, audio);
  player.select('original');
  player.start();
  player.pause();
  rejectPlay(new globalThis.DOMException('Pausado', 'AbortError'));
  await Promise.resolve();
  assert.equal(player.needsGesture, false);
  assert.equal(audio.paused, true);
});

test('la bienvenida activa música por defecto y conserva el silencio elegido explícitamente', () => {
  assert.equal(initialMusicVersion(catalog), 'original');
  const local = globalThis.structuredClone(catalog);
  local.versions.push({ id: 'remaster', label: 'Remaster', tracks: [] });
  assert.equal(initialMusicVersion(local), 'remaster');
  assert.equal(initialMusicVersion(local, 'none'), 'none');
  assert.equal(initialMusicVersion(local, 'medieval'), 'medieval');
  assert.equal(initialMusicVersion(local, 'retirada'), 'remaster');
  assert.equal(initialMusicVersion({ ...local, versions: [] }), 'none');
});

test('RS5 permanece en bucle durante la bienvenida y continúa tras ocultar la pestaña', () => {
  const audio = new AudioFixture();
  const local = globalThis.structuredClone(catalog);
  local.versions[0].tracks.push({
    id: 'CURSE.RS5',
    label: 'CURSE.RS5',
    file: '/rs5.ogg',
    midi: false,
  });
  const player = new MusicPlayer(local, () => {}, audio);
  player.select('original', 'CURSE.RS5');
  player.start();
  audio.currentTime = 37;
  player.setContext('core');
  assert.equal(audio.src, '/rs5.ogg');
  assert.equal(audio.loop, true);
  assert.equal(audio.currentTime, 37);
  player.pause();
  player.start();
  assert.equal(audio.currentTime, 37);
  assert.equal(audio.src, '/rs5.ogg');
});

test('silenciar un autoplay bloqueado elimina el reintento pendiente', async () => {
  const audio = new AudioFixture();
  audio.play = () =>
    Promise.reject(new globalThis.DOMException('Gesto requerido', 'NotAllowedError'));
  const player = new MusicPlayer(catalog, () => {}, audio);
  player.select('original');
  player.start();
  await Promise.resolve();
  assert.equal(player.needsGesture, true);
  player.select('none');
  assert.equal(player.needsGesture, false);
  player.start();
  assert.equal(audio.src, '');
  assert.equal(audio.paused, true);
});
