import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const knownDynamic = new Set(['fps', 'open-credits', 'project-credits']);

test('las consultas estáticas de main tienen un destino único en el HTML', () => {
  const queried = [...source.matchAll(/querySelector(?:<[^>]+>)?\(['"]#([\w-]+)['"]\)/g)].map(
    (match) => match[1],
  );
  const buttons = [...source.matchAll(/\bbutton\(['"]([\w-]+)['"]\)/g)].map((match) => match[1]);
  for (const id of new Set([...queried, ...buttons])) {
    if (knownDynamic.has(id)) continue;
    assert.equal(ids.filter((value) => value === id).length, 1, `Falta o se repite #${id}`);
  }
});

test('las tres barras de volumen incluyen sus etiquetas y sus porcentajes', () => {
  for (const id of [
    'music-volume-label',
    'music-volume',
    'effects-volume',
    'ambience-volume',
    'music-volume-value',
    'effects-volume-value',
    'ambience-volume-value',
  ])
    assert.equal(ids.filter((value) => value === id).length, 1, id);
});
