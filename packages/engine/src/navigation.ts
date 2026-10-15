export interface Point {
  x: number;
  y: number;
}
export type Facing = 'left' | 'right' | 'up' | 'down';

/** Incluye el borde. La prueba jugable utiliza un polígono convexo. */
export function containsPoint(polygon: readonly Point[], point: Point): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j],
      b = polygon[i];
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    if (
      Math.abs(cross) < 1e-8 &&
      point.x >= Math.min(a.x, b.x) &&
      point.x <= Math.max(a.x, b.x) &&
      point.y >= Math.min(a.y, b.y) &&
      point.y <= Math.max(a.y, b.y)
    )
      return true;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

export function moveTowards(position: Point, target: Point, speed: number, seconds: number): Point {
  if (
    ![position.x, position.y, target.x, target.y, speed, seconds].every(Number.isFinite) ||
    speed < 0 ||
    seconds < 0
  )
    throw new Error('Invalid movement input');
  const dx = target.x - position.x,
    dy = target.y - position.y;
  const distance = Math.hypot(dx, dy),
    step = speed * seconds;
  if (!distance || step >= distance) return { ...target };
  return { x: position.x + (dx / distance) * step, y: position.y + (dy / distance) * step };
}

export function facingTowards(position: Point, target: Point): Facing {
  const dx = target.x - position.x,
    dy = target.y - position.y;
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
}
