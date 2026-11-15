import * as THREE from 'three';
import { Building, column, gable } from '../materials';
import type { Placement } from '../materials';
export interface TempleOptions { width?: number; length?: number; podiumHeight?: number; columnHeight?: number; frontColumns?: number; peripteral?: boolean }
/** 20×35m podium, 2.5m high, six 10m front columns. Peripteral by default; stairs face +Z. */
export function createTemple(o: TempleOptions = {}): THREE.Group {
  const { width: w = 20, length: l = 35, podiumHeight: p = 2.5, columnHeight: h = 10, frontColumns: n = 6, peripteral = true } = o;
  const b = new Building('Temple'); b.foundation(w, l); b.box('travertine', w, p, l);
  // podium mouldings: projecting base and crowning cornice
  b.box('travertine', w + 0.6, 0.45, l + 0.6, 0, 0.225);
  b.box('marble', w + 0.5, 0.3, l + 0.5, 0, p - 0.15);
  b.box('marble', w + 0.2, 0.18, l + 0.2, 0, p + 0.09);
  const cols: Placement[] = [];
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 1.8 + i * (w - 3.6) / Math.max(1, n - 1);
    cols.push({ x, y: p, z: l / 2 - 1.8 });
    if (peripteral) cols.push({ x, y: p, z: -l / 2 + 1.8 });
  }
  if (peripteral) for (const side of [-1, 1]) for (let i = 1; i < 10; i++) cols.push({ x: side * (w / 2 - 1.8), y: p, z: -l / 2 + 1.8 + i * (l - 3.6) / 10 });
  b.repeated('marble', column(h, 0.6), cols);
  for (const x of [-w * 0.28, w * 0.28]) b.box('plaster', 0.8, h - 0.3, l * 0.65, x, p + (h - 0.3) / 2, -1);
  b.box('plaster', w * 0.56, h - 0.3, 0.8, 0, p + (h - 0.3) / 2, -1 - l * 0.325);
  for (const side of [-1, 1]) b.box('plaster', w * 0.2, h - 0.3, 0.8, side * w * 0.18, p + (h - 0.3) / 2, -1 + l * 0.325);
  // entablature: architrave, frieze, projecting cornice; marble raking cornices frame the pediments
  b.box('marble', w - 0.2, 0.55, l - 0.2, 0, p + h + 0.275);
  b.box('marble', w - 0.4, 0.5, l - 0.4, 0, p + h + 0.8);
  b.box('marble', w + 0.9, 0.3, l + 0.9, 0, p + h + 1.2);
  b.add('roofTile', gable(w + 1, 4, l + 1), { x: 0, y: p + h + 1.35, z: 0 });
  for (const side of [-1, 1]) b.add('marble', gable(w + 1.3, 4.25, 0.25), { x: 0, y: p + h + 1.3, z: side * (l / 2 + 0.6) });
  const steps = Math.ceil(p / 0.25);
  for (let i = 0; i < steps; i++) b.box('travertine', w * 0.65, p * (i + 1) / steps + 3, 0.4, 0, (p * (i + 1) / steps - 3) / 2, l / 2 + (steps - i - 0.5) * 0.4);
  return b.finish();
}
