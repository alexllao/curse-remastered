import test from 'node:test';
import assert from 'node:assert/strict';
import { fullscreenElement, toggleFullscreen } from '../src/fullscreen.ts';

test('la API estándar recibe la solicitud directamente y permite salir', async () => {
  const doc = {
    fullscreenElement: null,
    exitFullscreen() {
      this.fullscreenElement = null;
      return Promise.resolve();
    },
  };
  const target = {
    requestFullscreen() {
      doc.fullscreenElement = this;
      return Promise.resolve();
    },
  };
  assert.equal(await toggleFullscreen(target, doc), true);
  assert.equal(fullscreenElement(doc), target);
  assert.equal(await toggleFullscreen(target, doc), true);
  assert.equal(fullscreenElement(doc), null);
});

test('Safari admite métodos WebKit que devuelven void y su estado propio', async () => {
  const doc = {
    webkitFullscreenElement: null,
    webkitExitFullscreen() {
      this.webkitFullscreenElement = null;
    },
  };
  const target = {
    webkitRequestFullscreen() {
      doc.webkitFullscreenElement = this;
    },
  };
  assert.equal(await toggleFullscreen(target, doc), true);
  assert.equal(fullscreenElement(doc), target);
  assert.equal(await toggleFullscreen(target, doc), true);
  assert.equal(fullscreenElement(doc), null);
});

test('un navegador sin API devuelve ausencia de soporte sin TypeError', async () => {
  assert.equal(await toggleFullscreen({}, {}), false);
});

test('los rechazos de permisos llegan al aviso de la interfaz', async () => {
  const target = {
    requestFullscreen() {
      return Promise.reject(new Error('Permiso denegado'));
    },
  };
  await assert.rejects(toggleFullscreen(target, {}), /Permiso denegado/);
});
