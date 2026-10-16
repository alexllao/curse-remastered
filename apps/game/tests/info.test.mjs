import test from 'node:test';
import assert from 'node:assert/strict';
import { originalInfoPage } from '../src/original-info-layout.ts';
import { createProjectInfo } from '../src/project-info.ts';
import { buildLabel } from '../src/build-label.ts';

test('la información original centra la página y calcula campos como el ejecutable', () => {
  const profile = {
    pages: [{ width: 216, height: 80, rows: [Array(9).fill(32)] }],
    fields: [
      { page: 0, row: 0, column: 0, kind: 'score' },
      { page: 0, row: 0, column: 6, kind: 'percentage' },
    ],
    maximumScore: 478,
  };
  for (const [score, expected] of [
    [0, '  0     0'],
    [5, '  5     1'],
    [99, ' 99    20'],
    [478, '478   100'],
  ]) {
    const page = originalInfoPage(profile, 0, score);
    assert.equal(String.fromCharCode(...page.rows[0]), expected);
    assert.deepEqual([page.x, page.y], [52, 60]);
  }
  assert.deepEqual(profile.pages[0].rows[0], Array(9).fill(32));
});

test('el diálogo de proyecto actualiza datos, evita abrir dos veces y notifica su cierre', () => {
  const fields = new Map([
    ['#project-info-score', {}],
    ['#project-info-graphics', {}],
  ]);
  const dialog = new globalThis.EventTarget();
  dialog.open = false;
  dialog.querySelector = (id) => fields.get(id);
  dialog.showModal = () => {
    dialog.open = true;
  };
  let opened = 0,
    closed = 0;
  const info = createProjectInfo(dialog, {
    opened() {
      opened++;
    },
    closed() {
      closed++;
    },
  });
  info.show({ score: 7, graphics: 'Remaster' });
  info.show({ score: 99, graphics: 'Otro' });
  assert.equal(info.open, true);
  assert.equal(opened, 1);
  assert.equal(fields.get('#project-info-score').textContent, '7');
  assert.equal(fields.get('#project-info-graphics').textContent, 'Remaster');
  dialog.open = false;
  dialog.dispatchEvent(new globalThis.Event('close'));
  assert.equal(info.open, false);
  assert.equal(closed, 1);
});

test('la etiqueta usa la versión y el instante de compilación con horario de Madrid', () => {
  const label = buildLabel('1.0.0', '2026-10-16T10:30:00Z');
  assert.match(label, /^v1\.0\.0 · Compilado:/);
  assert.ok(label.includes('16/10/2026'));
  assert.ok(label.includes('12:30'));
});
