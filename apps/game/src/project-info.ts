interface ProjectInfoSnapshot {
  score: number;
  graphics: string;
}
interface ProjectInfoLifecycle {
  opened(): void;
  closed(): void;
}

/** Diálogo nativo: Escape, tabulación y cierre mediante formulario conservan su comportamiento. */
export function createProjectInfo(dialog: HTMLDialogElement, lifecycle: ProjectInfoLifecycle) {
  const score = dialog.querySelector<HTMLElement>('#project-info-score')!;
  const graphics = dialog.querySelector<HTMLElement>('#project-info-graphics')!;
  dialog.addEventListener('close', () => lifecycle.closed());
  return {
    get open() {
      return dialog.open;
    },
    show(snapshot: ProjectInfoSnapshot) {
      if (dialog.open) return;
      score.textContent = String(snapshot.score);
      graphics.textContent = snapshot.graphics;
      dialog.showModal();
      lifecycle.opened();
    },
  };
}
