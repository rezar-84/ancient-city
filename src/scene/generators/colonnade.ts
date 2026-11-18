import * as THREE from 'three';
import { Building, column } from '../materials';
import type { Placement } from '../materials';
export interface ColonnadedStreetOptions {
  length?: number; carriagewayWidth?: number; porticoDepth?: number; columnHeight?: number; spacing?: number
  /** true where the shop wall should be left out (local x, z of the back wall), e.g. where a monument opens onto the street */
  open?: (x: number, z: number) => boolean
}
/** Z-aligned 300m street, 14m carriageway, 6m side porticoes, 6m columns at ~3.5m spacing. */
export function createColonnadedStreet(o: ColonnadedStreetOptions = {}): THREE.Group {
  const { length: l = 300, carriagewayWidth: w = 14, porticoDepth: d = 6, columnHeight: h = 6, spacing = 3.5, open } = o;
  const b = new Building('Colonnaded Street'); b.foundation(w + 2 * d, l);
  b.box('travertine', w, 0.12, l);
  const placements: Placement[] = [], bays = Math.max(1, Math.round(l / spacing)), pitch = l / bays;
  for (const side of [-1, 1]) {
    const backX = side * (w / 2 + d);
    b.box('limestone', d, 0.35, l, side * (w / 2 + d / 2));
    for (let i = 0; i <= bays; i++) placements.push({ x: side * (w / 2 + 0.5), y: 0.35, z: -l / 2 + i * pitch });
    // Shop jambs and continuous lintel leave open doorways in the back wall.
    if (!open) {
      for (let i = 0; i <= bays; i++) b.box('plaster', 0.6, h, Math.max(0.5, pitch - 1.5), backX, h / 2 + 0.35, -l / 2 + i * pitch);
      b.box('plaster', 0.6, h - 2.6, l, backX, 2.95 + (h - 2.6) / 2);
    } else {
      // per-bay walls so stretches can open onto a monument behind the portico
      for (let i = 0; i <= bays; i++) {
        const z = -l / 2 + i * pitch;
        if (open(backX, z)) continue;
        b.box('plaster', 0.6, h, Math.max(0.5, pitch - 1.5), backX, h / 2 + 0.35, z);
        if (i < bays && !open(backX, z + pitch)) b.box('plaster', 0.6, h - 2.6, pitch, backX, 2.95 + (h - 2.6) / 2, z + pitch / 2);
      }
    }
    b.box('marble', 0.8, 0.4, l, side * (w / 2 + 0.5), h + 0.45);
    b.box('roofTile', d + 0.6, 0.35, l + 0.6, side * (w / 2 + d / 2), h + 0.85);
  }
  // Repeated kerbs and paving are shared geometry, not individual draw calls.
  const paving: Placement[] = [];
  for (let z = -l / 2 + 0.75; z < l / 2; z += 1.5)
    for (let x = -w / 2 + 0.75; x < w / 2; x += 1.5)
      paving.push({ x, y: 0.15, z });
  b.repeated('travertine', new THREE.BoxGeometry(1.46, 0.08, 1.46), paving);
  for (const side of [-1, 1]) {
    b.box('limestone', 0.32, 0.24, l, side * (w / 2 - 0.16), 0.2);
    b.box('marble', 1.1, 0.16, l, side * (w / 2 + 0.5), h + 0.72);
    for (let z = -l / 2 + pitch; z < l / 2; z += pitch * 4) {
      const x = side * (w / 2 + d - 0.7);
      // A bench occupies 2.2 m along the shop wall. Keep its whole span
      // clear where an entrance or monument interrupts the portico.
      const wallX = side * (w / 2 + d);
      if (open && [-1.1, 0, 1.1].some(offset => open(wallX, z + offset))) continue;
      b.box('travertine', 0.65, 0.16, 2.2, x, 0.9, z);
      for (const offset of [-0.7, 0.7]) b.box('limestone', 0.5, 0.5, 0.3, x, 0.57, z + offset);
    }
  }
  b.repeated('marble', column(h), placements);
  return b.finish();
}
