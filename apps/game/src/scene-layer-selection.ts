export interface LoadedSceneLayers {
  sceneId: number;
  packId: string;
}

/** Las capas conservan su identidad aunque la portada cambie el paquete activo. */
export function needsSceneLayers(
  nextStatic: boolean,
  nextSceneId: number,
  nextPackId: string,
  loaded: LoadedSceneLayers,
) {
  return !nextStatic && (loaded.sceneId !== nextSceneId || loaded.packId !== nextPackId);
}
