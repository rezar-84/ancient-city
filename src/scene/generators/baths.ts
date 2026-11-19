import * as THREE from 'three';
import { Building, arch, column, combine } from '../materials';
import type { Placement } from '../materials';
import { createFountainWater } from '../water';
export interface BathsOptions { width?: number; depth?: number; hallHeight?: number; courtDepth?: number; halls?: number }
/** Vaulted Roman bath complex (thermae) with colonnaded palaestra (+Z), interconnected barrel-vaulted halls,
 * Diocletian thermal lunette windows, marble benches, and an interior warm plunge basin (natatio). */
export function createBaths(o: BathsOptions = {}): THREE.Group {
  const { width: w = 70, depth: d = 60, hallHeight: h = 14, courtDepth: court = 30, halls = 3 } = o;
  const b = new Building('Roman Baths'), blockZ = -court / 2, front = (d - court) / 2;
  const totalD = d + court;
  // Deep limestone substructure (11 m) so downhill corners remain grounded on the western terrace slope
  b.box('limestone', w, 11.0, totalD, 0, -5.5);
  // Stepped palaestra flight on +Z descending up to 3.3 m in 0.22 m risers so slope approaches stay walkable
  for (let step = 0; step < 15; step++) {
    const topY = 0.05 - step * 0.22;
    b.box('travertine', Math.min(w * 0.5, 24), topY + 5.0, 0.52, 0, (topY - 5.0) / 2, totalD / 2 + 0.4 + step * 0.46);
  }
  b.box('travertine', w, 0.2, totalD);

  const hw = w / halls, radius = hw / 2 - 0.4, spring = h - radius;
  // Helper to build a longitudinal wall with open arched transverse passages between bathing halls
  const addPartitionWall = (wx: number, isOuter: boolean) => {
    if (isOuter) {
      // Outer side wall with lower masonry dado and high thermal clerestory windows with bronze muntins
      const winBase = Math.min(spring - 2.6, 5.2);
      b.box('limestone', 0.85, winBase, d, wx, winBase / 2, blockZ);
      const winBays = Math.max(3, Math.round(d / 10));
      const bp = d / winBays;
      const winH = Math.max(1.2, spring - winBase - 0.8);
      for (let k = 0; k <= winBays; k++) {
        const wz = blockZ - d / 2 + k * bp;
        b.box('limestone', 0.85, winH, Math.min(bp * 0.52, 4.2), wx, winBase + winH / 2, wz);
        if (k < winBays) {
          // Bronze window muntin grille
          for (const off of [-0.6, 0, 0.6]) b.box('bronze', 0.08, winH, 0.07, wx, winBase + winH / 2, wz + bp / 2 + off);
          b.box('bronze', 0.08, 0.07, bp * 0.46, wx, winBase + winH * 0.5, wz + bp / 2);
        }
      }
      b.box('limestone', 0.85, 0.8, d, wx, spring - 0.4, blockZ);
      return;
    }
    // Internal partition wall pierced by two wide 3.8×5.4 m vaulted passages so visitors walk between all 3 halls
    const passW = 3.8, passH = Math.min(5.4, spring - 1.2);
    const zPasses = d > 28 ? [blockZ - d * 0.22, blockZ + d * 0.22] : [blockZ];
    let cursor = blockZ - d / 2;
    for (const pz of zPasses) {
      const left = pz - (passW + 1.6) / 2;
      if (left > cursor + 0.2) b.box('limestone', 0.8, spring, left - cursor, wx, spring / 2, (cursor + left) / 2);
      b.add('travertine', arch(passW, passH, 0.85, 0.8), { x: wx, y: 0.2, z: pz, ry: Math.PI / 2 });
      const above = spring - passH - 1.0;
      if (above > 0.15) b.box('limestone', 0.8, above, passW + 1.6, wx, 0.2 + passH + 0.8 + above / 2, pz);
      cursor = pz + (passW + 1.6) / 2;
    }
    const endZ = blockZ + d / 2;
    if (endZ > cursor + 0.2) b.box('limestone', 0.8, spring, endZ - cursor, wx, spring / 2, (cursor + endZ) / 2);
  };

  for (let i = 0; i <= halls; i++) {
    addPartitionWall(-w / 2 + i * hw, i === 0 || i === halls);
  }

  for (let i = 0; i < halls; i++) {
    const x = -w / 2 + hw * (i + 0.5);
    // Barrel vault shell
    const s = new THREE.Shape();
    s.moveTo(-radius - 0.5, 0);
    for (let j = 0; j <= 12; j++) { const a = Math.PI - j * Math.PI / 12; s.lineTo((radius + 0.5) * Math.cos(a), (radius + 0.5) * Math.sin(a)); }
    for (let j = 0; j <= 12; j++) { const a = j * Math.PI / 12; s.lineTo(radius * Math.cos(a), radius * Math.sin(a)); }
    s.closePath();
    b.add('roofTile', combine([new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2)]), { x, y: spring, z: blockZ });

    // End walls with true walked-through doorway arch AND semicircular Diocletian thermal lunette window above!
    const end = new THREE.Shape(), doorRadius = Math.min(2.2, hw * 0.22);
    const doorHeight = Math.min(6, h * 0.52), doorSpring = doorHeight - doorRadius;
    end.moveTo(-hw / 2, 0); end.lineTo(-hw / 2, spring);
    for (let j = 0; j <= 12; j++) {
      const a = Math.PI - j * Math.PI / 12;
      end.lineTo(radius * Math.cos(a), spring + radius * Math.sin(a));
    }
    end.lineTo(hw / 2, spring); end.lineTo(hw / 2, 0);
    end.lineTo(doorRadius, 0); end.lineTo(doorRadius, doorSpring);
    for (let j = 1; j <= 10; j++) {
      const a = j * Math.PI / 10;
      end.lineTo(doorRadius * Math.cos(a), doorSpring + doorRadius * Math.sin(a));
    }
    end.lineTo(-doorRadius, 0); end.closePath();
    // Semicircular Diocletian thermal window hole in the upper lunette
    const lunR = Math.min(radius * 0.58, 3.6);
    if (spring + lunR < h - 0.6 && spring > doorHeight + 1.2) {
      const hole = new THREE.Path();
      hole.moveTo(-lunR, spring + 0.4);
      for (let j = 0; j <= 10; j++) {
        const a = Math.PI - j * Math.PI / 10;
        hole.lineTo(lunR * Math.cos(a), spring + 0.4 + lunR * Math.sin(a));
      }
      hole.closePath();
      end.holes.push(hole);
    }
    for (const z of [front, blockZ - d / 2]) {
      b.add('travertine', combine([new THREE.ExtrudeGeometry(end, { depth: 0.85, bevelEnabled: false }).translate(0, 0, -0.425)]), { x, y: 0, z });
      // Bronze vertical mullions in the Diocletian thermal lunette + swung-open bronze-bound timber hall doors
      if (lunR > 1.2) {
        for (const mx of [-lunR * 0.36, lunR * 0.36]) b.box('bronze', 0.09, lunR * 0.9, 0.1, x + mx, spring + 0.4 + lunR * 0.45, z);
      }
      for (const leaf of [-1, 1]) {
        b.box('ground', 0.09, Math.min(4.2, doorSpring), 1.35, x + leaf * (doorRadius - 0.08), Math.min(4.2, doorSpring) / 2 + 0.2, z - Math.sign(z - blockZ) * 0.75);
      }
    }
    // Interior marble apodyterium / tepidarium benches along side walls
    for (const side of [-1, 1]) {
      b.box('marble', 0.65, 0.46, Math.min(8, d * 0.22), x + side * (hw / 2 - 0.9), 0.43, blockZ);
    }
  }

  // Central hall marble-rimmed warm thermal plunge basin (low 0.22 m rim so visitors can step over cleanly)
  const poolW = Math.min(hw * 0.56, 8.4), poolD = Math.min(d * 0.32, 16);
  for (const side of [-1, 1]) {
    b.box('marble', 0.45, 0.24, poolD + 0.9, side * (poolW / 2 + 0.225), 0.32, blockZ);
    b.box('marble', poolW, 0.24, 0.45, 0, 0.32, blockZ + side * (poolD / 2 + 0.225));
  }

  // Palaestra colonnade (+Z court) with open central entrance portal
  const cols: Placement[] = [];
  for (const side of [-1, 1]) {
    b.box('roofTile', 4.2, 0.4, court, side * (w / 2 - 2.1), 5.7, front + court / 2);
    b.box('marble', 0.9, 0.34, court, side * (w / 2 - 3), 5.35, front + court / 2);
    const nC = Math.ceil(court / 4);
    for (let i = 0; i <= nC; i++) cols.push({ x: side * (w / 2 - 3), y: 0.2, z: front + i * court / nC });
  }
  b.repeated('marble', column(5), cols);

  const group = b.finish();
  const bathWater = createFountainWater(poolW, poolD, 0.38);
  bathWater.position.set(0, 0, blockZ);
  bathWater.userData.noShadow = bathWater.userData.noCollide = true;
  group.add(bathWater);
  return group;
}
