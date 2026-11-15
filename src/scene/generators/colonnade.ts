import * as THREE from 'three';
import { Building, column } from '../materials';
import type { Placement } from '../materials';
export interface ColonnadedStreetOptions { length?: number; carriagewayWidth?: number; porticoDepth?: number; columnHeight?: number; spacing?: number }
/** Z-aligned 300m street, 14m carriageway, 6m side porticoes, 6m columns at ~3.5m spacing. */
export function createColonnadedStreet(o: ColonnadedStreetOptions = {}): THREE.Group {
  const { length: l = 300, carriagewayWidth: w = 14, porticoDepth: d = 6, columnHeight: h = 6, spacing = 3.5 } = o;
  const b = new Building('Colonnaded Street'); b.foundation(w + 2 * d, l);
  b.box('travertine', w, 0.12, l);
  const placements: Placement[] = [], bays = Math.max(1, Math.round(l / spacing)), pitch = l / bays;
  for (const side of [-1, 1]) {
    const backX = side * (w / 2 + d);
    b.box('limestone', d, 0.35, l, side * (w / 2 + d / 2));
    for (let i = 0; i <= bays; i++) placements.push({ x: side * (w / 2 + 0.5), y: 0.35, z: -l / 2 + i * pitch });
    // Shop jambs and continuous lintel leave open doorways in the back wall.
    for (let i = 0; i <= bays; i++) b.box('plaster', 0.6, h, Math.max(0.5, pitch - 1.5), backX, h / 2 + 0.35, -l / 2 + i * pitch);
    b.box('plaster', 0.6, h - 2.6, l, backX, 2.95 + (h - 2.6) / 2);
    b.box('marble', 0.8, 0.4, l, side * (w / 2 + 0.5), h + 0.45);
    b.box('roofTile', d + 0.6, 0.35, l + 0.6, side * (w / 2 + d / 2), h + 0.85);
  }
  b.repeated('marble', column(h), placements);
  return b.finish();
}
