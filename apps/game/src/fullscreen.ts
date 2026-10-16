type SafariDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type SafariElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function fullscreenElement(doc: Document = document): Element | null {
  return doc.fullscreenElement ?? (doc as SafariDocument).webkitFullscreenElement ?? null;
}

/** Llamar directamente desde el gesto: Safari conserva su autorización de usuario. */
export async function toggleFullscreen(
  element: HTMLElement,
  doc: Document = document,
): Promise<boolean> {
  if (fullscreenElement(doc)) {
    if (typeof doc.exitFullscreen === 'function') await doc.exitFullscreen();
    else if ((doc as SafariDocument).webkitExitFullscreen)
      await (doc as SafariDocument).webkitExitFullscreen!();
    else return false;
  } else if (typeof element.requestFullscreen === 'function') await element.requestFullscreen();
  else if ((element as SafariElement).webkitRequestFullscreen)
    await (element as SafariElement).webkitRequestFullscreen!();
  else return false;
  return true;
}
