import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettingNotice } from '../src/setting-notice.ts';
test('el aviso solo aparece por cambios explícitos, se renueva y desaparece', () => {
  const fields = Object.fromEntries(
    ['label', 'detail', 'caption', 'shortcut'].map((key) => [`[data-setting-${key}]`, {}]),
  );
  const tasks = new Map();
  let serial = 0;
  const element = {
    hidden: true,
    dataset: {},
    classList: { add() {}, remove() {} },
    querySelector(id) {
      return fields[id];
    },
  };
  const notice = createSettingNotice(element, {
    setTimeout(fn, delay) {
      assert.equal(delay, 3400);
      tasks.set(++serial, fn);
      return serial;
    },
    clearTimeout(id) {
      tasks.delete(id);
    },
  });
  notice.playingMusic('Remaster · CURSE.RS1');
  assert.equal(element.hidden, true);
  assert.equal(tasks.size, 0);
  notice.show({ kind: 'music', label: 'Remaster', detail: 'Versión seleccionada' });
  const firstTimer = serial;
  notice.playingMusic('Remaster · CURSE.RS1');
  assert.equal(serial, firstTimer);
  assert.equal(fields['[data-setting-detail]'].textContent, 'Sonando: Remaster · CURSE.RS1');
  notice.show({ kind: 'graphics', label: 'Original', detail: 'Modo gráfico activo' });
  assert.equal(fields['[data-setting-caption]'].textContent, 'Gráficos');
  assert.equal(fields['[data-setting-shortcut]'].textContent, 'F2');
  notice.playingMusic('Remaster · CURSE.RS1');
  assert.equal(fields['[data-setting-detail]'].textContent, 'Modo gráfico activo');
  notice.show({
    kind: 'music',
    label: 'Sin música',
    detail: 'Efectos y ambiente conservan su volumen',
    muted: true,
  });
  assert.equal(tasks.size, 1);
  assert.equal(fields['[data-setting-label]'].textContent, 'Sin música');
  assert.equal(fields['[data-setting-shortcut]'].textContent, 'F5');
  assert.equal(element.dataset.muted, 'true');
  assert.equal(element.hidden, false);
  [...tasks.values()][0]();
  assert.equal(element.hidden, true);
  notice.playingMusic('Original · CURSE.RS1');
  assert.equal(element.hidden, true);
  assert.equal(tasks.size, 0);
});
