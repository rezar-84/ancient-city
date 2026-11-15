import * as THREE from 'three';
import { Building, column, arch } from '../materials';
import type { Placement } from '../materials';
export interface NymphaeumOptions { width?: number; height?: number; wingDepth?: number; basinDepth?: number }
/** U-shaped 60×12m two-storey facade, 12m wings and a 10m-deep basin facing +Z. */
export function createNymphaeum(o: NymphaeumOptions = {}): THREE.Group {
  const { width: w = 60, height: h = 12, wingDepth: d = 12, basinDepth: bd = 10 } = o;
  const b = new Building('Nymphaeum'); b.foundation(w + 2, d + bd);
  const back = -(d + bd) / 2 + 1, front = (d + bd) / 2 - 1;
  b.box('travertine', w, h, 1.2, 0, h / 2, back);
  for (const side of [-1, 1]) b.box('travertine', 1.2, h, d, side * (w / 2 - 0.6), h / 2, back + d / 2);
  const cols: Placement[] = [];
  for (let tier = 0; tier < 2; tier++) {
    const y = 0.5 + tier * h / 2;
    for (let i = 0; i <= 14; i++) cols.push({ x: -w / 2 + 2 + i * (w - 4) / 14, y, z: back + 1.8 });
    for (const side of [-1, 1]) {
      for (let i = 1; i <= 3; i++) cols.push({ x: side * (w / 2 - 2), y, z: back + 1.8 + i * (d - 2) / 3 });
      b.box('marble', 3, 0.5, d + 1, side * (w / 2 - 1.5), (tier + 1) * h / 2, back + d / 2);
    }
    b.box('marble', w + 1, 0.5, 3.5, 0, (tier + 1) * h / 2, back + 1);
    for (let i = 0; i < 7; i++) b.add('limestone', arch(2.5, h / 2 - 1, 0.25, 0.35), { x: -w / 2 + 5 + i * (w - 10) / 6, y, z: back + 0.8 });
  }
  b.repeated('marble', column(h / 2 - 1, 0.4), cols);
  const basinZ = front - bd / 2;
  b.box('limestone', w - 4, 0.25, bd, 0, 0.125, basinZ);
  b.box('water', w - 5, 0.08, bd - 1, 0, 0.72, basinZ);
  for (const side of [-1, 1]) {
    b.box('travertine', 0.5, 1, bd, side * (w / 2 - 2.25), 0.5, basinZ);
    b.box('travertine', w - 4, 1, 0.5, 0, 0.5, basinZ + side * bd / 2);
  }
  return b.finish();
}
