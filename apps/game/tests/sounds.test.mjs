import test from 'node:test';
import assert from 'node:assert/strict';
import { soundBus, SoundPlayer } from '../src/sounds.ts';

class AudioFixture extends globalThis.EventTarget {
  static instances = [];
  paused = false;
  constructor(src) {
    super();
    this.src = src;
    AudioFixture.instances.push(this);
  }
  play() {
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}
function fixture(run) {
  const previous = globalThis.Audio;
  globalThis.Audio = AudioFixture;
  AudioFixture.instances = [];
  try {
    run();
  } finally {
    globalThis.Audio = previous;
  }
}
const catalog = {
  schemaVersion: 1,
  events: { 0: '/original/help.wav', 3: '/original/pick.wav' },
  priorities: { 0: 255, 3: 254 },
  scenes: {
    0: {
      events: { 15: '/original/door.wav', 17: '/original/drop.wav' },
      priorities: { 15: 100, 17: 100 },
    },
  },
  versions: [{ id: 'remastered', label: 'Remasterizados', events: { 0: '/remaster/help.wav' } }],
};
test('los efectos locales no se reutilizan en otra sala; los globales permanecen disponibles', () =>
  fixture(() => {
    const player = new SoundPlayer(catalog);
    player.setScene(0);
    player.play(15);
    const door = AudioFixture.instances.at(-1);
    player.setScene(1);
    assert.equal(door.paused, true);
    player.play(15);
    assert.equal(AudioFixture.instances.length, 1);
    player.play(0);
    assert.equal(AudioFixture.instances.at(-1).src, '/original/help.wav');
  }));
test('una sola voz: ignora prioridad igual o inferior y permite interrumpir con una superior', () =>
  fixture(() => {
    const player = new SoundPlayer(catalog);
    player.setScene(0);
    player.play(17);
    player.play(15);
    assert.equal(AudioFixture.instances.length, 1);
    player.play(0);
    assert.equal(AudioFixture.instances[0].paused, true);
    assert.equal(AudioFixture.instances.length, 2);
    player.play(3);
    assert.equal(AudioFixture.instances.length, 2);
    AudioFixture.instances.at(-1).dispatchEvent(new globalThis.Event('ended'));
    player.play(3);
    assert.equal(AudioFixture.instances.length, 3);
  }));
test('un remaster parcial vuelve al original y conserva la prioridad nativa', () =>
  fixture(() => {
    const player = new SoundPlayer(catalog);
    player.select('remastered');
    player.setScene(0);
    player.play(0);
    assert.equal(AudioFixture.instances[0].src, '/remaster/help.wav');
    player.play(15);
    assert.equal(AudioFixture.instances.length, 1);
    AudioFixture.instances[0].dispatchEvent(new globalThis.Event('ended'));
    player.play(15);
    assert.equal(AudioFixture.instances[1].src, '/original/door.wav');
  }));
test('sin efectos detiene la voz y un evento antiguo no borra el estado de la nueva', () =>
  fixture(() => {
    const player = new SoundPlayer(catalog);
    player.setScene(0);
    player.play(17);
    const old = AudioFixture.instances[0];
    player.play(0);
    old.dispatchEvent(new globalThis.Event('ended'));
    player.play(15);
    assert.equal(AudioFixture.instances.length, 2);
    player.select('none');
    assert.equal(AudioFixture.instances[1].paused, true);
    player.play(0);
    assert.equal(AudioFixture.instances.length, 2);
  }));

test('efectos y ambiente tienen volumen independiente y los cambios actúan sobre la voz actual', () =>
  fixture(() => {
    const player = new SoundPlayer(catalog);
    player.setScene(0);
    player.setVolume('effects', 0.7);
    player.setVolume('ambience', 0.2);
    player.play(17);
    const ambience = AudioFixture.instances.at(-1);
    assert.equal(ambience.volume, 0.2);
    player.setVolume('effects', 0.5);
    assert.equal(ambience.volume, 0.2);
    player.setVolume('ambience', 0.1);
    assert.equal(ambience.volume, 0.1);
    ambience.dispatchEvent(new globalThis.Event('ended'));
    player.play(0);
    const effect = AudioFixture.instances.at(-1);
    assert.equal(effect.volume, 0.5);
    player.setVolume('effects', 0);
    assert.equal(effect.paused, true);
    const count = AudioFixture.instances.length;
    player.play(0);
    assert.equal(AudioFixture.instances.length, count);
    player.play(17);
    assert.equal(AudioFixture.instances.at(-1).volume, 0.1);
  }));

test('la clasificación ambiental se limita a los eventos de la sala comprobada', () => {
  assert.equal(soundBus(0, 17), 'ambience');
  assert.equal(soundBus(0, 19), 'ambience');
  assert.equal(soundBus(0, 0), 'effects');
  assert.equal(soundBus(1, 17), 'effects');
  assert.equal(soundBus(null, 19), 'effects');
});
