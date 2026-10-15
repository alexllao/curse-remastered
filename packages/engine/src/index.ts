export const VERBS = ['LOOK', 'PICK UP', 'USE', 'TALK', 'OPEN', 'CLOSE', 'PUSH', 'PULL'] as const;
export type Verb = (typeof VERBS)[number];
export interface Hotspot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Scene {
  id: string;
  name: string;
  hotspots: Hotspot[];
}
export function findHotspot(scene: Scene, x: number, y: number) {
  return scene.hotspots.find(
    (h) => x >= h.x && y >= h.y && x < h.x + h.width && y < h.y + h.height,
  );
}

export {
  containsPoint,
  moveTowards,
  facingTowards,
  type Point,
  type Facing,
} from './navigation.js';
