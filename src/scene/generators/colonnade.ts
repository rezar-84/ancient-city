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
  b.box('travertine', w, 0.16, l);
  const placements: Placement[] = [], bays = Math.max(1, Math.round(l / spacing)), pitch = l / bays;
  const addTabernaDoor = (side: number, backX: number, doorZ: number, doorW: number) => {
    const inSign = -side; // inward toward the portico is -side
    // Limestone threshold with pivot groove, timber jambs/lintel, and open wooden shop shutter leaves
    b.box('limestone', 0.74, 0.06, doorW + 0.24, backX, 0.38, doorZ);
    for (const s of [-1, 1]) {
      const jz = doorZ + s * (doorW / 2 - 0.06);
      b.box('ground', 0.22, 2.52, 0.12, backX + inSign * 0.22, 0.38 + 1.26, jz);
      // Half-open timber shutter leaf swung neatly along the pier face (never blocking the portico)
      b.box('ground', 0.06, 2.38, 0.58, backX + inSign * 0.35, 0.41 + 1.19, jz + s * 0.28, inSign * s * 0.18);
      b.box('bronze', 0.08, 0.07, 0.54, backX + inSign * 0.35, 0.95, jz + s * 0.28, inSign * s * 0.18);
      b.box('bronze', 0.08, 0.07, 0.54, backX + inSign * 0.35, 2.15, jz + s * 0.28, inSign * s * 0.18);
    }
    b.box('ground', 0.26, 0.16, doorW + 0.28, backX + inSign * 0.22, 2.94, doorZ);
    // Dark recessed shop interior panel behind the doorway so closed insula boxes never show bright seams
    b.box('dark', 0.06, 2.5, doorW - 0.12, backX - inSign * 0.24, 0.38 + 1.25, doorZ);
  };
  for (const side of [-1, 1]) {
    const backX = side * (w / 2 + d);
    b.box('limestone', d, 0.35, l, side * (w / 2 + d / 2));
    for (let i = 0; i <= bays; i++) {
      const bz = -l / 2 + i * pitch, colX = side * (w / 2 + 0.5);
      if (open && open(colX, bz)) continue;
      placements.push({ x: colX, y: 0.35, z: bz });
    }
    const doorW = Math.min(1.5, Math.max(0.9, pitch - Math.max(0.5, pitch - 1.5)));
    // Shop jambs, continuous lintel, and framed taberna doorways in the back wall.
    if (!open) {
      for (let i = 0; i <= bays; i++) b.box('plaster', 0.6, h, Math.max(0.5, pitch - 1.5), backX, h / 2 + 0.35, -l / 2 + i * pitch);
      b.box('plaster', 0.6, h - 2.6, l, backX, 2.95 + (h - 2.6) / 2);
      for (let i = 0; i < bays; i++) addTabernaDoor(side, backX, -l / 2 + (i + 0.5) * pitch, doorW);
    } else {
      // per-bay walls so stretches can open onto a monument or intersecting street behind the portico
      for (let i = 0; i <= bays; i++) {
        const z = -l / 2 + i * pitch;
        const hereOpen = open(backX, z);
        if (!hereOpen) b.box('plaster', 0.6, h, Math.max(0.5, pitch - 1.5), backX, h / 2 + 0.35, z);
        if (i < bays && !hereOpen && !open(backX, z + pitch * 0.5) && !open(backX, z + pitch)) {
          b.box('plaster', 0.6, h - 2.6, pitch, backX, 2.95 + (h - 2.6) / 2, z + pitch / 2);
          addTabernaDoor(side, backX, z + pitch / 2, doorW);
        }
      }
    }
    b.box('marble', 0.8, 0.4, l, side * (w / 2 + 0.5), h + 0.45);
    b.box('roofTile', d + 0.6, 0.35, l + 0.6, side * (w / 2 + d / 2), h + 0.85);
  }
  // Repeated kerbs and paving are shared geometry, not individual draw calls.
  const paving: Placement[] = [];
  for (let z = -l / 2 + 0.75; z < l / 2; z += 1.5) {
    for (let x = -w / 2 + 0.75; x < w / 2; x += 1.5) {
      // Leave central axial cloaca channel and wheel-rut strips slightly recessed for authentic Plateia relief
      const onDrain = Math.abs(x) < 0.45;
      const onRut = Math.abs(Math.abs(x) - 1.69) < 0.35 || Math.abs(Math.abs(x) - 3.11) < 0.35;
      paving.push({ x, y: onDrain ? 0.135 : onRut ? 0.125 : 0.15, z });
    }
  }
  const pavingMesh = b.repeated('travertine', new THREE.BoxGeometry(1.46, 0.08, 1.46), paving);
  if (pavingMesh) { pavingMesh.userData.noShadow = true; pavingMesh.userData.noCollide = true; }
  // Central axial sewer cover slabs (cloaca) with recessed drainage slots
  for (let z = -l / 2 + 1.5; z < l / 2 - 1; z += 3.0) {
    b.box('limestone', 0.78, 0.05, 1.35, 0, 0.165, z);
    b.box('dark', 0.12, 0.02, 0.52, 0, 0.185, z);
  }
  for (const side of [-1, 1]) {
    // Stylobate curb + recessed storm gutter channel along the carriageway edge
    b.box('limestone', 0.32, 0.24, l, side * (w / 2 - 0.16), 0.2);
    b.box('limestone', 0.28, 0.05, l, side * (w / 2 - 0.48), 0.135);
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
