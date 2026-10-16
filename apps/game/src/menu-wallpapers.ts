/** Ordenar por el recorte proporcional necesario, sin deformar la ilustración. */
export function menuWallpaperCandidates(width: number, height: number) {
  const ratio = Math.max(1, width) / Math.max(1, height);
  return [
    { ratio: 16 / 10, file: '/menu/graficos/WALLPAPER-16x10.png' },
    { ratio: 16 / 9, file: '/menu/graficos/WALLPAPER-16x9.png' },
    { ratio: 24 / 9, file: '/menu/graficos/WALLPAPER-24x9.png' },
    { ratio: 32 / 9, file: '/menu/graficos/WALLPAPER-32x9.png' },
  ]
    .sort((a, b) => Math.abs(Math.log(ratio / a.ratio)) - Math.abs(Math.log(ratio / b.ratio)))
    .map((variant) => variant.file);
}
