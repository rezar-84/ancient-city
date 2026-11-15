import * as THREE from 'three';
import { Building, column } from '../materials';
import type { Placement } from '../materials';
export interface AgoraOptions { width?: number; length?: number; stoaDepth?: number; columnHeight?: number; spacing?: number }
/** 170×280m paved agora, 10m stoas on west/north/east, open +Z; east (+X) basilica has two storeys. */
export function createAgora(o: AgoraOptions = {}): THREE.Group {
  const { width: w = 170, length: l = 280, stoaDepth: d = 10, columnHeight: h = 7, spacing = 4 } = o;
  const b = new Building('Agora'); b.foundation(w, l); b.box('travertine', w, 0.15, l);
  const cols: Placement[] = [];
  for (const side of [-1, 1]) {
    const tiers = side === 1 ? 2 : 1;
    b.box('limestone', d, 0.4, l, side * (w / 2 - d / 2));
    b.box('plaster', 0.8, tiers * (h + 0.6), l, side * (w / 2 - 0.4), tiers * (h + 0.6) / 2 + 0.4);
    const count = Math.max(1, Math.round((l - 2) / spacing));
    for (let tier = 0; tier < tiers; tier++) {
      for (let i = 0; i <= count; i++) cols.push({ x: side * (w / 2 - d + 0.6), y: 0.4 + tier * (h + 0.6), z: -l / 2 + 1 + i * (l - 2) / count });
      b.box(tier === tiers - 1 ? 'roofTile' : 'travertine', d + 0.5, 0.5, l, side * (w / 2 - d / 2), 0.4 + (tier + 1) * (h + 0.6) - 0.25);
    }
  }
  b.box('plaster', w - 2 * d, h + 0.6, 0.8, 0, h / 2 + 0.7, -l / 2 + 0.4);
  b.box('roofTile', w - 2 * d, 0.5, d, 0, h + 0.75, -l / 2 + d / 2);
  const count = Math.max(1, Math.round((w - 2 * d) / spacing));
  for (let i = 0; i <= count; i++) cols.push({ x: -w / 2 + d + i * (w - 2 * d) / count, y: 0.4, z: -l / 2 + d - 0.6 });
  b.repeated('marble', column(h), cols);
  return b.finish();
}
