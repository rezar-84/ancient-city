import * as THREE from 'three';
import { Building, arch, column, gable, sector } from '../materials';
import type { Placement } from '../materials';
export interface ChurchOptions { width?: number; length?: number; naveHeight?: number; aisleHeight?: number; apseRadius?: number }
/** Byzantine basilica: 25m wide (Z), 50m long (X), 14m nave and two 8m aisles.
 * Liturgical east/apse is +X, deliberately not -Z. A south porch/entrance faces +Z;
 * a secondary western entrance is at -X. Dimensions exclude the projecting apse and porch.
 */
export function createChurch(o: ChurchOptions = {}): THREE.Group {
  const { width: w = 25, length: l = 50, naveHeight: nh = 14, aisleHeight: ah = 8, apseRadius: r = 6 } = o;
  const b = new Building('Byzantine Church'); b.foundation(l, w);
  b.box('travertine', l, 0.2, w);
  const nave = w * 0.44, cols: Placement[] = [], bays = 10;
  for (const side of [-1, 1]) {
    const z = side * nave / 2;
    for (let i = 0; i <= bays; i++) cols.push({ x: -l / 2 + 1 + i * (l - 2) / bays, y: 0.2, z });
    for (let i = 0; i < bays; i++) {
      const x = -l / 2 + 1 + (i + 0.5) * (l - 2) / bays;
      b.add('plaster', arch((l - 2) / bays - 0.6, 2.6, 0.6, 0.3), { x, y: ah - 2.9, z });
    }
    // Clerestory piers leave a clear band of small windows above the aisles.
    b.box('plaster', l, 1.6, 0.65, 0, ah + 0.8, z);
    for (let i = 0; i <= bays; i++) b.box('plaster', 2, nh - ah - 1.6, 0.65, -l / 2 + i * l / bays, (nh + ah + 1.6) / 2, z);
    const aisleWidth = (w - nave) / 2;
    b.add('roofTile', gable(aisleWidth + 0.5, 1.2, l + 1).rotateY(Math.PI / 2), { x: 0, y: ah, z: side * (nave / 2 + aisleWidth / 2) });
    const outerZ = side * w / 2;
    for (const sign of [-1, 1]) b.box('plaster', (l - 4.6) / 2, ah, 0.7, sign * (l + 4.6) / 4, ah / 2, outerZ);
    b.add('plaster', arch(3, 5, 0.7), { x: 0, y: 0, z: outerZ });
    b.box('plaster', 4.6, ah - 5.8, 0.7, 0, (ah + 5.8) / 2, outerZ);
  }
  b.repeated('marble', column(ah - 2.9), cols);
  b.add('roofTile', gable(nave + 1, 3, l + 1).rotateY(Math.PI / 2), { x: 0, y: nh, z: 0 });
  for (const side of [-1, 1]) {
    const x = side * l / 2;
    const opening = side === 1 ? Math.min(r * 1.5, nave - 1.6) : 3;
    const openingHeight = side === 1 ? ah + 2 : 5;
    b.add('plaster', arch(opening, openingHeight, 0.8), { x, y: 0, z: 0, ry: Math.PI / 2 });
    const flank = (nave - opening - 1.6) / 2;
    for (const sign of [-1, 1]) {
      if (flank > 0) b.box('plaster', 0.8, nh, flank, x, nh / 2, sign * (nave / 2 - flank / 2));
      b.box('plaster', 0.8, ah, (w - nave) / 2, x, ah / 2, sign * (w + nave) / 4);
    }
    b.box('plaster', 0.8, nh - openingHeight - 0.8, opening + 1.6, x, (nh + openingHeight + 0.8) / 2);
    b.add('plaster', gable(nave, 3, 0.8).rotateY(Math.PI / 2), { x, y: nh, z: 0 });
  }
  b.add('limestone', sector(0, r + 0.7, 3.2, 0, Math.PI, 12), { x: l / 2, y: -3, z: 0 });
  b.add('plaster', sector(r, r + 0.7, ah + 1, 0, Math.PI, 12), { x: l / 2, y: 0, z: 0 });
  b.add('roofTile', new THREE.ConeGeometry(r + 1, 3, 12, 1, false, 0, Math.PI), { x: l / 2, y: ah + 2.5, z: 0 });
  b.box('travertine', 8, 3.3, 4, 0, -1.35, w / 2 + 2);
  b.add('roofTile', gable(8, 1.5, 4), { x: 0, y: 5.5, z: w / 2 + 2 });
  b.repeated('marble', column(5.5), [{ x: -3, y: 0.2, z: w / 2 + 3.5 }, { x: 3, y: 0.2, z: w / 2 + 3.5 }]);
  return b.finish();
}
