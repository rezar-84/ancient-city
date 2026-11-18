import * as THREE from 'three';
import { Building, arch, column, gable, sector } from '../materials';
import type { Placement } from '../materials';
export interface ChurchOptions {
  width?: number; length?: number; naveHeight?: number; aisleHeight?: number; apseRadius?: number;
  /** Include the 1st-c. Roman saddle-roofed travertine tomb chamber venerated inside St Philip's Church (D'Andria 2011). */
  tombChamber?: boolean;
}
/** Byzantine three-aisled basilica: 25m wide (Z), 49–50m long (X), 14m nave and two 8m aisles.
 * Liturgical east/apse is +X. Accessible via western narthex portal (-X) and lateral porches (±Z),
 * with marble templon chancel screen, synthronon apse bench, pierced transenna windows, and polycandela. */
export function createChurch(o: ChurchOptions = {}): THREE.Group {
  const { width: w = 25, length: l = 50, naveHeight: nh = 14, aisleHeight: ah = 8, apseRadius: r = 6, tombChamber = false } = o;
  const b = new Building('Byzantine Church');
  b.box('limestone', l, 8.0, w, 0, -4.0);
  // Stepped flights at western (-X) and north/south (±Z) entrances descending up to 3.0 m in 0.22 m risers
  for (let step = 0; step < 14; step++) {
    const topY = 0.05 - step * 0.22;
    b.box('travertine', 0.52, topY + 5.0, 6.2, -l / 2 - 0.4 - step * 0.46, (topY - 5.0) / 2, 0);
    for (const sz of [-1, 1]) {
      b.box('travertine', 8.4, topY + 5.0, 0.52, 0, (topY - 5.0) / 2, sz * (w / 2 + (sz > 0 ? 4.2 : 0.4) + step * 0.46));
    }
  }
  b.box('travertine', l, 0.2, w);

  const nave = w * 0.44, cols: Placement[] = [], bays = 10;
  for (const side of [-1, 1]) {
    const z = side * nave / 2;
    for (let i = 0; i <= bays; i++) cols.push({ x: -l / 2 + 1 + i * (l - 2) / bays, y: 0.2, z });
    for (let i = 0; i < bays; i++) {
      const x = -l / 2 + 1 + (i + 0.5) * (l - 2) / bays;
      b.add('plaster', arch((l - 2) / bays - 0.6, 2.6, 0.6, 0.3), { x, y: ah - 2.9, z });
      // Hanging bronze polycandelon wheel chandelier suspended in alternating nave bays (high above head clearance)
      if (side === 1 && i % 3 === 1) {
        b.add('bronze', new THREE.TorusGeometry(0.42, 0.025, 5, 12).rotateX(Math.PI / 2), { x, y: 4.15, z: 0 });
        b.box('bronze', 0.02, nh - 4.15, 0.02, x, 4.15 + (nh - 4.15) / 2, 0);
      }
    }
    // Clerestory wall with pierced marble transenna mullions in the window band
    b.box('plaster', l, 1.6, 0.65, 0, ah + 0.8, z);
    const clWinH = nh - ah - 2.2;
    for (let i = 0; i <= bays; i++) {
      const px = -l / 2 + i * l / bays;
      b.box('plaster', 2, clWinH, 0.65, px, ah + 1.6 + clWinH / 2, z);
      if (i < bays) {
        const wx = px + (l / bays) * 0.5;
        b.box('marble', 0.1, clWinH, 0.14, wx, ah + 1.6 + clWinH / 2, z);
        b.box('marble', l / bays - 2.0, 0.1, 0.14, wx, ah + 1.6 + clWinH * 0.5, z);
      }
    }
    b.box('plaster', l, 0.6, 0.65, 0, nh - 0.3, z);

    const aisleWidth = (w - nave) / 2;
    b.add('roofTile', gable(aisleWidth + 0.5, 1.2, l + 1).rotateY(Math.PI / 2), { x: 0, y: ah, z: side * (nave / 2 + aisleWidth / 2) });
    const outerZ = side * w / 2;
    // Outer aisle walls with side entrance arch + arched aisle windows
    for (const sign of [-1, 1]) {
      const segLen = (l - 4.6) / 2, segCenter = sign * (l + 4.6) / 4;
      b.box('plaster', segLen, 2.4, 0.7, segCenter, 1.2, outerZ);
      const wBays = Math.max(2, Math.round(segLen / 5.5)), wp = segLen / wBays;
      for (let k = 0; k <= wBays; k++) {
        const kx = segCenter - segLen / 2 + k * wp;
        b.box('plaster', Math.min(wp * 0.58, 2.8), ah - 3.2, 0.7, kx, 2.4 + (ah - 3.2) / 2, outerZ);
        if (k < wBays) b.box('marble', 0.1, ah - 3.2, 0.16, kx + wp / 2, 2.4 + (ah - 3.2) / 2, outerZ);
      }
      b.box('plaster', segLen, 0.8, 0.7, segCenter, ah - 0.4, outerZ);
    }
    b.add('plaster', arch(3, 5, 0.7), { x: 0, y: 0, z: outerZ });
    b.box('plaster', 4.6, ah - 5.8, 0.7, 0, (ah + 5.8) / 2, outerZ);
    // Open studded timber portal doors folded inside the north/south entrances
    for (const leaf of [-1, 1]) {
      b.box('ground', 0.08, 3.4, 1.25, leaf * 1.38, 1.9, outerZ - side * 0.85);
    }
  }

  b.repeated('marble', column(ah - 2.9), cols);
  b.add('roofTile', gable(nave + 1, 3, l + 1).rotateY(Math.PI / 2), { x: 0, y: nh, z: 0 });

  for (const side of [-1, 1]) {
    const x = side * l / 2;
    const opening = side === 1 ? Math.min(r * 1.5, nave - 1.6) : 3.2;
    const openingHeight = side === 1 ? ah + 2 : 5;
    b.add('plaster', arch(opening, openingHeight, 0.8), { x, y: 0, z: 0, ry: Math.PI / 2 });
    if (side === -1) {
      // Western main portal: marble spolia lintel + open studded double timber doors
      b.box('marble', 0.95, 0.28, opening + 1.2, x, 3.9, 0);
      for (const leaf of [-1, 1]) b.box('ground', 0.08, 3.6, 1.35, x + 0.95, 2.0, leaf * (opening / 2 - 0.1), Math.PI / 2);
    }
    const flank = (nave - opening - 1.6) / 2;
    for (const sign of [-1, 1]) {
      if (flank > 0) b.box('plaster', 0.8, nh, flank, x, nh / 2, sign * (nave / 2 - flank / 2));
      b.box('plaster', 0.8, ah, (w - nave) / 2, x, ah / 2, sign * (w + nave) / 4);
    }
    b.box('plaster', 0.8, nh - openingHeight - 0.8, opening + 1.6, x, (nh + openingHeight + 0.8) / 2);
    b.add('plaster', gable(nave, 3, 0.8).rotateY(Math.PI / 2), { x, y: nh, z: 0 });
  }

  // Eastern liturgical apse (+X) with semicircular synthronon bench, marble altar & templon chancel screen (open 2.4 m royal gate!)
  b.add('limestone', sector(0, r + 0.7, 3.2, 0, Math.PI, 12), { x: l / 2, y: -3, z: 0 });
  b.add('plaster', sector(r, r + 0.7, ah + 1, 0, Math.PI, 12), { x: l / 2, y: 0, z: 0 });
  b.add('marble', sector(r - 1.1, r, 0.55, 0.15, Math.PI - 0.3, 10), { x: l / 2, y: 0.2, z: 0 });
  b.add('roofTile', new THREE.ConeGeometry(r + 1, 3, 12, 1, false, 0, Math.PI), { x: l / 2, y: ah + 2.5, z: 0 });
  // Marble altar table under ciborium & carved templon parapet slabs flanking a clear 2.4 m central sanctuary gate
  b.box('marble', 1.3, 1.0, 1.9, l / 2 - 1.2, 0.7, 0);
  const templonX = l / 2 - 3.6, screenSpan = (nave - 2.8) / 2;
  if (screenSpan > 0.6) {
    for (const sz of [-1, 1]) {
      b.box('marble', 0.16, 1.05, screenSpan, templonX, 0.725, sz * (1.4 + screenSpan / 2));
      b.add('marble', column(2.6, 0.16), { x: templonX, y: 0.2, z: sz * 1.4 });
    }
    b.box('marble', 0.24, 0.22, nave - 0.4, templonX, 2.91, 0);
  }

  // Venerated 1st-century Roman travertine saddle-roofed tomb chamber inside St Philip's Church (D'Andria 2011: 3.5 × 4 m)
  if (tombChamber) {
    const tx = l * 0.16, tz = -nave / 2 - (w - nave) * 0.24;
    b.box('travertine', 4.0, 0.22, 3.5, tx, 0.31, tz);
    b.box('travertine', 4.0, 2.4, 0.32, tx, 1.4, tz - 1.59);
    for (const sx of [-1, 1]) {
      b.box('travertine', 0.32, 2.4, 3.5, tx + sx * 1.84, 1.4, tz);
      b.box('travertine', 1.25, 2.4, 0.32, tx + sx * 1.375, 1.4, tz + 1.59);
    }
    b.box('travertine', 1.5, 0.5, 0.32, tx, 2.35, tz + 1.59);
    b.add('travertine', gable(4.2, 0.95, 3.7).rotateY(Math.PI / 2), { x: tx, y: 2.6, z: tz });
  }

  // South entrance porch (+Z) with flush floor
  b.box('travertine', 8, 3.2, 4, 0, -1.4, w / 2 + 2);
  b.add('roofTile', gable(8, 1.5, 4), { x: 0, y: 5.5, z: w / 2 + 2 });
  b.repeated('marble', column(5.5), [{ x: -3, y: 0.2, z: w / 2 + 3.5 }, { x: 3, y: 0.2, z: w / 2 + 3.5 }]);
  return b.finish();
}
