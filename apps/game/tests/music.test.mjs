import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicPlayer } from '../src/music.ts';

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
  assert.match(messages.at(-1), /Elige un tema/);
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
