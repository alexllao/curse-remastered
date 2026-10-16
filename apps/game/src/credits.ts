import './credits.css';

const menu = document.querySelector('#game-menu');
const actions = menu?.querySelector('.menu-actions') ?? document.querySelector('header .controls');

if (actions) {
  const openButton = document.createElement('button');
  openButton.id = 'open-credits';
  openButton.type = 'button';
  openButton.textContent = 'Créditos';
  openButton.setAttribute('aria-haspopup', 'dialog');
  openButton.setAttribute('aria-controls', 'project-credits');
  actions.append(openButton);

  const subtitle = document.createElement('p');
  subtitle.className = 'project-attribution';
  subtitle.lang = 'en';
  subtitle.textContent = 'Unofficial Web Remaster';
  if (menu) menu.querySelector('h2')?.after(subtitle);
  else document.querySelector('header h1')?.after(subtitle);

  const dialog = document.createElement('dialog');
  dialog.id = 'project-credits';
  dialog.setAttribute('aria-labelledby', 'credits-title');
  dialog.innerHTML = `
    <h2 id="credits-title" lang="en">Curse of Enchantia</h2>
    <div class="credits-attribution" lang="en">
      <p>Originally developed by Core Design (1992)</p>
      <p class="credits-port">Web Port &amp; Remaster by Àlex Llaó</p>
      <p class="credits-disclaimer">Unofficial fan project. Not affiliated with or endorsed by the original rights holders.</p>
    </div>
    <section aria-labelledby="credits-about">
      <h3 id="credits-about" lang="en">About this project</h3>
      <p>Proyecto de preservación y adaptación tecnológica de un videojuego clásico: reconstrucción del motor en TypeScript y PixiJS, adaptación al navegador e investigación de sus recursos originales. El desarrollo sigue en curso.</p>
      <p>Los recursos originales pertenecen a sus respectivos titulares y no se distribuyen en este repositorio.</p>
      <p><a href="https://github.com/alexllao/curse-remastered" target="_blank" rel="noopener noreferrer">Repositorio del proyecto</a></p>
    </section>
    <form method="dialog"><button autofocus>Volver</button></form>
  `;
  (document.querySelector('.stage') ?? document.body).append(dialog);

  openButton.addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('close', () => openButton.focus());

  // El diálogo conserva sus teclas nativas sin activar los atajos del juego.
  window.addEventListener(
    'keydown',
    (event) => {
      if (dialog.open) event.stopImmediatePropagation();
    },
    { capture: true },
  );
}
