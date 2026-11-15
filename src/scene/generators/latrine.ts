import * as THREE from 'three';
import { Building, column, gable, arch } from '../materials';
import type { Placement } from '../materials';
export interface LatrineOptions { length?: number; width?: number; height?: number; columnSpacing?: number }
/** 40×10m communal latrine, 5m high, two internal column rows, perimeter benches and tiled roof. Front +Z. */
export function createLatrine(o: LatrineOptions = {}): THREE.Group {
  const { length: l = 40, width: w = 10, height: h = 5, columnSpacing = 4 } = o;
  const b = new Building('Latrine'); b.foundation(l, w); b.box('travertine', l, 0.15, w);
  b.box('plaster', l, h, 0.5, 0, h / 2, -w / 2);
  for (const side of [-1, 1]) {
    b.box('plaster', 0.5, h, w, side * l / 2);
    b.box('marble', l - 1.5, 0.4, 0.9, 0, 0.55, side * (w / 2 - 0.8));
    b.box('limestone', l - 2, 0.12, 0.4, 0, 0.2, side * (w / 2 - 1.5));
    b.box('plaster', (l - 4) / 2, h, 0.5, side * (l + 4) / 4, h / 2, w / 2);
  }
  b.add('plaster', arch(2.4, 3.5, 0.5), { x: 0, y: 0, z: w / 2 });
  if (h > 4.3) b.box('plaster', 4, h - 4.3, 0.5, 0, (h + 4.3) / 2, w / 2);
  const cols: Placement[] = [], n = Math.max(1, Math.floor((l - 4) / columnSpacing));
  for (const side of [-1, 1]) for (let i = 0; i <= n; i++) cols.push({ x: -l / 2 + 2 + i * (l - 4) / n, y: 0.15, z: side * w * 0.22 });
  b.repeated('marble', column(h - 0.15, 0.25), cols);
  b.add('roofTile', gable(w + 1, 1.6, l + 1).rotateY(Math.PI / 2), { x: 0, y: h, z: 0 });
  return b.finish();
}
